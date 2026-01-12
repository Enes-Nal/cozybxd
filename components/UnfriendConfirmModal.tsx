'use client';

import React from 'react';
import { User } from '@/lib/types';

interface UnfriendConfirmModalProps {
  friend: User;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}

const UnfriendConfirmModal: React.FC<UnfriendConfirmModalProps> = ({ 
  friend, 
  onClose, 
  onConfirm,
  isPending = false 
}) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-fade-in">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-scale-in">
        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-gray-500 hover:text-white active:scale-90 transition-all duration-200 hover:rotate-90"
          disabled={isPending}
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <div className="text-center py-4">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto">
            <i className="fa-solid fa-user-minus text-2xl"></i>
          </div>
          <h2 className="text-2xl font-black mb-2">Unfriend {friend.name}?</h2>
          <p className="text-sm text-gray-400 mb-8">
            Are you sure you want to remove {friend.name} from your friends list? This action cannot be undone.
          </p>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Unfriending...' : 'Unfriend'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnfriendConfirmModal;

