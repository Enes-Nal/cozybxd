'use client'


import React, { useState } from 'react';

interface AddFriendModalProps {
  onClose: () => void;
}

const AddFriendModal: React.FC<AddFriendModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        {sent ? (
          <div className="text-center py-8 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/5 text-accent rounded-full flex items-center justify-center mb-6">
              <i className="fa-solid fa-paper-plane text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black mb-2">Invite Sent!</h2>
            <p className="text-sm text-gray-500 font-medium">We'll let you know when they join.</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black mb-2">Add a Friend</h2>
            <p className="text-sm text-gray-400 mb-8">Synchronize your watchlists with others.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">Friend's Email or Handle</label>
                <input 
                  autoFocus
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jason.cine@gmail.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AddFriendModal;
