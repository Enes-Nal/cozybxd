'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Header from '@/components/Header';
import MovieGrid from '@/components/MovieGrid';
import InboxView from '@/components/InboxView';
import MyStuffView from '@/components/MyStuffView';
import SettingsView from '@/components/SettingsView';
import GroupView from '@/components/GroupView';
import GroupSettingsView from '@/components/GroupSettingsView';
import ProfileView from '@/components/ProfileView';
import TitleDetailView from '@/components/TitleDetailView';
import CustomSortModal from '@/components/CustomSortModal';
import AIRecommendationModal from '@/components/AIRecommendationModal';
import SchedulingModal from '@/components/SchedulingModal';
import RandomPickerModal from '@/components/RandomPickerModal';
import FilterDrawer, { FilterState } from '@/components/FilterDrawer';
import AddFriendModal from '@/components/AddFriendModal';
import CreateGroupModal from '@/components/CreateGroupModal';
import JoinGroupModal from '@/components/JoinGroupModal';
import SetUsernameModal from '@/components/SetUsernameModal';
import { useToast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';
import { Movie, User, Group } from '@/lib/types';
import { transformTMDBMovieToMovieSync, transformTeamToGroup, transformMediaToMovie, transformYouTubeVideoToMovie } from '@/lib/utils/transformers';
import { TMDBMovie, getGenres } from '@/lib/api/tmdb';
import { getPosterUrl } from '@/lib/api/tmdb';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genreMap, setGenreMap] = useState<Map<number, string>>(new Map());
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'Home');
  const [activeGroup, setActiveGroup] = useState<string | null>(searchParams.get('group') || null);
  const [activeProfile, setActiveProfile] = useState<User | null>(null);
  
  // Check if we're on Group Settings tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    const group = searchParams.get('group');
    if (tab === 'Group Settings' && group) {
      setActiveTab('Group Settings');
      setActiveGroup(group);
    }
  }, [searchParams]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isSetUsernameOpen, setIsSetUsernameOpen] = useState(false);
  const [schedulingMovie, setSchedulingMovie] = useState<Movie | null>(null);
  const [sortBy, setSortBy] = useState<string>('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [groupMovies, setGroupMovies] = useState<Movie[]>([]);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [useNavbar, setUseNavbar] = useState(false);

  // Check navbar preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('useNavbar');
    setUseNavbar(saved === 'true');
  }, []);

  // Fetch current user
  const { data: currentUserData, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  const currentUser: User | null = currentUserData || null;
  const currentUsername = (currentUserData as any)?.username || null;

  // Show username modal if user is authenticated but doesn't have a username
  useEffect(() => {
    if (sessionStatus === 'authenticated' && !userLoading && currentUserData && !currentUsername) {
      setIsSetUsernameOpen(true);
    }
  }, [sessionStatus, userLoading, currentUserData, currentUsername]);

  // Fetch genres on mount
  useEffect(() => {
    getGenres().then(genres => {
      const map = new Map(genres.map(g => [g.id, g.name]));
      setGenreMap(map);
    });
  }, []);

  // Fetch movies based on sortBy and filters
  const { data: moviesData, isLoading: moviesLoading } = useQuery({
    queryKey: ['movies', sortBy, filters],
    queryFn: async () => {
      // If filters are applied, use discover endpoint
      if (filters) {
        const params = new URLSearchParams();
        params.append('contentType', filters.contentType);
        params.append('maxRuntime', filters.maxRuntime.toString());
        params.append('minRating', filters.minRating.toString());
        if (filters.genres.length > 0) {
          params.append('genres', filters.genres.join(','));
        }
        params.append('criticallyAcclaimed', filters.criticallyAcclaimed.toString());
        params.append('nicheExperimental', filters.nicheExperimental.toString());
        params.append('budgetFit', filters.budgetFit.toString());
        
        const res = await fetch(`/api/media/discover?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch movies');
        const data = await res.json();
        
        if (data.type === 'tmdb' || data.type === 'movie') {
          return data.results.map((tmdbMovie: TMDBMovie) => 
            transformTMDBMovieToMovieSync(tmdbMovie, genreMap)
          );
        }
        
        return data.results || [];
      }
      
      // Otherwise use the original endpoints
      let endpoint = '/api/media/trending';
      if (sortBy === 'Top Rated') {
        endpoint = '/api/media/popular';
      } else if (sortBy === 'New Releases') {
        endpoint = '/api/media/new-releases';
      }
      
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch movies');
      const data = await res.json();
      
      // Transform TMDB movies to our Movie type
      if (data.type === 'tmdb' || data.type === 'movie') {
        return data.results.map((tmdbMovie: TMDBMovie) => 
          transformTMDBMovieToMovieSync(tmdbMovie, genreMap)
        );
      }
      
      // If it's database media format, transform it
      if (data.type === 'media' && data.results) {
        return data.results.map((media: any) => transformMediaToMovie(media));
      }
      
      // Handle mixed type (database media + TMDB movies)
      if (data.type === 'mixed' && data.results) {
        return data.results.map((item: any) => {
          // Check if it's a TMDB movie (has genre_ids array, which is unique to TMDBMovie)
          if (Array.isArray(item.genre_ids)) {
            return transformTMDBMovieToMovieSync(item as TMDBMovie, genreMap);
          }
          // Otherwise it's a database media object
          return transformMediaToMovie(item);
        });
      }
      
      return data.results || [];
    },
    enabled: genreMap.size > 0,
  });

  // Update movies when data changes
  useEffect(() => {
    if (moviesData) {
      setMovies(moviesData);
    }
  }, [moviesData]);

  // Search functionality
  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) return [];
      const data = await res.json();
      
      if (data.type === 'movie' && data.results) {
        return data.results.map((tmdbMovie: TMDBMovie) => 
          transformTMDBMovieToMovieSync(tmdbMovie, genreMap)
        );
      }
      
      if (data.type === 'youtube' && data.data) {
        return [transformYouTubeVideoToMovie(data.data)];
      }
      
      return [];
    },
    enabled: searchQuery.trim().length > 0 && (genreMap.size > 0 || searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')),
  });

  // Use search results if available
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      setMovies(searchResults);
    } else if (searchQuery.trim().length === 0 && moviesData) {
      setMovies(moviesData);
    }
  }, [searchResults, searchQuery, moviesData]);

  // Fetch group data when activeGroup changes
  const { data: groupDataResponse, isLoading: groupLoading, error: groupError, refetch: refetchGroup } = useQuery({
    queryKey: ['group', activeGroup],
    queryFn: async () => {
      if (!activeGroup) return null;
      const res = await fetch(`/api/teams/${activeGroup}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch group' }));
        throw new Error(errorData.error || 'Failed to fetch group');
      }
      return res.json();
    },
    enabled: !!activeGroup && sessionStatus === 'authenticated',
    retry: 2,
    retryDelay: 1000,
  });

  // Reset group data when activeGroup changes
  useEffect(() => {
    setGroupData(null);
  }, [activeGroup]);

  // Transform group data
  useEffect(() => {
    if (groupDataResponse) {
      const group = transformTeamToGroup(groupDataResponse);
      setGroupData(group);
    }
  }, [groupDataResponse]);

  // Fetch group watchlist movies
  const { data: groupWatchlistData } = useQuery({
    queryKey: ['groupWatchlist', activeGroup],
    queryFn: async () => {
      if (!activeGroup) return [];
      const res = await fetch(`/api/watchlist?teamId=${activeGroup}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeGroup && sessionStatus === 'authenticated',
  });

  useEffect(() => {
    if (groupWatchlistData) {
      setGroupMovies(groupWatchlistData);
    }
  }, [groupWatchlistData]);

  // Fetch personal watchlist for MovieGrid
  const { data: personalWatchlist = [], refetch: refetchPersonalWatchlist } = useQuery({
    queryKey: ['watchlist', 'personal'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      // Default to dark mode - ensure light-mode class is removed
      document.body.classList.remove('light-mode');
      // Set theme to 'dark' if not already set, to ensure consistency
      if (!savedTheme) {
        localStorage.setItem('theme', 'dark');
      }
    }
    const savedAccent = localStorage.getItem('accent');
    if (savedAccent) {
      document.documentElement.style.setProperty('--accent-color', savedAccent);
    } else {
      // Set default accent color if none is saved
      document.documentElement.style.setProperty('--accent-color', '#FF47C8');
    }
    const savedGlass = localStorage.getItem('glass');
    if (savedGlass === 'off') {
      document.documentElement.style.setProperty('--glass-blur', '0px');
    }
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveGroup(null);
    setActiveProfile(null);
    setSelectedMovie(null);
    router.push(`/?tab=${tab}`);
  };

  const handleGroupSelect = (groupId: string) => {
    setActiveGroup(groupId);
    setActiveTab('Group');
    setActiveProfile(null);
    setSelectedMovie(null);
    router.push(`/?tab=Group&group=${groupId}`);
  };

  const handleProfileSelect = (user: User) => {
    setActiveProfile(user);
    setActiveTab('Profile');
    setActiveGroup(null);
    setSelectedMovie(null);
    router.push(`/?tab=Profile&user=${user.id}`);
  };

  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
    setActiveTab('Detail');
    setActiveGroup(null);
    setActiveProfile(null);
    router.push(`/?tab=Detail&movie=${movie.id}`);
  };

  // Helper function to parse runtime string to minutes
  const parseRuntimeToMinutes = (runtime: string): number | null => {
    if (runtime === 'N/A') return null;
    const match = runtime.match(/(\d+)h\s*(\d+)m/);
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    const matchHours = runtime.match(/(\d+)h/);
    if (matchHours) {
      return parseInt(matchHours[1]) * 60;
    }
    const matchMinutes = runtime.match(/(\d+)m/);
    if (matchMinutes) {
      return parseInt(matchMinutes[1]);
    }
    return null;
  };

  // Helper function to get genre IDs from genre names
  const getGenreIdsFromNames = (genreNames: string[]): number[] => {
    const ids: number[] = [];
    genreNames.forEach(name => {
      genreMap.forEach((genreName, id) => {
        if (genreName.toLowerCase() === name.toLowerCase()) {
          ids.push(id);
        }
      });
    });
    return ids;
  };

  const filteredAndSortedMovies = useMemo(() => {
    let result = [...movies];
    
    // Apply filters if they exist
    if (filters) {
      // Filter by content type (already handled by API, but double-check)
      // Filter by runtime
      if (filters.maxRuntime) {
        result = result.filter(movie => {
          const runtimeMinutes = parseRuntimeToMinutes(movie.runtime);
          if (runtimeMinutes === null) return true; // Include if runtime unknown
          return runtimeMinutes <= filters.maxRuntime;
        });
      }
      
      // Filter by rating (vote_average from TMDB)
      // Note: We need to get the original TMDB data for vote_average
      // For now, we'll rely on the API filtering, but we can add client-side filtering
      // if we store vote_average in the Movie type
      
      // Filter by genres
      if (filters.genres && filters.genres.length > 0) {
        result = result.filter(movie => {
          // Get genre IDs from genre names
          const movieGenreIds = getGenreIdsFromNames(movie.genre);
          // Check if any selected genre matches
          return filters.genres.some(selectedGenreId => 
            movieGenreIds.includes(selectedGenreId)
          );
        });
      }
    }
    
    // Sort
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'Top Rated': return b.votes - a.votes;
        case 'New Releases': return b.year - a.year;
        case 'Trending':
        default: return 0;
      }
    });
  }, [movies, sortBy, filters, genreMap]);

  const renderContent = () => {
    const key = selectedMovie?.id || activeProfile?.id || activeGroup || activeTab;
    
    let content;
    if (selectedMovie) content = <PageTransition transitionKey={key}><TitleDetailView movie={selectedMovie} onBack={() => setSelectedMovie(null)} /></PageTransition>;
    else if (activeProfile) content = <PageTransition transitionKey={key}><ProfileView user={activeProfile} /></PageTransition>;
    else if (activeTab === 'Group Settings' && activeGroup) {
      content = (
        <PageTransition transitionKey={key}>
          <GroupSettingsView 
            groupId={activeGroup}
            onBack={() => {
              setActiveTab('Group');
              router.push(`/?tab=Group&group=${activeGroup}`);
            }}
          />
        </PageTransition>
      );
    } else if (activeGroup) {
      if (groupLoading) {
        content = (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading group...</div>
          </div>
        );
      } else if (groupError) {
        content = (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-red-400">Failed to load group</div>
            <button
              onClick={() => refetchGroup()}
              className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold hover:brightness-110 active:scale-95 transition-all duration-200"
            >
              Retry
            </button>
          </div>
        );
      } else if (groupData) {
        content = (
          <PageTransition transitionKey={key}>
            <GroupView 
              group={groupData} 
              movies={groupMovies}
              onSchedule={(movie) => setSchedulingMovie(movie)}
              onSelect={handleMovieSelect}
              onProfileSelect={handleProfileSelect}
            />
          </PageTransition>
        );
      } else {
        content = (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Group not found</div>
          </div>
        );
      }
    }
    else {
      switch (activeTab) {
        case 'Inbox': content = <PageTransition transitionKey={key}><InboxView /></PageTransition>; break;
        case 'My Stuff': content = <PageTransition transitionKey={key}><MyStuffView /></PageTransition>; break;
        case 'Settings': content = <PageTransition transitionKey={key}><SettingsView /></PageTransition>; break;
        default:
          content = (
            <div className="mt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-2xl relative group mr-12">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[var(--accent-color)] transition-colors"></i>
                    <input 
                      type="text" 
                      placeholder="Search titles, actors, or moods..." 
                      className="w-full bg-[#111] border border-[#222] rounded-xl py-2.5 pl-12 pr-4 outline-none focus:border-[var(--accent-color)]/50 focus:bg-[#1a1a1a] transition-all duration-200 text-xs font-medium text-main"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsFilterDrawerOpen(true)}
                      className={`border px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all duration-200 text-main ${
                        filters 
                          ? 'bg-[var(--accent-color)]/20 border-[var(--accent-color)] text-[var(--accent-color)]' 
                          : 'bg-[#111] border-[#222] hover:border-[var(--accent-color)]/30'
                      }`}
                    >
                      <i className={`fa-solid fa-sliders transition-transform duration-200 hover:rotate-90 ${
                        filters ? 'text-[var(--accent-color)]' : 'text-[var(--accent-color)]'
                      }`}></i>
                      Filters{filters && ' •'}
                    </button>
                    <button 
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] hover:border-[var(--accent-color)]/30 active:scale-95 transition-all duration-200 text-main"
                    >
                      <i className="fa-solid fa-bookmark text-[var(--accent-color)] transition-transform duration-200 hover:scale-110"></i>
                      Presets
                    </button>
                    <button 
                      onClick={() => setIsCustomSortOpen(true)}
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] hover:border-[var(--accent-color)]/30 active:scale-95 transition-all duration-200 text-main"
                    >
                      <i className="fa-solid fa-arrow-down-wide-short text-[var(--accent-color)] transition-transform duration-200"></i>
                      Sort
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['Trending', 'Top Rated', 'New Releases'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`whitespace-nowrap px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 border active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--bg-main)] ${
                        sortBy === opt 
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black shadow-lg shadow-[var(--accent-color)]/20' 
                          : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300 hover:border-[var(--accent-color)]/30 hover:bg-[#1a1a1a]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-20">
                {moviesLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading movies...</div>
                  </div>
                ) : filteredAndSortedMovies.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">No movies found</div>
                  </div>
                ) : (
                  <MovieGrid 
                    movies={filteredAndSortedMovies}
                    personalWatchlist={personalWatchlist}
                    onVote={async (id) => {
                      // Find the current movie
                      const currentMovie = filteredAndSortedMovies.find(mov => mov.id === id);
                      if (!currentMovie) return;
                      
                      // Check if already in watchlist
                      const isInWatchlist = personalWatchlist.some((m: Movie) => {
                        if (m.id === id) return true;
                        if (id.startsWith('tmdb-')) {
                          const tmdbId = id.replace('tmdb-', '');
                          if (m.id === `tmdb-${tmdbId}`) return true;
                        }
                        if (m.title === currentMovie.title) return true;
                        return false;
                      });
                      
                      // Optimistic update - update UI IMMEDIATELY (instant feedback)
                      const previousWatchlist = personalWatchlist;
                      let newWatchlist: Movie[];
                      
                      if (isInWatchlist) {
                        // Optimistically remove
                        newWatchlist = personalWatchlist.filter((m: Movie) => {
                          if (m.id === id) return false;
                          if (id.startsWith('tmdb-')) {
                            const tmdbId = id.replace('tmdb-', '');
                            if (m.id === `tmdb-${tmdbId}`) return false;
                          }
                          if (m.title === currentMovie.title) return false;
                          return true;
                        });
                      } else {
                        // Optimistically add
                        newWatchlist = [...personalWatchlist, currentMovie];
                      }
                      
                      // Update the query cache immediately - UI updates instantly!
                      queryClient.setQueryData(['watchlist', 'personal'], newWatchlist);
                      
                      // Now do the actual API calls in the background (non-blocking)
                      // Extract mediaId from id (could be tmdb-123, youtube-123, or uuid)
                      let mediaId = id.startsWith('tmdb-') ? id.replace('tmdb-', '') : 
                                   id.startsWith('youtube-') ? id.replace('youtube-', '') : id;
                      
                      // Fire off API calls in background - don't await, just handle errors
                      (async () => {
                        try {
                          let actualMediaId = mediaId;
                          
                          // If it's a TMDB ID, sync it first to get the database media ID
                          if (id.startsWith('tmdb-')) {
                            const syncRes = await fetch('/api/media/sync', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tmdbId: mediaId, type: 'movie' }),
                            });
                            
                            if (!syncRes.ok) {
                              // Revert optimistic update on error
                              queryClient.setQueryData(['watchlist', 'personal'], previousWatchlist);
                              const errorData = await syncRes.json().catch(() => ({ error: 'Failed to sync' }));
                              console.error('Failed to sync media:', errorData);
                              toast.showError('Failed to add movie. Please try again.');
                              return;
                            }
                            
                            const media = await syncRes.json();
                            actualMediaId = media.id;
                          } else if (id.startsWith('youtube-')) {
                            // If it's a YouTube video, sync it first to get the database media ID
                            const syncRes = await fetch('/api/media/sync', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ youtubeId: mediaId }),
                            });
                            
                            if (!syncRes.ok) {
                              // Revert optimistic update on error
                              queryClient.setQueryData(['watchlist', 'personal'], previousWatchlist);
                              const errorData = await syncRes.json().catch(() => ({ error: 'Failed to sync' }));
                              console.error('Failed to sync YouTube video:', errorData);
                              toast.showError('Failed to add YouTube video. Please try again.');
                              return;
                            }
                            
                            const media = await syncRes.json();
                            actualMediaId = media.id;
                          }
                          
                          if (isInWatchlist) {
                            // Remove from watchlist
                            const deleteRes = await fetch(`/api/watchlist?mediaId=${actualMediaId}`, {
                              method: 'DELETE',
                            });
                            
                            if (!deleteRes.ok) {
                              // Revert optimistic update on error
                              queryClient.setQueryData(['watchlist', 'personal'], previousWatchlist);
                              const errorData = await deleteRes.json().catch(() => ({ error: 'Failed to delete' }));
                              console.error('Failed to remove from watchlist:', errorData);
                              toast.showError('Failed to remove from watchlist. Please try again.');
                              return;
                            }
                            toast.showSuccess(`Removed ${currentMovie.title} from watchlist`);
                          } else {
                            // Add to watchlist
                            const addRes = await fetch('/api/watchlist', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mediaId: actualMediaId }),
                            });
                            
                            if (!addRes.ok) {
                              // Revert optimistic update on error
                              queryClient.setQueryData(['watchlist', 'personal'], previousWatchlist);
                              const errorData = await addRes.json().catch(() => ({ error: 'Failed to add' }));
                              console.error('Failed to add to watchlist:', errorData);
                              const errorMessage = errorData.error || 'Failed to add to watchlist. Please try again.';
                              if (errorData.error === 'Already in watchlist') {
                                toast.showWarning('Already in watchlist');
                              } else {
                                toast.showError(errorMessage);
                              }
                              return;
                            }
                            
                            // Update with actual data from server (in case IDs changed)
                            const addedMovie = await addRes.json();
                            queryClient.setQueryData<Movie[]>(['watchlist', 'personal'], (old = []) => {
                              // Replace optimistic movie with real one
                              const filtered = old.filter(m => m.id !== id && m.id !== actualMediaId);
                              return [...filtered, addedMovie];
                            });
                            
                            toast.showSuccess(`Added ${currentMovie.title} to watchlist!`);
                          }
                          
                          // Silently refetch in background to ensure consistency
                          refetchPersonalWatchlist().catch(() => {});
                        } catch (error) {
                          // Revert optimistic update on error
                          queryClient.setQueryData(['watchlist', 'personal'], previousWatchlist);
                          console.error('Failed to toggle watchlist:', error);
                          toast.showError('An error occurred. Please try again.');
                        }
                      })();
                    }}
                    onSchedule={(id) => setSchedulingMovie(movies.find(m => m.id === id) || null)} 
                    onSelect={handleMovieSelect}
                    users={currentUser ? [currentUser] : []} 
                  />
                )}
              </div>
            </div>
          );
      }
    }

    return (
      <div key={key} className="page-transition flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className={`animate-fade-in w-full ${useNavbar ? 'flex flex-col items-center' : ''}`}>
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className={`${useNavbar ? 'flex flex-col navbar-mode' : 'flex'} h-screen bg-main text-main overflow-hidden`}>
      {useNavbar ? (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          onGroupSelect={handleGroupSelect} 
          onFriendSelect={handleProfileSelect}
          onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
          onAddFriendClick={() => setIsAddFriendOpen(true)}
          onCreateGroupClick={() => setIsCreateGroupOpen(true)}
          onJoinGroupClick={() => setIsJoinGroupOpen(true)}
        />
      ) : (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          onGroupSelect={handleGroupSelect} 
          onFriendSelect={handleProfileSelect}
          onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
          onAddFriendClick={() => setIsAddFriendOpen(true)}
          onCreateGroupClick={() => setIsCreateGroupOpen(true)}
          onJoinGroupClick={() => setIsJoinGroupOpen(true)}
        />
      )}

      <main className={`flex-1 flex flex-col ${useNavbar ? 'px-8 pt-4' : 'px-8 pt-6'} transition-all duration-300 overflow-hidden smooth-scroll`}>
        <Header 
          groupName={activeGroup ? "Group" : (selectedMovie ? selectedMovie.title : "cozybxd")} 
          isHome={activeTab === 'Home' && !activeGroup && !activeProfile && !selectedMovie}
          onNotificationClick={() => handleTabChange('Inbox')}
          onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
          onMovieSelect={handleMovieSelect}
        />
        {sessionStatus === 'loading' || userLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : sessionStatus === 'unauthenticated' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
              <a href="/api/auth/signin" className="text-accent hover:underline">Sign in with Discord</a>
            </div>
          </div>
        ) : (
          <div className={`flex-1 ${useNavbar ? 'flex justify-center overflow-y-auto' : ''}`}>
            <div className={useNavbar ? 'w-full max-w-7xl flex justify-center' : 'w-full'}>
              {renderContent()}
            </div>
          </div>
        )}
      </main>

      <FilterDrawer 
        isOpen={isFilterDrawerOpen} 
        onClose={() => setIsFilterDrawerOpen(false)}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          setIsFilterDrawerOpen(false);
        }}
        onClearFilters={() => {
          setFilters(null);
        }}
        initialFilters={filters || undefined}
      />
      {isAddFriendOpen && (
        <AddFriendModal 
          onClose={() => setIsAddFriendOpen(false)}
          onFriendAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['friends'] });
          }}
        />
      )}
      {isCreateGroupOpen && (
        <CreateGroupModal 
          onClose={() => setIsCreateGroupOpen(false)} 
          onSuccess={(groupId) => {
            handleGroupSelect(groupId);
          }}
        />
      )}
      {isJoinGroupOpen && (
        <JoinGroupModal 
          onClose={() => setIsJoinGroupOpen(false)} 
          onSuccess={(groupId) => {
            handleGroupSelect(groupId);
          }}
        />
      )}
      {isSetUsernameOpen && (
        <SetUsernameModal 
          onClose={() => setIsSetUsernameOpen(false)}
          defaultDiscordUsername={session?.user?.name || undefined}
        />
      )}
      {isCustomSortOpen && <CustomSortModal onClose={() => setIsCustomSortOpen(false)} />}
      {isAIModalOpen && <AIRecommendationModal onClose={() => setIsAIModalOpen(false)} onAdd={(m) => setMovies([m, ...movies])} groupContext={{ members: currentUser ? [currentUser] : [], history: movies }} />}
      {isRandomModalOpen && <RandomPickerModal movies={movies} onClose={() => setIsRandomModalOpen(false)} onSelect={(m) => { setSchedulingMovie(m); setSelectedMovie(null); }} />}
      {schedulingMovie && (
        <SchedulingModal 
          movie={schedulingMovie} 
          onClose={() => setSchedulingMovie(null)} 
          onConfirm={async (groupId: string, interestLevel: number) => {
            // Optimistically update UI IMMEDIATELY (instant feedback)
            const previousGroupMovies = groupMovies;
            if (activeGroup === groupId) {
              // Create a temporary movie object for optimistic update
              const optimisticMovie: Movie = {
                ...schedulingMovie,
                id: schedulingMovie.id, // Use original ID for now
                upvotes: 0,
                downvotes: 0,
                votes: 0,
                userVote: null,
              };
              // Update local state immediately - UI updates instantly!
              setGroupMovies(prev => [...prev, optimisticMovie]);
              // Update query cache immediately
              queryClient.setQueryData<Movie[]>(['groupWatchlist', groupId], (old = []) => [...old, optimisticMovie]);
            }
            
            // Close modal immediately for instant feedback
            setSchedulingMovie(null);
            
            // Now do the actual API calls in the background (non-blocking)
            (async () => {
              try {
                let mediaId = schedulingMovie.id.startsWith('tmdb-') 
                  ? schedulingMovie.id.replace('tmdb-', '')
                  : schedulingMovie.id.startsWith('youtube-')
                  ? schedulingMovie.id.replace('youtube-', '')
                  : schedulingMovie.id;
                let actualMediaId = mediaId;
                
                // If it's a TMDB ID, sync it first to get the database media ID
                if (schedulingMovie.id.startsWith('tmdb-')) {
                  const syncRes = await fetch('/api/media/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tmdbId: mediaId, type: 'movie' }),
                  });
                  
                  if (!syncRes.ok) {
                    // Revert optimistic update on error
                    if (activeGroup === groupId) {
                      setGroupMovies(previousGroupMovies);
                      queryClient.setQueryData(['groupWatchlist', groupId], previousGroupMovies);
                    }
                    const errorData = await syncRes.json().catch(() => ({ error: 'Failed to sync' }));
                    console.error('Failed to sync media:', errorData);
                    toast.showError('Failed to add movie. Please try again.');
                    return;
                  }
                  
                  const media = await syncRes.json();
                  actualMediaId = media.id;
                } else if (schedulingMovie.id.startsWith('youtube-')) {
                  // If it's a YouTube video, sync it first to get the database media ID
                  const syncRes = await fetch('/api/media/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ youtubeId: mediaId }),
                  });
                  
                  if (!syncRes.ok) {
                    // Revert optimistic update on error
                    if (activeGroup === groupId) {
                      setGroupMovies(previousGroupMovies);
                      queryClient.setQueryData(['groupWatchlist', groupId], previousGroupMovies);
                    }
                    const errorData = await syncRes.json().catch(() => ({ error: 'Failed to sync' }));
                    console.error('Failed to sync YouTube video:', errorData);
                    toast.showError('Failed to add YouTube video. Please try again.');
                    return;
                  }
                  
                  const media = await syncRes.json();
                  actualMediaId = media.id;
                }
                
                // Add to group watchlist
                const addRes = await fetch('/api/watchlist', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mediaId: actualMediaId, teamId: groupId }),
                });
                
                if (!addRes.ok) {
                  // Revert optimistic update on error
                  if (activeGroup === groupId) {
                    setGroupMovies(previousGroupMovies);
                    queryClient.setQueryData(['groupWatchlist', groupId], previousGroupMovies);
                  }
                  const errorData = await addRes.json().catch(() => ({ error: 'Failed to add' }));
                  console.error('Failed to add to watchlist:', errorData);
                  const errorMessage = errorData.error || 'Failed to add movie to watchlist. Please try again.';
                  if (errorData.error === 'Already in watchlist') {
                    toast.showWarning('Already in watchlist');
                  } else {
                    toast.showError(errorMessage);
                  }
                  return;
                }
                
                // Get the actual movie data from the response
                const addedMovie = await addRes.json();
                
                // Show success message only after API call succeeds
                toast.showSuccess(`Added ${schedulingMovie.title} to group watchlist!`);
                
                // Update with actual data if viewing that group
                if (activeGroup === groupId) {
                  // Replace optimistic update with actual data
                  setGroupMovies(prev => {
                    // Remove the optimistic movie and add the real one
                    const filtered = prev.filter(m => m.id !== actualMediaId && m.id !== schedulingMovie.id);
                    return [...filtered, addedMovie];
                  });
                  // Update query cache with actual data
                  queryClient.setQueryData<Movie[]>(['groupWatchlist', groupId], (old = []) => {
                    const filtered = old.filter(m => m.id !== actualMediaId && m.id !== schedulingMovie.id);
                    return [...filtered, addedMovie];
                  });
                } else {
                  // If not viewing that group, just invalidate to refresh when they navigate to it
                  queryClient.invalidateQueries({ queryKey: ['groupWatchlist', groupId] });
                }
                
                // Also invalidate group query to ensure consistency
                queryClient.invalidateQueries({ queryKey: ['group', groupId] });
              } catch (error) {
                // Revert optimistic update on error
                if (activeGroup === groupId) {
                  setGroupMovies(previousGroupMovies);
                  queryClient.setQueryData(['groupWatchlist', groupId], previousGroupMovies);
                }
                console.error('Error adding to watchlist:', error);
                toast.showError('An error occurred. Please try again.');
              }
            })();
          }} 
        />
      )}
    </div>
  );
}

const Home = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
};

export default Home;
