'use client'

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User } from '@/lib/types';
import { checkProfanity } from '@/lib/utils/profanity';

interface EditProfileModalProps {
  onClose: () => void;
  currentUser: User | null;
  currentEmail?: string;
  currentUsername?: string | null;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose, currentUser, currentEmail, currentUsername }) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [banner, setBanner] = useState(currentUser?.banner || '');
  const [username, setUsername] = useState(currentUsername || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setAvatar(currentUser.avatar || '');
      setBanner(currentUser.banner || '');
    }
    if (currentUsername !== undefined) {
      setUsername(currentUsername || '');
    }
  }, [currentUser, currentUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Check for profanity and slurs in name
    const trimmedName = name.trim();
    const nameProfanityCheck = checkProfanity(trimmedName);
    if (!nameProfanityCheck.isValid) {
      setError(nameProfanityCheck.error || 'Name contains inappropriate language');
      return;
    }

    // Check for profanity and slurs in username if provided
    const trimmedUsername = username.trim();
    if (trimmedUsername) {
      const profanityCheck = checkProfanity(trimmedUsername);
      if (!profanityCheck.isValid) {
        setError(profanityCheck.error || 'Username contains inappropriate language');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          image: avatar.trim() || null,
          banner: banner.trim() || null,
          username: username.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        setLoading(false);
        return;
      }

      // Invalidate and refetch user data
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      
      // Close modal after successful update
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors"
          disabled={loading}
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <h2 className="text-2xl font-black mb-2">Edit Profile</h2>
        <p className="text-sm text-gray-400 mb-8">Update your profile information.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-black text-[var(--accent-color)] tracking-widest mb-3">
              Username
            </label>
            <input 
              autoFocus
              type="text" 
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="your-username"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-[var(--accent-color)]/50 focus:bg-white/[0.08] transition-all outline-none text-main"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500">Your unique username (lowercase, no spaces)</p>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-[var(--accent-color)] tracking-widest mb-3">
              Name
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Your name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-[var(--accent-color)]/50 focus:bg-white/[0.08] transition-all outline-none text-main"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-[var(--accent-color)] tracking-widest mb-3">
              Avatar URL
            </label>
            <input 
              type="url" 
              value={avatar}
              onChange={(e) => {
                setAvatar(e.target.value);
                setError(null);
              }}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-[var(--accent-color)]/50 focus:bg-white/[0.08] transition-all outline-none text-main"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500">Leave empty to use default avatar</p>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-[var(--accent-color)] tracking-widest mb-3">
              Banner URL
            </label>
            <input 
              type="url" 
              value={banner}
              onChange={(e) => {
                setBanner(e.target.value);
                setError(null);
              }}
              placeholder="https://example.com/banner.jpg"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-[var(--accent-color)]/50 focus:bg-white/[0.08] transition-all outline-none text-main"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500">Optional banner image for your profile</p>
          </div>

          {currentEmail && (
            <div>
              <label className="block text-[10px] uppercase font-black text-[var(--accent-color)] tracking-widest mb-3">
                Email
              </label>
              <input 
                type="email" 
                value={currentEmail}
                disabled
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium opacity-50 cursor-not-allowed text-main"
              />
              <p className="mt-2 text-xs text-gray-500">Email cannot be changed</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-[var(--accent-color)] text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-[var(--accent-color)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;

