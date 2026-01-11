
import React from 'react';
import { Movie } from '../types';

const HistoryView: React.FC<{ movies: Movie[] }> = ({ movies }) => {
  return (
    <div className="py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      <h2 className="text-3xl font-black mb-10 tracking-tight text-main">SHARED JOURNEY</h2>
      
      <div className="relative border-l-2 border-main ml-4 pl-8 space-y-12 pb-20">
        {movies.map((movie, idx) => (
          <div key={movie.id} className="relative group">
            {/* Timeline dot using accent color */}
            <div className="absolute -left-[42px] top-6 w-5 h-5 rounded-full bg-accent border-4 border-main group-hover:scale-125 transition-transform z-10"></div>
            
            <div className="flex flex-col md:flex-row gap-8 glass p-6 rounded-[2rem] border-main hover:bg-black/[0.02] transition-all">
              <div className="w-32 h-48 rounded-2xl overflow-hidden shadow-lg shrink-0">
                <img src={movie.poster} className="w-full h-full object-cover" alt={movie.title} />
              </div>
              
              <div className="py-2 flex-1">
                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">WATCHED DEC {20 - idx}</p>
                <h3 className="text-2xl font-black mb-2 text-main">{movie.title}</h3>
                <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                  <div className="flex items-center gap-1.5 bg-black/[0.03] px-2 py-1 rounded-md border border-main">
                    <i className="fa-solid fa-star text-yellow-500"></i>
                    <span className="text-main">4.8</span>
                  </div>
                  <span className="opacity-30">•</span>
                  <span className="text-gray-400">FAMILY NIGHT</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed italic line-clamp-3">
                  "A masterpiece of modern cinema. Everyone agreed this was the highlight of our monthly watch cycle. Marcus especially loved the sound design."
                </p>
                <div className="mt-6 flex items-center gap-3 pt-4 border-t border-main">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <img key={i} className="w-6 h-6 rounded-full border-2 border-main" src={`https://picsum.photos/seed/${i+10}/50/50`} alt="Member" />
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">VERIFIED WATCH</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;
