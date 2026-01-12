'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Movie } from '@/lib/types';
import UnfriendConfirmModal from './UnfriendConfirmModal';

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
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);

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

  // Check if the viewed user is a friend (only direct friends are returned now)
  const isFriend = friendsData.some((friend: User) => friend.id === user.id);
  const isCurrentUser = session?.user?.id === user.id;

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
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      setAddFriendError(null);
    },
    onError: (error) => {
      console.error('Add friend error:', error);
      setAddFriendError(error instanceof Error ? error.message : 'Failed to add friend');
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
    },
    onError: (error) => {
      console.error('Unfriend error:', error);
      // You could add toast notification here if needed
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

  const stats = userData?.stats || { watched: 0, reviews: 0, groups: 0 };
  const teams = userData?.teams || [];
  const recentReviews = reviewsData.slice(0, 2);

  return (
    <div className="py-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      {/* Banner */}
      {user.banner && (
        <div className="w-full h-64 rounded-[2.5rem] overflow-hidden mb-8 border-2 border-main/20 shadow-xl">
          <img 
            src={user.banner} 
            className="w-full h-full object-cover" 
            alt={`${user.name}'s banner`}
            onError={(e) => {
              // Hide banner if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      
      <div className="flex flex-col md:flex-row items-center gap-10 mb-16">
        <div className="w-40 h-40 rounded-[3rem] overflow-hidden border-4 border-main shadow-xl shrink-0">
           <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
        </div>
        <div className="text-center md:text-left flex-1">
          <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
            <h2 className="text-5xl font-black text-main tracking-tight">{user.name.toUpperCase()}</h2>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest">{user.role}</p>
          {userData?.email && (
            <p className="text-gray-500 text-sm mt-1">{userData.email}</p>
          )}
          {session && !isCurrentUser && !isFriend && (
            <div className="mt-4 flex flex-col justify-center md:justify-start gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddFriend();
                }}
                disabled={addFriendMutation.isPending || userLoading || !userData?.username}
                className="px-6 py-2 rounded-xl bg-accent/10 border border-accent/50 text-accent hover:bg-accent/20 transition-all text-sm font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 w-fit"
              >
                <i className="fa-solid fa-user-plus text-xs"></i>
                {addFriendMutation.isPending ? 'Adding...' : 'Add Friend'}
              </button>
              {userLoading && (
                <p className="text-sm text-gray-500">Loading user data...</p>
              )}
              {!userLoading && !userData?.username && (
                <p className="text-sm text-gray-500">This user needs to log in to set their username</p>
              )}
              {addFriendError && (
                <p className="text-sm text-red-400">{addFriendError}</p>
              )}
            </div>
          )}
          {session && !isCurrentUser && isFriend && (
            <div className="mt-4 flex justify-center md:justify-start">
              <button
                onClick={handleUnfriend}
                disabled={unfriendMutation.isPending}
                className="px-6 py-2 rounded-xl bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20 transition-all text-sm font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="flex gap-6 mt-8 justify-center md:justify-start">
            {[
              { label: 'Watched', value: stats.watched },
              { label: 'Reviews', value: stats.reviews },
              { label: 'Groups', value: stats.groups }
            ].map(stat => (
              <div key={stat.label} className="text-center glass px-6 py-4 rounded-3xl border-main min-w-[100px]">
                <p className="text-2xl font-black text-accent">{stat.value}</p>
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-8">RECENT ACTIVITY</h3>
            {recentReviews.length === 0 ? (
              <div className="glass p-5 rounded-3xl border-main text-center">
                <p className="text-sm text-gray-500">No recent reviews</p>
              </div>
            ) : (
              <div className="space-y-6">
                {recentReviews.map((review: any) => {
                  const reviewDate = review.created_at ? new Date(review.created_at) : new Date();
                  const dateStr = reviewDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
                  
                  return (
                    <div key={review.id} className="glass p-6 rounded-[2.5rem] flex gap-8 hover:bg-black/[0.02] transition-all group">
                      {review.media?.posterUrl && (
                        <img src={review.media.posterUrl} className="w-24 h-36 rounded-2xl object-cover shadow-md" alt={review.media.title} />
                      )}
                      <div className="flex-1 py-1">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-black text-main group-hover:text-accent transition-colors">{review.media?.title || 'Unknown'}</h4>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <i key={s} className={`fa-solid fa-star text-xs ${s <= (review.rating || 0) ? 'text-accent' : 'text-gray-200'}`}></i>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">RATED ON {dateStr}</p>
                        {review.comment && (
                          <p className="text-sm text-gray-500 font-medium italic">"{review.comment}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-12">
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-6">GROUPS</h3>
            {teams.length === 0 ? (
              <div className="glass p-5 rounded-3xl border-main text-center">
                <p className="text-sm text-gray-500">No groups yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map((team: any) => (
                  <div key={team.id} className="glass p-5 rounded-3xl border-main flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/[0.03] flex items-center justify-center text-gray-400">
                      <i className="fa-solid fa-user-group text-sm"></i>
                    </div>
                    <span className="text-sm font-bold text-main">{team.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-6">TOP GENRES</h3>
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
                    topGenres.map(tag => (
                      <span key={tag} className={`px-4 py-2 rounded-2xl border text-[10px] font-black tracking-widest ${getGenreColor(tag)}`}>
                        {tag}
                      </span>
                    ))
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
