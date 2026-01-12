'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Movie, User } from '@/lib/types';
import SchedulingModal from './SchedulingModal';
import { getMovieDetailsWithCredits, getProfileUrl } from '@/lib/api/tmdb';

interface TitleDetailViewProps {
  movie: Movie;
  onBack: () => void;
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

const TitleDetailView: React.FC<TitleDetailViewProps> = ({ movie, onBack }) => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingWatchCount, setIsUpdatingWatchCount] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const tabs = ['Overview', 'Where to Find', 'Cast', 'Collections', 'Reviews', 'Stats', 'Friends'];

  // Extract TMDB ID from movie.id (format: "tmdb-{id}" or UUID)
  const tmdbId = movie.id.startsWith('tmdb-') ? parseInt(movie.id.replace('tmdb-', '')) : null;
  const mediaId = movie.id.startsWith('tmdb-') ? null : movie.id;

  // Fetch movie details with credits and collection
  const { data: movieDetails } = useQuery({
    queryKey: ['movieDetails', tmdbId],
    queryFn: async () => {
      if (!tmdbId) return null;
      return await getMovieDetailsWithCredits(tmdbId);
    },
    enabled: !!tmdbId,
  });

  // Fetch reviews
  const { data: reviews = [], refetch: refetchReviews } = useQuery({
    queryKey: ['movieReviews', mediaId || tmdbId],
    queryFn: async () => {
      if (mediaId) {
        const res = await fetch(`/api/media/${mediaId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.reviews || [];
      }
      // For TMDB movies, query by tmdbId
      if (tmdbId) {
        const res = await fetch(`/api/reviews?tmdbId=${tmdbId}`);
        if (!res.ok) return [];
        return await res.json();
      }
      return [];
    },
    enabled: !!(mediaId || tmdbId),
  });

  // Fetch logs (viewing history) - check both media endpoint and history API
  const { data: logs = [] } = useQuery({
    queryKey: ['movieLogs', mediaId || tmdbId, session?.user?.id],
    queryFn: async () => {
      const allLogs: any[] = [];
      
      // Try to get logs from media endpoint if mediaId exists
      if (mediaId) {
        const res = await fetch(`/api/media/${mediaId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.logs) {
            allLogs.push(...data.logs);
          }
        }
      }
      
      // Also check personal history for this specific movie
      if (session?.user?.id) {
        const historyRes = await fetch('/api/history');
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          // Find logs for this movie
          const movieHistory = historyData.filter((item: any) => {
            // Match by ID format
            if (mediaId && item.id === mediaId) return true;
            if (tmdbId && item.id === `tmdb-${tmdbId}`) return true;
            // Also match by title as fallback
            if (item.title === movie.title) return true;
            return false;
          });
          
          // Convert history items to log format
          movieHistory.forEach((item: any) => {
            if (item.attendees && item.attendees.length > 0) {
              allLogs.push({
                id: item.id,
                watched_at: item.watchedAt,
                log_attendees: item.attendees.map((a: any) => ({
                  user_id: a.user_id || a.userId,
                  ...a
                })),
              });
            }
          });
        }
      }
      
      return allLogs;
    },
    enabled: !!(mediaId || tmdbId || session?.user?.id),
  });

  // Fetch user's watch count for this movie
  const { data: userWatchCount = 0, refetch: refetchWatchCount } = useQuery({
    queryKey: ['userWatchCount', mediaId || tmdbId, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return 0;
      
      const params = new URLSearchParams();
      if (mediaId) params.append('mediaId', mediaId);
      if (tmdbId) params.append('tmdbId', tmdbId.toString());
      
      const res = await fetch(`/api/history/count?${params.toString()}`);
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count || 0;
    },
    enabled: !!session?.user?.id && !!(mediaId || tmdbId),
  });

  // Check if user has watched this movie
  const { data: userHasWatched, refetch: refetchWatchedStatus } = useQuery({
    queryKey: ['userWatched', mediaId || tmdbId, movie.title, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      
      // Check history API first (most reliable)
      try {
        const historyRes = await fetch('/api/history');
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          // Check if this movie is in the user's history
          const found = historyData.some((item: any) => {
            // Match by ID format (tmdb-{id} or UUID)
            if (mediaId && item.id === mediaId) return true;
            if (tmdbId && item.id === `tmdb-${tmdbId}`) return true;
            // Also match by title as fallback (case-insensitive)
            if (item.title && movie.title && item.title.toLowerCase() === movie.title.toLowerCase()) return true;
            return false;
          });
          if (found) return true;
        }
      } catch (error) {
        console.error('Error checking history:', error);
      }
      
      // Also check logs if available
      if (logs && logs.length > 0) {
        const userInLogs = logs.some((log: any) =>
          log.log_attendees?.some((attendee: any) => {
            const userId = attendee.user_id || attendee.userId;
            return userId === session.user.id;
          })
        );
        if (userInLogs) return true;
      }
      
      return false;
    },
    enabled: !!session?.user?.id && !!(mediaId || tmdbId || movie.title),
    staleTime: 0, // Always check fresh data
    refetchOnMount: true, // Always refetch when component mounts
  });
  
  // Refetch watched status when component mounts or when mediaId/tmdbId changes
  useEffect(() => {
    if (session?.user?.id && (mediaId || tmdbId)) {
      refetchWatchedStatus();
    }
  }, [session?.user?.id, mediaId, tmdbId, refetchWatchedStatus]);

  // Update current status based on watched status
  useEffect(() => {
    // Set status from query result - only update if we have a definitive answer
    if (userHasWatched === true) {
      setCurrentStatus('Finished');
    } else if (userHasWatched === false && currentStatus === null) {
      // Only set to null if it was never set (initial load)
      // Don't reset if user just saved it
    }
  }, [userHasWatched]);

  // Also check logs directly on mount and when logs change
  useEffect(() => {
    if (logs && logs.length > 0 && session?.user?.id && currentStatus !== 'Finished') {
      const userInLogs = logs.some((log: any) =>
        log.log_attendees?.some((attendee: any) => {
          const userId = attendee.user_id || attendee.userId;
          return userId === session.user.id;
        })
      );
      if (userInLogs) {
        setCurrentStatus('Finished');
      }
    }
  }, [logs, session?.user?.id]);

  // Fetch friends
  const { data: friendsData = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await fetch('/api/friends');
      if (!res.ok) return [];
      return await res.json();
    },
  });

  // Fetch count of friends who have this media in their watchlist
  const { data: friendsWithMediaCount = 0 } = useQuery({
    queryKey: ['friendsWithMedia', mediaId || tmdbId, friendsData.length],
    queryFn: async () => {
      if (!session?.user?.id || friendsData.length === 0) return 0;
      if (!mediaId && !tmdbId) return 0;

      try {
        const friendIds = friendsData.map((friend: User) => friend.id);
        
        // Query each friend's watchlist and check if they have this media
        // We'll batch the requests to avoid too many simultaneous calls
        const batchSize = 5;
        let count = 0;
        
        for (let i = 0; i < friendIds.length; i += batchSize) {
          const batch = friendIds.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (friendId: string) => {
              try {
                const res = await fetch(`/api/watchlist?userId=${friendId}`);
                if (!res.ok) return false;
                const watchlist = await res.json();
                return watchlist.some((item: Movie) => {
                  // Match by mediaId (UUID)
                  if (mediaId && item.id === mediaId) return true;
                  // Match by tmdbId format
                  if (tmdbId && item.id === `tmdb-${tmdbId}`) return true;
                  // Match by title as fallback (case-insensitive)
                  if (item.title && movie.title && 
                      item.title.toLowerCase() === movie.title.toLowerCase()) return true;
                  return false;
                });
              } catch {
                return false;
              }
            })
          );
          count += batchResults.filter(Boolean).length;
        }
        
        return count;
      } catch (error) {
        console.error('Error fetching friends with media count:', error);
        return 0;
      }
    },
    enabled: !!session?.user?.id && friendsData.length > 0 && !!(mediaId || tmdbId),
  });

  // Get friends who have watched this movie (for Friends tab)
  const friendsWithMovie = friendsData.filter((friend: User) => 
    movie.seenBy?.includes(friend.id)
  );

  const cast = movieDetails?.credits?.cast || [];
  const collection = movieDetails?.belongs_to_collection || null;

  // Format runtime - prefer movieDetails runtime (from TMDB API) if available
  const formatRuntime = (): string | null => {
    // If we have runtime from TMDB API (in minutes), use that
    if (movieDetails?.runtime && movieDetails.runtime > 0) {
      const hours = Math.floor(movieDetails.runtime / 60);
      const minutes = movieDetails.runtime % 60;
      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      }
    }
    // Fall back to movie.runtime (already formatted string) if it exists and is not empty
    return movie.runtime && movie.runtime.trim() ? movie.runtime : null;
  };

  const displayRuntime = formatRuntime();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showAddDropdown && 
          dropdownRef.current && !dropdownRef.current.contains(target) &&
          buttonRef.current && !buttonRef.current.contains(target)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddDropdown]);

  useEffect(() => {
    const updateDropdownPosition = () => {
      if (showAddDropdown && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      } else {
        setDropdownPosition(null);
      }
    };

    updateDropdownPosition();

    if (showAddDropdown) {
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }

    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [showAddDropdown]);

  const listOptions = ['Want to Watch', 'Watching', 'Finished', 'Favorites', 'Custom List...'];

  // Check if user has already reviewed this movie
  const userReview = reviews.find((review: any) => review.user_id === session?.user?.id);

  // Initialize form with existing review if available
  useEffect(() => {
    if (userReview && showReviewForm) {
      setReviewRating(userReview.rating);
      setReviewComment(userReview.comment || '');
    } else if (showReviewForm && !userReview) {
      setReviewRating(5);
      setReviewComment('');
    }
  }, [userReview, showReviewForm]);

  const handleSubmitReview = async () => {
    if (!session?.user?.id) {
      alert('Please sign in to add a review');
      return;
    }

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      alert('Please select a rating between 1 and 5');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: mediaId || undefined,
          tmdbId: tmdbId || undefined,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to submit review' }));
        throw new Error(error.error || 'Failed to submit review');
      }

      // Close form and refresh reviews
      setShowReviewForm(false);
      await refetchReviews();
      await queryClient.invalidateQueries({ queryKey: ['movieReviews'] });
      
      // Also invalidate stats
      await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleStatusSelect = async (status: string) => {
    if (!session?.user?.id) {
      alert('Please sign in to save your status');
      return;
    }

    setShowAddDropdown(false);

    // Handle "Finished" status toggle
    if (status === 'Finished') {
      // If already "Finished", remove it
      if (currentStatus === 'Finished') {
        setIsSaving(true);
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

          // Reset status
          setCurrentStatus(null);

          // Invalidate queries to refresh data
          await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
          await queryClient.invalidateQueries({ queryKey: ['userWatched'] });
          await queryClient.invalidateQueries({ queryKey: ['history'] });
          await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
          
          // If mediaId exists, also invalidate media queries
          if (mediaId) {
            await queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
          }
          
          // Refetch immediately
          await refetchWatchedStatus();
          await queryClient.refetchQueries({ queryKey: ['movieLogs', mediaId || tmdbId, session?.user?.id] });
        } catch (error) {
          console.error('Failed to remove from history:', error);
          alert(error instanceof Error ? error.message : 'Failed to remove from history');
          // Keep status as Finished on error
          setCurrentStatus('Finished');
        } finally {
          setIsSaving(false);
        }
      } else {
        // Not finished yet, add it
        setIsSaving(true);
        try {
          const response = await fetch('/api/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mediaId: mediaId || undefined,
              tmdbId: tmdbId || undefined,
              watchedAt: new Date().toISOString(),
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to save' }));
            throw new Error(error.error || 'Failed to save watched status');
          }

          // Set status to Finished
          setCurrentStatus('Finished');

          // Invalidate queries to refresh data
          await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
          await queryClient.invalidateQueries({ queryKey: ['userWatched'] });
          await queryClient.invalidateQueries({ queryKey: ['history'] });
          await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
          
          // If mediaId exists, also invalidate media queries
          if (mediaId) {
            await queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
          }
          
          // Refetch immediately
          await refetchWatchedStatus();
          await queryClient.refetchQueries({ queryKey: ['movieLogs', mediaId || tmdbId, session?.user?.id] });
        } catch (error) {
          console.error('Failed to save watched status:', error);
          alert(error instanceof Error ? error.message : 'Failed to save watched status');
          // Revert status on error
          setCurrentStatus(null);
        } finally {
          setIsSaving(false);
        }
      }
    } else if (status === 'Watching') {
      // Handle "Watching" status (always add, no toggle)
      setCurrentStatus(status);
      setIsSaving(true);
      try {
        const response = await fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId: mediaId || undefined,
            tmdbId: tmdbId || undefined,
            watchedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to save' }));
          throw new Error(error.error || 'Failed to save watched status');
        }

        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
        await queryClient.invalidateQueries({ queryKey: ['userWatched'] });
        await queryClient.invalidateQueries({ queryKey: ['history'] });
        await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        
        // If mediaId exists, also invalidate media queries
        if (mediaId) {
          await queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
        }
        
        // Refetch immediately
        await refetchWatchedStatus();
        await queryClient.refetchQueries({ queryKey: ['movieLogs', mediaId || tmdbId, session?.user?.id] });
      } catch (error) {
        console.error('Failed to save watched status:', error);
        alert(error instanceof Error ? error.message : 'Failed to save watched status');
        // Revert status on error
        setCurrentStatus(null);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Other statuses (Want to Watch, Favorites, etc.) - just set the status
      setCurrentStatus(status);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 animate-in fade-in duration-700 bg-main scrollbar-hide">
      {/* Hero Banner Section - Smaller Scale */}
      <div className="relative min-h-[380px] w-full group overflow-hidden rounded-[2rem] mt-4 border border-main">
        {/* Background Image with blur */}
        <div 
          className="absolute inset-0 bg-cover bg-center scale-105 opacity-30 blur-xl" 
          style={{ backgroundImage: `url(${movie.poster})` }}
        ></div>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        <button onClick={onBack} className="absolute top-6 left-6 glass w-8 h-8 rounded-full flex items-center justify-center hover:brightness-125 transition-all z-20 border-main bg-black/20">
          <i className="fa-solid fa-chevron-left text-[10px] text-main"></i>
        </button>

        <div className="relative h-full flex items-center px-10 py-10 max-w-6xl mx-auto z-10 gap-10">
          {/* Poster Section - Compact */}
          <div className="w-48 aspect-[2/3] relative hidden md:block shrink-0 shadow-2xl self-center animate-in slide-in-from-left duration-500">
            <div className="absolute inset-0 rounded-[1.2rem] overflow-hidden border-[3px] border-white/90">
              {movie.poster ? (
                <img src={movie.poster} className="w-full h-full object-cover" alt={movie.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <i className="fa-solid fa-image text-gray-600 text-3xl"></i>
                </div>
              )}
              {movieDetails?.vote_average && (
                <div className="absolute top-2 right-2 glass px-1.5 py-0.5 rounded-md text-[9px] font-black text-main border-main bg-black/60 backdrop-blur-md">
                  <i className="fa-solid fa-star text-yellow-500 mr-1"></i> {movieDetails.vote_average.toFixed(1)}
                </div>
              )}
            </div>
          </div>

          {/* Info Section - Smaller text for better hierarchy */}
          <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-right duration-500">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black text-main tracking-tight leading-none">{movie.title}</h1>
            </div>
            
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-base font-black text-main">{movie.year}</span>
              {displayRuntime && (
                <>
                  <span className="text-gray-500/40 text-xs">•</span>
                  <span className="text-sm font-semibold text-main/80">{displayRuntime}</span>
                </>
              )}
              <span className="text-gray-500/40 text-xs">•</span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-300 bg-white/5 border border-white/10">
                Movie
              </span>
              <span className="text-gray-500/40 text-xs">•</span>
              <div className="flex items-center gap-2 flex-wrap">
                {movie.genre.map((genre, idx) => (
                  <span key={idx} className="text-sm font-medium text-main/60">
                    {genre}{idx < movie.genre.length - 1 && <span className="text-gray-500/30 mx-1">,</span>}
                  </span>
                ))}
              </div>
            </div>
            
            {movie.description && (
              <p className="text-sm text-main/50 max-w-xl leading-relaxed mb-6 font-medium line-clamp-3">
                {movie.description}
              </p>
            )}
            
            <div className="flex items-center gap-3 relative">
              <div className="flex bg-accent rounded-xl overflow-visible shadow-lg shadow-accent/20 relative h-11" ref={buttonRef}>
                <button 
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                  disabled={isSaving}
                  className="px-6 text-white font-black uppercase text-[9px] tracking-[0.15em] hover:brightness-110 transition-all min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SAVING...' : (currentStatus || 'ADD TO LIST')}
                </button>
                <button 
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                  disabled={isSaving}
                  className="px-4 border-l border-white/20 text-white hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <i className={`fa-solid fa-chevron-${showAddDropdown ? 'up' : 'down'} text-[8px]`}></i>
                </button>
              </div>

              {showAddDropdown && dropdownPosition && typeof window !== 'undefined' && createPortal(
                <div 
                  ref={dropdownRef}
                  className="fixed glass border-main rounded-xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-1 duration-200 shadow-2xl bg-[#111]"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`
                  }}
                >
                  {listOptions.map((opt) => (
                    <button 
                      key={opt}
                      onClick={() => handleStatusSelect(opt)}
                      className={`w-full px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${currentStatus === opt ? 'text-accent' : 'text-main'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>,
                document.body
              )}
              
              <button className="glass w-11 h-11 rounded-xl flex items-center justify-center border-main hover:bg-white/5 transition-all group bg-black/20">
                <i className={`fa-solid fa-heart text-xs ${currentStatus === 'Favorites' ? 'text-accent' : 'text-gray-400 group-hover:text-accent'} transition-colors`}></i>
              </button>
              
              <button 
                onClick={() => setIsScheduling(true)}
                className="glass w-11 h-11 rounded-xl flex items-center justify-center border-main hover:bg-white/5 transition-all group bg-black/20"
              >
                <i className="fa-solid fa-plus text-xs text-gray-400 group-hover:text-accent transition-colors"></i>
              </button>

              {friendsWithMediaCount > 0 && (
                <div className="ml-4 flex flex-col justify-center border-l border-white/10 pl-4 h-11">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
                    Added by {friendsWithMediaCount} {friendsWithMediaCount === 1 ? 'friend' : 'friends'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="sticky top-0 z-40 bg-main/80 backdrop-blur-md border-b border-main mt-8 mb-8">
        <div className="max-w-6xl mx-auto px-10 flex gap-8">
          {tabs.map(t => (
            <button 
              key={t}
              onClick={() => setActiveTab(t)}
              className={`py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === t ? 'text-accent' : 'text-gray-500 hover:text-main'}`}
            >
              {t}
              {activeTab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent rounded-t-full"></div>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-10">
        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <h2 className="text-lg font-black text-main mb-4">Description</h2>
                <p className="text-sm text-main/70 leading-relaxed">
                  {movie.description || 'No description available.'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass p-5 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Release Year</div>
                  <div className="text-2xl font-black text-main">{movie.year}</div>
                </div>
                <div className="glass p-5 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Runtime</div>
                  <div className="text-2xl font-black text-main">{displayRuntime || '—'}</div>
                </div>
                <div className="glass p-5 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Genres</div>
                  <div className="flex flex-wrap gap-2">
                    {movie.genre.map((genre, idx) => (
                      <span key={idx} className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${getGenreColor(genre)}`}>
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="glass p-5 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Status</div>
                  <div className="text-sm font-bold text-main">{movie.status}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Where to Find' && (
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <h2 className="text-lg font-black text-main mb-4">Streaming Availability</h2>
                {movie.availability && movie.availability.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {movie.availability.map((service, idx) => (
                      <div key={idx} className="glass p-4 rounded-xl border-main bg-white/[0.02] text-center">
                        <div className="text-sm font-black text-main">{service}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-main/50">No streaming information available.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Cast' && (
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <h2 className="text-lg font-black text-main mb-6">Cast</h2>
                {cast.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {cast.slice(0, 12).map((member) => (
                      <div key={member.id} className="text-center">
                        <div className="w-full aspect-[2/3] rounded-xl overflow-hidden mb-2 border border-main bg-white/[0.02]">
                          {member.profile_path ? (
                            <img 
                              src={getProfileUrl(member.profile_path)} 
                              alt={member.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <i className="fa-solid fa-user text-gray-600 text-2xl"></i>
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-black text-main truncate">{member.name}</div>
                        <div className="text-[10px] text-main/60 truncate">{member.character}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-main/50">Cast information not available.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Collections' && (
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <h2 className="text-lg font-black text-main mb-4">Collection</h2>
                {collection ? (
                  <div className="flex items-center gap-4">
                    <div className="w-32 aspect-[2/3] rounded-xl overflow-hidden border border-main bg-white/[0.02]">
                      {collection.poster_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w300${collection.poster_path}`}
                          alt={collection.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <i className="fa-solid fa-images text-gray-600 text-2xl"></i>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-main mb-2">{collection.name}</h3>
                      <p className="text-sm text-main/60">Part of a collection</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-main/50">This title is not part of a collection.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Reviews' && (
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black text-main">Reviews</h2>
                  {session?.user?.id && (
                    <button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="px-4 py-2 bg-accent text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:brightness-110 transition-all"
                    >
                      {userReview ? 'EDIT REVIEW' : 'ADD REVIEW'}
                    </button>
                  )}
                </div>

                {/* Review Form */}
                {showReviewForm && session?.user?.id && (
                  <div className="glass p-6 rounded-xl border-main bg-white/[0.02] mb-6">
                    <h3 className="text-sm font-black text-main mb-4">
                      {userReview ? 'Edit Your Review' : 'Write a Review'}
                    </h3>
                    
                    {/* Rating Selection */}
                    <div className="mb-4">
                      <label className="text-xs font-bold text-main/70 mb-2 block">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className={`w-10 h-10 rounded-lg border-2 transition-all ${
                              reviewRating >= star
                                ? 'bg-yellow-500 border-yellow-500 text-white'
                                : 'bg-white/5 border-main/30 text-main/50 hover:border-main/50'
                            }`}
                          >
                            <i className="fa-solid fa-star text-sm"></i>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Comment Textarea */}
                    <div className="mb-4">
                      <label className="text-xs font-bold text-main/70 mb-2 block">Comment (Optional)</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share your thoughts about this movie..."
                        className="w-full px-4 py-3 bg-white/5 border border-main/30 rounded-lg text-sm text-main placeholder-main/30 focus:outline-none focus:border-accent/50 resize-none"
                        rows={4}
                      />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview}
                        className="px-6 py-2 bg-accent text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingReview ? 'SUBMITTING...' : 'SUBMIT REVIEW'}
                      </button>
                      <button
                        onClick={() => {
                          setShowReviewForm(false);
                          if (userReview) {
                            setReviewRating(userReview.rating);
                            setReviewComment(userReview.comment || '');
                          } else {
                            setReviewRating(5);
                            setReviewComment('');
                          }
                        }}
                        className="px-6 py-2 bg-white/5 border border-main/30 text-main text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-white/10 transition-all"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {/* Reviews List */}
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review: any) => (
                      <div key={review.id} className="glass p-4 rounded-xl border-main bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {review.users?.image && (
                              <img 
                                src={review.users.image} 
                                alt={review.users.name}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div>
                              <div className="text-sm font-black text-main">
                                {review.users?.name || 'Anonymous'}
                                {review.user_id === session?.user?.id && (
                                  <span className="ml-2 text-[10px] text-accent">(You)</span>
                                )}
                              </div>
                              <div className="text-[10px] text-main/50">
                                {new Date(review.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          {review.rating && (
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <i
                                  key={i}
                                  className={`fa-solid fa-star text-xs ${
                                    i < review.rating ? 'text-yellow-500' : 'text-gray-600'
                                  }`}
                                ></i>
                              ))}
                              <span className="text-sm font-black text-main ml-1">{review.rating}/5</span>
                            </div>
                          )}
                        </div>
                        {review.comment && (
                          <p className="text-sm text-main/70 mt-2">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-main/50">
                    {session?.user?.id 
                      ? 'No reviews yet. Be the first to review!' 
                      : 'No reviews yet. Sign in to add a review!'}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Score</div>
                  <div className={`text-3xl font-black mb-1 ${
                    (movie.votes || 0) > 0 ? 'text-[var(--accent-color)]' : 
                    (movie.votes || 0) < 0 ? 'text-red-400' : 'text-main'
                  }`}>
                    {(movie.votes || 0) > 0 ? `+${movie.votes}` : movie.votes || 0}
                  </div>
                  <div className="text-xs text-main/60">
                    Reddit-style voting
                  </div>
                </div>
                <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Times Watched</div>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black text-main">{userWatchCount}</div>
                    {session?.user?.id && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={async () => {
                            if (isUpdatingWatchCount) return;
                            setIsUpdatingWatchCount(true);
                            try {
                              const params = new URLSearchParams();
                              if (mediaId) params.append('mediaId', mediaId);
                              if (tmdbId) params.append('tmdbId', tmdbId.toString());
                              
                              const res = await fetch('/api/history/decrement', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ mediaId: mediaId || undefined, tmdbId: tmdbId || undefined }),
                              });
                              
                              if (res.ok) {
                                await refetchWatchCount();
                                await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
                                await queryClient.invalidateQueries({ queryKey: ['userWatched'] });
                                await queryClient.invalidateQueries({ queryKey: ['history'] });
                              }
                            } catch (error) {
                              console.error('Failed to decrement watch count:', error);
                            } finally {
                              setIsUpdatingWatchCount(false);
                            }
                          }}
                          disabled={isUpdatingWatchCount || userWatchCount === 0}
                          className="glass w-8 h-8 rounded-lg flex items-center justify-center border-main hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-black/20"
                        >
                          <i className="fa-solid fa-minus text-xs text-main"></i>
                        </button>
                        <button
                          onClick={async () => {
                            if (isUpdatingWatchCount) return;
                            setIsUpdatingWatchCount(true);
                            try {
                              const res = await fetch('/api/history/increment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ mediaId: mediaId || undefined, tmdbId: tmdbId || undefined }),
                              });
                              
                              if (res.ok) {
                                await refetchWatchCount();
                                await queryClient.invalidateQueries({ queryKey: ['movieLogs'] });
                                await queryClient.invalidateQueries({ queryKey: ['userWatched'] });
                                await queryClient.invalidateQueries({ queryKey: ['history'] });
                              }
                            } catch (error) {
                              console.error('Failed to increment watch count:', error);
                            } finally {
                              setIsUpdatingWatchCount(false);
                            }
                          }}
                          disabled={isUpdatingWatchCount}
                          className="glass w-8 h-8 rounded-lg flex items-center justify-center border-main hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-black/20"
                        >
                          <i className="fa-solid fa-plus text-xs text-main"></i>
                        </button>
                      </div>
                    )}
                  </div>
                  {session?.user?.id && (
                    <div className="text-xs text-main/60 mt-2">
                      Your watch count
                    </div>
                  )}
                </div>
                <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Reviews</div>
                  <div className="text-3xl font-black text-main">{reviews.length}</div>
                </div>
              </div>
              
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <h3 className="text-sm font-black text-main mb-4">Viewing History</h3>
                {logs.length > 0 ? (
                  <div className="space-y-3">
                    {logs.slice(0, 5).map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-main">
                        <div>
                          <div className="text-sm font-black text-main">
                            {new Date(log.watched_at || log.created_at).toLocaleDateString()}
                          </div>
                          {log.log_attendees && log.log_attendees.length > 0 && (
                            <div className="text-xs text-main/60 mt-1">
                              Watched with {log.log_attendees.length} {log.log_attendees.length === 1 ? 'person' : 'people'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-main/50">No viewing history yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Friends' && (
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border-main bg-white/[0.02]">
                <h2 className="text-lg font-black text-main mb-6">Friends</h2>
                {friendsWithMovie.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {friendsWithMovie.map((friend: User) => (
                      <div key={friend.id} className="glass p-4 rounded-xl border-main bg-white/[0.02] text-center">
                        <img 
                          src={friend.avatar} 
                          alt={friend.name}
                          className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-main"
                        />
                        <div className="text-sm font-black text-main">{friend.name}</div>
                        <div className="text-[10px] text-main/60 mt-1">Has watched</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-main/50">None of your friends have watched this yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isScheduling && (
        <SchedulingModal 
          movie={movie} 
          onClose={() => setIsScheduling(false)} 
          onConfirm={() => setIsScheduling(false)} 
        />
      )}
    </div>
  );
};

export default TitleDetailView;
