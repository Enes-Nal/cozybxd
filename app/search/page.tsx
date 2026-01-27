'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import MovieGrid from '@/components/MovieGrid';
import TitleDetailView from '@/components/TitleDetailView';
import { Movie, User } from '@/lib/types';
import { transformTMDBMovieToMovieSync, transformYouTubeVideoToMovie } from '@/lib/utils/transformers';
import { TMDBMovie, getGenres } from '@/lib/api/tmdb';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const query = searchParams.get('q') || '';
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genreMap, setGenreMap] = useState<Map<number, string>>(new Map());
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [activeTab, setActiveTab] = useState('Home');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState(query);
  const [useNavbar, setUseNavbar] = useState(true);
  
  // Update searchQuery when URL query changes
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    setSearchQuery(urlQuery);
  }, [searchParams]);

  // Update useNavbar from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem('useNavbar');
    if (saved !== null) {
      setUseNavbar(saved === 'true');
    }
  }, []);

  // Fetch genres
  useEffect(() => {
    getGenres().then(genres => {
      const map = new Map<number, string>();
      genres.forEach(genre => {
        map.set(genre.id, genre.name);
      });
      setGenreMap(map);
    });
  }, []);

  // Fetch current user
  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  const currentUser: User | null = currentUserData || null;

  // Fetch personal watchlist for vote status
  const { data: personalWatchlist = [] } = useQuery({
    queryKey: ['watchlist', 'personal'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Search functionality
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(query)}`);
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
    enabled: query.trim().length > 0 && (genreMap.size > 0 || query.includes('youtube.com') || query.includes('youtu.be')),
  });

  // Update movies when search results change
  useEffect(() => {
    if (searchResults) {
      setMovies(searchResults);
    }
  }, [searchResults]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/?tab=${tab}`);
  };

  const handleGroupSelect = (id: string) => {
    setActiveGroup(id);
    router.push(`/?tab=Group&group=${id}`);
  };

  const handleProfileSelect = (user: User) => {
    setActiveProfile(user);
    router.push(`/?tab=Profile&user=${user.id}`);
  };

  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
  };

  const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  if (selectedMovie) {
    return (
      <div className={`${useNavbar ? 'flex flex-col navbar-mode' : 'flex'} h-screen bg-main text-main overflow-hidden`}>
        {useNavbar ? (
          <Navbar 
            activeTab={activeTab} 
            setActiveTab={handleTabChange} 
            onGroupSelect={handleGroupSelect} 
            onFriendSelect={handleProfileSelect}
            onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
            onAddFriendClick={() => {}}
            onCreateGroupClick={() => {}}
            onJoinGroupClick={() => {}}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
          />
        ) : (
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={handleTabChange} 
            onGroupSelect={handleGroupSelect} 
            onFriendSelect={handleProfileSelect}
            onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
            onAddFriendClick={() => {}}
            onCreateGroupClick={() => {}}
            onJoinGroupClick={() => {}}
          />
        )}
        <main className={`flex-1 flex flex-col ${useNavbar ? 'px-8 pt-4' : 'px-8 pt-6'} transition-all duration-300 overflow-hidden`}>
          <TitleDetailView movie={selectedMovie} onBack={() => setSelectedMovie(null)} />
        </main>
      </div>
    );
  }

  return (
    <div className={`${useNavbar ? 'flex flex-col navbar-mode' : 'flex'} h-screen bg-main text-main overflow-hidden`}>
      {useNavbar ? (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          onGroupSelect={handleGroupSelect} 
          onFriendSelect={handleProfileSelect}
          onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
          onAddFriendClick={() => {}}
          onCreateGroupClick={() => {}}
          onJoinGroupClick={() => {}}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
        />
      ) : (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          onGroupSelect={handleGroupSelect} 
          onFriendSelect={handleProfileSelect}
          onProfileClick={() => currentUser && handleProfileSelect(currentUser)}
          onAddFriendClick={() => {}}
          onCreateGroupClick={() => {}}
          onJoinGroupClick={() => {}}
        />
      )}

      <main className={`flex-1 flex flex-col ${useNavbar ? 'px-8 pt-4' : 'px-8 pt-6'} transition-all duration-300 ${useNavbar ? 'overflow-hidden' : 'overflow-y-auto'} smooth-scroll`}>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-main mb-2">
              {query ? `Search results for "${query}"` : 'Search'}
            </h1>
            {query && (
              <p className="text-sm text-gray-400">
                {searchLoading ? 'Searching...' : movies.length > 0 ? `Found ${movies.length} result${movies.length !== 1 ? 's' : ''}` : 'No results found'}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 pb-20 min-h-0 w-full max-w-full">
            {!query ? (
              <div className="flex items-center justify-center h-64 w-full max-w-full">
                <div className="text-gray-500">Enter a search query to get started</div>
              </div>
            ) : searchLoading ? (
              <div className="flex items-center justify-center h-64 w-full max-w-full">
                <div className="text-gray-500">Loading search results...</div>
              </div>
            ) : movies.length === 0 ? (
              <div className="flex items-center justify-center h-64 w-full max-w-full">
                <div className="text-gray-500">No results found for "{query}"</div>
              </div>
            ) : (
              <MovieGrid 
                movies={movies}
                personalWatchlist={personalWatchlist}
                onVote={async (id) => {
                  // Find the current movie
                  const currentMovie = movies.find(mov => mov.id === id);
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
                  
                  if (isInWatchlist) {
                    // Remove from watchlist
                    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
                  } else {
                    // Add to watchlist
                    await fetch('/api/watchlist', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mediaId: id }),
                    });
                  }
                }}
                onSchedule={(id) => {
                  const movie = movies.find(m => m.id === id);
                  if (movie) {
                    // Navigate to home with scheduling modal or handle scheduling
                    router.push(`/?schedule=${id}`);
                  }
                }}
                onSelect={handleMovieSelect}
                users={[]}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

