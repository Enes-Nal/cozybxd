'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Movie } from '@/lib/types';
import { useToast } from './Toast';
import { useLayoutAnimation } from '@/lib/hooks/useLayoutAnimation';
import { TMDBMovie } from '@/lib/api/tmdb';
import { transformTMDBMovieToMovieSync, transformYouTubeVideoToMovie } from '@/lib/utils/transformers';
import { getGenres } from '@/lib/api/tmdb';

// Extended Movie type with team information for shared watchlists
interface MovieWithTeam extends Movie {
  teamId?: string;
  teamName?: string;
}

const NewListModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [listName, setListName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!listName.trim()) {
      setError('List name is required');
      return;
    }

    // If collaborative, create a team
    if (isShared) {
      setError(null);
      setIsSubmitting(true);
      
      try {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: listName.trim(),
            description: `A collaborative watchlist: ${listName.trim()}`,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Failed to create list' }));
          throw new Error(errorData.error || 'Failed to create list');
        }

        // Invalidate and refetch teams
        await queryClient.invalidateQueries({ queryKey: ['teams'] });
        await queryClient.refetchQueries({ queryKey: ['teams'] });
        
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create list');
        setIsSubmitting(false);
      }
    } else {
      // Personal lists don't need to be created - they're just the user's watchlist
      // Just close the modal
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-black">Create New List</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white active:scale-90 transition-all duration-200 hover:rotate-90"
            disabled={isSubmitting}
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-8">Organize your cinematic discoveries.</p>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">List Name</label>
            <input 
              autoFocus
              type="text" 
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. 90s Cyberpunk Noir"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  handleCreate();
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between glass p-4 rounded-xl border-white/5">
            <div>
              <p className="text-xs font-bold">Collaborative List</p>
              <p className="text-[9px] text-gray-500 font-medium">Allow group members to add movies</p>
            </div>
            <div 
              onClick={() => !isSubmitting && setIsShared(!isShared)}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isShared ? 'bg-accent' : 'bg-gray-400/20'} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isShared ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              disabled={isSubmitting || !listName.trim()}
              className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all duration-200 no-glow shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

