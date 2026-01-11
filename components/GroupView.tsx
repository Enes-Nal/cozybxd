'use client';

import React, { useState } from 'react';
import { Group, Movie } from '@/lib/types';
import MovieGrid from './MovieGrid';
import InvitePeopleModal from './InvitePeopleModal';

interface GroupViewProps {
  group: Group;
  movies: Movie[];
  onVote?: (id: string) => void;
  onSchedule?: (movie: Movie) => void;
  onSelect?: (movie: Movie) => void;
}

const GroupView: React.FC<GroupViewProps> = ({ 
  group, 
  movies, 
  onVote = async (id) => {
    try {
      let mediaId = id.startsWith('tmdb-') ? id.replace('tmdb-', '') : id;
      
      // If it's a TMDB ID, sync it first
      if (id.startsWith('tmdb-')) {
        const syncRes = await fetch('/api/media/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId: mediaId, type: 'movie' }),
        });
        if (syncRes.ok) {
          const media = await syncRes.json();
          mediaId = media.id;
        }
      }
      
      // Try to upvote first
      let res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${group.id}`, {
        method: 'POST',
      });
      
      // If not in watchlist, add it first then upvote
      if (!res.ok && res.status === 404) {
        const addRes = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId, teamId: group.id }),
        });
        if (addRes.ok) {
          // Now upvote
          res = await fetch(`/api/watchlist/${mediaId}/upvote?teamId=${group.id}`, {
            method: 'POST',
          });
        }
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  },
  onSchedule = () => {},
  onSelect = () => {}
}) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const budgetProgress = group.budgetHours > 0 ? (group.usedHours / group.budgetHours) * 100 : 0;
  const remainingHours = Math.max(0, group.budgetHours - group.usedHours);
  const nextMovie = movies.length > 0 ? movies[0] : null;
  const readyMembers = group.members.filter(m => m.status === 'Ready' || m.status === 'Online').length;

  const copyInviteCode = () => {
    if (group.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      // You could add a toast notification here
    }
  };

  return (
    <>
      <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div className="flex items-start gap-4">
            {group.pictureUrl && (
              <img 
                src={group.pictureUrl} 
                alt={group.name}
                className="w-20 h-20 rounded-2xl object-cover border border-white/10"
              />
            )}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-4xl font-black tracking-tight">{group.name}</h2>
                <span className="px-3 py-1 rounded-full bg-white/5 text-accent text-[10px] font-bold border border-white/10 uppercase tracking-widest">Active Sprint</span>
              </div>
              <p className="text-gray-400 max-w-md">{group.description || `${group.name} shared watchlist and viewing history.`}</p>
              {group.inviteCode && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-500">Invite Code:</span>
                  <code className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono tracking-widest uppercase">
                    {group.inviteCode}
                  </code>
                  <button
                    onClick={copyInviteCode}
                    className="text-accent hover:text-accent/80 transition-colors"
                    title="Copy invite code"
                  >
                    <i className="fa-solid fa-copy text-xs"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {group.members.map(m => (
                <img key={m.id} src={m.avatar} className="w-10 h-10 rounded-full border-2 border-[#0a0a0a]" alt={m.name} title={m.name} />
              ))}
            </div>
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-all"
              title="Invite people"
            >
              <i className="fa-solid fa-user-plus text-gray-400"></i>
            </button>
            <button className="bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-all"><i className="fa-solid fa-gear text-gray-400"></i></button>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Current Goal</p>
          <h4 className="text-xl font-bold mb-2">{remainingHours > 0 ? `${remainingHours.toFixed(1)} hours remaining` : 'Budget used'}</h4>
          <p className="text-xs text-gray-400 mb-6">{group.usedHours.toFixed(1)} / {group.budgetHours} hours used this month</p>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, budgetProgress)}%` }}
            ></div>
          </div>
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-4">Next Up</p>
          {nextMovie ? (
            <div className="flex items-center gap-4">
              <img src={nextMovie.poster} className="w-12 h-16 rounded-lg object-cover" alt={nextMovie.title} />
              <div>
                <h4 className="text-sm font-bold">{nextMovie.title}</h4>
                <p className="text-xs text-accent">{nextMovie.votes} votes</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-16 rounded-lg bg-white/5 flex items-center justify-center">
                <i className="fa-solid fa-film text-gray-500 text-xs"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-500">No movies in queue</h4>
                <p className="text-xs text-gray-400">Add movies to get started</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col items-center justify-center text-center">
          <button className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-3 hover:scale-110 transition-transform shadow-lg shadow-accent/20">
            <i className="fa-solid fa-play text-white text-xs ml-1"></i>
          </button>
          <h4 className="text-sm font-bold">Start Watch Party</h4>
          <p className="text-[10px] text-gray-500 mt-1">{readyMembers} {readyMembers === 1 ? 'member is' : 'members are'} currently ready</p>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-6">Group Queue</h3>
      {movies.length > 0 ? (
        <MovieGrid 
          movies={movies} 
          onVote={onVote}
          onSchedule={(id) => {
            const movie = movies.find(m => m.id === id);
            if (movie) onSchedule(movie);
          }}
          users={group.members} 
          onSelect={onSelect} 
        />
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500 mb-2">No movies in group watchlist</p>
            <p className="text-xs text-gray-400">Add movies to start building your queue</p>
          </div>
        </div>
      )}
      </div>

      {isInviteModalOpen && group.inviteCode && (
        <InvitePeopleModal
          groupId={group.id}
          groupName={group.name}
          inviteCode={group.inviteCode}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}
    </>
  );
};

export default GroupView;
