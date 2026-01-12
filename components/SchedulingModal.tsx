'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Movie, Group } from '@/lib/types';
import { transformTeamToGroup } from '@/lib/utils/transformers';

interface AddToGroupModalProps {
  movie: Movie;
  onClose: () => void;
  onConfirm: (groupId: string, interestLevel: number) => void;
}

const SchedulingModal: React.FC<AddToGroupModalProps> = ({ movie, onClose, onConfirm }) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [interestLevel, setInterestLevel] = useState(50);

  // Fetch groups from API
  const { data: teamsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await fetch('/api/teams');
      if (!res.ok) throw new Error('Failed to fetch groups');
      return res.json();
    },
  });

  const groups = teamsData ? teamsData.map((team: any) => transformTeamToGroup(team)) : [];
  
  // Get the selected group's voting enabled setting
  const selectedGroupData = groups.find((g: Group) => g.id === selectedGroup);
  const isInterestLevelVotingEnabled = selectedGroupData?.interestLevelVotingEnabled || false;
  
  // Set first group as default when groups load
  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
  }, [groups, selectedGroup]);

  // Reset interest level to 50 when voting is disabled or group changes
  useEffect(() => {
    if (!isInterestLevelVotingEnabled) {
      setInterestLevel(50);
    }
  }, [isInterestLevelVotingEnabled, selectedGroup]);

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
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">Select Group</label>
            {groupsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No groups available. Create a group first.</div>
            ) : (
              <div className="space-y-2">
                {groups.map((group: Group) => (
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
            )}
          </div>

          <div className={isInterestLevelVotingEnabled ? '' : 'opacity-30 brightness-50'}>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">
              How much do you want to watch this?
            </label>
            <div className="space-y-3">
              <input
                type="range"
                min="0"
                max="100"
                value={interestLevel}
                onChange={(e) => setInterestLevel(Number(e.target.value))}
                disabled={!isInterestLevelVotingEnabled}
                className="w-full h-2 bg-white/5 rounded-lg appearance-none accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: isInterestLevelVotingEnabled
                    ? `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(139, 92, 246) ${interestLevel}%, rgba(255, 255, 255, 0.05) ${interestLevel}%, rgba(255, 255, 255, 0.05) 100%)`
                    : `linear-gradient(to right, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.3) ${interestLevel}%, rgba(255, 255, 255, 0.02) ${interestLevel}%, rgba(255, 255, 255, 0.02) 100%)`,
                  cursor: isInterestLevelVotingEnabled ? 'pointer' : 'not-allowed'
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Not interested</span>
                <span className={`font-bold ${isInterestLevelVotingEnabled ? 'text-accent' : 'text-gray-500'}`}>{interestLevel}%</span>
                <span>Very interested</span>
              </div>
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
              onClick={() => {
                if (selectedGroup) {
                  onConfirm(selectedGroup, interestLevel);
                }
              }}
              disabled={!selectedGroup || groupsLoading}
              className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
