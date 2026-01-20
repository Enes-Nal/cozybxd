'use client'

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User } from '@/lib/types';
import { checkProfanity } from '@/lib/utils/profanity';
import { useToast } from './Toast';

interface EditProfileModalProps {
  onClose: () => void;
  currentUser: User | null;
  currentEmail?: string;
  currentUsername?: string | null;
}

// Utility function to validate banner image dimensions
const validateBannerImage = (url: string): Promise<{ valid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    if (!url || !url.trim()) {
      resolve({ valid: true }); // Empty is valid (optional field)
      return;
    }

    const trimmedUrl = url.trim();
    
    // Basic URL validation
    try {
      new URL(trimmedUrl);
    } catch {
      resolve({ valid: false, error: 'Invalid URL format. Please enter a valid image URL (e.g., https://example.com/image.jpg)' });
      return;
    }

    // Check if URL looks like an image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const urlLower = trimmedUrl.toLowerCase();
    const hasImageExtension = imageExtensions.some(ext => urlLower.includes(ext));
    if (!hasImageExtension && !urlLower.includes('data:image')) {
      // Not a hard requirement, but warn if it doesn't look like an image
      // We'll still try to load it
    }

    let timeoutId: NodeJS.Timeout;
    let resolved = false;
    let retryAttempted = false;

    const resolveOnce = (result: { valid: boolean; error?: string }) => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(result);
      }
    };

    const attemptLoad = (useCors: boolean) => {
      const img = new Image();
      img.crossOrigin = useCors ? 'anonymous' : null;
      
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        // If dimensions are 0, image might not have loaded properly
        if (width === 0 || height === 0) {
          resolveOnce({ valid: false, error: 'Could not determine image dimensions. The image may be corrupted or the URL may not point to a valid image file.' });
          return;
        }
        
        // Any size is acceptable - the banner will be fitted automatically
        resolveOnce({ valid: true });
      };
      
      img.onerror = () => {
        // If CORS fails and we haven't retried, try without CORS
        if (useCors && !retryAttempted) {
          retryAttempted = true;
          attemptLoad(false);
          return;
        }
        
        // Provide more helpful error message
        let errorMsg = 'Failed to load image. ';
        if (useCors && retryAttempted) {
          errorMsg += 'The image URL may be invalid, inaccessible, or blocked by CORS. Please ensure the URL is publicly accessible and points to a valid image file.';
        } else {
          errorMsg += 'Please check that the URL is correct, the image is publicly accessible, and the file is a valid image format (JPG, PNG, GIF, WebP, SVG).';
        }
        resolveOnce({ valid: false, error: errorMsg });
      };
      
      img.src = trimmedUrl;
    };
    
    // Set timeout for slow-loading images
    timeoutId = setTimeout(() => {
      resolveOnce({ valid: false, error: 'Image took too long to load. The server may be slow or the URL may be incorrect. Please try a different image or check your internet connection.' });
    }, 10000);
    
    // Start with CORS attempt
    attemptLoad(true);
  });
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose, currentUser, currentEmail, currentUsername }) => {
  const toast = useToast();
  const [name, setName] = useState(currentUser?.name || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [banner, setBanner] = useState(currentUser?.banner || '');
  const [username, setUsername] = useState(currentUsername || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerValidating, setBannerValidating] = useState(false);
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

    // Validate banner image dimensions if provided
    const trimmedBanner = banner.trim();
    if (trimmedBanner) {
      setBannerValidating(true);
      const bannerValidation = await validateBannerImage(trimmedBanner);
      setBannerValidating(false);
      
      if (!bannerValidation.valid) {
        setError(bannerValidation.error || 'Invalid banner image');
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
      
      toast.showSuccess('Profile updated successfully!');
      // Close modal after successful update
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err) {
      const errorMsg = 'An error occurred. Please try again.';
      setError(errorMsg);
      toast.showError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300 overflow-visible">
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white transition-colors"
            disabled={loading}
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

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
              onChange={async (e) => {
                const newBanner = e.target.value;
                setBanner(newBanner);
                setError(null);
                
                // Validate banner dimensions when user enters a URL
                if (newBanner.trim()) {
                  setBannerValidating(true);
                  const validation = await validateBannerImage(newBanner.trim());
                  setBannerValidating(false);
                  if (!validation.valid) {
                    setError(validation.error || 'Invalid banner image');
                  }
                }
              }}
              placeholder="https://example.com/banner.jpg"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-[var(--accent-color)]/50 focus:bg-white/[0.08] transition-all outline-none text-main"
              disabled={loading}
            />
            <div className="mt-2 flex items-center gap-2">
              {bannerValidating && (
                <span className="text-xs text-gray-400">
                  <i className="fa-solid fa-spinner fa-spin mr-1"></i>
                  Validating image...
                </span>
              )}
              {!bannerValidating && (
                <p className="text-xs text-gray-500">
                  Any size image or GIF is accepted. The banner will be automatically fitted.
                </p>
              )}
            </div>
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

