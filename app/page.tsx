'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import MovieGrid from '@/components/MovieGrid';
import InboxView from '@/components/InboxView';
import WatchlistView from '@/components/WatchlistView';
import HistoryView from '@/components/HistoryView';
import SettingsView from '@/components/SettingsView';
import GroupView from '@/components/GroupView';
import ProfileView from '@/components/ProfileView';
import TitleDetailView from '@/components/TitleDetailView';
import CustomSortModal from '@/components/CustomSortModal';
import AIRecommendationModal from '@/components/AIRecommendationModal';
import SchedulingModal from '@/components/SchedulingModal';
import RandomPickerModal from '@/components/RandomPickerModal';
import FilterDrawer from '@/components/FilterDrawer';
import AddFriendModal from '@/components/AddFriendModal';
import CreateGroupModal from '@/components/CreateGroupModal';
import JoinGroupModal from '@/components/JoinGroupModal';
import { Movie, User, Group } from '@/lib/types';
import { transformTMDBMovieToMovieSync, transformTeamToGroup, transformMediaToMovie } from '@/lib/utils/transformers';
import { TMDBMovie, getGenres } from '@/lib/api/tmdb';
import { getPosterUrl } from '@/lib/api/tmdb';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genreMap, setGenreMap] = useState<Map<number, string>>(new Map());
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'Home');
  const [activeGroup, setActiveGroup] = useState<string | null>(searchParams.get('group') || null);
  const [activeProfile, setActiveProfile] = useState<User | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [schedulingMovie, setSchedulingMovie] = useState<Movie | null>(null);
  const [sortBy, setSortBy] = useState<string>('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [groupMovies, setGroupMovies] = useState<Movie[]>([]);

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

  // Fetch genres on mount
  useEffect(() => {
    getGenres().then(genres => {
      const map = new Map(genres.map(g => [g.id, g.name]));
      setGenreMap(map);
    });
  }, []);

  // Fetch movies based on sortBy
  const { data: moviesData, isLoading: moviesLoading } = useQuery({
    queryKey: ['movies', sortBy],
    queryFn: async () => {
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
      return [];
    },
    enabled: searchQuery.trim().length > 0 && genreMap.size > 0,
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

  const filteredAndSortedMovies = useMemo(() => {
    let result = [...movies];
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'Top Rated': return b.votes - a.votes;
        case 'New Releases': return b.year - a.year;
        case 'Trending':
        default: return 0;
      }
    });
  }, [movies, sortBy]);

  const renderContent = () => {
    const key = selectedMovie?.id || activeProfile?.id || activeGroup || activeTab;
    
    let content;
    if (selectedMovie) content = <TitleDetailView movie={selectedMovie} onBack={() => setSelectedMovie(null)} />;
    else if (activeProfile) content = <ProfileView user={activeProfile} />;
    else if (activeGroup) {
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
              className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all"
            >
              Retry
            </button>
          </div>
        );
      } else if (groupData) {
        content = (
          <GroupView 
            group={groupData} 
            movies={groupMovies}
            onVote={async (id) => {
              try {
                let mediaId = id.startsWith('tmdb-') ? id.replace('tmdb-', '') : id;
                
                // If it's a TMDB ID, sync it first
                if (id.startsWith('tmdb-')) {
                  const syncRes = await fetch('/api/media/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tmdbId: mediaId, type: 'movie' }),
                  });
                  if (syncRes.ok) {
                    const media = await syncRes.json();
                    mediaId = media.id;
                  }
                }
                
                // Try to upvote first
                let res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${activeGroup}`, {
                  method: 'POST',
                });
                
                // If not in watchlist, add it first then upvote
                if (!res.ok && res.status === 404) {
                  const addRes = await fetch('/api/watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mediaId, teamId: activeGroup }),
                  });
                  if (addRes.ok) {
                    // Now upvote
                    res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${activeGroup}`, {
                      method: 'POST',
                    });
                  }
                }
                
                if (res.ok) {
                  const data = await res.json();
                  setGroupMovies(prev => prev.map(m => m.id === id ? {...m, votes: data.upvotes} : m));
                }
              } catch (error) {
                console.error('Failed to vote:', error);
              }
            }}
            onSchedule={(movie) => setSchedulingMovie(movie)}
            onSelect={handleMovieSelect}
          />
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
        case 'Inbox': content = <InboxView />; break;
        case 'Watchlists': content = <WatchlistView />; break;
        case 'History': content = <HistoryView />; break;
        case 'Settings': content = <SettingsView />; break;
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
                      className="w-full bg-[#111] border border-[#222] rounded-xl py-2.5 pl-12 pr-4 outline-none focus:border-[var(--accent-color)]/50 transition-all text-xs font-medium text-main"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsFilterDrawerOpen(true)}
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all text-main"
                    >
                      <i className="fa-solid fa-sliders text-[var(--accent-color)]"></i>
                      Filters
                    </button>
                    <button 
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all text-main"
                    >
                      <i className="fa-solid fa-bookmark text-[var(--accent-color)]"></i>
                      Presets
                    </button>
                    <button 
                      onClick={() => setIsCustomSortOpen(true)}
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all text-main"
                    >
                      <i className="fa-solid fa-arrow-down-wide-short text-[var(--accent-color)]"></i>
                      Sort
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['Trending', 'Top Rated', 'New Releases'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`whitespace-nowrap px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                        sortBy === opt 
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black' 
                          : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300'
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
                      try {
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
                        
                        // Optimistic update - update UI immediately
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
                        
                        // Update the query cache immediately
                        queryClient.setQueryData(['watchlist', 'personal'], newWatchlist);
                        
                        // Now do the actual API call in the background
                        // Extract mediaId from id (could be tmdb-123 or uuid)
                        let mediaId = id.startsWith('tmdb-') ? id.replace('tmdb-', '') : id;
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
                            alert('Failed to add movie. Please try again.');
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
                            alert('Failed to remove from watchlist. Please try again.');
                            return;
                          }
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
                            alert(errorData.error || 'Failed to add to watchlist. Please try again.');
                            return;
                          }
                        }
                        
                        // Refetch to ensure we have the latest data (with correct IDs)
                        await refetchPersonalWatchlist();
                      } catch (error) {
                        // Revert optimistic update on error
                        queryClient.setQueryData(['watchlist', 'personal'], personalWatchlist);
                        console.error('Failed to toggle watchlist:', error);
                        alert('An error occurred. Please try again.');
                      }
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
      <div key={key} className="page-transition flex-1 flex flex-col min-h-0">
        {content}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-main text-main overflow-hidden">
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

      <main className="flex-1 flex flex-col px-8 pt-6 transition-all duration-300 overflow-hidden">
        <Header 
          groupName={activeGroup ? "Group" : (selectedMovie ? selectedMovie.title : "cozybxd")} 
          isHome={activeTab === 'Home' && !activeGroup && !activeProfile && !selectedMovie}
          onNotificationClick={() => handleTabChange('Inbox')}
          onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
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
          renderContent()
        )}
      </main>

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} />
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
      {isCustomSortOpen && <CustomSortModal onClose={() => setIsCustomSortOpen(false)} />}
      {isAIModalOpen && <AIRecommendationModal onClose={() => setIsAIModalOpen(false)} onAdd={(m) => setMovies([m, ...movies])} groupContext={{ members: currentUser ? [currentUser] : [], history: movies }} />}
      {isRandomModalOpen && <RandomPickerModal movies={movies} onClose={() => setIsRandomModalOpen(false)} onSelect={(m) => { setSchedulingMovie(m); setSelectedMovie(null); }} />}
      {schedulingMovie && (
        <SchedulingModal 
          movie={schedulingMovie} 
          onClose={() => setSchedulingMovie(null)} 
          onConfirm={async (groupId: string, interestLevel: number) => {
            try {
              let mediaId = schedulingMovie.id.startsWith('tmdb-') 
                ? schedulingMovie.id.replace('tmdb-', '') 
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
                  const errorData = await syncRes.json().catch(() => ({ error: 'Failed to sync' }));
                  console.error('Failed to sync media:', errorData);
                  alert('Failed to add movie. Please try again.');
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
                const errorData = await addRes.json().catch(() => ({ error: 'Failed to add' }));
                console.error('Failed to add to watchlist:', errorData);
                alert(errorData.error || 'Failed to add movie to watchlist. Please try again.');
                return;
              }
              
              // Refresh watchlist if viewing that group
              if (activeGroup === groupId) {
                queryClient.invalidateQueries({ queryKey: ['groupWatchlist', groupId] });
                queryClient.invalidateQueries({ queryKey: ['group', groupId] });
              }
              
              // Close modal on success
              setSchedulingMovie(null);
            } catch (error) {
              console.error('Error adding to watchlist:', error);
              alert('An error occurred. Please try again.');
            }
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
