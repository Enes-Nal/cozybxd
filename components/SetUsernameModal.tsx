'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { checkProfanity } from '@/lib/utils/profanity';

interface SetUsernameModalProps {
  onClose: () => void;
  defaultDiscordUsername?: string;
}

const SetUsernameModal: React.FC<SetUsernameModalProps> = ({ onClose, defaultDiscordUsername }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  // Set default username to Discord username if provided
  useEffect(() => {
    if (defaultDiscordUsername) {
      setUsername(defaultDiscordUsername.toLowerCase());
    } else if (session?.user?.name) {
      // Fallback to session name (likely Discord username)
      setUsername(session.user.name.toLowerCase());
    }
  }, [defaultDiscordUsername, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    
    // If empty, use Discord username as default
    const usernameToSet = trimmedUsername || defaultDiscordUsername || session?.user?.name || '';
    
    if (!usernameToSet) {
      setError('Please enter a username');
      return;
    }

    // Check for profanity and slurs
    const profanityCheck = checkProfanity(usernameToSet);
    if (!profanityCheck.isValid) {
      setError(profanityCheck.error || 'Username contains inappropriate language');
      return;
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
          username: usernameToSet.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to set username');
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

  const handleUseDefault = async () => {
    const defaultUsername = defaultDiscordUsername || session?.user?.name || '';
    if (!defaultUsername) {
      setError('No default username available');
      return;
    }

    // Check for profanity and slurs in default username
    const profanityCheck = checkProfanity(defaultUsername);
    if (!profanityCheck.isValid) {
      setError(profanityCheck.error || 'Default username contains inappropriate language. Please set a custom username.');
      return;
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
          username: defaultUsername.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to set username');
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

  const defaultUsername = defaultDiscordUsername || session?.user?.name || 'your Discord username';
  const hasDiscordUsername = !!(defaultDiscordUsername || session?.user?.name);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-black mb-2">Welcome! Set Your Username</h2>
        <p className="text-sm text-gray-400 mb-8">
          {hasDiscordUsername ? (
            <>Choose a username for your account. If you don't set one, we'll use <span className="font-bold text-[var(--accent-color)]">{defaultUsername}</span> (your Discord username) as your username.</>
          ) : (
            <>Choose a username for your account. If you don't set one, we'll use your Discord username as your username.</>
          )}
        </p>

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
              placeholder={defaultUsername}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-[var(--accent-color)]/50 focus:bg-white/[0.08] transition-all outline-none text-main"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500">
              Leave empty to use {defaultUsername} as your username
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={handleUseDefault}
              className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all disabled:opacity-50"
              disabled={loading}
            >
              Use {defaultUsername}
            </button>
            <button 
              type="submit"
              className="flex-1 bg-[var(--accent-color)] text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-[var(--accent-color)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Setting...' : username.trim() ? 'Set Username' : `Use ${defaultUsername}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetUsernameModal;

