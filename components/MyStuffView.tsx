'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Movie } from '@/lib/types';
import { useToast } from './Toast';
import { useLayoutAnimation } from '@/lib/hooks/useLayoutAnimation';
import { TMDBMovie } from '@/lib/api/tmdb';
import { transformTMDBMovieToMovieSync, transformYouTubeVideoToMovie } from '@/lib/utils/transformers';
import { getGenres } from '@/lib/api/tmdb';

const AddMovieModal: React.FC<{ onClose: () => void; onAdd: (movie: Movie) => void; onError: (message: string) => void }> = ({ onClose, onAdd, onError }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch genres for transformation
  const { data: genres } = useQuery<Map<number, string>>({
    queryKey: ['genres'],
    queryFn: async () => {
      const genreList = await getGenres();
      return new Map(genreList.map(g => [g.id, g.name]));
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch search results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['addMovieSearch', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      
      const data = await res.json();
      
      if (data.type === 'movie' && data.results) {
        if (genres && genres instanceof Map && genres.size > 0) {
          return data.results.map((tmdbMovie: TMDBMovie) => 
            transformTMDBMovieToMovieSync(tmdbMovie, genres)
          );
        } else {
          return data.results.map((tmdbMovie: TMDBMovie) => ({
            id: `tmdb-${tmdbMovie.id}`,
            title: tmdbMovie.title,
            poster: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : '',
            year: tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : new Date().getFullYear(),
            runtime: tmdbMovie.runtime ? `${Math.floor(tmdbMovie.runtime / 60)}h ${tmdbMovie.runtime % 60}m` : '',
            genre: [],
            description: tmdbMovie.overview,
            priority: 'Low' as const,
            status: 'Watchlist' as const,
            votes: 0,
            upvotes: 0,
            downvotes: 0,
            userVote: null,
            seenBy: [],
            availability: [],
          }));
        }
      }
      
      if (data.type === 'youtube' && data.data) {
        return [transformYouTubeVideoToMovie(data.data)];
      }
      
      return [];
    },
    enabled: debouncedQuery.trim().length > 0 && (genres !== undefined || debouncedQuery.includes('youtube.com') || debouncedQuery.includes('youtu.be')),
  });

  const handleAddMovie = async (movie: Movie) => {
    try {
      // Sync media if needed (for TMDB movies)
      let mediaId = movie.id;
      if (movie.id.startsWith('tmdb-')) {
        const tmdbId = movie.id.replace('tmdb-', '');
        const syncRes = await fetch('/api/media/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId: parseInt(tmdbId), type: 'movie' }),
        });
        if (syncRes.ok) {
          const syncedMedia = await syncRes.json();
          mediaId = syncedMedia.id;
        }
      }

      // Add to watchlist
      const addRes = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      });

      if (!addRes.ok) {
        const errorData = await addRes.json().catch(() => ({ error: 'Failed to add' }));
        throw new Error(errorData.error || 'Failed to add to watchlist');
      }

      const addedMovie = await addRes.json();
      onAdd(addedMovie);
      onClose();
    } catch (error) {
      console.error('Error adding movie:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add movie to watchlist';
      onError(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-10 relative border-white/10 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose} 
          className="absolute top-6 sm:top-8 right-6 sm:right-8 text-gray-500 hover:text-white active:scale-90 transition-all duration-200 hover:rotate-90"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <h2 className="text-xl sm:text-2xl font-black mb-2">Add Movie to Watchlist</h2>
        <p className="text-xs sm:text-sm text-gray-400 mb-6">Search for a movie to add to your watchlist.</p>

        <div className="relative mb-6">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies, YouTube videos, or paste IMDB/YouTube URLs..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 text-sm">Searching...</div>
            </div>
          )}

          {!isSearching && debouncedQuery.trim() && searchResults && searchResults.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 text-sm">No results found</div>
            </div>
          )}

          {!isSearching && searchResults && searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((movie: Movie) => (
                <button
                  key={movie.id}
                  onClick={() => handleAddMovie(movie)}
                  className="w-full glass rounded-xl p-4 flex gap-4 hover:border-accent/40 transition-all text-left group"
                >
                  {movie.poster ? (
                    <img 
                      src={movie.poster} 
                      className="w-16 h-24 rounded-lg object-cover flex-shrink-0" 
                      alt={movie.title} 
                    />
                  ) : (
                    <div className="w-16 h-24 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-image text-gray-600"></i>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-sm text-main group-hover:text-accent transition-colors truncate">{movie.title}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">
                      {movie.year} {movie.runtime ? `• ${movie.runtime}` : ''}
                    </p>
                    {movie.description && (
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{movie.description}</p>
                    )}
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <i className="fa-solid fa-plus text-gray-400 group-hover:text-accent transition-colors"></i>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!debouncedQuery.trim() && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 text-sm text-center">
                Start typing to search for movies...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MyStuffView: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  const [activeSubTab, setActiveSubTab] = useState<'Watchlist' | 'History'>('Watchlist');
  const [isAddMovieModalOpen, setIsAddMovieModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Fetch personal watchlist
  const { data: watchlistMovies = [], isLoading: watchlistIsLoading } = useQuery({
    queryKey: ['watchlist', 'personal'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Fetch history from API
  const { data: historyData = [], isLoading: historyLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Setup layout animation for the grid - animates when movies change
  useLayoutAnimation(
    gridRef,
    {
      duration: 600,
      ease: 'easeOutExpo',
    },
    [watchlistMovies.length, watchlistMovies.map((m: Movie) => m.id).join(',')]
  );

  // Setup layout animation for the timeline - animates when movies change
  useLayoutAnimation(timelineRef, {
    duration: 500,
    ease: 'easeOutExpo',
  }, [historyData.length, historyData.map((m: any) => m.id).join(',')]);

  const handleDeleteWatchlist = async (movie: Movie) => {
    if (!session?.user?.id) return;

    const queryKey = ['watchlist', 'personal'];

    // Optimistic update: remove from cache immediately
    const previousWatchlist = queryClient.getQueryData<Movie[]>(queryKey) || [];
    queryClient.setQueryData<Movie[]>(queryKey, (old = []) => 
      old.filter(m => m.id !== movie.id)
    );

    try {
      // Make DELETE request
      const res = await fetch(`/api/watchlist?mediaId=${movie.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert optimistic update on error
        queryClient.setQueryData(queryKey, previousWatchlist);
        let errorMessage = 'Failed to remove from watchlist. Please try again.';
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            const text = await res.text();
            if (text) {
              errorMessage = text;
            }
          }
        } catch (e) {
          // Failed to read response
        }
        toast.showError(errorMessage);
        return;
      }

      // Refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'personal'] });
      toast.showSuccess('Removed from watchlist');
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(queryKey, previousWatchlist);
      console.error('Error removing from watchlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove from watchlist. Please try again.';
      toast.showError(errorMessage);
    }
  };

  const handleDeleteHistory = async (movie: any) => {
    if (sessionStatus !== 'authenticated') return;
    
    // Extract IDs from movie.id (format: "tmdb-{id}" or UUID)
    const tmdbId = movie.id.startsWith('tmdb-') ? parseInt(movie.id.replace('tmdb-', '')) : null;
    const mediaId = movie.id.startsWith('tmdb-') ? null : movie.id;

    setDeletingIds(prev => new Set(prev).add(movie.id));

    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: mediaId || undefined,
          tmdbId: tmdbId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to remove' }));
        throw new Error(error.error || 'Failed to remove from history');
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['history'] });
      await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
      await queryClient.invalidateQueries({ queryKey: ['userWatched'] });
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      
      // If mediaId exists, also invalidate media queries
      if (mediaId) {
        await queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
      }
      
      // Refetch history to update the list
      await queryClient.refetchQueries({ queryKey: ['history'] });
      toast.showSuccess('Removed from history');
    } catch (error) {
      console.error('Failed to remove from history:', error);
      toast.showError('Failed to remove movie from history. Please try again.');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(movie.id);
        return next;
      });
    }
  };

  return (
    <div className="py-6 sm:py-8 px-4 sm:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-main">MY STUFF</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-black/[0.03] p-1 rounded-2xl border border-main overflow-hidden">
            {['Watchlist', 'History'].map(t => {
              const isActive = activeSubTab === t;
              return (
                <button 
                  key={t}
                  onClick={() => setActiveSubTab(t as 'Watchlist' | 'History')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95 whitespace-nowrap ${
                    isActive ? 'bg-accent text-white shadow-md scale-105' : 'text-gray-500 hover:text-main hover:scale-[1.02]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Watchlist View */}
      {activeSubTab === 'Watchlist' && (
        <>
          {watchlistIsLoading ? (
            <div className="flex items-center justify-center py-12 sm:py-20">
              <div className="text-gray-500 text-sm sm:text-base">Loading watchlist...</div>
            </div>
          ) : watchlistMovies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-4 sm:mb-6">
                <i className="fa-solid fa-list-check text-2xl sm:text-3xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-main mb-2 text-center">No movies in watchlist</h3>
              <p className="text-xs sm:text-sm text-gray-500 text-center max-w-md mb-6 px-4">
                Start building your watchlist by adding movies you want to watch.
              </p>
            </div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full overflow-x-hidden">
              {watchlistMovies.map((movie: Movie) => {
                return (
                <div key={movie.id} className="glass rounded-[2rem] p-4 sm:p-5 flex gap-3 sm:gap-4 hover:border-accent/40 transition-all duration-300 group hover:scale-[1.02] active:scale-100 min-w-0 w-full">
                  {movie.poster ? (
                    <img 
                      src={movie.poster} 
                      className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl object-cover shadow-sm" 
                      alt={movie.title} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                  ) : (
                    <div className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-image text-gray-600 text-lg sm:text-xl"></i>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0 w-full overflow-hidden">
                    <div className="min-w-0 w-full">
                      <h4 className="font-black text-xs sm:text-sm text-main group-hover:text-accent transition-colors line-clamp-2 leading-tight mb-1.5">{movie.title}</h4>
                      <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium mb-2">{movie.year} • {movie.runtime}</p>
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 mt-auto">
                      <button className="flex-1 bg-accent text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl hover:brightness-110 active:scale-95 transition-all duration-200">
                        Watch
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteWatchlist(movie);
                        }}
                        className="px-2.5 sm:px-3 text-gray-400 hover:text-red-400 active:scale-90 transition-all duration-200 flex-shrink-0"
                        title="Remove from watchlist"
                      >
                        <i className="fa-solid fa-trash-can text-xs sm:text-sm"></i>
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            
              <button 
              onClick={() => setIsAddMovieModalOpen(true)}
              className="border-2 border-dashed border-main rounded-[2rem] p-6 sm:p-8 flex flex-col items-center justify-center text-gray-400 hover:text-accent hover:border-accent/40 transition-all duration-300 min-h-[120px] sm:min-h-[144px] hover:scale-[1.02] active:scale-100 group"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/[0.03] flex items-center justify-center mb-3 sm:mb-4 border border-main group-hover:border-accent/40 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/10">
                <i className="fa-solid fa-plus text-[10px] sm:text-xs transition-transform duration-300 group-hover:rotate-90"></i>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">ADD MOVIE</span>
            </button>
            </div>
          )}
        </>
      )}

      {/* History View */}
      {activeSubTab === 'History' && (
        <>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12 sm:py-20">
              <div className="text-gray-500 text-sm sm:text-base">Loading history...</div>
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-4 sm:mb-6">
                <i className="fa-solid fa-clock-rotate-left text-2xl sm:text-3xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-main mb-2 text-center">No watch history</h3>
              <p className="text-xs sm:text-sm text-gray-500 text-center max-w-md px-4">
                Your viewing history will appear here once you start logging movies with your groups.
              </p>
            </div>
          ) : (
            <div ref={timelineRef} className="relative border-l-2 border-main ml-4 pl-8 space-y-12 pb-20">
              {historyData.map((movie: any, idx: number) => {
                const watchedDate = movie.watchedAt ? new Date(movie.watchedAt) : new Date();
                const month = watchedDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                const day = watchedDate.getDate();
                const staggerClass = idx < 5 ? `animate-stagger-${Math.min(idx + 1, 5)}` : 'animate-fade-in';
                
                return (
              <div key={movie.id} className={`relative group ${staggerClass}`}>
                {/* Timeline dot using accent color */}
                <div className="absolute -left-[42px] top-6 w-5 h-5 rounded-full bg-accent border-4 border-main group-hover:scale-125 transition-transform z-10"></div>
                
                <div className="flex flex-col md:flex-row gap-8 glass p-6 rounded-[2rem] border-main hover:bg-black/[0.02] transition-all-smooth card-hover">
                  <div className="w-32 h-48 rounded-2xl overflow-hidden shadow-lg shrink-0">
                    {movie.poster ? (
                      <img src={movie.poster} className="w-full h-full object-cover animate-image-fade-in" alt={movie.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 animate-image-fade-in">
                        <i className="fa-solid fa-image text-gray-600 text-2xl"></i>
                      </div>
                    )}
                  </div>
                  
                  <div className="py-2 flex-1 relative">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <p className="text-[10px] font-black text-accent uppercase tracking-widest">WATCHED {month} {day}</p>
                      <button
                        onClick={() => handleDeleteHistory(movie)}
                        disabled={deletingIds.has(movie.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove from history"
                      >
                        <i className={`fa-solid ${deletingIds.has(movie.id) ? 'fa-spinner fa-spin' : 'fa-trash'} text-xs`}></i>
                      </button>
                    </div>
                    <h3 className="text-2xl font-black mb-2 text-main">{movie.title}</h3>
                    <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                      {movie.reviews && movie.reviews.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 bg-black/[0.03] px-2 py-1 rounded-md border border-main">
                            <i className="fa-solid fa-star text-yellow-500"></i>
                            <span className="text-main">
                              {(movie.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / movie.reviews.length).toFixed(1)}
                            </span>
                          </div>
                          <span className="opacity-30">•</span>
                        </>
                      )}
                      {movie.attendees && movie.attendees.length > 0 && (
                        <span className="text-gray-400">{movie.attendees.length} {movie.attendees.length === 1 ? 'ATTENDEE' : 'ATTENDEES'}</span>
                      )}
                    </div>
                    {movie.reviews && movie.reviews.length > 0 && movie.reviews[0].comment && (
                      <p className="text-sm text-gray-500 leading-relaxed italic line-clamp-3">
                        "{movie.reviews[0].comment}"
                      </p>
                    )}
                    {movie.notes && (
                      <p className="text-sm text-gray-500 leading-relaxed italic line-clamp-3">
                        "{movie.notes}"
                      </p>
                    )}
                    {movie.attendees && movie.attendees.length > 0 && (
                      <div className="mt-6 flex items-center gap-3 pt-4 border-t border-main">
                        <div className="flex -space-x-2">
                          {movie.attendees.slice(0, 5).map((attendee: any) => (
                            <img 
                              key={attendee.user_id || attendee.id} 
                              className="w-6 h-6 rounded-full border-2 border-main" 
                              src={attendee.users?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(attendee.users?.name || 'User')}`} 
                              alt={attendee.users?.name || 'User'} 
                              title={attendee.users?.name || 'User'}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">VERIFIED WATCH</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
              })}
            </div>
          )}
        </>
      )}

      {isAddMovieModalOpen && (
        <AddMovieModal 
          onClose={() => setIsAddMovieModalOpen(false)} 
          onAdd={async (movie) => {
            // Invalidate watchlist to refresh
            await queryClient.invalidateQueries({ queryKey: ['watchlist', 'personal'] });
            toast.showSuccess(`Added ${movie.title} to watchlist!`);
          }}
          onError={(message) => {
            if (message === 'Already in watchlist') {
              toast.showWarning('This movie is already in your watchlist');
            } else {
              toast.showError(message);
            }
          }}
        />
      )}
    </div>
  );
};

export default MyStuffView;

