'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './Toast';

interface InvitePeopleModalProps {
  groupId: string;
  groupName: string;
  inviteCode?: string;
  onClose: () => void;
}

const InvitePeopleModal: React.FC<InvitePeopleModalProps> = ({ 
  groupId, 
  groupName, 
  inviteCode,
  onClose 
}) => {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch(`/api/teams/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to invite user' }));
        throw new Error(errorData.error || 'Failed to invite user');
      }
      return res.json();
    },
    onSuccess: (data) => {
      const invitedName = data.user.username || data.user.name || 'user';
      setSuccessMessage(`Successfully invited ${invitedName}!`);
      setSuccess(true);
      setUsername('');
      toast.showSuccess(`Invited ${invitedName} to ${groupName}!`);
      queryClient.invalidateQueries({ queryKey: ['teams', groupId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setTimeout(() => {
        setSuccess(false);
        setSuccessMessage('');
      }, 3000);
    },
    onError: (error: Error) => {
      const errorMsg = error.message;
      setError(errorMsg);
      toast.showError(errorMsg);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setIsSubmitting(true);
    inviteMutation.mutate(username.trim());
  };


  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300 overflow-visible">
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white active:scale-90 transition-all duration-200"
            disabled={isSubmitting}
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <h2 className="text-2xl font-black mb-2">Invite People</h2>
        <p className="text-sm text-gray-400 mb-8">Invite friends to join <span className="text-accent font-bold">{groupName}</span>.</p>

        {success && successMessage && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-xl px-4 py-3 text-sm text-green-400 mb-6">
            {successMessage}
          </div>
        )}
        {success && !successMessage && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-xl px-4 py-3 text-sm text-green-400 mb-6">
            Invite code copied to clipboard!
          </div>
        )}

        <div className="space-y-6">
          {/* Username Invite Section */}
          <div className="border-t border-white/10 pt-6">
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Invite by Username
            </label>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
                disabled={isSubmitting}
              />
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button 
                type="submit"
                disabled={isSubmitting || !username.trim()}
                className="w-full bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20 disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
              >
                {isSubmitting ? 'Inviting...' : 'Send Invite'}
              </button>
            </form>
          </div>

          <div className="pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="w-full px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 active:scale-95 transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitePeopleModal;

