'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './Toast';

const InboxView: React.FC = () => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch incoming friend requests
  const { data: incomingRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['friendRequests', 'incoming'],
    queryFn: async () => {
      const res = await fetch('/api/friends/requests?type=incoming');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
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
      toast.showSuccess('Friend request accepted!');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to accept friend request');
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
      toast.showSuccess('Friend request rejected');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to reject friend request');
    },
  });

  const handleAccept = (requestId: string) => {
    acceptRequestMutation.mutate(requestId);
  };

  const handleReject = (requestId: string) => {
    rejectRequestMutation.mutate(requestId);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('default', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  const allNotifications = [
    ...incomingRequests.map((req: any) => ({
      id: req.id,
      type: 'friend_request',
      from: req.user.name || req.user.username || 'Unknown',
      content: 'sent you a friend request',
      time: formatTime(req.created_at),
      requestId: req.id,
    })),
  ];

  return (
    <div className="py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-black uppercase tracking-tight mb-10 text-main">Inbox</h2>
      
      {isLoadingRequests ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-6">
            <i className="fa-solid fa-spinner fa-spin text-3xl"></i>
          </div>
          <h3 className="text-xl font-black text-main mb-2">Loading...</h3>
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-6">
            <i className="fa-solid fa-inbox text-3xl"></i>
          </div>
          <h3 className="text-xl font-black text-main mb-2">No notifications</h3>
          <p className="text-sm text-gray-500 text-center max-w-md">
            Your inbox is empty. You'll see friend requests, team invitations, vote polls, and watchlist updates here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allNotifications.map((n) => (
            <div key={n.id} className="glass p-8 rounded-[2rem] border-white/5 flex items-center justify-between group hover:bg-black/[0.02] transition-all">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-black/[0.03] flex items-center justify-center text-accent border border-main">
                  <i className={`fa-solid ${n.type === 'friend_request' ? 'fa-user-plus' : n.type === 'invite' ? 'fa-user-group' : n.type === 'vote' ? 'fa-check-to-slot' : 'fa-bell'} text-lg`}></i>
                </div>
                <div>
                  <p className="text-sm font-bold">
                    <span className="text-accent font-black">{n.from}</span> 
                    <span className="text-main ml-1">{n.content}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5">{n.time}</p>
                </div>
              </div>
              {n.type === 'friend_request' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(n.requestId)}
                    disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                    className="bg-accent hover:brightness-110 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all no-glow shadow-lg shadow-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {acceptRequestMutation.isPending ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleReject(n.requestId)}
                    disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                    className="bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rejectRequestMutation.isPending ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              )}
              {n.type !== 'friend_request' && (
                <button className="bg-accent hover:brightness-110 text-white px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all no-glow shadow-lg shadow-accent/10">
                  {n.action || 'View'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InboxView;
