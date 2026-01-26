'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface ActivityLog {
  id: string;
  team_id: string;
  user_id: string;
  activity_type: 'member_joined' | 'member_left' | 'movie_added' | 'movie_removed' | 'movie_upvoted' | 'movie_downvoted';
  media_id?: string;
  metadata?: {
    title?: string;
    type?: string;
    action?: string;
    invited_by?: string;
    invited_by_name?: string;
  };
  created_at: string;
  users?: {
    id: string;
    name: string;
    image: string;
  };
  media?: {
    id: string;
    title: string;
    poster_url?: string;
    type?: string;
  };
}

interface ActivityLogProps {
  teamId: string;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ teamId }) => {
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['teamActivity', teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/activity?limit=20`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityMessage = (log: ActivityLog) => {
    const userName = log.users?.name || 'Someone';
    const userAvatar = log.users?.image || '';
    
    switch (log.activity_type) {
      case 'member_joined':
        if (log.metadata?.invited_by_name) {
          return {
            icon: 'fa-user-plus',
            iconColor: 'text-green-400',
            message: `${userName} joined the group`,
            subtext: `Invited by ${log.metadata.invited_by_name}`,
            avatar: userAvatar,
          };
        }
        return {
          icon: 'fa-user-plus',
          iconColor: 'text-green-400',
          message: `${userName} joined the group`,
          avatar: userAvatar,
        };
      case 'member_left':
        return {
          icon: 'fa-user-minus',
          iconColor: 'text-red-400',
          message: `${userName} left the group`,
          avatar: userAvatar,
        };
      case 'movie_added':
        const movieTitle = log.media?.title || log.metadata?.title || 'a movie';
        return {
          icon: 'fa-plus',
          iconColor: 'text-blue-400',
          message: `${userName} added ${movieTitle} to the watchlist`,
          avatar: userAvatar,
          mediaPoster: log.media?.poster_url,
        };
      case 'movie_removed':
        const removedTitle = log.media?.title || log.metadata?.title || 'a movie';
        return {
          icon: 'fa-trash',
          iconColor: 'text-red-400',
          message: `${userName} removed ${removedTitle} from the watchlist`,
          avatar: userAvatar,
          mediaPoster: log.media?.poster_url,
        };
      case 'movie_upvoted':
        const upvotedTitle = log.media?.title || log.metadata?.title || 'a movie';
        return {
          icon: 'fa-thumbs-up',
          iconColor: 'text-green-400',
          message: `${userName} upvoted ${upvotedTitle}`,
          avatar: userAvatar,
          mediaPoster: log.media?.poster_url,
        };
      case 'movie_downvoted':
        const downvotedTitle = log.media?.title || log.metadata?.title || 'a movie';
        return {
          icon: 'fa-thumbs-down',
          iconColor: 'text-red-400',
          message: `${userName} downvoted ${downvotedTitle}`,
          avatar: userAvatar,
          mediaPoster: log.media?.poster_url,
        };
      default:
        return {
          icon: 'fa-circle',
          iconColor: 'text-gray-400',
          message: `${userName} performed an action`,
          avatar: userAvatar,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Recent Activity</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white/5"></div>
              <div className="flex-1">
                <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-white/5 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Recent Activity</p>
        <div className="text-center py-8">
          <i className="fa-solid fa-clock text-gray-500 text-2xl mb-2"></i>
          <p className="text-sm text-gray-400">No activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
      <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Recent Activity</p>
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {logs.map((log) => {
          const activity = getActivityMessage(log);
          return (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className="relative flex-shrink-0">
                {activity.mediaPoster ? (
                  <img 
                    src={activity.mediaPoster} 
                    alt={log.media?.title || ''}
                    className="w-10 h-14 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : activity.avatar ? (
                  <img 
                    src={activity.avatar} 
                    alt={log.users?.name || ''}
                    className="w-10 h-10 rounded-full"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <i className={`fa-solid ${activity.icon} ${activity.iconColor} text-sm`}></i>
                  </div>
                )}
                {!activity.mediaPoster && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0a0a0a] border-2 border-[#0a0a0a] flex items-center justify-center">
                    <i className={`fa-solid ${activity.icon} ${activity.iconColor} text-[8px]`}></i>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 leading-tight">{activity.message}</p>
                {activity.subtext && (
                  <p className="text-xs text-gray-500 mt-1">{activity.subtext}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(log.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityLog;

