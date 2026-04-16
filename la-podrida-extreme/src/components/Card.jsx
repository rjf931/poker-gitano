import React from 'react';

const Card = ({ card, hidden, onClick, selectable, style = {} }) => {
  if (hidden) {
    return (
      <div 
        className="w-20 h-32 md:w-28 md:h-40 rounded-xl bg-blue-800 border-2 border-white flex items-center justify-center card-shadow"
        style={style}
      >
        <div className="w-16 h-28 md:w-24 md:h-36 rounded-lg border border-blue-400 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/argyle.png')]"></div>
      </div>
    );
  }

  // Visual text for suit
  const getSuitIcon = (suit) => {
    switch(suit) {
      case 'Oros': return '🪙';
      case 'Copas': return '🍷';
      case 'Espadas': return '🗡️';
      case 'Bastos': return '🪵';
      default: return '';
    }
  };

  return (
    <div 
      onClick={selectable ? onClick : undefined}
      className={`relative w-20 h-32 md:w-28 md:h-40 rounded-xl bg-white border border-gray-300 card-shadow flex flex-col items-center justify-between p-2 
      ${selectable ? 'cursor-pointer hover:-translate-y-4 transition-transform duration-200 hover:ring-2 ring-yellow-400' : ''}`}
      style={style}
    >
      <div className="absolute top-1 left-2 text-lg font-bold text-gray-800 flex flex-col items-center">
        <span>{card.num}</span>
        <span className="text-sm -mt-1">{getSuitIcon(card.suit)}</span>
      </div>
      
      <div className="flex-1 flex items-center justify-center text-4xl mt-3">
        {getSuitIcon(card.suit)}
      </div>

      <div className="absolute bottom-1 right-2 text-lg font-bold text-gray-800 rotate-180 flex flex-col items-center">
        <span>{card.num}</span>
        <span className="text-sm -mt-1">{getSuitIcon(card.suit)}</span>
      </div>
    </div>
  );
};

export default Card;
