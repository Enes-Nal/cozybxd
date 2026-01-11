'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Movie } from '@/lib/types';

const HistoryView: React.FC<{ movies?: Movie[] }> = ({ movies: propMovies }) => {
  const { status: sessionStatus } = useSession();

  // Fetch history from API
  const { data: historyData = [], isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: sessionStatus === 'authenticated',
  });

  // Use prop movies if provided (for backwards compatibility), otherwise use fetched data
  const movies = propMovies || historyData;

  return (
    <div className="py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      <h2 className="text-3xl font-black mb-10 tracking-tight text-main">SHARED JOURNEY</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">Loading history...</div>
        </div>
      ) : movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-6">
            <i className="fa-solid fa-clock-rotate-left text-3xl"></i>
          </div>
          <h3 className="text-xl font-black text-main mb-2">No watch history</h3>
          <p className="text-sm text-gray-500 text-center max-w-md">
            Your viewing history will appear here once you start logging movies with your groups.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-main ml-4 pl-8 space-y-12 pb-20">
          {movies.map((movie: any, idx: number) => {
            const watchedDate = movie.watchedAt ? new Date(movie.watchedAt) : new Date();
            const month = watchedDate.toLocaleString('default', { month: 'short' }).toUpperCase();
            const day = watchedDate.getDate();
            
            return (
          <div key={movie.id} className="relative group">
            {/* Timeline dot using accent color */}
            <div className="absolute -left-[42px] top-6 w-5 h-5 rounded-full bg-accent border-4 border-main group-hover:scale-125 transition-transform z-10"></div>
            
            <div className="flex flex-col md:flex-row gap-8 glass p-6 rounded-[2rem] border-main hover:bg-black/[0.02] transition-all">
              <div className="w-32 h-48 rounded-2xl overflow-hidden shadow-lg shrink-0">
                {movie.poster ? (
                  <img src={movie.poster} className="w-full h-full object-cover" alt={movie.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <i className="fa-solid fa-image text-gray-600 text-2xl"></i>
                  </div>
                )}
              </div>
              
              <div className="py-2 flex-1">
                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">WATCHED {month} {day}</p>
                <h3 className="text-2xl font-black mb-2 text-main">{movie.title}</h3>
                <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                  {movie.reviews && movie.reviews.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 bg-black/[0.03] px-2 py-1 rounded-md border border-main">
                        <i className="fa-solid fa-star text-yellow-500"></i>
                        <span className="text-main">
                          {(movie.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / movie.reviews.length).toFixed(1)}
                        </span>
                      </div>
                      <span className="opacity-30">•</span>
                    </>
                  )}
                  {movie.attendees && movie.attendees.length > 0 && (
                    <span className="text-gray-400">{movie.attendees.length} {movie.attendees.length === 1 ? 'ATTENDEE' : 'ATTENDEES'}</span>
                  )}
                </div>
                {movie.reviews && movie.reviews.length > 0 && movie.reviews[0].comment && (
                  <p className="text-sm text-gray-500 leading-relaxed italic line-clamp-3">
                    "{movie.reviews[0].comment}"
                  </p>
                )}
                {movie.notes && (
                  <p className="text-sm text-gray-500 leading-relaxed italic line-clamp-3">
                    "{movie.notes}"
                  </p>
                )}
                {movie.attendees && movie.attendees.length > 0 && (
                  <div className="mt-6 flex items-center gap-3 pt-4 border-t border-main">
                    <div className="flex -space-x-2">
                      {movie.attendees.slice(0, 5).map((attendee: any) => (
                        <img 
                          key={attendee.user_id || attendee.id} 
                          className="w-6 h-6 rounded-full border-2 border-main" 
                          src={attendee.users?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(attendee.users?.name || 'User')}`} 
                          alt={attendee.users?.name || 'User'} 
                          title={attendee.users?.name || 'User'}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">VERIFIED WATCH</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryView;
