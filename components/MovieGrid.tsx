'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Movie, User } from '@/lib/types';
import RemoveMovieModal from './RemoveMovieModal';
import { useLayoutAnimation } from '@/lib/hooks/useLayoutAnimation';
import { useAnimations } from './AnimationProvider';

// Animated number component for smooth vote count transitions
const AnimatedVoteCount: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setIsAnimating(true);
      // Animate the number change
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
        prevValueRef.current = value;
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value]);

  return (
    <span 
      key={`vote-${value}`}
      className={`${className} transition-all duration-300 ease-out ${
        isAnimating ? 'scale-110 opacity-80' : 'scale-100 opacity-100'
      }`}
    >
      {displayValue > 0 ? `+${displayValue}` : displayValue}
    </span>
  );
};

interface MovieGridProps {
  movies: Movie[];
  onVote?: (id: string) => void; // Legacy support
  onUpvote?: (id: string) => void;
  onDownvote?: (id: string) => void;
  onSchedule: (id: string) => void;
  onSelect: (movie: Movie) => void;
  onRemove?: (id: string) => void; // Remove from queue
  users: User[];
  personalWatchlist?: Movie[];
  isGroupWatchlist?: boolean; // Indicates if this is a group watchlist
  votingMovieId?: string | null; // Track which movie is being voted on
}

// Helper function to get genre color classes
const getGenreColor = (genre: string): string => {
  const genreLower = genre.toLowerCase();
  const colors: Record<string, string> = {
    'action': 'text-red-400',
    'adventure': 'text-orange-400',
    'animation': 'text-pink-400',
    'comedy': 'text-yellow-400',
    'crime': 'text-gray-400',
    'documentary': 'text-cyan-400',
    'drama': 'text-blue-400',
    'family': 'text-green-400',
    'fantasy': 'text-purple-400',
    'history': 'text-amber-400',
    'horror': 'text-red-500',
    'music': 'text-indigo-400',
    'mystery': 'text-slate-400',
    'romance': 'text-rose-400',
    'science fiction': 'text-violet-400',
    'sci-fi': 'text-violet-400',
    'thriller': 'text-emerald-400',
    'war': 'text-stone-400',
    'western': 'text-amber-500',
  };
  
  // Try exact match first
  if (colors[genreLower]) {
    return colors[genreLower];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(colors)) {
    if (genreLower.includes(key) || key.includes(genreLower)) {
      return value;
    }
  }
  
  // Default fallback - use hash of genre name for consistent color
  const hash = genreLower.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const defaultColors = [
    'text-blue-400',
    'text-purple-400',
    'text-pink-400',
    'text-indigo-400',
    'text-cyan-400',
  ];
  return defaultColors[hash % defaultColors.length];
};

