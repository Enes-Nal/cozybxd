'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateGroupModalProps {
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; pictureUrl?: string }) => {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create group' }));
        throw new Error(errorData.error || 'Failed to create group');
      }
      return res.json();
    },
    onSuccess: async (data) => {
      // Invalidate and refetch teams to ensure data is available
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.refetchQueries({ queryKey: ['teams'] });
      
      // Also prefetch the group data
      await queryClient.prefetchQuery({
        queryKey: ['group', data.id],
        queryFn: async () => {
          const res = await fetch(`/api/teams/${data.id}`);
          if (!res.ok) throw new Error('Failed to fetch group');
          return res.json();
        },
      });
      
      if (onSuccess) {
        // Small delay to ensure data is ready
        setTimeout(() => {
          onSuccess(data.id);
        }, 100);
      }
      onClose();
    },
    onError: (error: Error) => {
      setError(error.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    createGroupMutation.mutate({ 
      name: name.trim(), 
      description: description.trim() || undefined,
      pictureUrl: pictureUrl.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors"
          disabled={isSubmitting}
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <h2 className="text-2xl font-black mb-2">Create a Group</h2>
        <p className="text-sm text-gray-400 mb-8">Start a new shared watchlist with friends.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Group Name <span className="text-red-400">*</span>
            </label>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Movie Night Squad"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Description (Optional)
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Group Picture URL (Optional)
            </label>
            <input 
              type="url" 
              value={pictureUrl}
              onChange={(e) => setPictureUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-2">Enter a URL to an image for your group</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;

