'use client';

import React from 'react';
import { Movie, User } from '@/lib/types';

interface MovieGridProps {
  movies: Movie[];
  onVote?: (id: string) => void; // Legacy support
  onUpvote?: (id: string) => void;
  onDownvote?: (id: string) => void;
  onSchedule: (id: string) => void;
  onSelect: (movie: Movie) => void;
  users: User[];
  personalWatchlist?: Movie[];
  isGroupWatchlist?: boolean; // Indicates if this is a group watchlist
}

const MovieGrid: React.FC<MovieGridProps> = ({ movies, onVote, onUpvote, onDownvote, onSchedule, onSelect, users, personalWatchlist = [], isGroupWatchlist = false }) => {
  // Helper to check if movie is in personal watchlist
  const isInWatchlist = (movieId: string) => {
    if (!personalWatchlist || personalWatchlist.length === 0) return false;
    
    return personalWatchlist.some(m => {
      // Direct ID match
      if (m.id === movieId) return true;
      
      // Handle TMDB IDs - check if the movie ID matches the watchlist item's ID
      // The watchlist item might have a UUID but the movie in grid has tmdb-{id}
      if (movieId.startsWith('tmdb-')) {
        const tmdbId = movieId.replace('tmdb-', '');
        // Check if watchlist item ID matches tmdb format
        if (m.id === movieId || m.id === `tmdb-${tmdbId}`) return true;
        // Also check if the watchlist item's title matches (fallback)
        // This handles cases where the ID format differs
      }
      
      // Check by title as fallback (less reliable but helps with ID mismatches)
      const currentMovie = movies.find(mov => mov.id === movieId);
      if (currentMovie && m.title === currentMovie.title) return true;
      
      return false;
    });
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
      {movies.map((movie, idx) => (
        <div 
          key={`${movie.id}-${idx}`} 
          className="relative rounded-2xl cursor-pointer" 
          onClick={() => onSelect(movie)}
        >
          {/* Vote count badge - always visible for group watchlists */}
          {isGroupWatchlist && ((movie.upvotes || 0) > 0 || (movie.downvotes || 0) > 0) && (
            <div className="absolute top-3 left-3 z-10 bg-[var(--accent-color)]/90 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/20">
              <i className="fa-solid fa-thumbs-up text-[10px] text-white"></i>
              <span className="text-[10px] font-bold text-white">{movie.upvotes || 0}</span>
              {(movie.downvotes || 0) > 0 && (
                <>
                  <span className="text-[8px] text-white/60">/</span>
                  <i className="fa-solid fa-thumbs-down text-[10px] text-white/60"></i>
                  <span className="text-[10px] font-bold text-white/60">{movie.downvotes || 0}</span>
                </>
              )}
            </div>
          )}

          <div className="aspect-[2/3] overflow-hidden relative rounded-2xl border border-main bg-[#111]">
            {/* Vote buttons - always visible for group watchlists, hover-only for personal */}
            {isGroupWatchlist ? (
              <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Downvote button */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onDownvote) {
                      onDownvote(movie.id);
                    } else if (onVote) {
                      onVote(movie.id);
                    }
                  }}
                  className={`px-2.5 py-2 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform border shadow-lg ${
                    movie.userVote === 'downvote'
                      ? 'bg-red-600/90 border-red-400/50'
                      : 'bg-black/60 backdrop-blur-sm border-white/20'
                  }`}
                  title={`Downvote ${movie.title}`}
                >
                  <i className={`fa-solid fa-thumbs-down text-[10px] ${
                    movie.userVote === 'downvote' ? 'text-white' : 'text-white/70'
                  }`}></i>
                  <span className={`text-[10px] font-bold ${
                    movie.userVote === 'downvote' ? 'text-white' : 'text-white/70'
                  }`}>{movie.downvotes || 0}</span>
                </button>
                
                {/* Upvote button */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onUpvote) {
                      onUpvote(movie.id);
                    } else if (onVote) {
                      onVote(movie.id);
                    }
                  }}
                  className={`px-2.5 py-2 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform border shadow-lg ${
                    movie.userVote === 'upvote'
                      ? 'bg-[var(--accent-color)]/90 border-[var(--accent-color)]/50'
                      : 'bg-black/60 backdrop-blur-sm border-white/20'
                  }`}
                  title={`Upvote ${movie.title}`}
                >
                  <i className={`fa-solid fa-thumbs-up text-[10px] ${
                    movie.userVote === 'upvote' ? 'text-white' : 'text-white/70'
                  }`}></i>
                  <span className={`text-[10px] font-bold ${
                    movie.userVote === 'upvote' ? 'text-white' : 'text-white/70'
                  }`}>{movie.upvotes || 0}</span>
                </button>
              </div>
            ) : (
              <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Personal watchlist: Show heart button */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onVote?.(movie.id);
                  }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-transform ${
                    isInWatchlist(movie.id)
                      ? 'bg-[var(--accent-color)] border-2 border-[var(--accent-color)]'
                      : 'bg-black/40 backdrop-blur-sm border-2 border-white/30'
                  }`}
                  title={isInWatchlist(movie.id) ? "Remove from Personal Watchlist" : "Add to Personal Watchlist"}
                >
                  <i className={`text-[10px] ${
                    isInWatchlist(movie.id)
                      ? 'fa-solid fa-heart text-white'
                      : 'fa-regular fa-heart text-white'
                  }`}></i>
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSchedule(movie.id);
                  }}
                  className="glass w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-transform border-main bg-black/40 backdrop-blur-sm"
                  title="Add to Group Watchlist"
                >
                  <i className="fa-solid fa-plus text-[10px] text-white"></i>
                </button>
              </div>
            )}
            {movie.poster ? (
              <img 
                src={movie.poster} 
                alt={movie.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <i className="fa-solid fa-image text-gray-600 text-4xl"></i>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
          </div>

          <div className="mt-4 px-1">
            <div className="flex gap-1 mb-1.5">
              <span className="text-[9px] uppercase font-black text-gray-500 tracking-[0.15em]">
                {movie.genre[0]}
              </span>
            </div>
            <h3 className="text-sm font-bold leading-tight truncate mb-1 text-main">
              {movie.title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-600 font-medium">
              <span>{movie.year}</span>
              <span className="opacity-30">•</span>
              <span>{movie.runtime}</span>
              {isGroupWatchlist && ((movie.upvotes || 0) > 0 || (movie.downvotes || 0) > 0) && (
                <>
                  <span className="opacity-30">•</span>
                  <span className="text-[var(--accent-color)] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-thumbs-up text-[9px]"></i>
                    {movie.upvotes || 0}
                  </span>
                  {(movie.downvotes || 0) > 0 && (
                    <>
                      <span className="opacity-30">•</span>
                      <span className="text-red-400 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-thumbs-down text-[9px]"></i>
                        {movie.downvotes || 0}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MovieGrid;
