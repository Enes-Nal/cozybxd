
import React, { useState } from 'react';
import { Movie } from '../types';

interface AddToGroupModalProps {
  movie: Movie;
  onClose: () => void;
  onConfirm: (groupId: string) => void;
}

const SchedulingModal: React.FC<AddToGroupModalProps> = ({ movie, onClose, onConfirm }) => {
  const [selectedGroup, setSelectedGroup] = useState('w1');
  const [priority, setPriority] = useState('Medium');

  const groups = [
    { id: 'w1', name: 'Family Night' },
    { id: 'w2', name: 'Cinephiles' },
    { id: 'w3', name: 'Horror Club' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 shadow-2xl">
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <h2 className="text-2xl font-black mb-2">Add to Group</h2>
        <p className="text-sm text-gray-400 mb-8">Push <span className="text-accent font-bold">{movie.title}</span> to a shared workspace.</p>
        
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">Select Workspace</label>
            <div className="space-y-2">
              {groups.map(group => (
                <button 
                  key={group.id}
                  onClick={() => setSelectedGroup(group.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    selectedGroup === group.id 
                    ? 'bg-white/5 border-accent/40 text-white' 
                    : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm font-bold">{group.name}</span>
                  {selectedGroup === group.id && <i className="fa-solid fa-circle-check text-accent"></i>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">Set Priority</label>
            <div className="flex gap-2">
              {['Low', 'Medium', 'High'].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    priority === p 
                    ? 'bg-white/10 border-white/40 text-white' 
                    : 'bg-white/5 border-white/5 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => onConfirm(selectedGroup)}
              className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20"
            >
              Add to Queue
            </button>
          </div>
        </div>
        
        <p className="text-[9px] text-center text-gray-600 mt-6 font-bold uppercase tracking-tighter">
          This will notify all members in the selected group
        </p>
      </div>
    </div>
  );
};

export default SchedulingModal;
