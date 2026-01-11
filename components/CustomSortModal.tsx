'use client'


import React, { useState } from 'react';

interface CustomSortModalProps {
  onClose: () => void;
}

const CustomSortModal: React.FC<CustomSortModalProps> = ({ onClose }) => {
  const [selections, setSelections] = useState<string[]>(['rating']);

  const options = [
    { id: 'rating', label: 'Top Rated', icon: 'fa-star', description: 'Prioritize critically acclaimed titles' },
    { id: 'recency', label: 'Freshness', icon: 'fa-calendar', description: 'Show the most recent releases first' },
    { id: 'popularity', label: 'High Engagement', icon: 'fa-fire', description: 'What everyone is watching right now' },
    { id: 'consensus', label: 'Group Faves', icon: 'fa-users', description: 'Movies with the most votes in your group' }
  ];

  const toggleSelection = (id: string) => {
    setSelections(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 overflow-y-auto animate-fade-in">
      <div className="glass w-full max-w-xl rounded-[3rem] p-10 relative border-white/10 my-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 cubic-bezier(0.16, 1, 0.3, 1)">
        <button onClick={onClose} className="absolute top-8 right-10 text-gray-500 hover:text-white transition-all hover:rotate-90">
          <i className="fa-solid fa-xmark text-2xl"></i>
        </button>

        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-white/5 text-accent px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 mb-4">
            <i className="fa-solid fa-sort"></i>
            Custom View
          </div>
          <h2 className="text-3xl font-black">Sort Preferences</h2>
          <p className="text-gray-400 mt-2 text-sm">Select the factors that matter most for tonight's watch.</p>
        </div>

        <div className="space-y-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggleSelection(opt.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left ${
                selections.includes(opt.id) 
                  ? 'bg-white/5 border-accent/40 scale-[1.02]' 
                  : 'bg-transparent border-white/5 hover:bg-white/[0.02]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                selections.includes(opt.id) ? 'bg-accent text-white' : 'bg-white/5 text-gray-500'
              }`}>
                <i className={`fa-solid ${opt.icon}`}></i>
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold transition-colors ${selections.includes(opt.id) ? 'text-white' : 'text-gray-400'}`}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-gray-600 font-medium uppercase tracking-tighter">
                  {opt.description}
                </p>
              </div>
              {selections.includes(opt.id) && (
                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center animate-in zoom-in">
                  <i className="fa-solid fa-check text-[10px] text-white"></i>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-12 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-accent text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20"
          >
            Update Sort
          </button>
          <button 
            className="px-8 glass hover:bg-white/5 text-gray-400 hover:text-white font-bold rounded-2xl active:scale-95 transition-all text-xs border-white/5"
          >
            Save Preset
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomSortModal;
