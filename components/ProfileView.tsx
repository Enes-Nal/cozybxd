'use client';

import React, { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Movie } from '@/lib/types';
import UnfriendConfirmModal from './UnfriendConfirmModal';
import { useToast } from './Toast';

interface ProfileViewProps {
  user: User;
  movies?: Movie[];
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

const ProfileView: React.FC<ProfileViewProps> = ({ user, movies: propMovies }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  // Fetch user profile data
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['user', user.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user.id}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Fetch user's recent reviews
  const { data: reviewsData = [] } = useQuery({
    queryKey: ['userReviews', user.id],
    queryFn: async () => {
      const res = await fetch(`/api/reviews?userId=${user.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Check if the viewed user is the current user (needed for conditional queries)
  const isCurrentUser = session?.user?.id === user.id;

  // Fetch current user's friends to check if this user is a friend
  const { data: friendsData = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await fetch('/api/friends');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  // Fetch current user's teams to find shared groups
  const { data: currentUserData } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!session && !isCurrentUser,
  });

  // Fetch incoming friend requests
  const { data: incomingRequests = [] } = useQuery({
    queryKey: ['friendRequests', 'incoming'],
    queryFn: async () => {
      const res = await fetch('/api/friends/requests?type=incoming');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  // Fetch outgoing friend requests
  const { data: outgoingRequests = [] } = useQuery({
    queryKey: ['friendRequests', 'outgoing'],
    queryFn: async () => {
      const res = await fetch('/api/friends/requests?type=outgoing');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  // Check if the viewed user is a friend (only direct friends are returned now)
  const isFriend = friendsData.some((friend: User) => friend.id === user.id);
  
  // Check for pending friend requests
  const incomingRequest = incomingRequests.find((req: any) => req.user.id === user.id);
  const outgoingRequest = outgoingRequests.find((req: any) => req.user.id === user.id);
  const hasPendingRequest = incomingRequest || outgoingRequest;

  // Add friend mutation
  const addFriendMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add friend');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      setAddFriendError(null);
      toast.showSuccess(`Friend request sent to ${user.name}!`);
    },
    onError: (error) => {
      console.error('Add friend error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to add friend';
      setAddFriendError(errorMsg);
      toast.showError(errorMsg);
    },
  });

  // Unfriend mutation
  const unfriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to unfriend');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      setShowUnfriendModal(false);
      toast.showSuccess(`Unfriended ${user.name}`);
    },
    onError: (error) => {
      console.error('Unfriend error:', error);
      toast.showError(error instanceof Error ? error.message : 'Failed to unfriend');
    },
  });

  // Accept friend request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch('/api/friends/requests/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to accept friend request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      setAddFriendError(null);
      toast.showSuccess(`You are now friends with ${user.name}!`);
    },
    onError: (error) => {
      console.error('Accept friend request error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to accept friend request';
      setAddFriendError(errorMsg);
      toast.showError(errorMsg);
    },
  });

  // Reject friend request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch('/api/friends/requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject friend request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      setAddFriendError(null);
      toast.showSuccess('Friend request rejected');
    },
    onError: (error) => {
      console.error('Reject friend request error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to reject friend request';
      setAddFriendError(errorMsg);
      toast.showError(errorMsg);
    },
  });

  // Cancel friend request mutation
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch('/api/friends/requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to cancel friend request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      setAddFriendError(null);
      toast.showSuccess('Friend request cancelled');
    },
    onError: (error) => {
      console.error('Cancel friend request error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to cancel friend request';
      setAddFriendError(errorMsg);
      toast.showError(errorMsg);
    },
  });

  const handleAddFriend = async () => {
    setAddFriendError(null);
    
    // Ensure we have userData loaded
    if (!userData) {
      setAddFriendError('Loading user data...');
      return;
    }
    
    if (!userData.username) {
      setAddFriendError('This user does not have a username set');
      return;
    }
    
    addFriendMutation.mutate(userData.username);
  };

  const handleUnfriend = () => {
    setShowUnfriendModal(true);
  };

  const handleConfirmUnfriend = () => {
    unfriendMutation.mutate(user.id);
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!session?.user?.id) {
      toast.showWarning('Please sign in to manage your reviews');
      return;
    }

    if (!isCurrentUser) {
      toast.showError('You can only remove your own reviews');
      return;
    }

    const ok = window.confirm('Remove this review? This cannot be undone.');
    if (!ok) return;

    setDeletingReviewId(reviewId);
    try {
      const res = await fetch('/api/reviews', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete review' }));
        throw new Error(error.error || 'Failed to delete review');
      }

      await queryClient.invalidateQueries({ queryKey: ['userReviews', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      toast.showSuccess('Review removed');
    } catch (error) {
      console.error('Delete review error:', error);
      toast.showError(error instanceof Error ? error.message : 'Failed to delete review');
    } finally {
      setDeletingReviewId(null);
    }
  };

  const stats = userData?.stats || { watched: 0, reviews: 0, groups: 0 };
  const allTeams = userData?.teams || [];
  const currentUserTeams = currentUserData?.teams || [];
  
  // Filter to only show groups that both users are in
  const sharedTeams = useMemo(() => {
    if (isCurrentUser) {
      // If viewing own profile, show all teams
      return allTeams;
    }
    if (!session || currentUserTeams.length === 0) {
      // If not logged in or no current user teams, show empty
      return [];
    }
    // Find teams where both users are members
    const currentUserTeamIds = new Set(currentUserTeams.map((team: any) => team.id));
    return allTeams.filter((team: any) => currentUserTeamIds.has(team.id));
  }, [allTeams, currentUserTeams, isCurrentUser, session]);
  
  const recentReviews = reviewsData.slice(0, 2);

  return (
    <div className="py-8 max-w-6xl mx-auto view-transition overflow-y-auto pb-20 px-4">
      {/* Profile Header - Centered */}
      <div className="mb-10">
        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-main/30 shadow-lg bg-black">
            <img src={user.avatar} className="w-full h-full object-cover animate-image-fade-in" alt={user.name} loading="lazy" />
          </div>
        </div>
        
        {/* Name and Role */}
        <div className="text-center mb-6">
          <h2 className="text-3xl md:text-4xl font-bold text-main tracking-tight mb-1">{user.name}</h2>
          <p className="text-gray-400 text-sm uppercase tracking-wider">{user.role}</p>
          {/* Action Buttons */}
          {session && !isCurrentUser && !isFriend && !hasPendingRequest && (
            <div className="flex flex-col items-center gap-2 mb-6">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddFriend();
                }}
                disabled={addFriendMutation.isPending || userLoading || !userData?.username}
                className="px-5 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-user-plus text-xs"></i>
                {addFriendMutation.isPending ? 'Sending...' : 'Send Friend Request'}
              </button>
              {userLoading && (
                <p className="text-xs text-gray-500">Loading user data...</p>
              )}
              {!userLoading && !userData?.username && (
                <p className="text-xs text-gray-500">This user needs to log in to set their username</p>
              )}
              {addFriendError && (
                <p className="text-xs text-red-400">{addFriendError}</p>
              )}
            </div>
          )}
          {session && !isCurrentUser && !isFriend && incomingRequest && (
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    acceptRequestMutation.mutate(incomingRequest.id);
                  }}
                  disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-check text-xs"></i>
                  {acceptRequestMutation.isPending ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    rejectRequestMutation.mutate(incomingRequest.id);
                  }}
                  disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-all text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                  {rejectRequestMutation.isPending ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
              {addFriendError && (
                <p className="text-xs text-red-400">{addFriendError}</p>
              )}
            </div>
          )}
          {session && !isCurrentUser && !isFriend && outgoingRequest && (
            <div className="flex flex-col items-center gap-2 mb-6">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelRequestMutation.mutate(outgoingRequest.id);
                }}
                disabled={cancelRequestMutation.isPending}
                className="px-5 py-2 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-500 hover:bg-gray-500/20 transition-all text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                {cancelRequestMutation.isPending ? 'Cancelling...' : 'Friend Request Sent'}
              </button>
              {addFriendError && (
                <p className="text-xs text-red-400">{addFriendError}</p>
              )}
            </div>
          )}
          {session && !isCurrentUser && isFriend && (
            <div className="flex justify-center mb-6">
              <button
                onClick={handleUnfriend}
                disabled={unfriendMutation.isPending}
                className="px-5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-all text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <i className="fa-solid fa-user-minus text-xs"></i>
                {unfriendMutation.isPending ? 'Unfriending...' : 'Unfriend'}
              </button>
            </div>
          )}
          {showUnfriendModal && (
            <UnfriendConfirmModal
              friend={user}
              onClose={() => setShowUnfriendModal(false)}
              onConfirm={handleConfirmUnfriend}
              isPending={unfriendMutation.isPending}
            />
          )}

        {/* Stats - Letterboxd Style */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm">
          <div className="text-center">
            <span className="text-main font-semibold">{stats.watched}</span>
            <span className="text-gray-400 ml-1 uppercase tracking-wider text-xs">Watched</span>
          </div>
          <div className="text-center">
            <span className="text-main font-semibold">{stats.reviews}</span>
            <span className="text-gray-400 ml-1 uppercase tracking-wider text-xs">Reviews</span>
          </div>
          <div className="text-center">
            <span className="text-main font-semibold">{stats.groups}</span>
            <span className="text-gray-400 ml-1 uppercase tracking-wider text-xs">Groups</span>
          </div>
        </div>
      </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-6">RECENT ACTIVITY</h3>
            {recentReviews.length === 0 ? (
              <div className="glass p-5 rounded-xl border border-white/5 text-center">
                <p className="text-sm text-gray-500">No recent reviews</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentReviews.map((review: any) => {
                  const reviewDate = review.created_at ? new Date(review.created_at) : new Date();
                  const dateStr = reviewDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
                  
                  return (
                    <div key={review.id} className="glass p-5 rounded-xl flex gap-5 hover:bg-black/[0.02] transition-all group border border-white/5">
                      {review.media?.posterUrl && (
                        <img src={review.media.posterUrl} className="w-20 h-28 rounded-lg object-cover shadow-md flex-shrink-0" alt={review.media.title} />
                      )}
                      <div className="flex-1 py-1 min-w-0">
                        <div className="flex justify-between items-start mb-2 gap-3">
                          <h4 className="text-base font-semibold text-main group-hover:text-accent transition-colors truncate">{review.media?.title || 'Unknown'}</h4>
                          <div className="flex items-center gap-3">
                            {isCurrentUser && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteReview(review.id);
                                }}
                                disabled={deletingReviewId === review.id}
                                className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                aria-label="Remove review"
                                title="Remove review"
                              >
                                <i className={`fa-solid ${deletingReviewId === review.id ? 'fa-spinner fa-spin' : 'fa-trash'} text-xs`}></i>
                              </button>
                            )}
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(s => (
                                <i key={s} className={`fa-solid fa-star text-xs ${s <= (review.rating || 0) ? 'text-accent' : 'text-gray-200'}`}></i>
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-3">Rated on {dateStr}</p>
                        {review.comment && (
                          <p className="text-sm text-gray-400 leading-relaxed">"{review.comment}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              {isCurrentUser ? 'GROUPS' : 'SHARED GROUPS'}
            </h3>
            {sharedTeams.length === 0 ? (
              <div className="glass p-4 rounded-xl border border-white/5 text-center">
                <p className="text-sm text-gray-500">
                  {isCurrentUser ? 'No groups yet' : 'No shared groups'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sharedTeams.map((team: any) => (
                  <div key={team.id} className="glass p-4 rounded-xl border border-white/5 flex items-center gap-3 hover:bg-black/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-black/[0.03] flex items-center justify-center text-gray-400 flex-shrink-0">
                      <i className="fa-solid fa-user-group text-xs"></i>
                    </div>
                    <span className="text-sm text-main truncate">{team.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">TOP GENRES</h3>
            <div className="flex flex-wrap gap-3">
              {reviewsData.length > 0 ? (
                // Extract genres from reviews (if available)
                (() => {
                  const genreCounts: Record<string, number> = {};
                  reviewsData.forEach((review: any) => {
                    if (review.media?.genres) {
                      review.media.genres.forEach((genre: string) => {
                        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                      });
                    }
                  });
                  const topGenres = Object.entries(genreCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([genre]) => genre.toUpperCase());
                  
                  return topGenres.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topGenres.map(tag => (
                        <span key={tag} className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium tracking-wider ${getGenreColor(tag)}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No genres yet</p>
                  );
                })()
              ) : (
                <p className="text-sm text-gray-500">No genres yet</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
