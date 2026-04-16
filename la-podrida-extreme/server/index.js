import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeck, ROUND_SEQUENCE, evaluateTrick } from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// App State
const rooms = new Map(); // roomId -> gameState

const generateRoomId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const getInitialGameState = (hostId) => ({
    phase: 'LOBBY',
    players: [], // { id, socketId, name, lives, hand, bid, tricksWon, isOut }
    hostId: hostId,
    roundIndex: 0,
    startingPlayerIndex: 0,
    trickStarterIndex: 0,
    currentPlayerIndex: 0,
    cardsPlayed: [],
    lastTrickWinner: null
});

const getActivePlayersInOrder = (state, startIndex) => {
    const active = [];
    const n = state.players.length;
    for (let i = 0; i < n; i++) {
      const idx = (startIndex + i) % n;
      if (!state.players[idx].isOut) active.push(idx);
    }
    return active;
};

// Start a round
const startRound = (state, rIndex, startPIndex) => {
    const activePlayers = state.players.filter(p => !p.isOut);
    if (activePlayers.length <= 1 || rIndex >= ROUND_SEQUENCE.length) {
      state.phase = 'GAME_OVER';
      return;
    }

    let actualStartIdx = startPIndex;
    while(state.players[actualStartIdx].isOut) {
      actualStartIdx = (actualStartIdx + 1) % state.players.length;
    }

    const cardsToDeal = ROUND_SEQUENCE[rIndex];
    const deck = createDeck();
    
    state.players.forEach(p => {
        p.hand = p.isOut ? [] : deck.splice(0, cardsToDeal);
        p.bid = null;
        p.tricksWon = 0;
    });

    state.roundIndex = rIndex;
    state.startingPlayerIndex = actualStartIdx;
    state.trickStarterIndex = actualStartIdx;
    state.currentPlayerIndex = actualStartIdx;
    state.cardsPlayed = [];
    state.lastTrickWinner = null;
    
    state.phase = 'BIDDING';
};

