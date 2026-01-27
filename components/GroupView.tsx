'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Group, Movie, User } from '@/lib/types';
import MovieGrid from './MovieGrid';
import InvitePeopleModal from './InvitePeopleModal';
import EditGroupPictureModal from './EditGroupPictureModal';
import GroupChatButton from './GroupChatButton';
import ActivityLog from './ActivityLog';
import MovieSwipe from './MovieSwipe';
import { useToast } from './Toast';

interface GroupViewProps {
  group: Group;
  movies: Movie[];
  onVote?: (id: string) => void;
  onSchedule?: (movie: Movie) => void;
  onSelect?: (movie: Movie) => void;
  onProfileSelect?: (user: User) => void;
}

const GroupView: React.FC<GroupViewProps> = ({ 
  group, 
  movies: initialMovies,
  onProfileSelect,
  onVote = async (id) => {
    try {
      let mediaId = id.startsWith('tmdb-') ? id.replace('tmdb-', '') : 
                   id.startsWith('youtube-') ? id.replace('youtube-', '') : id;
      
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
      } else if (id.startsWith('youtube-')) {
        // If it's a YouTube video, sync it first
        const syncRes = await fetch('/api/media/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeId: mediaId }),
        });
        if (syncRes.ok) {
          const media = await syncRes.json();
          mediaId = media.id;
        }
      }
      
      // Try to upvote first
      let res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${group.id}`, {
        method: 'POST',
      });
      
      // If not in watchlist, add it first then upvote
      if (!res.ok && res.status === 404) {
        const addRes = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId, teamId: group.id }),
        });
        if (addRes.ok) {
          // Now upvote
          res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${group.id}`, {
            method: 'POST',
          });
        }
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  },
  onSchedule = () => {},
  onSelect = () => {}
}) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditPictureModalOpen, setIsEditPictureModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMovieSwipeOpen, setIsMovieSwipeOpen] = useState(false);
  const [userToKick, setUserToKick] = useState<User | null>(null);
  const [movies, setMovies] = useState(initialMovies);
  const [votingMovieId, setVotingMovieId] = useState<string | null>(null); // Track which movie is being voted on
  const [sortOption, setSortOption] = useState<'votes' | 'recent' | 'alphabetical'>('votes');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const previousInitialMoviesRef = useRef(initialMovies);
  
  // Get current user's role in the group
  const currentUser = group.members.find(m => m.id === session?.user?.id);
  const isAdmin = currentUser?.role === 'Admin';
  
  // Update movies when initialMovies changes, but only if not currently voting
  useEffect(() => {
    if (votingMovieId === null) {
      // Only update if initialMovies reference changed (new data from server)
      if (initialMovies !== previousInitialMoviesRef.current) {
        setMovies(initialMovies);
        previousInitialMoviesRef.current = initialMovies;
      }
    }
  }, [initialMovies, votingMovieId]);
  
  // Helper function to sync media if needed
  const syncMediaIfNeeded = async (id: string): Promise<string> => {
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
    
    return mediaId;
  };


  // Upvote handler with optimistic UI update
  const handleUpvote = async (id: string) => {
    // Prevent double clicks
    if (votingMovieId === id) return;
    
    const currentMovie = movies.find(m => m.id === id);
    if (!currentMovie) return;
    const currentUpvotes = currentMovie.upvotes || 0;
    const currentDownvotes = currentMovie.downvotes || 0;
    const currentUserVote = currentMovie.userVote;
    const currentScore = currentUpvotes - currentDownvotes;
    
    setVotingMovieId(id);
    
    // Optimistic update for existing movie
    setMovies(prevMovies => 
      prevMovies.map(m => {
        if (m.id !== id) return m;
        let newUpvotes = currentUpvotes;
        let newDownvotes = currentDownvotes;
        let newUserVote: 'upvote' | 'downvote' | null = 'upvote';
        let newScore = currentScore;
        
        if (currentUserVote === 'upvote') {
          // Toggle off
          newUpvotes = Math.max(0, newUpvotes - 1);
          newUserVote = null;
          newScore = newScore - 1;
        } else if (currentUserVote === 'downvote') {
          // Switch from downvote to upvote
          newDownvotes = Math.max(0, newDownvotes - 1);
          newUpvotes = newUpvotes + 1;
          newUserVote = 'upvote';
          newScore = newScore + 2; // +1 for removing downvote, +1 for adding upvote
        } else {
          // Add upvote
          newUpvotes = newUpvotes + 1;
          newScore = newScore + 1;
        }
        
        return { 
          ...m, 
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          votes: newScore,
          userVote: newUserVote
        };
      })
    );
    
    // Show toast immediately for instant feedback
    const movie = movies.find(m => m.id === id) || currentMovie;
    if (currentUserVote === 'upvote') {
      toast.showSuccess(`Removed upvote from ${movie?.title || 'movie'}`);
    } else {
      toast.showSuccess(`Upvoted ${movie?.title || 'movie'}`);
    }
    
    // Now do the actual API calls in the background (non-blocking)
    (async () => {
      let voteSuccess = false;
      try {
        const mediaId = await syncMediaIfNeeded(id);
        
        let res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${group.id}`, {
          method: 'POST',
        });
        
        // If not in watchlist, add it first then upvote
        if (!res.ok && res.status === 404) {
          const addRes = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaId, teamId: group.id }),
          });
          if (addRes.ok) {
            // Get the added movie from response
            const addedMovie = await addRes.json();
            // Update with actual data
            setMovies(prevMovies => {
              // Remove optimistic movie and add real one
              const filtered = prevMovies.filter(m => m.id !== id && m.id !== mediaId);
              return [...filtered, addedMovie];
            });
            // Update query cache
            queryClient.setQueryData<Movie[]>(['groupWatchlist', group.id], (old = []) => {
              const filtered = old.filter(m => m.id !== id && m.id !== mediaId);
              return [...filtered, addedMovie];
            });
            // Now upvote
            res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${group.id}`, {
              method: 'POST',
            });
          } else {
            toast.showError('Failed to add movie to watchlist. Please try again.');
            return;
          }
        }
        
        // Update with actual response
        if (res.ok) {
          const data = await res.json();
          setMovies(prevMovies => 
            prevMovies.map(m => {
              // Match by either the original id or the mediaId
              if (m.id === id || m.id === mediaId) {
                return { 
                  ...m, 
                  upvotes: data.upvotes,
                  downvotes: data.downvotes,
                  votes: data.score,
                  userVote: data.userVote
                };
              }
              return m;
            })
          );
          voteSuccess = true;
        } else {
          // Revert optimistic update on error
          setMovies(prevMovies => 
            prevMovies.map(m => 
              m.id === id ? { 
                ...m, 
                upvotes: currentUpvotes,
                downvotes: currentDownvotes,
                votes: currentScore,
                userVote: currentUserVote
              } : m
            )
          );
          toast.showError('Failed to upvote. Please try again.');
        }
      } catch (error) {
        console.error('Failed to upvote:', error);
        // Revert optimistic update on error
        setMovies(prevMovies => 
          prevMovies.map(m => 
            m.id === id ? { 
              ...m, 
              upvotes: currentUpvotes,
              downvotes: currentDownvotes,
              votes: currentScore,
              userVote: currentUserVote
            } : m
          )
        );
        toast.showError('Failed to upvote. Please try again.');
      } finally {
        setVotingMovieId(null);
        // Invalidate query in background to sync with server (but don't wait for it)
        if (voteSuccess) {
          // Use a small delay to ensure the database transaction is committed
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['groupWatchlist', group.id] });
            queryClient.invalidateQueries({ queryKey: ['teamActivity', group.id] });
          }, 100);
        }
      }
    })();
  };

  // Downvote handler with optimistic UI update
  const handleDownvote = async (id: string) => {
    // Prevent double clicks
    if (votingMovieId === id) return;
    
    const currentMovie = movies.find(m => m.id === id);
    if (!currentMovie) return;
    const currentUpvotes = currentMovie.upvotes || 0;
    const currentDownvotes = currentMovie.downvotes || 0;
    const currentUserVote = currentMovie.userVote;
    const currentScore = currentUpvotes - currentDownvotes;
    
    setVotingMovieId(id);
    
    // Optimistic update for existing movie
    setMovies(prevMovies => 
      prevMovies.map(m => {
        if (m.id !== id) return m;
        let newUpvotes = currentUpvotes;
        let newDownvotes = currentDownvotes;
        let newUserVote: 'upvote' | 'downvote' | null = 'downvote';
        let newScore = currentScore;
        
        if (currentUserVote === 'downvote') {
          // Toggle off
          newDownvotes = Math.max(0, newDownvotes - 1);
          newUserVote = null;
          newScore = newScore + 1;
        } else if (currentUserVote === 'upvote') {
          // Switch from upvote to downvote
          newUpvotes = Math.max(0, newUpvotes - 1);
          newDownvotes = newDownvotes + 1;
          newUserVote = 'downvote';
          newScore = newScore - 2; // -1 for removing upvote, -1 for adding downvote
        } else {
          // Add downvote
          newDownvotes = newDownvotes + 1;
          newScore = newScore - 1;
        }
        
        return { 
          ...m, 
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          votes: newScore,
          userVote: newUserVote
        };
      })
    );
    
    // Show toast immediately for instant feedback
    const movie = movies.find(m => m.id === id) || currentMovie;
    if (currentUserVote === 'downvote') {
      toast.showSuccess(`Removed downvote from ${movie?.title || 'movie'}`);
    } else {
      toast.showSuccess(`Downvoted ${movie?.title || 'movie'}`);
    }
    
    // Now do the actual API calls in the background (non-blocking)
    (async () => {
      let voteSuccess = false;
      try {
        const mediaId = await syncMediaIfNeeded(id);
        
        let res = await fetch(`/api/watchlist/${mediaId}/downvote?teamId=${group.id}`, {
          method: 'POST',
        });
        
        // If not in watchlist, add it first then downvote
        if (!res.ok && res.status === 404) {
          const addRes = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaId, teamId: group.id }),
          });
          if (addRes.ok) {
            // Get the added movie from response
            const addedMovie = await addRes.json();
            // Update with actual data
            setMovies(prevMovies => {
              // Remove optimistic movie and add real one
              const filtered = prevMovies.filter(m => m.id !== id && m.id !== mediaId);
              return [...filtered, addedMovie];
            });
            // Update query cache
            queryClient.setQueryData<Movie[]>(['groupWatchlist', group.id], (old = []) => {
              const filtered = old.filter(m => m.id !== id && m.id !== mediaId);
              return [...filtered, addedMovie];
            });
            // Now downvote
            res = await fetch(`/api/watchlist/${mediaId}/downvote?teamId=${group.id}`, {
              method: 'POST',
            });
          } else {
            toast.showError('Failed to add movie to watchlist. Please try again.');
            return;
          }
        }
        
        // Update with actual response
        if (res.ok) {
          const data = await res.json();
          setMovies(prevMovies => 
            prevMovies.map(m => {
              // Match by either the original id or the mediaId
              if (m.id === id || m.id === mediaId) {
                return { 
                  ...m, 
                  upvotes: data.upvotes,
                  downvotes: data.downvotes,
                  votes: data.score,
                  userVote: data.userVote
                };
              }
              return m;
            })
          );
          voteSuccess = true;
        } else {
          // Revert optimistic update on error
          setMovies(prevMovies => 
            prevMovies.map(m => 
              m.id === id ? { 
                ...m, 
                upvotes: currentUpvotes,
                downvotes: currentDownvotes,
                votes: currentScore,
                userVote: currentUserVote
              } : m
            )
          );
          toast.showError('Failed to downvote. Please try again.');
        }
      } catch (error) {
        console.error('Failed to downvote:', error);
        // Revert optimistic update on error
        setMovies(prevMovies => 
          prevMovies.map(m => 
            m.id === id ? { 
              ...m, 
              upvotes: currentUpvotes,
              downvotes: currentDownvotes,
              votes: currentScore,
              userVote: currentUserVote
            } : m
          )
        );
        toast.showError('Failed to downvote. Please try again.');
      } finally {
        setVotingMovieId(null);
        // Invalidate query in background to sync with server (but don't wait for it)
        if (voteSuccess) {
          // Use a small delay to ensure the database transaction is committed
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['groupWatchlist', group.id] });
            queryClient.invalidateQueries({ queryKey: ['teamActivity', group.id] });
          }, 100);
        }
      }
    })();
  };

  // Remove handler with optimistic UI update
  const handleRemove = async (id: string) => {
    const movieToRemove = movies.find(m => m.id === id);
    if (!movieToRemove) return;

    // Optimistic update: remove from local state immediately
    const previousMovies = [...movies];
    setMovies(prevMovies => prevMovies.filter(m => m.id !== id));

    try {
      const mediaId = await syncMediaIfNeeded(id);
      
      // Make DELETE request
      const url = `/api/watchlist?mediaId=${mediaId}&teamId=${group.id}`;
      const res = await fetch(url, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert optimistic update on error
        setMovies(previousMovies);
        let errorMessage = 'Failed to remove from queue. Please try again.';
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        toast.showError(errorMessage);
        return;
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['watchlist', 'shared', group.id] });
      queryClient.invalidateQueries({ queryKey: ['teamActivity', group.id] });
      toast.showSuccess(`Removed ${movieToRemove.title} from queue`);
    } catch (error) {
      // Revert optimistic update on error
      setMovies(previousMovies);
      console.error('Error removing from queue:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove from queue. Please try again.';
      toast.showError(errorMessage);
    }
  };
  
  // Find most watchlisted movie (highest votes)
  const mostWatchlistedMovie = useMemo(() => {
    if (movies.length === 0) return null;
    return movies.reduce((prev, current) => 
      ((current.votes || 0) > (prev.votes || 0)) ? current : prev
    );
  }, [movies]);

  // Next movie is the highest scored item (should be first after API sorting, but calculate explicitly)
  const nextMovie = useMemo(() => {
    if (movies.length === 0) return null;
    // Find the movie with the highest score (votes = upvotes - downvotes)
    return movies.reduce((prev, current) => {
      const prevScore = prev.votes || 0;
      const currentScore = current.votes || 0;
      // If scores are equal, prefer the one added more recently
      if (currentScore > prevScore) {
        return current;
      } else if (currentScore === prevScore) {
        // This is a fallback - in practice API should already sort correctly
        return prev;
      }
      return prev;
    });
  }, [movies]);

  // Sort movies based on selected sort option
  const sortedMovies = useMemo(() => {
    const sorted = [...movies];
    switch (sortOption) {
      case 'votes':
        // Already sorted by API by score, but ensure it's correct
        sorted.sort((a, b) => {
          const scoreA = (a.votes || 0);
          const scoreB = (b.votes || 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return 0;
        });
        break;
      case 'recent':
        // Reverse to show most recent first (API returns highest votes first)
        // Since we don't have addedAt in Movie type, we'll keep original order
        // which should be most recent first from API
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [movies, sortOption]);
  const totalMovies = movies.length;
  const totalVotes = movies.reduce((sum, m) => sum + (m.votes || 0), 0);


  // Leave group mutation
  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teams/${group.id}/members`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to leave group');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teamActivity', group.id] });
      toast.showSuccess(`Left "${group.name}"`);
      router.push('/?tab=Home');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to leave group');
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teams/${group.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete group');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.showSuccess(`Deleted "${group.name}"`);
      router.push('/?tab=Home');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to delete group');
    },
  });

  // Kick user mutation
  const kickUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/teams/${group.id}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to kick user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teamActivity', group.id] });
      setUserToKick(null);
      toast.showSuccess('User has been removed from the group');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to kick user');
    },
  });

  const handleLeaveGroup = () => {
    if (confirm(`Are you sure you want to leave "${group.name}"?`)) {
      leaveGroupMutation.mutate();
    }
  };

  const handleDeleteGroup = () => {
    if (confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) {
      deleteGroupMutation.mutate();
    }
  };


  return (
    <>
      <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-12">
          <div className="flex items-start gap-4">
            <div className="relative group">
              {group.pictureUrl ? (
                <img 
                  src={group.pictureUrl} 
                  alt={group.name}
                  className={`animate-image-fade-in w-20 h-20 rounded-2xl object-cover border border-white/10 ${isAdmin ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all duration-200' : ''}`}
                  loading="lazy"
                  onClick={() => isAdmin && setIsEditPictureModalOpen(true)}
                />
              ) : (
                <div 
                  className={`w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${isAdmin ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}`}
                  onClick={() => isAdmin && setIsEditPictureModalOpen(true)}
                  title={isAdmin ? "Add group picture" : undefined}
                >
                  <i className="fa-solid fa-image text-gray-500"></i>
                </div>
              )}
              {isAdmin && (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setIsEditPictureModalOpen(true)}>
                  <i className="fa-solid fa-camera text-white text-xs"></i>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-4xl font-black tracking-tight">{group.name}</h2>
              </div>
              <p className="text-gray-400 max-w-md">{group.description || `${group.name} shared watchlist and viewing history.`}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-4 ml-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMembersModalOpen(true)}
                className="flex -space-x-3 hover:opacity-80 active:scale-95 transition-all duration-200 cursor-pointer group"
                title="View all members"
              >
                {group.members.slice(0, 5).map((m, idx) => (
                  <img key={m.id} src={m.avatar} className="w-10 h-10 rounded-full border-2 border-[#0a0a0a] group-hover:border-accent/50 transition-all-smooth animate-image-fade-in relative" style={{ zIndex: idx + 1 }} alt={m.name} title={m.name} loading="lazy" />
                ))}
                {group.members.length > 5 && (
                  <div className="w-10 h-10 rounded-full border-2 border-[#0a0a0a] bg-[#0a0a0a] flex items-center justify-center text-xs font-bold text-gray-400 group-hover:border-accent/50 transition-colors relative z-10">
                    +{group.members.length - 5}
                  </div>
                )}
              </button>
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-white/5 hover:bg-white/10 active:scale-95 p-3 rounded-xl transition-all duration-200 overflow-hidden"
                title="Invite people"
              >
                <i className="fa-solid fa-user-plus text-gray-400"></i>
              </button>
              {isAdmin && (
                <>
                  <button 
                    onClick={() => {
                      router.push(`/?tab=Group Settings&group=${group.id}`);
                    }}
                    className="bg-white/5 hover:bg-white/10 active:scale-95 p-3 rounded-xl transition-all duration-200 overflow-hidden"
                    title="Group settings"
                  >
                    <i className="fa-solid fa-cog text-gray-400"></i>
                  </button>
                  <button 
                    onClick={handleDeleteGroup}
                    className="bg-white/5 hover:bg-red-500/20 active:scale-95 p-3 rounded-xl transition-all duration-200 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete group"
                    disabled={deleteGroupMutation.isPending}
                  >
                    <i className="fa-solid fa-trash text-red-400"></i>
                  </button>
                </>
              )}
              <button 
                onClick={handleLeaveGroup}
                className="bg-white/5 hover:bg-white/10 active:scale-95 p-3 rounded-xl transition-all duration-200 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                title="Leave group"
                disabled={leaveGroupMutation.isPending}
              >
              <i className="fa-solid fa-sign-out-alt text-gray-400"></i>
            </button>
            </div>
          </div>
        </div>

      {currentUser && (
        <GroupChatButton
          teamId={group.id}
          currentUser={{
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar || session?.user?.image || '',
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold">Group Queue</h3>
          <button
            onClick={() => setIsMovieSwipeOpen(true)}
            className="bg-accent hover:bg-accent/80 text-black px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
            title="Discover new movies"
          >
            <i className="fa-solid fa-fire"></i>
            Discover Movies
          </button>
        </div>
        {movies.length > 0 && (
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-medium text-gray-300 hover:border-accent/50 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2 min-w-[140px] justify-between"
            >
              <span>
                {sortOption === 'votes' && 'Highest Votes'}
                {sortOption === 'recent' && 'Recently Added'}
                {sortOption === 'alphabetical' && 'Alphabetical'}
              </span>
              <i className={`fa-solid fa-chevron-${isSortDropdownOpen ? 'up' : 'down'} text-[10px] transition-transform`}></i>
            </button>
            
            {isSortDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-full glass border-white/10 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200 shadow-2xl bg-[#111]">
                <button
                  onClick={() => {
                    setSortOption('votes');
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-center text-xs hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                    sortOption === 'votes'
                      ? 'text-accent bg-white/5 font-bold'
                      : 'text-gray-300'
                  }`}
                >
                  Highest Votes
                </button>
                <button
                  onClick={() => {
                    setSortOption('recent');
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-center text-xs hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                    sortOption === 'recent'
                      ? 'text-accent bg-white/5 font-bold'
                      : 'text-gray-300'
                  }`}
                >
                  Recently Added
                </button>
                <button
                  onClick={() => {
                    setSortOption('alphabetical');
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-center text-xs hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                    sortOption === 'alphabetical'
                      ? 'text-accent bg-white/5 font-bold'
                      : 'text-gray-300'
                  }`}
                >
                  Alphabetical
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {movies.length > 0 ? (
        <MovieGrid 
          movies={sortedMovies} 
          onUpvote={handleUpvote}
          onDownvote={handleDownvote}
          votingMovieId={votingMovieId}
          onRemove={handleRemove}
          onSchedule={(id) => {
            const movie = sortedMovies.find(m => m.id === id);
            if (movie) onSchedule(movie);
          }}
          users={group.members} 
          onSelect={onSelect}
          isGroupWatchlist={true}
        />
      ) : (
        <div className="flex items-center justify-center h-64 w-full max-w-full">
          <div className="text-center">
            <p className="text-gray-500 mb-2">No movies in group watchlist</p>
            <p className="text-xs text-gray-400">Add movies to start building your queue</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 mt-12">
        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Most Watchlisted</p>
          {mostWatchlistedMovie ? (
            <div className="flex items-center gap-4">
              <img src={mostWatchlistedMovie.poster} className="w-12 h-16 rounded-lg object-cover animate-image-fade-in" alt={mostWatchlistedMovie.title} loading="lazy" />
              <div>
                <h4 className="text-sm font-bold">{mostWatchlistedMovie.title}</h4>
                <p className="text-xs text-accent">{(mostWatchlistedMovie.votes || 0)} {(mostWatchlistedMovie.votes || 0) === 1 ? 'vote' : 'votes'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-16 rounded-lg bg-white/5 flex items-center justify-center">
                <i className="fa-solid fa-film text-gray-500 text-xs"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-500">No movies yet</h4>
                <p className="text-xs text-gray-400">Add movies to see favorites</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Next Up</p>
          {nextMovie ? (
            <div className="flex items-center gap-4">
              <img src={nextMovie.poster} className="w-12 h-16 rounded-lg object-cover animate-image-fade-in" alt={nextMovie.title} loading="lazy" />
              <div>
                <h4 className="text-sm font-bold">{nextMovie.title}</h4>
                <p className="text-xs text-accent">{(nextMovie.votes || 0)} votes</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-16 rounded-lg bg-white/5 flex items-center justify-center">
                <i className="fa-solid fa-film text-gray-500 text-xs"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-500">No movies in queue</h4>
                <p className="text-xs text-gray-400">Add movies to get started</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Group Stats</p>
          <div className="space-y-3">
            <div>
              <h4 className="text-xl font-bold">{totalMovies}</h4>
              <p className="text-xs text-gray-400">Movies in watchlist</p>
            </div>
            <div className="pt-3 border-t border-white/10">
              <h4 className="text-xl font-bold">{totalVotes}</h4>
              <p className="text-xs text-gray-400">Total votes</p>
            </div>
            <div className="pt-3 border-t border-white/10">
              <h4 className="text-xl font-bold">{group.members.length}</h4>
              <p className="text-xs text-gray-400">Members</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12">
        <ActivityLog teamId={group.id} />
      </div>
      </div>

      {isInviteModalOpen && (
        <InvitePeopleModal
          groupId={group.id}
          groupName={group.name}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      {isEditPictureModalOpen && (
        <EditGroupPictureModal
          groupId={group.id}
          currentPictureUrl={group.pictureUrl}
          onClose={() => setIsEditPictureModalOpen(false)}
        />
      )}

      {userToKick && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
          <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black mb-2">Remove Member</h2>
            <p className="text-sm text-gray-400 mb-8">
              Are you sure you want to remove <strong>{userToKick.name}</strong> from <strong>{group.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setUserToKick(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 active:scale-95 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                disabled={kickUserMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  kickUserMutation.mutate(userToKick.id);
                }}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 active:scale-95 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={kickUserMutation.isPending}
              >
                {kickUserMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isMembersModalOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          onClick={() => setIsMembersModalOpen(false)}
        >
          <div 
            className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-6 right-6 z-10">
              <button 
                onClick={() => setIsMembersModalOpen(false)} 
                className="text-gray-500 hover:text-white active:scale-90 transition-all duration-200"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <h2 className="text-2xl font-black mb-2">Group Members</h2>
            <p className="text-sm text-gray-400 mb-8">{group.members.length} {group.members.length === 1 ? 'member' : 'members'}</p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {group.members.map((member) => {
                const canKick = isAdmin && member.id !== session?.user?.id;
                return (
                  <div 
                    key={member.id} 
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div 
                      className="flex items-center gap-4 flex-1 cursor-pointer"
                      onClick={() => {
                        if (onProfileSelect) {
                          onProfileSelect(member);
                          setIsMembersModalOpen(false);
                        }
                      }}
                    >
                      <div className="relative">
                        <img 
                          src={member.avatar} 
                          alt={member.name}
                          className="w-12 h-12 rounded-full"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">{member.name}</h4>
                          {member.role && (
                            <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full font-medium">
                              {member.role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canKick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserToKick(member);
                        }}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove from group"
                      >
                        <i className="fa-solid fa-user-minus text-sm"></i>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isMovieSwipeOpen && (
        <MovieSwipe
          teamId={group.id}
          onClose={() => {
            setIsMovieSwipeOpen(false);
            // Refresh watchlist after swiping
            queryClient.invalidateQueries({ queryKey: ['groupWatchlist', group.id] });
          }}
        />
      )}
    </>
  );
};

export default GroupView;
