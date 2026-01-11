'use client';

import React from 'react';
import { Movie, User } from '@/lib/types';

interface MovieGridProps {
  movies: Movie[];
  onVote: (id: string) => void;
  onSchedule: (id: string) => void;
  onSelect: (movie: Movie) => void;
  users: User[];
  personalWatchlist?: Movie[];
}

const MovieGrid: React.FC<MovieGridProps> = ({ movies, onVote, onSchedule, onSelect, users, personalWatchlist = [] }) => {
  // Helper to check if movie is in personal watchlist
  const isInWatchlist = (movieId: string) => {
    return personalWatchlist.some(m => {
      // Handle both regular IDs and TMDB IDs
      if (movieId.startsWith('tmdb-')) {
        return m.id === movieId || m.id === `tmdb-${movieId.replace('tmdb-', '')}`;
      }
      return m.id === movieId;
    });
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
      {movies.map((movie, idx) => (
        <div 
          key={`${movie.id}-${idx}`} 
          className="group relative rounded-2xl transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) cursor-pointer hover:-translate-y-2" 
          onClick={() => onSelect(movie)}
        >
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button clicked for movie:', movie.id);
                onVote(movie.id);
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all group/btn ${
                isInWatchlist(movie.id)
                  ? 'bg-[var(--accent-color)] border-2 border-[var(--accent-color)]'
                  : 'bg-transparent border-2 border-white hover:border-white/80'
              }`}
              title={isInWatchlist(movie.id) ? "Remove from Personal Watchlist" : "Add to Personal Watchlist"}
            >
              <i className={`text-[10px] transition-transform ${
                isInWatchlist(movie.id)
                  ? 'fa-solid fa-heart text-white group-hover/btn:scale-125'
                  : 'fa-regular fa-heart text-white group-hover/btn:scale-125'
              }`}></i>
            </button>
            <button 
              onClick={() => onSchedule(movie.id)}
              className="glass w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all border-main group/btn"
              title="Add to Group Watchlist"
            >
              <i className="fa-solid fa-plus text-[10px] group-hover/btn:text-[var(--accent-color)] transition-colors"></i>
            </button>
          </div>

          <div className="aspect-[2/3] overflow-hidden relative rounded-2xl border border-main bg-[#111]">
            <img 
              src={movie.poster} 
              alt={movie.title} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="mt-4 px-1">
            <div className="flex gap-1 mb-1.5">
              <span className="text-[9px] uppercase font-black text-gray-500 tracking-[0.15em]">
                {movie.genre[0]}
              </span>
            </div>
            <h3 className="text-sm font-bold leading-tight group-hover:text-[var(--accent-color)] transition-colors truncate mb-1 text-main">
              {movie.title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-600 font-medium">
              <span>{movie.year}</span>
              <span className="opacity-30">•</span>
              <span>{movie.runtime}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MovieGrid;
