'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Movie } from '@/lib/types';

const NewListModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [listName, setListName] = useState('');
  const [isShared, setIsShared] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-10 relative border-white/10 animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <h2 className="text-2xl font-black mb-2">Create New List</h2>
        <p className="text-sm text-gray-400 mb-8">Organize your cinematic discoveries.</p>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-black text-accent tracking-widest mb-3">List Name</label>
            <input 
              autoFocus
              type="text" 
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. 90s Cyberpunk Noir"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-medium focus:border-accent/50 focus:bg-white/[0.08] transition-all outline-none"
            />
          </div>

          <div className="flex items-center justify-between glass p-4 rounded-xl border-white/5">
            <div>
              <p className="text-xs font-bold">Collaborative List</p>
              <p className="text-[9px] text-gray-500 font-medium">Allow group members to add movies</p>
            </div>
            <div 
              onClick={() => setIsShared(!isShared)}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isShared ? 'bg-accent' : 'bg-gray-400/20'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isShared ? 'right-1' : 'left-1'}`}></div>
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
              className="flex-1 bg-accent text-white px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all no-glow shadow-lg shadow-accent/20"
            >
              Create List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WatchlistView: React.FC<{ movies?: Movie[] }> = ({ movies: propMovies }) => {
  const { data: session, status: sessionStatus } = useSession();
  const [tab, setTab] = useState('Personal');
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch personal watchlist
  const { data: personalWatchlist = [], isLoading: personalLoading } = useQuery({
    queryKey: ['watchlist', 'personal'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Fetch shared watchlists (team watchlists)
  const { data: teamsData = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await fetch('/api/teams');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Fetch watchlist for first team (for shared tab)
  const firstTeamId = teamsData.length > 0 ? teamsData[0].id : null;
  const { data: sharedWatchlist = [], isLoading: sharedLoading } = useQuery({
    queryKey: ['watchlist', 'shared', firstTeamId],
    queryFn: async () => {
      if (!firstTeamId) return [];
      const res = await fetch(`/api/watchlist?teamId=${firstTeamId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated' && !!firstTeamId,
  });

  // Use prop movies if provided (for backwards compatibility), otherwise use fetched data
  const movies = propMovies || (tab === 'Personal' ? personalWatchlist : sharedWatchlist);
  const isLoading = tab === 'Personal' ? personalLoading : sharedLoading;

  const handleDelete = async (movie: Movie) => {
    if (!session?.user?.id) return;

    const isPersonal = tab === 'Personal';
    const teamId = isPersonal ? null : firstTeamId;
    const queryKey = isPersonal 
      ? ['watchlist', 'personal']
      : ['watchlist', 'shared', firstTeamId];

    // Optimistic update: remove from cache immediately
    const previousWatchlist = queryClient.getQueryData<Movie[]>(queryKey) || [];
    queryClient.setQueryData<Movie[]>(queryKey, (old = []) => 
      old.filter(m => m.id !== movie.id)
    );

    try {
      // Make DELETE request
      const url = `/api/watchlist?mediaId=${movie.id}${teamId ? `&teamId=${teamId}` : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert optimistic update on error
        queryClient.setQueryData(queryKey, previousWatchlist);
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete' }));
        console.error('Failed to remove from watchlist:', errorData);
        alert('Failed to remove from watchlist. Please try again.');
        return;
      }

      // Refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(queryKey, previousWatchlist);
      console.error('Error removing from watchlist:', error);
      alert('Failed to remove from watchlist. Please try again.');
    }
  }; 

  return (
    <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-black uppercase tracking-tight text-main">WATCHLISTS</h2>
        <div className="flex bg-black/[0.03] p-1 rounded-2xl border border-main">
          {['Personal', `Shared (${teamsData.length})`].map(t => {
            const isPersonal = t.startsWith('Personal');
            const isActive = (isPersonal && tab === 'Personal') || (!isPersonal && tab === 'Shared');
            return (
              <button 
                key={t}
                onClick={() => setTab(isPersonal ? 'Personal' : 'Shared')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive ? 'bg-accent text-white shadow-md' : 'text-gray-500 hover:text-main'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">Loading watchlist...</div>
        </div>
      ) : movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-6">
            <i className="fa-solid fa-list-check text-3xl"></i>
          </div>
          <h3 className="text-xl font-black text-main mb-2">No movies in watchlist</h3>
          <p className="text-sm text-gray-500 text-center max-w-md mb-6">
            {tab === 'Personal' 
              ? "Start building your personal watchlist by adding movies you want to watch."
              : "No shared watchlists yet. Create a group to start a shared watchlist."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {movies.map((movie: Movie) => (
          <div key={movie.id} className="glass rounded-[2rem] p-5 flex gap-5 hover:border-accent/40 transition-all group">
            {movie.poster ? (
              <img src={movie.poster} className="w-20 h-28 rounded-xl object-cover shadow-sm" alt={movie.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-sm">
                <i className="fa-solid fa-image text-gray-600 text-xl"></i>
              </div>
            )}
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h4 className="font-black text-sm text-main group-hover:text-accent transition-colors">{movie.title}</h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">{movie.year} • {movie.runtime}</p>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:brightness-110 transition-all">
                  Watch
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(movie);
                  }}
                  className="px-3 text-gray-400 hover:text-accent transition-colors"
                  title="Remove from watchlist"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>
            </div>
          </div>
          ))}
        
          <button 
          onClick={() => setIsNewListModalOpen(true)}
          className="border-2 border-dashed border-main rounded-[2rem] p-8 flex flex-col items-center justify-center text-gray-400 hover:text-accent hover:border-accent/40 transition-all min-h-[144px]"
        >
          <div className="w-10 h-10 rounded-full bg-black/[0.03] flex items-center justify-center mb-4 border border-main group-hover:border-accent/40">
            <i className="fa-solid fa-plus text-xs"></i>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">NEW LIST</span>
        </button>
        </div>
      )}

      {isNewListModalOpen && <NewListModal onClose={() => setIsNewListModalOpen(false)} />}
    </div>
  );
};

export default WatchlistView;
