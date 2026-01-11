'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface InvitePeopleModalProps {
  groupId: string;
  groupName: string;
  inviteCode: string;
  onClose: () => void;
}

const InvitePeopleModal: React.FC<InvitePeopleModalProps> = ({ 
  groupId, 
  groupName, 
  inviteCode,
  onClose 
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      // For now, we'll just show the invite code since we don't have an email invite system
      // In the future, this could call an API to send an email invite
      return { success: true };
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    },
    onError: (error: Error) => {
      setError(error.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    inviteMutation.mutate(email.trim());
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
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

        <h2 className="text-2xl font-black mb-2">Invite People</h2>
        <p className="text-sm text-gray-400 mb-8">Invite friends to join <span className="text-accent font-bold">{groupName}</span>.</p>

        {success && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-xl px-4 py-3 text-sm text-green-400 mb-6">
            Invite code copied to clipboard!
          </div>
        )}

        <div className="space-y-6">
          {/* Invite Code Section */}
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Invite Code
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={inviteCode}
                readOnly
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium text-center tracking-widest uppercase"
              />
              <button
                type="button"
                onClick={copyInviteCode}
                className="px-6 py-4 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20"
                title="Copy invite code"
              >
                <i className="fa-solid fa-copy"></i>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Share this code with friends to let them join</p>
          </div>

          {/* Email Invite Section (Future feature) */}
          <div className="border-t border-white/10 pt-6">
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Send Email Invite (Coming Soon)
            </label>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
                disabled={true}
              />
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button 
                type="submit"
                disabled={true}
                className="w-full bg-white/5 text-gray-500 px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest cursor-not-allowed"
              >
                Email invites coming soon
              </button>
            </form>
          </div>

          <div className="pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="w-full px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
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

