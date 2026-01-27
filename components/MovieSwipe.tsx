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

const MovieSwipe: React.FC<MovieSwipeProps> = ({ teamId, onClose }) => {
  const { data: session } = useSession();
  const toast = useToast();
  const [movies, setMovies] = useState<SwipeableMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [source, setSource] = useState<'popular' | 'trending' | 'discover'>('popular');
  
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  const isDragging = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Fetch movies for swiping
  const fetchMovies = useCallback(async (page = 1) => {
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
      
      setMovies(prev => [...prev, ...swipeableMovies]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      toast.showError('Failed to load movies');
      setLoading(false);
    }
  }, [teamId, source, toast]);

  useEffect(() => {
    fetchMovies(1);
  }, [fetchMovies]);

  const currentMovie = movies[currentIndex];

  // Handle swipe
  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!currentMovie) return;

    const swipeType = direction === 'right' ? 'like' : 'dislike';
    const tmdbId = currentMovie.id.startsWith('tmdb-') 
      ? parseInt(currentMovie.id.replace('tmdb-', ''))
      : null;

    try {
      const res = await fetch(`/api/teams/${teamId}/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId,
          mediaId: currentMovie.id.startsWith('tmdb-') ? null : currentMovie.id,
          swipeType,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record swipe');
      }

      if (swipeType === 'like') {
        toast.showSuccess(`Liked ${currentMovie.title}! Added to watchlist.`);
      }

      // Move to next movie
      if (currentIndex < movies.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Load more movies
        await fetchMovies(Math.floor(movies.length / 20) + 1);
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      console.error('Error swiping:', error);
      toast.showError('Failed to record swipe');
    }
  }, [currentMovie, teamId, currentIndex, movies.length, fetchMovies, toast]);

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
    setSwiping(false);
    
    // Cancel any pending animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const currentMovieState = movies[currentIndex];
    const x = currentMovieState?.x || 0;
    const threshold = 80; // Reduced threshold for better responsiveness

    // Only check horizontal swipe (left/right)
    if (Math.abs(x) > threshold) {
      if (x > 0) {
        handleSwipe('right');
      } else {
        handleSwipe('left');
      }
    } else {
      // Snap back smoothly
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
      setSwiping(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const currentMovieState = movies[currentIndex];
      const x = currentMovieState?.x || 0;
      const threshold = 80;

      if (Math.abs(x) > threshold) {
        if (x > 0) {
          handleSwipe('right');
        } else {
          handleSwipe('left');
        }
      } else {
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
      setSwiping(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const currentMovieState = movies[currentIndex];
      const x = currentMovieState?.x || 0;
      const threshold = 80;

      if (Math.abs(x) > threshold) {
        if (x > 0) {
          handleSwipe('right');
        } else {
          handleSwipe('left');
        }
      } else {
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

  if (!currentMovie && !loading) {
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
                fetchMovies(1);
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

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSource('popular');
              setMovies([]);
              setCurrentIndex(0);
              fetchMovies(1);
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
              setMovies([]);
              setCurrentIndex(0);
              fetchMovies(1);
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
              setMovies([]);
              setCurrentIndex(0);
              fetchMovies(1);
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
                    
                    {/* Title overlay on poster */}
                    <div className="absolute top-0 left-0 right-0 p-6">
                      <h3 className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] leading-tight">
                        {movie.title.toUpperCase()}
                      </h3>
                    </div>

                    {/* Gradient overlay at bottom of poster */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
                  </div>
                  
                  {/* Movie details section */}
                  <div className="bg-black/95 backdrop-blur-sm p-6 space-y-4">
                    {/* Year, Runtime, Rating */}
                    <div className="flex items-center gap-4 text-sm text-gray-300">
                      {movie.year && <span className="font-medium">{movie.year}</span>}
                      {movie.runtime && (
                        <span className="text-gray-400">• {movie.runtime}</span>
                      )}
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
                            className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-200 border border-white/20"
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

                  {/* Swipe indicators */}
                  {isCurrent && (
                    <>
                      {movie.x > 30 && (
                        <div 
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-4 border-green-500 rounded-2xl p-6 rotate-[-20deg] pointer-events-none transition-opacity duration-200"
                          style={{
                            opacity: Math.min(1, Math.abs(movie.x) / 100),
                            zIndex: 1000,
                          }}
                        >
                          <i className="fa-solid fa-heart text-5xl text-green-500"></i>
                        </div>
                      )}
                      {movie.x < -30 && (
                        <div 
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-4 border-red-500 rounded-2xl p-6 rotate-[20deg] pointer-events-none transition-opacity duration-200"
                          style={{
                            opacity: Math.min(1, Math.abs(movie.x) / 100),
                            zIndex: 1000,
                          }}
                        >
                          <i className="fa-solid fa-xmark text-5xl text-red-500"></i>
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

