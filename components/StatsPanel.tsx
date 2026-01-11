'use client';

import React from 'react';
import { Group, Movie } from '@/lib/types';

interface StatsPanelProps {
  group: Group;
  movies: Movie[];
}

const StatsPanel: React.FC<StatsPanelProps> = ({ group, movies }) => {
  const percentage = Math.round((group.usedHours / group.budgetHours) * 100);
  const topGenre = movies.length > 0 
    ? movies.flatMap(m => m.genre).reduce((acc, g) => {
        acc[g] = (acc[g] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};
    
  // Fixed: explicitly typed entries and handled the potential undefined result of sort/find
  const sortedGenreEntries = Object.entries(topGenre).sort((a, b) => (b[1] as number) - (a[1] as number));
  const sortedGenre = sortedGenreEntries.length > 0 ? sortedGenreEntries[0] : null;

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Watch Capacity</h3>
        <i className="fa-solid fa-circle-info text-gray-500 text-xs"></i>
      </div>
      
      <div className="relative pt-1">
        <div className="flex mb-2 items-center justify-between">
          <div>
            <span className="text-[10px] font-bold inline-block py-1 px-2 uppercase rounded-full text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
              Monthly Budget
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold inline-block text-indigo-400">
              {percentage}%
            </span>
          </div>
        </div>
        <div className="overflow-hidden h-2.5 mb-4 text-xs flex rounded-full bg-white/5">
          <div 
            style={{ width: `${percentage}%` }} 
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 rounded-full transition-all duration-1000"
          ></div>
        </div>
        <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          <span>{group.usedHours}h / {group.budgetHours}h</span>
          <span>Time remaining</span>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-[10px] uppercase font-bold text-gray-600 tracking-[0.2em] mb-4">Group Taste Profile</p>
        
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <i className="fa-solid fa-masks-theater text-indigo-500"></i>
          </div>
          <div>
            <p className="text-sm font-semibold">Main Vibe</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mt-0.5">
              {sortedGenre ? sortedGenre[0] : 'Scanning...'}
            </p>
          </div>
          <div className="ml-auto text-[10px] font-bold text-indigo-400 uppercase">{sortedGenre ? sortedGenre[1] : 0} picks</div>
        </div>
        
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <i className="fa-solid fa-fire text-orange-500"></i>
          </div>
          <div>
            <p className="text-sm font-semibold">Consensus</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mt-0.5">Voting Heatmap</p>
          </div>
          <div className="ml-auto text-[10px] font-bold text-orange-500 uppercase">High</div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
