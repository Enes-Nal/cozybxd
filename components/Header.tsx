'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Movie } from '@/lib/types';
import { TMDBMovie } from '@/lib/api/tmdb';
import { transformTMDBMovieToMovieSync, transformYouTubeVideoToMovie } from '@/lib/utils/transformers';
import { getGenres } from '@/lib/api/tmdb';

interface HeaderProps {
  groupName: string;
  isHome?: boolean;
  onNotificationClick: () => void;
  onProfileClick: () => void;
  onMovieSelect?: (movie: Movie) => void;
}

const Header: React.FC<HeaderProps> = ({ groupName, isHome, onNotificationClick, onProfileClick, onMovieSelect }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch genres for transformation
  const { data: genres } = useQuery<Map<number, string>>({
    queryKey: ['genres'],
    queryFn: async () => {
      const genreList = await getGenres();
      return new Map(genreList.map(g => [g.id, g.name]));
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch search results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['headerSearch', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      
      const data = await res.json();
      
      // Check if it's a YouTube URL (doesn't need genres)
      const isYouTube = debouncedQuery.includes('youtube.com') || debouncedQuery.includes('youtu.be');
      
      if (data.type === 'movie' && data.results) {
        if (genres && genres instanceof Map && genres.size > 0) {
          return data.results.map((tmdbMovie: TMDBMovie) => 
            transformTMDBMovieToMovieSync(tmdbMovie, genres)
          );
        } else {
          // Fallback: return basic movie data without genre transformation
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

  // Show dropdown when there's a query and results
  useEffect(() => {
    if (searchQuery.trim().length > 0 && (searchResults || isSearching)) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [searchQuery, searchResults, isSearching]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMovieClick = (movie: Movie) => {
    setSearchQuery('');
    setShowDropdown(false);
    if (onMovieSelect) {
      onMovieSelect(movie);
    } else {
      // Fallback: navigate to home and trigger search there
      router.push('/');
    }
  };

  const handleInputFocus = () => {
    if (searchQuery.trim().length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <header className="flex items-center justify-between no-glow relative pb-4">
      <div className="flex-1">
        {/* Title area or context info */}
      </div>

      <div className="flex items-center gap-6">
        {!isHome && (
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl border-main no-glow">
              <i className="fa-solid fa-magnifying-glass text-gray-500 text-xs"></i>
              <input 
                ref={inputRef}
                type="text" 
                placeholder="Search titles..." 
                className="bg-transparent border-none outline-none text-xs w-56 placeholder:text-gray-600 font-medium text-main"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleInputFocus}
              />
              {isSearching && (
                <i className="fa-solid fa-spinner fa-spin text-gray-500 text-xs"></i>
              )}
            </div>
            
            {showDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto overflow-x-hidden bg-[#111] border border-[#222] rounded-xl shadow-2xl z-50">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500 text-xs">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Searching...
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="py-2">
                    {searchResults.slice(0, 10).map((movie: Movie) => (
                      <button
                        key={movie.id}
                        onClick={() => handleMovieClick(movie)}
                        className="w-full px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex items-center gap-3 text-left"
                      >
                        {movie.poster ? (
                          <img 
                            src={movie.poster} 
                            alt={movie.title}
                            className="w-12 h-18 object-cover rounded flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-18 bg-[#222] rounded flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-image text-gray-600 text-xs"></i>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-sm font-medium text-main truncate">{movie.title}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {movie.year} {movie.runtime && `• ${movie.runtime}`}
                          </div>
                          {movie.genre && movie.genre.length > 0 && (
                            <div className="text-xs text-gray-600 truncate">
                              {movie.genre.slice(0, 2).join(', ')}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : debouncedQuery.trim().length > 0 ? (
                  <div className="p-4 text-center text-gray-500 text-xs">
                    No results found
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
