'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Movie } from '@/lib/types';

interface ProfileViewProps {
  user: User;
  movies?: Movie[];
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, movies: propMovies }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

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

  // Check if the viewed user is a friend
  const isFriend = friendsData.some((friend: User) => friend.id === user.id);
  const isCurrentUser = session?.user?.id === user.id;

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
    },
  });

  const handleUnfriend = async () => {
    if (confirm(`Are you sure you want to unfriend ${user.name}?`)) {
      unfriendMutation.mutate(user.id);
    }
  };

  const stats = userData?.stats || { watched: 0, reviews: 0, groups: 0 };
  const teams = userData?.teams || [];
  const recentReviews = reviewsData.slice(0, 2);

  // Determine styles based on status and potentially browsing/watching context
  const getStatusStyles = () => {
    if (user.status === 'Offline') return 'border-red-500/50 text-red-500 bg-red-500/10';
    
    // In a real app, we'd check user context, but following the visual request:
    // Online/Ready = Green, Away = Yellow, Offline = Red
    if (user.status === 'Ready') return 'border-[#00c851]/50 text-[#00c851] bg-[#00c851]/10';
    if (user.status === 'Online') return 'border-[#00c851]/50 text-[#00c851] bg-[#00c851]/10';
    
    // Default fallback for any 'Away' implied state
    return 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10';
  };

  return (
    <div className="py-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      <div className="flex flex-col md:flex-row items-center gap-10 mb-16">
        <div className="w-40 h-40 rounded-[3rem] overflow-hidden border-4 border-main shadow-xl shrink-0">
           <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
        </div>
        <div className="text-center md:text-left flex-1">
          <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
            <h2 className="text-5xl font-black text-main tracking-tight">{user.name.toUpperCase()}</h2>
            <div className={`px-4 py-1 rounded-full border ${getStatusStyles()} text-[9px] font-black uppercase tracking-widest flex items-center justify-center min-w-[70px]`}>
              {user.status}
            </div>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest">{user.role}</p>
          {userData?.email && (
            <p className="text-gray-500 text-sm mt-1">{userData.email}</p>
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
              <div className="glass p-8 rounded-[2.5rem] text-center">
                <p className="text-gray-500">No recent reviews</p>
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
                      <span key={tag} className="px-4 py-2 rounded-2xl bg-black/[0.03] border border-main text-[10px] font-black text-gray-500 tracking-widest">
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
