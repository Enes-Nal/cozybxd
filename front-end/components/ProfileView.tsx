
import React from 'react';
import { User, Movie } from '../types';

interface ProfileViewProps {
  user: User;
  movies: Movie[];
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, movies }) => {
  const watchedMovies = movies.slice(0, 2);
  const groups = ['Family Night', 'Cinephiles'];

  // Determine styles based on status and potentially browsing/watching context
  const getStatusStyles = () => {
    if (user.status === 'Offline') return 'border-red-500/50 text-red-500 bg-red-500/10';
    
    // In a real app, we'd check user context, but following the visual request:
    // Online/Ready = Green, Away = Yellow, Offline = Red
    if (user.status === 'Ready') return 'border-[#00c851]/50 text-[#00c851] bg-[#00c851]/10';
    if (user.status === 'Online') return 'border-[#00c851]/50 text-[#00c851] bg-[#00c851]/10';
    
    // Default fallback for any 'Away' implied state
    return 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10';
  };

  return (
    <div className="py-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      <div className="flex flex-col md:flex-row items-center gap-10 mb-16">
        <div className="w-40 h-40 rounded-[3rem] overflow-hidden border-4 border-main shadow-xl shrink-0">
           <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
        </div>
        <div className="text-center md:text-left flex-1">
          <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
            <h2 className="text-5xl font-black text-main tracking-tight">{user.name.toUpperCase()}</h2>
            <div className={`px-4 py-1 rounded-full border ${getStatusStyles()} text-[9px] font-black uppercase tracking-widest flex items-center justify-center min-w-[70px]`}>
              {user.status}
            </div>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest">Senior Cinephile • {user.role}</p>
          <div className="flex gap-6 mt-8 justify-center md:justify-start">
            {[
              { label: 'Watched', value: 124 },
              { label: 'Reviews', value: 42 },
              { label: 'Groups', value: 3 }
            ].map(stat => (
              <div key={stat.label} className="text-center glass px-6 py-4 rounded-3xl border-main min-w-[100px]">
                <p className="text-2xl font-black text-accent">{stat.value}</p>
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-8">RECENT ACTIVITY</h3>
            <div className="space-y-6">
              {watchedMovies.map(movie => (
                <div key={movie.id} className="glass p-6 rounded-[2.5rem] flex gap-8 hover:bg-black/[0.02] transition-all group">
                  <img src={movie.poster} className="w-24 h-36 rounded-2xl object-cover shadow-md" alt={movie.title} />
                  <div className="flex-1 py-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-black text-main group-hover:text-accent transition-colors">{movie.title}</h4>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <i key={s} className={`fa-solid fa-star text-xs ${s <= 4 ? 'text-accent' : 'text-gray-200'}`}></i>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">RATED ON JAN 5, 2026</p>
                    <p className="text-sm text-gray-500 font-medium italic">"One of the best visual experiences of the year. The pacing was perfect for a group watch."</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-12">
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-6">GROUPS</h3>
            <div className="space-y-3">
              {groups.map(g => (
                <div key={g} className="glass p-5 rounded-3xl border-main flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/[0.03] flex items-center justify-center text-gray-400">
                    <i className="fa-solid fa-user-group text-sm"></i>
                  </div>
                  <span className="text-sm font-bold text-main">{g}</span>
                </div>
              ))}
            </div>
          </section>
          
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-6">TOP GENRES</h3>
            <div className="flex flex-wrap gap-3">
              {['SCI-FI', 'NOIR', 'INDIE', 'THRILLER'].map(tag => (
                <span key={tag} className="px-4 py-2 rounded-2xl bg-black/[0.03] border border-main text-[10px] font-black text-gray-500 tracking-widest">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
