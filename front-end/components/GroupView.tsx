
import React from 'react';
import { Group, Movie } from '../types';
import MovieGrid from './MovieGrid';

const GroupView: React.FC<{ group: Group, movies: Movie[] }> = ({ group, movies }) => {
  return (
    <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-4xl font-black tracking-tight">{group.name}</h2>
            <span className="px-3 py-1 rounded-full bg-white/5 text-accent text-[10px] font-bold border border-white/10 uppercase tracking-widest">Active Sprint</span>
          </div>
          <p className="text-gray-400 max-w-md">Our shared space for exploring neo-noir and indie gems. We're currently working through the "90's HK Action" cycle.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {group.members.map(m => (
              <img key={m.id} src={m.avatar} className="w-10 h-10 rounded-full border-2 border-[#0a0a0a]" alt={m.name} title={m.name} />
            ))}
          </div>
          <button className="bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-all"><i className="fa-solid fa-gear text-gray-400"></i></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Current Goal</p>
          <h4 className="text-xl font-bold mb-2">Watch 4 more movies</h4>
          <p className="text-xs text-gray-400 mb-6">Only 8 days left in this month's budget cycle.</p>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="w-[65%] h-full bg-accent rounded-full transition-all duration-500"></div>
          </div>
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Next Up</p>
          <div className="flex items-center gap-4">
            <img src={movies[0].poster} className="w-12 h-16 rounded-lg object-cover" alt="Next" />
            <div>
              <h4 className="text-sm font-bold">{movies[0].title}</h4>
              <p className="text-xs text-accent">Jan 12, 8:00 PM</p>
            </div>
          </div>
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col items-center justify-center text-center">
          <button className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-3 hover:scale-110 transition-transform shadow-lg shadow-accent/20">
            <i className="fa-solid fa-play text-white text-xs ml-1"></i>
          </button>
          <h4 className="text-sm font-bold">Start Watch Party</h4>
          <p className="text-[10px] text-gray-500 mt-1">2 members are currently ready</p>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-6">Group Queue</h3>
      <MovieGrid movies={movies} onVote={()=>{}} onSchedule={()=>{}} users={group.members} onSelect={() => {}} />
    </div>
  );
};

export default GroupView;
