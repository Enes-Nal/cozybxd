'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Movie } from '@/lib/types';
import { useToast } from './Toast';

interface MovieSwipeProps {
  teamId: string;
  onClose?: () => void;
}

interface SwipeableMovie extends Movie {
  x: number;
  y: number;
  rotation: number;
}

// Helper function to get genre color classes
const getGenreColor = (genre: string): string => {
  const genreLower = genre.toLowerCase();
  const colors: Record<string, string> = {
    'action': 'bg-red-500/10 border-red-500/30 text-red-400',
    'adventure': 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    'animation': 'bg-pink-500/10 border-pink-500/30 text-pink-400',
    'comedy': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    'crime': 'bg-gray-500/10 border-gray-500/30 text-gray-400',
    'documentary': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    'drama': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    'family': 'bg-green-500/10 border-green-500/30 text-green-400',
    'fantasy': 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    'history': 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    'horror': 'bg-red-600/10 border-red-600/30 text-red-500',
    'music': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    'mystery': 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    'romance': 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    'science fiction': 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    'sci-fi': 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    'thriller': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    'war': 'bg-stone-500/10 border-stone-500/30 text-stone-400',
    'western': 'bg-amber-600/10 border-amber-600/30 text-amber-500',
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
    'bg-blue-500/10 border-blue-500/30 text-blue-400',
    'bg-purple-500/10 border-purple-500/30 text-purple-400',
    'bg-pink-500/10 border-pink-500/30 text-pink-400',
    'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  ];
  return defaultColors[hash % defaultColors.length];
};

const MovieSwipe: React.FC<MovieSwipeProps> = ({ teamId, onClose }) => {
  const { data: session } = useSession();
  const toast = useToast();
  const [movies, setMovies] = useState<SwipeableMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [source, setSource] = useState<'popular' | 'trending' | 'discover'>('popular');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1000);
  const [consecutiveEmptyPages, setConsecutiveEmptyPages] = useState(0);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  const isDragging = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const consecutiveEmptyPagesRef = useRef(0);

  // Fetch movies for swiping
  const fetchMovies = useCallback(async (page = 1, autoFetchNext = false) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teams/${teamId}/swipe?page=${page}&source=${source}`);
      if (!res.ok) throw new Error('Failed to fetch movies');
      const data = await res.json();
      
      const swipeableMovies: SwipeableMovie[] = data.movies.map((movie: Movie) => ({
        ...movie,
        x: 0,
        y: 0,
        rotation: 0,
      }));
      
      // Update pagination info
      if (data.currentPage !== undefined) {
        setCurrentPage(data.currentPage);
      }
      if (data.totalPages !== undefined) {
        setTotalPages(data.totalPages);
      }
      
      // If we got movies, reset consecutive empty pages counter
      if (swipeableMovies.length > 0) {
        consecutiveEmptyPagesRef.current = 0;
        setConsecutiveEmptyPages(0);
        setMovies(prev => [...prev, ...swipeableMovies]);
      } else {
        // No movies returned - increment empty pages counter
        const newEmptyCount = consecutiveEmptyPagesRef.current + 1;
        consecutiveEmptyPagesRef.current = newEmptyCount;
        setConsecutiveEmptyPages(newEmptyCount);
        
        // If we have more pages and haven't hit too many consecutive empty pages, fetch next page
        if (autoFetchNext && data.hasMore && page < (data.totalPages || 1000) && newEmptyCount < 5) {
          // Fetch next page automatically
          setTimeout(() => {
            fetchMovies(page + 1, true).catch(console.error);
          }, 100);
        } else {
          // Only add empty array if we're not auto-fetching
          setMovies(prev => [...prev, ...swipeableMovies]);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      toast.showError('Failed to load movies');
      setLoading(false);
    }
  }, [teamId, source, toast]);

  useEffect(() => {
    setMovies([]);
    setCurrentIndex(0);
    setCurrentPage(1);
    consecutiveEmptyPagesRef.current = 0;
    setConsecutiveEmptyPages(0);
    fetchMovies(1, true);
  }, [source, fetchMovies]); // Re-fetch when source or fetchMovies changes

  const currentMovie = movies[currentIndex];

  // Handle swipe - optimized for immediate UI response
  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!currentMovie) return;

    const swipeType = direction === 'right' ? 'like' : 'dislike';
    const tmdbId = currentMovie.id.startsWith('tmdb-') 
      ? parseInt(currentMovie.id.replace('tmdb-', ''))
      : null;

    // Optimistically move to next movie immediately for smooth UX
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < movies.length) {
      setCurrentIndex(nextIndex);
    } else {
      // Load more movies in background - fetch next page
      const nextPage = currentPage + 1;
      if (nextPage <= totalPages) {
        fetchMovies(nextPage, true).catch(console.error);
      }
      setCurrentIndex(nextIndex);
    }

    // Reset current card position immediately
    setMovies(prev => prev.map((m, i) => 
      i === currentIndex 
        ? { ...m, x: 0, y: 0, rotation: 0 }
        : m
    ));

    // Make API call in background (non-blocking, silent - no UI feedback)
    fetch(`/api/teams/${teamId}/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId,
        mediaId: currentMovie.id.startsWith('tmdb-') ? null : currentMovie.id,
        swipeType,
      }),
    })
      .catch(error => {
        // Silently log errors in background - no user-facing notifications
        console.error('Error swiping:', error);
      });
  }, [currentMovie, teamId, currentIndex, movies.length, currentPage, totalPages, fetchMovies]);

  // Smooth swipe handlers with global event listeners
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (!cardRef.current || !currentMovie) return;
    isDragging.current = true;
    setSwiping(true);
    
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startX.current = clientX;
    startY.current = clientY;
    
    // Get current offset from state
    const currentMovieState = movies[currentIndex];
    offsetX.current = currentMovieState?.x || 0;
    offsetY.current = currentMovieState?.y || 0;
  }, [currentMovie, currentIndex, movies]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging.current || !currentMovie) return;

    const deltaX = clientX - startX.current;
    const deltaY = clientY - startY.current;
    
    const newX = offsetX.current + deltaX;
    const newY = offsetY.current + deltaY;
    const rotation = newX * 0.1; // Rotation based on horizontal movement
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      setMovies(prev => prev.map((m, i) => 
        i === currentIndex 
          ? { ...m, x: newX, y: newY, rotation }
          : m
      ));
    });
  }, [currentMovie, currentIndex]);

  const handleEnd = useCallback(() => {
    if (!isDragging.current || !currentMovie) return;
    
    isDragging.current = false;
    
    // Cancel any pending animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const currentMovieState = movies[currentIndex];
    const x = currentMovieState?.x || 0;
    const threshold = 80; // Reduced threshold for better responsiveness

    // Only check horizontal swipe (left/right)
    if (Math.abs(x) > threshold) {
      // Immediately hide swiping state and trigger swipe
      setSwiping(false);
      if (x > 0) {
        handleSwipe('right');
      } else {
        handleSwipe('left');
      }
    } else {
      // Snap back smoothly
      setSwiping(false);
      setMovies(prev => prev.map((m, i) => 
        i === currentIndex 
          ? { ...m, x: 0, y: 0, rotation: 0 }
          : m
      ));
    }
  }, [currentMovie, currentIndex, movies, handleSwipe]);

  // Global event listeners for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !currentMovie) return;
      e.preventDefault();

      const deltaX = e.clientX - startX.current;
      const deltaY = e.clientY - startY.current;
      
      const newX = offsetX.current + deltaX;
      const newY = offsetY.current + deltaY;
      const rotation = newX * 0.1;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(() => {
        setMovies(prev => prev.map((m, i) => 
          i === currentIndex 
            ? { ...m, x: newX, y: newY, rotation }
            : m
        ));
      });
    };

    const handleGlobalMouseUp = () => {
      if (!isDragging.current || !currentMovie) return;
      
      isDragging.current = false;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const currentMovieState = movies[currentIndex];
      const x = currentMovieState?.x || 0;
      const threshold = 80;

      if (Math.abs(x) > threshold) {
        setSwiping(false);
        if (x > 0) {
          handleSwipe('right');
        } else {
          handleSwipe('left');
        }
      } else {
        setSwiping(false);
        setMovies(prev => prev.map((m, i) => 
          i === currentIndex 
            ? { ...m, x: 0, y: 0, rotation: 0 }
            : m
        ));
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !currentMovie || !e.touches[0]) return;
      e.preventDefault();

      const deltaX = e.touches[0].clientX - startX.current;
      const deltaY = e.touches[0].clientY - startY.current;
      
      const newX = offsetX.current + deltaX;
      const newY = offsetY.current + deltaY;
      const rotation = newX * 0.1;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(() => {
        setMovies(prev => prev.map((m, i) => 
          i === currentIndex 
            ? { ...m, x: newX, y: newY, rotation }
            : m
        ));
      });
    };

    const handleGlobalTouchEnd = () => {
      if (!isDragging.current || !currentMovie) return;
      
      isDragging.current = false;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const currentMovieState = movies[currentIndex];
      const x = currentMovieState?.x || 0;
      const threshold = 80;

      if (Math.abs(x) > threshold) {
        setSwiping(false);
        if (x > 0) {
          handleSwipe('right');
        } else {
          handleSwipe('left');
        }
      } else {
        setSwiping(false);
        setMovies(prev => prev.map((m, i) => 
          i === currentIndex 
            ? { ...m, x: 0, y: 0, rotation: 0 }
            : m
        ));
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentMovie, currentIndex, movies, handleSwipe]);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleStart(e.clientX, e.clientY);
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  // Button handlers
  const handleDislike = () => {
    handleSwipe('left');
  };

  const handleLike = () => {
    handleSwipe('right');
  };

  if (loading && movies.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading movies...</p>
        </div>
      </div>
    );
  }

  // Only show "No more movies!" if we've exhausted pages or hit too many consecutive empty pages
  const shouldShowNoMore = !currentMovie && !loading && 
    (currentPage >= totalPages || consecutiveEmptyPages >= 5);
  
  if (shouldShowNoMore) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">No more movies!</h2>
          <p className="text-gray-400 mb-6">You've swiped through all available movies.</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setMovies([]);
                setCurrentIndex(0);
                setCurrentPage(1);
                consecutiveEmptyPagesRef.current = 0;
                setConsecutiveEmptyPages(0);
                fetchMovies(1, true);
              }}
              className="bg-accent hover:bg-accent/80 px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Try Different Source
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="bg-white/5 hover:bg-white/10 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Show loading if we're fetching more movies
  if (!currentMovie && loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading more movies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSource('popular');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              source === 'popular' 
                ? 'bg-accent text-black' 
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Popular
          </button>
          <button
            onClick={() => {
              setSource('trending');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              source === 'trending' 
                ? 'bg-accent text-black' 
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Trending
          </button>
          <button
            onClick={() => {
              setSource('discover');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              source === 'discover' 
                ? 'bg-accent text-black' 
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Discover
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        )}
      </div>

      <div className="flex items-center justify-center h-full p-4 md:p-8 pt-20 pb-24">
        <div ref={containerRef} className="relative w-full max-w-sm h-[70vh]">
          {/* Stack of cards */}
          {movies.slice(currentIndex, currentIndex + 3).map((movie, index) => {
            const isCurrent = index === 0;
            const cardIndex = currentIndex + index;
            const zIndex = 100 - index;
            const scale = 1 - index * 0.03;
            const yOffset = index * 8;

            return (
              <div
                key={cardIndex}
                ref={isCurrent ? cardRef : null}
                className={`absolute w-full h-full rounded-[2rem] overflow-hidden ${
                  isCurrent 
                    ? 'cursor-grab active:cursor-grabbing' 
                    : 'pointer-events-none'
                } ${isCurrent && !isDragging.current ? 'transition-transform duration-300 ease-out' : ''}`}
                style={{
                  zIndex,
                  transform: isCurrent
                    ? `translate3d(${movie.x}px, ${movie.y}px, 0) rotate(${movie.rotation}deg) scale(${scale})`
                    : `translate3d(0, ${yOffset}px, 0) scale(${scale})`,
                  opacity: isCurrent ? 1 : Math.max(0.4, 0.8 - index * 0.15),
                  willChange: isCurrent ? 'transform' : 'auto',
                }}
                onMouseDown={isCurrent ? onMouseDown : undefined}
                onTouchStart={isCurrent ? onTouchStart : undefined}
              >
                <div className="relative w-full h-full flex flex-col">
                  {/* Poster section with title overlay */}
                  <div className="relative flex-1 min-h-0">
                    {movie.poster ? (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <i className="fa-solid fa-film text-6xl text-gray-500"></i>
                      </div>
                    )}

                    {/* Runtime at top right */}
                    {movie.runtime && (
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <span className="text-xs text-white font-medium">{movie.runtime}</span>
                      </div>
                    )}

                    {/* Gradient overlay at bottom of poster */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
                  </div>
                  
                  {/* Movie details section */}
                  <div className="bg-black/95 backdrop-blur-sm p-6 space-y-4">
                    {/* Title */}
                    <h3 className="text-lg md:text-xl font-black text-white leading-tight truncate">
                      {movie.title.toUpperCase()}
                    </h3>

                    {/* Year, Rating */}
                    <div className="flex items-center gap-4 text-sm text-gray-300">
                      {movie.year && <span className="font-medium">{movie.year}</span>}
                      {movie.imdbRating && (
                        <span className="flex items-center gap-1 ml-auto">
                          <i className="fa-solid fa-star text-yellow-400 text-xs"></i>
                          <span className="font-semibold">{movie.imdbRating.toFixed(1)}</span>
                        </span>
                      )}
                    </div>

                    {/* Genres */}
                    {movie.genre && movie.genre.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {movie.genre.slice(0, 3).map((g, i) => (
                          <span
                            key={i}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getGenreColor(g)}`}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {movie.description && (
                      <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                        {movie.description}
                      </p>
                    )}
                  </div>

                  {/* Full-card swipe overlays */}
                  {isCurrent && (
                    <>
                      {/* Green overlay when swiping right */}
                      {movie.x > 30 && (
                        <div 
                          className="absolute inset-0 bg-green-500/40 rounded-[2rem] pointer-events-none transition-opacity duration-200"
                          style={{
                            opacity: Math.min(0.6, Math.abs(movie.x) / 150),
                            zIndex: 50,
                          }}
                        />
                      )}
                      {/* Red overlay when swiping left */}
                      {movie.x < -30 && (
                        <div 
                          className="absolute inset-0 bg-red-500/40 rounded-[2rem] pointer-events-none transition-opacity duration-200"
                          style={{
                            opacity: Math.min(0.6, Math.abs(movie.x) / 150),
                            zIndex: 50,
                          }}
                        />
                      )}
                    </>
                  )}

                  {/* Swipe indicators */}
                  {isCurrent && (
                    <>
                      {movie.x > 30 && (
                        <div 
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-200 flex items-center justify-center"
                          style={{
                            opacity: Math.min(1, Math.abs(movie.x) / 100),
                            zIndex: 1000,
                          }}
                        >
                          <i className="fa-solid fa-heart text-5xl text-white rotate-[-20deg]"></i>
                        </div>
                      )}
                      {movie.x < -30 && (
                        <div 
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-200 flex items-center justify-center"
                          style={{
                            opacity: Math.min(1, Math.abs(movie.x) / 100),
                            zIndex: 1000,
                          }}
                        >
                          <i className="fa-solid fa-xmark text-5xl text-white rotate-[20deg]"></i>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-12 z-[150] pointer-events-none">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!swiping) handleDislike();
          }}
          disabled={!currentMovie || swiping}
          className="w-20 h-20 rounded-full bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 shadow-lg hover:shadow-red-500/20 pointer-events-auto"
          title="Dislike"
        >
          <i className="fa-solid fa-xmark text-3xl text-red-400"></i>
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!swiping) handleLike();
          }}
          disabled={!currentMovie || swiping}
          className="w-20 h-20 rounded-full bg-green-500/20 hover:bg-green-500/30 border-2 border-green-500 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 shadow-lg hover:shadow-green-500/20 pointer-events-auto"
          title="Like"
        >
          <i className="fa-solid fa-heart text-3xl text-green-400"></i>
        </button>
      </div>
    </div>
  );
};

export default MovieSwipe;

