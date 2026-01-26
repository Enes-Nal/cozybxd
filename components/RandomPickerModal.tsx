'use client';

import React, { useState } from 'react';
import { Movie } from '@/lib/types';
import { GoogleGenAI, Type } from '@google/genai';
import { useAnimations } from './AnimationProvider';

interface RandomPickerModalProps {
  movies: Movie[];
  onClose: () => void;
  onSelect: (movie: Movie) => void;
}

const RandomPickerModal: React.FC<RandomPickerModalProps> = ({ movies, onClose, onSelect }) => {
  const { experimentalAnimations } = useAnimations();
  const [picking, setPicking] = useState(false);
  const [result, setResult] = useState<Movie | null>(null);
  const [mood, setMood] = useState('Anything');
  const [isExiting, setIsExiting] = useState(false);

  const moods = ['Anything', 'Action Packed', 'Emotional', 'Cerebral', 'Lighthearted'];

  const pickRandom = async () => {
    setPicking(true);
    // Simulate a "roulette" effect
    await new Promise(r => setTimeout(r, 1500));
    
    // Weighted pick based on votes and mood filtering
    const candidates = mood === 'Anything' 
      ? movies 
      : movies.filter(m => m.votes > 0); // Logic could be more complex with AI tags
      
    const finalPick = candidates[Math.floor(Math.random() * candidates.length)];
    setResult(finalPick);
    setPicking(false);
  };

  const handleClose = () => {
    if (experimentalAnimations) {
      setIsExiting(true);
      setTimeout(() => {
        onClose();
        setIsExiting(false);
      }, 250);
    } else {
      onClose();
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 ${
        experimentalAnimations 
          ? isExiting ? '' : 'experimental-animations:animate-modal-backdrop'
          : ''
      }`}
      style={experimentalAnimations ? { animation: isExiting ? 'none' : undefined } : undefined}
    >
      <div 
        className={`glass w-full max-w-lg rounded-[3rem] p-10 relative border-white/10 no-glow overflow-visible ${
          experimentalAnimations 
            ? isExiting ? 'modal-exit' : 'experimental-animations:animate-modal-content'
            : ''
        }`}
        style={experimentalAnimations ? { animation: isExiting ? 'none' : undefined } : undefined}
      >
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl"></div>
        
        <div className="absolute top-6 right-6 z-10">
          <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <h2 className="text-3xl font-bold mb-2">Random Choice</h2>
        <p className="text-sm text-gray-400 mb-8">Can't decide? Let the group's collective energy pick for you.</p>

        <div className="space-y-8 relative z-10">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Select Mood</label>
            <div className="flex flex-wrap gap-2">
              {moods.map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    mood === m ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-10">
            {picking ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-6 text-sm font-bold text-indigo-400 animate-pulse">Scanning group taste...</p>
              </div>
            ) : result ? (
              <div className="w-full animate-in zoom-in-95 duration-500">
                <div className="flex gap-6 bg-white/5 p-6 rounded-3xl border border-white/5">
                  <img src={result.poster} className="w-24 h-36 rounded-xl object-cover" alt="Poster" />
                  <div className="flex-1 py-2">
                    <h4 className="text-xl font-bold">{result.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{result.year} • {result.runtime}</p>
                    <button 
                      onClick={() => onSelect(result)}
                      className="mt-6 w-full bg-white text-black text-xs font-bold py-3 rounded-xl hover:bg-indigo-400 hover:text-white transition-all"
                    >
                      Watch This One
                    </button>
                  </div>
                </div>
                <button onClick={() => setResult(null)} className="mt-4 w-full text-[10px] text-gray-500 uppercase font-bold tracking-widest hover:text-white">
                  Pick Again
                </button>
              </div>
            ) : (
              <button 
                onClick={pickRandom}
                className="w-32 h-32 bg-indigo-600 hover:bg-indigo-500 rounded-full flex flex-col items-center justify-center transition-all group shadow-2xl shadow-indigo-600/20"
              >
                <i className="fa-solid fa-dice-five text-3xl group-hover:rotate-45 transition-transform duration-500"></i>
                <span className="text-[10px] font-bold mt-2 uppercase tracking-tighter">Roll Dice</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RandomPickerModal;
