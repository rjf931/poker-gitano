// Constants for the deck
export const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
export const NUMBERS = [1, 12, 11, 10, 7, 6, 5, 4, 3, 2];

export const getCardPower = (num) => {
  if (num === 1) return 14;
  return num;
};

export const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const num of NUMBERS) {
      deck.push({
        id: `${num}-${suit}`,
        suit,
        num,
        power: getCardPower(num)
      });
    }
  }
  return shuffle(deck);
};

export const shuffle = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const ROUND_SEQUENCE = [5, 4, 3, 2, 1, 2, 3, 4, 5];

export const evaluateTrick = (cardsPlayed) => {
  if (cardsPlayed.length === 0) return null;
  let winningPlay = cardsPlayed[0];
  for (let i = 1; i < cardsPlayed.length; i++) {
    const play = cardsPlayed[i];
    if (play.card.power > winningPlay.card.power) {
      winningPlay = play;
    }
  }
  return winningPlay.playerId;
};
