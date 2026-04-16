import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Card from './components/Card';
import { Users, Heart, Crown, ChevronRight, Play, AlertCircle } from 'lucide-react';

const socket = io();

export default function App() {
  const [appState, setAppState] = useState('HOME'); // HOME, LOBBY, PLAYING
  const [gameState, setGameState] = useState(null);
  
  const [playerName, setPlayerName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(null);

  useEffect(() => {
    socket.on('gameStateUpdate', (state) => {
        setGameState(state);
        setMyPlayerId(state.myPlayerId);
        
        if (state.phase === 'LOBBY') setAppState('LOBBY');
        else setAppState('PLAYING');
    });

    return () => {
        socket.off('gameStateUpdate');
    };
  }, []);

  const createRoom = (e) => {
      e.preventDefault();
      if (!playerName.trim()) return;
      socket.emit('create_room', { playerName: playerName.trim() }, (res) => {
          if (res.error) alert(res.error);
      });
  };

  const joinRoom = (e) => {
      e.preventDefault();
      if (!playerName.trim() || !roomIdInput.trim()) return;
      socket.emit('join_room', { roomId: roomIdInput.trim(), playerName: playerName.trim() }, (res) => {
          if (res.error) alert(res.error);
      });
  };

  const startGame = () => {
      if (gameState && gameState.roomId) {
         socket.emit('start_game', { roomId: gameState.roomId });
      } else {
         // Because I forgot to broadcast roomId in the state from backend...
         // Actually wait, let's use global roomId if I saved it. I didn't. 
         // But wait, the backend doesn't inject `roomId` into the gameState sent to clients!
      }
  };

  // Wait, I need roomId for everything. Let me just store it in state when created/joined
  const [roomId, setRoomId] = useState(null);
  const handleCreate = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    socket.emit('create_room', { playerName: playerName.trim() }, (res) => {
        if (!res.error) setRoomId(res.roomId);
        else alert(res.error);
    });
  }
  const handleJoin = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !roomIdInput.trim()) return;
    socket.emit('join_room', { roomId: roomIdInput.trim(), playerName: playerName.trim() }, (res) => {
        if (!res.error) setRoomId(res.roomId);
        else alert(res.error);
    });
  }

  const handleStartGame = () => {
      socket.emit('start_game', { roomId });
  }

  const handleBid = (bidAmount) => {
      socket.emit('place_bid', { roomId, bidAmount });
  };

  const handlePlayCard = (cardIndex) => {
      socket.emit('play_card', { roomId, cardIndex });
  };

  const handleNextRound = () => {
      socket.emit('next_round', { roomId });
  };

  if (!gameState || appState === 'HOME') {
      return (
        <div className="min-h-screen bg-felt flex flex-col items-center justify-center py-8 px-4">
             <div className="flex flex-col items-center w-full max-w-md bg-black/50 p-8 rounded-2xl border border-white/20 backdrop-blur-md shadow-2xl">
                <h1 className="text-5xl font-black text-white mb-2 drop-shadow-lg tracking-tight text-center">
                    LA <span className="text-emerald-400">PODRIDA</span>
                </h1>
                <p className="text-center text-white/70 mb-8 font-medium">ONLINE EXTREME</p>
                
                <input 
                    type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
                    placeholder="Tu nombre" maxLength={12}
                    className="w-full bg-white/10 rounded-lg px-4 py-3 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-emerald-500 mb-6 text-center text-xl font-bold"
                />

                <div className="w-full space-y-4">
                    <button onClick={handleCreate} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition">Crear Sala Nueva</button>
                    <div className="flex items-center gap-2">
                        <div className="h-px bg-white/20 flex-1"></div>
                        <span className="text-white/40 text-sm font-bold">O</span>
                        <div className="h-px bg-white/20 flex-1"></div>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={roomIdInput} onChange={e => setRoomIdInput(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={6} className="bg-white/10 rounded-lg px-4 py-3 text-white text-center font-mono placeholder-white/50 w-full uppercase" />
                        <button onClick={handleJoin} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition">Unirse</button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  const { phase, players, hostId, roundIndex, currentPlayerIndex, cardsPlayed, lastTrickWinner } = gameState;
  const isHost = myPlayerId === hostId;
  const me = players.find(p => p.id === myPlayerId) || {};
  const myTurn = players[currentPlayerIndex]?.id === myPlayerId;
  const cardsDealt = [5, 4, 3, 2, 1, 2, 3, 4, 5][roundIndex] || 0;

  const renderScoreBoard = () => (
    <div className="flex flex-wrap gap-2 justify-center mb-6 w-full max-w-4xl">
      {players.map((p, idx) => (
        <div key={p.id} className={`flex items-center space-x-2 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg border 
            ${idx === currentPlayerIndex && phase !== 'LOBBY' ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-white/10'} 
            ${p.id === myPlayerId ? 'bg-white/10' : ''}
            ${p.isOut ? 'opacity-30' : ''}`}>
          <div className="font-semibold text-white min-w-[60px]">{p.name} {p.id === hostId ? '👑' : ''}</div>
          <div className="flex space-x-1">
            {[...Array(Math.max(0, p.lives))].map((_, i) => <Heart key={i} size={16} fill="#ef4444" color="#ef4444" />)}
          </div>
          {phase !== 'LOBBY' && !p.isOut && (
             <div className="text-yellow-400 text-sm ml-2 bg-yellow-400/20 px-2 min-w-[50px] text-center rounded">
                Bid: {p.bid !== null ? p.bid : '-'} | G: {p.tricksWon}
             </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
      <div className="min-h-screen bg-felt flex flex-col items-center py-8 px-4">
        {phase !== 'LOBBY' && phase !== 'GAME_OVER' && <div className="text-white/50 text-sm tracking-widest mb-2 font-bold uppercase">Código Sala: {roomId} • Ronda {roundIndex + 1} • {cardsDealt} Cartas</div>}
        {phase !== 'LOBBY' && renderScoreBoard()}

        {/* LOBBY */}
        {phase === 'LOBBY' && (
           <div className="flex flex-col items-center w-full max-w-md bg-black/50 p-8 rounded-2xl border border-white/20 backdrop-blur-md shadow-2xl mt-12">
               <div className="text-xl font-bold mb-4">CÓDIGO DE SALA:</div>
               <div className="text-6xl font-mono font-black text-yellow-400 tracking-widest mb-8 bg-black/50 px-6 py-2 rounded-xl border border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.2)] select-all">{roomId}</div>
               
               <div className="w-full space-y-2 mb-8">
                 {players.map(p => (
                   <div key={p.id} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-lg border border-white/10">
                     <span className="font-semibold text-lg">{p.name} {p.id === hostId ? '(Host)' : ''}</span>
                     {p.id === myPlayerId && <span className="text-emerald-400 text-sm font-bold">TÚ</span>}
                   </div>
                 ))}
                 {players.length < 2 && <p className="text-white/40 text-center py-4">Esperando jugadores...</p>}
               </div>

               {isHost ? (
                    <button onClick={handleStartGame} disabled={players.length < 2} className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xl py-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] disabled:opacity-50 flex items-center justify-center gap-2">
                         <Play fill="currentColor" /> INICIAR JUEGO
                    </button>
               ) : (
                    <div className="text-white/50 font-bold animate-pulse">Esperando a que el HOST inicie la partida...</div>
               )}
           </div>
        )}

        {/* BIDDING */}
        {phase === 'BIDDING' && (
            <div className="flex-1 flex flex-col items-center w-full max-w-3xl mt-4">
               {myTurn ? (() => {
                   let blockedBid = -1;
                   let lastBidderIdx = (gameState.startingPlayerIndex + players.length - 1) % players.length;
                   while(players[lastBidderIdx].isOut && lastBidderIdx !== gameState.startingPlayerIndex) {
                       lastBidderIdx = (lastBidderIdx + players.length - 1) % players.length;
                   }
                   if (currentPlayerIndex === lastBidderIdx && cardsDealt !== 1) {
                       const currentSum = players.reduce((sum, p) => sum + (p.bid || 0), 0);
                       blockedBid = cardsDealt - currentSum;
                   }
                   return (
                   <div className="bg-blue-900/40 border border-blue-500/30 rounded-2xl p-6 w-full mb-8 text-center animate-[pop_0.3s_ease-out_1]">
                        <h2 className="text-2xl font-bold mb-4 text-emerald-400">Tu turno: ¿Cuántas bazas vas a ganar?</h2>
                        <div className="flex items-center justify-center space-x-4 mb-2">
                            {[...Array(cardsDealt + 1)].map((_, i) => (
                            <button
                                key={i} onClick={() => handleBid(i)}
                                disabled={i === blockedBid}
                                className={`w-14 h-14 rounded-full text-2xl font-bold flex items-center justify-center ${i === blockedBid ? 'bg-red-900 border-red-500 text-red-300 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'} border-2`}
                            >
                                {cardsDealt === 1 ? (i === 1 ? 'SÍ' : 'NO') : i}
                            </button>
                            ))}
                        </div>
                   </div>
                   );
               })() : (
                   <div className="bg-black/40 border border-white/10 rounded-2xl p-6 w-full mb-8 text-center text-white/50 font-bold text-xl">
                        Turno de apuestas de: <span className="text-yellow-400">{players[currentPlayerIndex]?.name}</span>
                   </div>
               )}

               <p className="text-white/60 mb-4 font-semibold tracking-wider">{cardsDealt === 1 ? 'CARTAS DE LOS DEMÁS (¡No ves la tuya!):' : 'TUS CARTAS:'}</p>
               <div className="flex flex-wrap justify-center gap-2 md:gap-4 lg:gap-6">
                 {cardsDealt === 1 ? (
                    players.filter(p => !p.isOut && p.id !== myPlayerId).map(p => (
                        <div key={p.id} className="flex flex-col items-center">
                            <span className="text-xs font-bold bg-white/20 px-2 rounded mb-1">{p.name}</span>
                            <Card card={p.hand && p.hand[0]} hidden={!p.hand || p.hand[0] === 'HIDDEN'} style={{ transform: 'scale(0.9)' }} />
                        </div>
                    ))
                 ) : (
                    me.hand && me.hand.map((card, i) => (
                      <Card key={i} card={card} hidden={card === 'HIDDEN'} selectable={false} />
                    ))
                 )}
               </div>
            </div>
        )}

        {/* PLAYING & TRICK_END */}
        {(phase === 'PLAYING' || phase === 'TRICK_END') && (
            <div className="flex flex-col flex-1 w-full max-w-5xl items-center relative gap-8 mt-4">
                {/* Oponentes en ronda de 1 carta que pueden verse flotando */}
                {cardsDealt === 1 && (
                    <div className="flex justify-center flex-wrap gap-4 items-end min-h-[160px]">
                        {players.filter(p => p.id !== myPlayerId).map(p => {
                             const played = cardsPlayed.find(c => c.playerId === p.id);
                             const cToShow = played ? played.card : p.hand[0];
                             if (!cToShow || p.isOut) return null;
                             return (
                                 <div key={p.id} className="flex flex-col items-center">
                                    <span className="text-xs font-bold bg-white/20 px-2 rounded mb-1">{p.name}</span>
                                    <Card card={cToShow} hidden={cToShow === 'HIDDEN'} style={{ transform: 'scale(0.8)' }} />
                                 </div>
                             );
                        })}
                    </div>
                )}

                <div className="flex-1 w-full min-h-[250px] bg-black/20 rounded-[40px] border-4 border-emerald-900/50 p-6 flex flex-col items-center justify-center relative shadow-inner">
                    <div className="flex flex-wrap items-center justify-center gap-4 z-10">
                        {cardsPlayed.map((played, i) => {
                             const pName = players.find(p => p.id === played.playerId)?.name || 'Jugador';
                             return (
                                 <div key={i} className="flex flex-col items-center animate-[bounce_0.3s_ease-out_1]">
                                     <span className="text-white/70 mb-2 font-semibold bg-black/40 px-3 py-1 rounded-full text-sm">{pName}</span>
                                     <Card card={played.card} selectable={false} />
                                 </div>
                             )
                        })}
                        {cardsPlayed.length === 0 && <div className="text-white/20 font-bold text-2xl tracking-widest uppercase">Mesa Vacía</div>}
                    </div>

                    {lastTrickWinner && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-[36px] z-50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-in]">
                            <div className="text-center">
                                 <Crown className="mx-auto text-yellow-400 mb-4" size={64} />
                                 <h2 className="text-4xl font-extrabold text-white mb-2">{lastTrickWinner.name} gana la baza!</h2>
                            </div>
                        </div>
                    )}
                </div>

                {/* MY HAND */}
                <div className="w-full flex flex-col items-center pb-8 pt-4">
                    <div className={`mb-4 font-bold text-xl ${myTurn ? 'text-emerald-400 animate-pulse' : 'text-white/40'}`}>
                        {myTurn ? '¡ES TU TURNO DE TIRAR!' : `Esperando a ${players[currentPlayerIndex]?.name}...`}
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 md:gap-4 relative px-4">
                        {me.hand && me.hand.map((card, i) => (
                            <Card 
                                key={i} 
                                card={card} 
                                hidden={card === 'HIDDEN'}
                                selectable={myTurn && phase === 'PLAYING'} 
                                onClick={() => { if(myTurn && phase === 'PLAYING') handlePlayCard(i) }} 
                            />
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* ROUND SCORE */}
        {phase === 'ROUND_SCORE' && (
            <div className="flex flex-col items-center bg-black/60 p-8 rounded-2xl border border-white/20 max-w-2xl w-full text-center mt-12 backdrop-blur">
                <h2 className="text-4xl font-black text-white mb-8">Fin de la Ronda {roundIndex + 1}</h2>
                <div className="w-full space-y-3 mb-8">
                    {players.map(p => {
                        const deviation = Math.abs(p.bid - p.tricksWon);
                        return (
                            <div key={p.id} className="flex bg-white/5 p-4 rounded-xl items-center">
                                <div className="flex-[2] text-left font-bold text-lg">{p.name} {p.id === myPlayerId ? '(TÚ)' : ''}</div>
                                <div className="flex-1 font-mono text-xl text-blue-300">{p.tricksWon}</div>
                                <div className="flex-1 font-mono text-xl text-yellow-300">{p.bid}</div>
                                <div className="flex-1 text-right text-red-500 font-bold text-xl">{deviation > 0 ? `-${deviation} 💔` : '¡Perfecto! 🛡️'}</div>
                            </div>
                        )
                    })}
                </div>
                {isHost ? (
                    <button onClick={handleNextRound} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl py-4 px-12 rounded-xl shadow-lg transition">Siguiente Ronda (Host)</button>
                ) : (
                    <p className="text-white/50 text-xl font-bold animate-pulse">Esperando que el Host avance...</p>
                )}
            </div>
        )}

        {/* GAME OVER */}
        {phase === 'GAME_OVER' && (
            <div className="flex flex-col items-center bg-black/80 p-12 rounded-3xl border border-yellow-500/50 max-w-lg w-full text-center mt-12">
                <Crown className="text-yellow-400 mb-6" size={80} />
                <h1 className="text-5xl font-black text-white mb-4">FIN DEL JUEGO</h1>
                <button onClick={() => window.location.reload()} className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 mt-8">Volver al Inicio</button>
            </div>
        )}
      </div>
  );
}
