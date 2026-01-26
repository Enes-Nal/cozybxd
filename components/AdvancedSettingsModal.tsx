'use client';

import React from 'react';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm experimental-animations:animate-modal-backdrop"
        onClick={onClose}
        style={{
          animation: 'none'
        }}
      />
      
      {/* Modal */}
      <div 
        className="relative glass rounded-[2.5rem] p-8 max-w-md w-full border-main experimental-animations:animate-modal-content"
        style={{
          animation: 'none'
        }}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-exclamation-triangle text-yellow-500 text-xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-main mb-2">Advanced Settings</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              You're about to enable experimental animations. These features are still in development and may affect performance on some devices.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="glass p-4 rounded-xl border-main">
            <p className="text-xs font-bold text-main mb-2">What to expect:</p>
            <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
              <li>Enhanced motion and transitions throughout the app</li>
              <li>Physics-based animations similar to modern design tools</li>
              <li>Potential performance impact on older devices</li>
              <li>You can disable this at any time in settings</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-main border border-main hover:bg-main/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest bg-accent text-white hover:brightness-110 transition-all"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsModal;

