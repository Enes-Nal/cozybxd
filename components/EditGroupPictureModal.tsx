'use client';

import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './Toast';

interface EditGroupPictureModalProps {
  groupId: string;
  currentPictureUrl?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditGroupPictureModal: React.FC<EditGroupPictureModalProps> = ({ 
  groupId, 
  currentPictureUrl,
  onClose, 
  onSuccess 
}) => {
  const toast = useToast();
  const [pictureUrl, setPictureUrl] = useState(currentPictureUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(currentPictureUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const updateGroupMutation = useMutation({
    mutationFn: async (data: { pictureUrl?: string }) => {
      const res = await fetch(`/api/teams/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update group picture' }));
        throw new Error(errorData.error || 'Failed to update group picture');
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.showSuccess('Group picture updated!');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    },
    onError: (error: Error) => {
      const errorMsg = error.message;
      setError(errorMsg);
      toast.showError(errorMsg);
      setIsSubmitting(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        // Convert to base64 data URL for storage
        setPictureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    setIsSubmitting(true);
    
    // If using URL input instead of file
    const finalUrl = pictureUrl.trim() || undefined;
    updateGroupMutation.mutate({ pictureUrl: finalUrl });
  };

  const handleRemove = async () => {
    setError(null);
    setIsSubmitting(true);
    setSelectedFile(null);
    setPreview(null);
    setPictureUrl('');
    updateGroupMutation.mutate({ pictureUrl: undefined });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300 overflow-visible">
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <h2 className="text-2xl font-black mb-2">Edit Group Picture</h2>
        <p className="text-sm text-gray-400 mb-8">Upload a new picture or enter an image URL.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Preview */}
          {preview && (
            <div className="flex justify-center mb-4">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-32 h-32 rounded-2xl object-cover border border-white/10"
              />
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Upload Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium hover:bg-white/[0.08] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-upload mr-2"></i>
              {selectedFile ? selectedFile.name : 'Choose Image File'}
            </button>
            <p className="text-xs text-gray-500 mt-2">Max 5MB. JPG, PNG, or GIF</p>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              Or Enter Image URL
            </label>
            <input 
              type="url" 
              value={pictureUrl}
              onChange={(e) => {
                setPictureUrl(e.target.value);
                if (e.target.value && !e.target.value.startsWith('data:')) {
                  setPreview(e.target.value);
                }
                setError(null);
              }}
              placeholder="https://example.com/image.jpg"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            {currentPictureUrl && (
              <button 
                type="button"
                onClick={handleRemove}
                disabled={isSubmitting}
                className="px-4 py-4 rounded-2xl border border-red-500/50 text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            )}
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
              disabled={isSubmitting}
              className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGroupPictureModal;