// Send safe game state to clients
const broadcastSafeGameState = (roomId) => {
    const state = rooms.get(roomId);
    if (!state) return;
    
    // For each player, send them a customized state where they can't see others' cards
    // UNLESS it's the 1-card round, then they can't see THEIR OWN card, but CAN see others'.
    const cardsDealt = ROUND_SEQUENCE[state.roundIndex];
    const isOneCardRound = cardsDealt === 1;

    state.players.forEach(p => {
        const safeState = JSON.parse(JSON.stringify(state));
        
        safeState.players.forEach(otherP => {
            if (otherP.id !== p.id) {
                // If it's a 1 card round, leave their cards intact so 'p' can see them
                if (!isOneCardRound) {
                   otherP.hand = otherP.hand.map(() => 'HIDDEN');
                }
            } else if (otherP.id === p.id) {
                // Own card rule
                if (isOneCardRound) {
                    otherP.hand = otherP.hand.map(() => 'HIDDEN');
                }
            }
        });

        safeState.myPlayerId = p.id;
        io.to(p.socketId).emit('gameStateUpdate', safeState);
    });
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', ({ playerName }, callback) => {
      const roomId = generateRoomId();
      const playerId = Date.now().toString();
      
      const newGame = getInitialGameState(playerId);
      newGame.players.push({
          id: playerId,
          socketId: socket.id,
          name: playerName,
          lives: 3,
          hand: [], bid: null, tricksWon: 0, isOut: false
      });
      
      rooms.set(roomId, newGame);
      socket.join(roomId);
      
      callback({ roomId, playerId });
      broadcastSafeGameState(roomId);
  });

  socket.on('join_room', ({ roomId, playerName }, callback) => {
      const state = rooms.get(roomId.toUpperCase());
      if (!state) return callback({ error: 'Sala no encontrada' });
      if (state.phase !== 'LOBBY') return callback({ error: 'El juego ya empezó' });
      if (state.players.length >= 8) return callback({ error: 'Sala llena' });

      const playerId = Date.now().toString();
      state.players.push({
          id: playerId,
          socketId: socket.id,
          name: playerName,
          lives: 3,
          hand: [], bid: null, tricksWon: 0, isOut: false
      });
      
      socket.join(roomId.toUpperCase());
      callback({ roomId: roomId.toUpperCase(), playerId });
      broadcastSafeGameState(roomId.toUpperCase());
  });

  socket.on('start_game', ({ roomId }) => {
      const state = rooms.get(roomId);
      if (state && state.phase === 'LOBBY') {
          const randStart = Math.floor(Math.random() * state.players.length);
          startRound(state, 0, randStart);
          broadcastSafeGameState(roomId);
      }
  });

  socket.on('place_bid', ({ roomId, bidAmount }) => {
      const state = rooms.get(roomId);
      if (!state || state.phase !== 'BIDDING') return;
      
      const pIndex = state.currentPlayerIndex;
      if (state.players[pIndex].socketId !== socket.id) return; // not your turn
      
      state.players[pIndex].bid = bidAmount;

      const activeOrder = getActivePlayersInOrder(state, state.startingPlayerIndex);
      const currentIndex = activeOrder.indexOf(pIndex);

      if (currentIndex === activeOrder.length - 1) {
         const currentSum = state.players.reduce((sum, p) => sum + (p.bid || 0), 0);
         const cardsDealt = ROUND_SEQUENCE[state.roundIndex];
         const blocked = cardsDealt - currentSum;
         if (blocked >= 0 && bidAmount === blocked) return; // REJECT BID

         state.phase = 'PLAYING';
         state.trickStarterIndex = state.startingPlayerIndex;
         state.currentPlayerIndex = state.startingPlayerIndex;
      } else {
         state.currentPlayerIndex = activeOrder[currentIndex + 1];
      }
      
      broadcastSafeGameState(roomId);
  });

  socket.on('play_card', ({ roomId, cardIndex }) => {
      const state = rooms.get(roomId);
      if (!state || state.phase !== 'PLAYING') return;
      
      const pIndex = state.currentPlayerIndex;
      const player = state.players[pIndex];
      if (player.socketId !== socket.id) return; // not your turn
      
      const [playedCard] = player.hand.splice(cardIndex, 1);
      state.cardsPlayed.push({ playerId: player.id, card: playedCard });

      const activeOrder = getActivePlayersInOrder(state, state.trickStarterIndex);
      const currentIndex = activeOrder.indexOf(pIndex);

      if (currentIndex === activeOrder.length - 1) {
          state.phase = 'TRICK_END';
          // Eval winner
          const winnerId = evaluateTrick(state.cardsPlayed);
          const winnerIndex = state.players.findIndex(p => p.id === winnerId);
          state.lastTrickWinner = state.players[winnerIndex];
          state.players[winnerIndex].tricksWon += 1;

          // Dispatch visual state before cleaning up
          broadcastSafeGameState(roomId);

          setTimeout(() => {
              state.cardsPlayed = [];
              state.lastTrickWinner = null;
              
              const activeIdx = getActivePlayersInOrder(state, 0)[0];
              if (state.players[activeIdx].hand.length === 0) {
                 state.phase = 'ROUND_SCORE';
              } else {
                 state.trickStarterIndex = state.startingPlayerIndex;
                 state.currentPlayerIndex = state.startingPlayerIndex;
                 state.phase = 'PLAYING';
              }
              broadcastSafeGameState(roomId);
          }, 4000); // 4 seconds trick end delay
      } else {
          state.currentPlayerIndex = activeOrder[currentIndex + 1];
          broadcastSafeGameState(roomId);
      }
  });

  socket.on('next_round', ({ roomId }) => {
      const state = rooms.get(roomId);
      if (!state || state.phase !== 'ROUND_SCORE') return;
      
      // Update lives
      state.players.forEach(p => {
          if (!p.isOut) {
              const deviation = Math.abs(p.bid - p.tricksWon);
              p.lives -= deviation;
              if (p.lives <= 0) p.isOut = true;
          }
      });

      const activeLeft = state.players.filter(p => !p.isOut);
      if (activeLeft.length <= 1) {
          state.phase = 'GAME_OVER';
      } else {
          let nextStart = (state.startingPlayerIndex + 1) % state.players.length;
          startRound(state, state.roundIndex + 1, nextStart);
      }
      broadcastSafeGameState(roomId);
  });

  socket.on('disconnect', () => {
    // Handle disconnect by finding room. For MVP, we skip reconnect logic and let them fail.
  });
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