const WatchlistView: React.FC<{ movies?: Movie[] }> = ({ movies: propMovies }) => {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('Personal');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isAddMovieModalOpen, setIsAddMovieModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch personal watchlist
  const { data: personalWatchlist = [], isLoading: personalLoading } = useQuery({
    queryKey: ['watchlist', 'personal'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Fetch shared watchlists (team watchlists)
  const { data: teamsData = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await fetch('/api/teams');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Get team IDs for query key dependency
  const teamIds = useMemo(() => teamsData.map((team: any) => team.id).sort().join(','), [teamsData]);

  // Fetch all team watchlists
  const teamWatchlistResults = useQuery({
    queryKey: ['watchlist', 'shared', 'all', teamIds],
    queryFn: async () => {
      if (teamsData.length === 0) return [];
      
      // Fetch watchlists for all teams in parallel
      const results = await Promise.all(
        teamsData.map(async (team: any) => {
          try {
            const res = await fetch(`/api/watchlist?teamId=${team.id}`);
            if (!res.ok) return [];
            const movies = await res.json();
            // Add team information to each movie
            return movies.map((movie: Movie) => ({
              ...movie,
              teamId: team.id,
              teamName: team.name,
            } as MovieWithTeam));
          } catch (error) {
            console.error(`Error fetching watchlist for team ${team.id}:`, error);
            return [];
          }
        })
      );
      
      // Flatten the array of arrays into a single array
      return results.flat();
    },
    enabled: sessionStatus === 'authenticated' && teamsData.length > 0,
  });

  const sharedWatchlist: MovieWithTeam[] = teamWatchlistResults.data || [];
  const sharedLoading = teamWatchlistResults.isLoading;

  // Get unique groups from shared watchlist for filter
  const availableGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }>();
    sharedWatchlist.forEach((movie: MovieWithTeam) => {
      if (movie.teamId && movie.teamName && !groups.has(movie.teamId)) {
        groups.set(movie.teamId, { id: movie.teamId, name: movie.teamName });
      }
    });
    return Array.from(groups.values());
  }, [sharedWatchlist]);

  // Filter shared watchlist by selected group
  const filteredSharedWatchlist = useMemo(() => {
    if (tab !== 'Shared' || !selectedGroupFilter) {
      return sharedWatchlist;
    }
    return sharedWatchlist.filter((movie: MovieWithTeam) => movie.teamId === selectedGroupFilter);
  }, [sharedWatchlist, selectedGroupFilter, tab]);

  // Reset group filter when switching tabs
  useEffect(() => {
    if (tab === 'Personal') {
      setSelectedGroupFilter(null);
      setIsDropdownOpen(false);
    }
  }, [tab]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Use prop movies if provided (for backwards compatibility), otherwise use fetched data
  const movies = propMovies || (tab === 'Personal' ? personalWatchlist : filteredSharedWatchlist);
  const isLoading = tab === 'Personal' ? personalLoading : sharedLoading;

  // Setup layout animation for the grid - animates when movies change or tab switches
  useLayoutAnimation(
    gridRef,
    {
      duration: 600,
      ease: 'easeOutExpo',
    },
    [movies.length, tab, movies.map((m: Movie | MovieWithTeam) => m.id).join(',')]
  );

  const handleDelete = async (movie: Movie | MovieWithTeam) => {
    if (!session?.user?.id) return;

    const isPersonal = tab === 'Personal';
    const movieWithTeam = movie as MovieWithTeam;
    const teamId = isPersonal ? null : movieWithTeam.teamId;
    const queryKey = isPersonal 
      ? ['watchlist', 'personal']
      : ['watchlist', 'shared', 'all'];

    // Optimistic update: remove from cache immediately
    const previousWatchlist = queryClient.getQueryData<MovieWithTeam[]>(queryKey) || [];
    if (isPersonal) {
      queryClient.setQueryData<Movie[]>(queryKey, (old = []) => 
        old.filter(m => m.id !== movie.id)
      );
    } else {
      // For shared watchlists, filter by both id and teamId to ensure we remove the right one
      queryClient.setQueryData<MovieWithTeam[]>(queryKey, (old = []) => 
        old.filter(m => !(m.id === movie.id && (m as MovieWithTeam).teamId === movieWithTeam.teamId))
      );
    }

    try {
      // Make DELETE request
      const url = `/api/watchlist?mediaId=${movie.id}${teamId ? `&teamId=${teamId}` : ''}`;
      const res = await fetch(url, {
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
            console.error('Failed to remove from watchlist:', {
              status: res.status,
              statusText: res.statusText,
              error: errorData
            });
          } else {
            // Response is not JSON
            const text = await res.text();
            console.error('Failed to remove from watchlist (non-JSON response):', {
              status: res.status,
              statusText: res.statusText,
              body: text || '(empty)'
            });
            if (text) {
              errorMessage = text;
            }
          }
        } catch (e) {
          // Failed to read response
          console.error('Failed to remove from watchlist (read error):', {
            status: res.status,
            statusText: res.statusText,
            error: e
          });
        }
        toast.showError(errorMessage);
        return;
      }

      // Refetch to ensure consistency
      if (isPersonal) {
        await queryClient.invalidateQueries({ queryKey: ['watchlist', 'personal'] });
      } else {
        // Invalidate all shared watchlists
        await queryClient.invalidateQueries({ queryKey: ['watchlist', 'shared', 'all'] });
        // Also invalidate individual team queries
        teamsData.forEach((team: any) => {
          queryClient.invalidateQueries({ queryKey: ['watchlist', 'shared', team.id] });
        });
      }
      toast.showSuccess('Removed from watchlist');
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(queryKey, previousWatchlist);
      console.error('Error removing from watchlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove from watchlist. Please try again.';
      toast.showError(errorMessage);
    }
  }; 

  return (
    <div className="py-6 sm:py-8 px-4 sm:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-main">WATCHLISTS</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="flex bg-black/[0.03] p-1 rounded-2xl border border-main overflow-hidden">
              {['Personal', `Shared (${sharedWatchlist.length})`].map(t => {
                const isPersonal = t.startsWith('Personal');
                const isActive = (isPersonal && tab === 'Personal') || (!isPersonal && tab === 'Shared');
                return (
                  <button 
                    key={t}
                    onClick={() => setTab(isPersonal ? 'Personal' : 'Shared')}
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
          {tab === 'Shared' && availableGroups.length > 0 && (
            <div ref={dropdownRef} className="relative w-full sm:w-auto min-w-[140px]">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-black/[0.03] border border-main rounded-2xl px-4 sm:px-6 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-main hover:border-accent/50 focus:border-accent/50 outline-none transition-all duration-200 flex items-center justify-between gap-2 active:scale-95"
              >
                <span className="truncate">
                  {selectedGroupFilter 
                    ? availableGroups.find(g => g.id === selectedGroupFilter)?.name || 'All Groups'
                    : 'All Groups'
                  }
                </span>
                <i className={`fa-solid fa-chevron-down text-[8px] transition-transform duration-200 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 glass rounded-xl shadow-lg border border-main/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      setSelectedGroupFilter(null);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors duration-150 ${
                      !selectedGroupFilter
                        ? 'bg-accent/20 text-accent'
                        : 'text-gray-400 hover:text-main hover:bg-white/5'
                    }`}
                  >
                    All Groups
                  </button>
                  {availableGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setSelectedGroupFilter(group.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors duration-150 border-t border-main/10 ${
                        selectedGroupFilter === group.id
                          ? 'bg-accent/20 text-accent'
                          : 'text-gray-400 hover:text-main hover:bg-white/5'
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 sm:py-20">
          <div className="text-gray-500 text-sm sm:text-base">Loading watchlist...</div>
        </div>
      ) : movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-4 sm:mb-6">
            <i className="fa-solid fa-list-check text-2xl sm:text-3xl"></i>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-main mb-2 text-center">No movies in watchlist</h3>
          <p className="text-xs sm:text-sm text-gray-500 text-center max-w-md mb-6 px-4">
            {tab === 'Personal' 
              ? "Start building your personal watchlist by adding movies you want to watch."
              : "No shared watchlists yet. Create a group to start a shared watchlist."}
          </p>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full overflow-x-hidden">
          {movies.map((movie: Movie | MovieWithTeam) => {
            const movieWithTeam = movie as MovieWithTeam;
            const isSharedTab = tab === 'Shared';
            return (
            <div key={`${movie.id}-${movieWithTeam.teamId || 'personal'}`} className="glass rounded-[2rem] p-4 sm:p-5 flex gap-3 sm:gap-4 hover:border-accent/40 transition-all duration-300 group hover:scale-[1.02] active:scale-100 min-w-0 w-full">
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
                  {isSharedTab && movie.votes !== undefined && movie.votes !== 0 && (
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-accent mb-2">
                      <i className={`fa-solid ${movie.votes > 0 ? 'fa-arrow-up' : 'fa-arrow-down'} text-[8px]`}></i>
                      <span>{movie.votes > 0 ? '+' : ''}{movie.votes}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 sm:gap-2 mt-auto">
                  <button className="flex-1 bg-accent text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl hover:brightness-110 active:scale-95 transition-all duration-200">
                    Watch
                  </button>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(movie);
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

      {isNewListModalOpen && <NewListModal onClose={() => setIsNewListModalOpen(false)} />}
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

export default WatchlistView;