const MovieGrid: React.FC<MovieGridProps> = ({ movies, onVote, onUpvote, onDownvote, onSchedule, onSelect, onRemove, users, personalWatchlist = [], isGroupWatchlist = false, votingMovieId = null }) => {
  const { experimentalAnimations } = useAnimations();
  const [movieToRemove, setMovieToRemove] = useState<Movie | null>(null);
  const [imdbRatings, setImdbRatings] = useState<Record<string, number>>({});
  const ratingsFetchedRef = useRef<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Setup layout animation for the grid - animates when movies change
  useLayoutAnimation(gridRef, {
    duration: 600,
    ease: 'easeOutExpo',
  }, [movies.length, movies.map(m => m.id).join(',')]);
  
  // Fetch IMDb ratings for movies that don't have them
  useEffect(() => {
    console.log('MovieGrid useEffect triggered, movies count:', movies.length);
    console.log('Current imdbRatings state:', imdbRatings);
    
    const fetchRatings = async () => {
      // Find movies without IMDb ratings that haven't been fetched yet
      const moviesToFetch = movies.filter(movie => {
        const movieId = movie.id;
        // Skip if already has rating or already fetched
        if (movie.imdbRating || ratingsFetchedRef.current.has(movieId)) {
          return false;
        }
        // Only fetch for TMDB movies (format: tmdb-{id})
        return movieId.startsWith('tmdb-');
      });

      console.log(`Movies to fetch ratings for: ${moviesToFetch.length}`, moviesToFetch.map(m => m.id).slice(0, 5));

      if (moviesToFetch.length === 0) {
        console.log('No movies to fetch ratings for');
        return;
      }

      // Extract TMDB IDs
      const tmdbIds = moviesToFetch.map(movie => {
        const tmdbId = movie.id.replace('tmdb-', '');
        return parseInt(tmdbId, 10);
      }).filter(id => !isNaN(id));

      if (tmdbIds.length === 0) return;

      // Mark as fetched to avoid duplicate requests
      moviesToFetch.forEach(movie => {
        ratingsFetchedRef.current.add(movie.id);
      });

      try {
        console.log(`Fetching IMDb ratings for ${tmdbIds.length} movies:`, tmdbIds.slice(0, 5));
        const response = await fetch('/api/media/imdb-ratings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tmdbIds }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Received IMDb ratings response:', data);
          if (data.ratings && Object.keys(data.ratings).length > 0) {
            console.log(`Setting ${Object.keys(data.ratings).length} IMDb ratings`);
            setImdbRatings(prev => ({ ...prev, ...data.ratings }));
          } else {
            console.warn('No ratings in response:', data);
          }
        } else {
          const errorText = await response.text();
          console.error('Failed to fetch IMDb ratings:', response.status, errorText);
        }
      } catch (error) {
        console.error('Failed to fetch IMDb ratings:', error);
      }
    };

    fetchRatings();
  }, [movies]);
  
  // Helper to get IMDb rating for a movie
  const getImdbRating = (movie: Movie): number | undefined => {
    // First check if movie already has rating
    if (movie.imdbRating) {
      return movie.imdbRating;
    }
    // Then check fetched ratings
    const fetchedRating = imdbRatings[movie.id];
    if (fetchedRating) {
      return fetchedRating;
    }
    return undefined;
  };
  
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
    <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
      {movies.map((movie, idx) => {
        const staggerClass = idx < 5 ? `animate-stagger-${idx + 1}` : 'animate-fade-in';
        const imdbRating = getImdbRating(movie);
        return (
        <div 
          key={`${movie.id}-${idx}`} 
          className={`relative rounded-2xl cursor-pointer group card-hover ${
            experimentalAnimations ? 'card-enter' : staggerClass
          }`}
          onClick={() => onSelect(movie)}
          style={experimentalAnimations ? { animationDelay: `${idx * 30}ms` } : undefined}
        >
          {/* Vote count badge - always visible for group watchlists (Reddit-style score) */}
          {isGroupWatchlist && (movie.votes !== undefined && movie.votes !== 0) && (
            <div 
              key={`badge-${movie.id}-${movie.votes}`}
              className={`absolute top-3 left-3 z-10 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/20 transition-all duration-300 ${
                movie.votes > 0 ? 'bg-[var(--accent-color)]/90' : movie.votes < 0 ? 'bg-red-600/90' : 'bg-gray-600/90'
              }`}
            >
              <i className={`fa-solid ${movie.votes > 0 ? 'fa-arrow-up' : movie.votes < 0 ? 'fa-arrow-down' : 'fa-minus'} text-[10px] text-white transition-all duration-300`}></i>
              <AnimatedVoteCount value={movie.votes} className="text-[10px] font-bold text-white" />
            </div>
          )}

          <div className="aspect-[2/3] overflow-hidden relative rounded-2xl border border-main bg-[#111]">
            {/* Runtime badge overlay - always visible at bottom */}
            <div className="absolute bottom-3 left-3 z-10 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/20 bg-black/60" style={{ bottom: '0.75rem', top: 'auto' }}>
              <i className="fa-solid fa-clock text-[10px] text-white/80"></i>
              <span className="text-[10px] font-bold text-white">
                {movie.runtime && movie.runtime.trim() ? movie.runtime : 'N/A'}
              </span>
            </div>
            {/* Vote buttons - always visible for group watchlists, hover-only for personal */}
            {isGroupWatchlist ? (
              <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* Vote count display - compact version */}
                {(movie.upvotes !== undefined || movie.downvotes !== undefined || movie.votes !== undefined) && (
                  <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1 flex items-center gap-1.5 text-[10px] mb-0.5">
                    <div className="flex items-center gap-0.5">
                      <i className="fa-solid fa-arrow-up text-[9px] text-green-400"></i>
                      <span className="font-bold text-white">{movie.upvotes || 0}</span>
                    </div>
                    {(movie.downvotes || 0) > 0 && (
                      <>
                        <span className="text-white/30">|</span>
                        <div className="flex items-center gap-0.5">
                          <i className="fa-solid fa-arrow-down text-[9px] text-red-400"></i>
                          <span className="font-bold text-white">{movie.downvotes || 0}</span>
                        </div>
                      </>
                    )}
                    {movie.votes !== undefined && (
                      <>
                        <span className="text-white/30">|</span>
                        <span className="font-bold text-accent">
                          {movie.votes > 0 ? '+' : ''}{movie.votes}
                        </span>
                      </>
                    )}
                  </div>
                )}
                
                {/* Upvote button */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (votingMovieId === movie.id) return; // Prevent double clicks
                    if (onUpvote) {
                      onUpvote(movie.id);
                    } else if (onVote) {
                      onVote(movie.id);
                    }
                  }}
                  disabled={votingMovieId === movie.id}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 border shadow-lg hover:scale-105 ${
                    movie.userVote === 'upvote'
                      ? 'bg-[var(--accent-color)]/90 border-[var(--accent-color)]/50'
                      : 'bg-black/60 backdrop-blur-sm border-white/20 hover:bg-[var(--accent-color)]/30'
                  } ${votingMovieId === movie.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={`Upvote ${movie.title}`}
                >
                  <i className={`fa-solid fa-arrow-up text-[11px] ${
                    movie.userVote === 'upvote' ? 'text-white' : 'text-white/70'
                  }`}></i>
                </button>
                
                {/* Downvote button */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (votingMovieId === movie.id) return; // Prevent double clicks
                    if (onDownvote) {
                      onDownvote(movie.id);
                    } else if (onVote) {
                      onVote(movie.id);
                    }
                  }}
                  disabled={votingMovieId === movie.id}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 border shadow-lg hover:scale-105 ${
                    movie.userVote === 'downvote'
                      ? 'bg-red-600/90 border-red-400/50'
                      : 'bg-black/60 backdrop-blur-sm border-white/20 hover:bg-red-600/30'
                  } ${votingMovieId === movie.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={`Downvote ${movie.title}`}
                >
                  <i className={`fa-solid fa-arrow-down text-[11px] ${
                    movie.userVote === 'downvote' ? 'text-white' : 'text-white/70'
                  }`}></i>
                </button>

                {/* Remove button */}
                {onRemove && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMovieToRemove(movie);
                    }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-200 bg-red-600/90 border border-red-400/50 hover:bg-red-600 hover:scale-110"
                    title={`Remove ${movie.title} from queue`}
                  >
                    <i className="fa-solid fa-trash-can text-[11px] text-white"></i>
                  </button>
                )}
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
                  className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-85 transition-all duration-150 hover:scale-105 ${
                    isInWatchlist(movie.id)
                      ? 'bg-[var(--accent-color)] border-2 border-[var(--accent-color)]'
                      : 'bg-black/40 backdrop-blur-sm border-2 border-white/30 hover:bg-[var(--accent-color)]/30 hover:border-[var(--accent-color)]/50'
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
                  className="glass w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-200 hover:scale-110 border-main bg-black/40 backdrop-blur-sm hover:bg-[var(--accent-color)]/20 hover:border-[var(--accent-color)]/30"
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
                className="w-full h-full object-cover animate-image-fade-in transition-opacity duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 animate-image-fade-in">
                <i className="fa-solid fa-image text-gray-600 text-4xl"></i>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-70"></div>
          </div>

          <div className="mt-4 px-1">
            {movie.genre && movie.genre.length > 0 && movie.genre[0] && (
              <div className="flex gap-1 mb-1.5">
                <span className={`text-[9px] uppercase font-black tracking-[0.15em] ${getGenreColor(movie.genre[0])}`}>
                  {movie.genre[0]}
                </span>
              </div>
            )}
            <h3 className="text-sm font-bold leading-tight truncate mb-1 text-main">
              {movie.title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-600 font-medium">
              <span>{movie.year}</span>
              <>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1">
                  <i className="fa-solid fa-star text-yellow-500 text-[9px]"></i>
                  <span>{imdbRating ? imdbRating.toFixed(1) : 'N/A'}</span>
                </span>
              </>
              {isGroupWatchlist && movie.votes !== undefined && movie.votes !== 0 && (
                <>
                  <span className="opacity-30">•</span>
                  <span 
                    key={`inline-${movie.id}-${movie.votes}`}
                    className={`font-bold flex items-center gap-1 transition-all duration-300 ${
                      movie.votes > 0 ? 'text-[var(--accent-color)]' : movie.votes < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    <i className={`fa-solid ${movie.votes > 0 ? 'fa-arrow-up' : 'fa-arrow-down'} text-[9px] transition-all duration-300`}></i>
                    <AnimatedVoteCount value={movie.votes} className="text-[10px]" />
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        );
      })}
      
      {movieToRemove && (
        <RemoveMovieModal
          movie={movieToRemove}
          onClose={() => setMovieToRemove(null)}
          onConfirm={() => {
            if (onRemove) {
              onRemove(movieToRemove.id);
            }
            setMovieToRemove(null);
          }}
        />
      )}
    </div>
  );
};

export default MovieGrid;
