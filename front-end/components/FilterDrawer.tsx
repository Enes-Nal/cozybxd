
import React, { useState } from 'react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const FilterDrawer: React.FC<FilterDrawerProps> = ({ isOpen, onClose }) => {
  const [runtimeRange, setRuntimeRange] = useState(120);
  const [ratingMin, setRatingMin] = useState(7);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-[#0d0d0d] h-full shadow-2xl border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Discovery Filters</h2>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Refine your search parameters</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Type Section */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6b6b] mb-4 block">Content Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-[#ff6b6b] text-black py-3 rounded-xl text-xs font-bold">Movies</button>
              <button className="bg-white/5 text-gray-500 py-3 rounded-xl text-xs font-bold hover:text-white transition-colors">TV Shows</button>
            </div>
          </section>

          {/* Runtime Slider */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6b6b]">Max Runtime</label>
              <span className="text-xs font-bold text-white">{runtimeRange} min</span>
            </div>
            <input 
              type="range" 
              min="30" 
              max="240" 
              value={runtimeRange}
              onChange={(e) => setRuntimeRange(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#ff6b6b]"
            />
            <div className="flex justify-between mt-2">
              <button className="text-[9px] font-bold text-gray-600 hover:text-white" onClick={() => setRuntimeRange(90)}>Short (&lt;90)</button>
              <button className="text-[9px] font-bold text-gray-600 hover:text-white" onClick={() => setRuntimeRange(120)}>Standard</button>
              <button className="text-[9px] font-bold text-gray-600 hover:text-white" onClick={() => setRuntimeRange(180)}>Epic</button>
            </div>
          </section>

          {/* Rating Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6b6b]">Min Rating</label>
              <span className="text-xs font-bold text-white">{ratingMin}.0+</span>
            </div>
            <div className="flex gap-2">
              {[5, 6, 7, 8, 9].map(r => (
                <button 
                  key={r}
                  onClick={() => setRatingMin(r)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                    ratingMin === r ? 'bg-[#ff6b6b] border-[#ff6b6b] text-black' : 'bg-white/5 border-white/5 text-gray-500'
                  }`}
                >
                  {r}+
                </button>
              ))}
            </div>
          </section>

          {/* Genres (Multi-select) */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6b6b] mb-4 block">Genres</label>
            <div className="flex flex-wrap gap-2">
              {['Action', 'Comedy', 'Sci-Fi', 'Romance', 'Horror', 'Drama', 'Thriller', 'Animation', 'Mystery'].map(g => (
                <button key={g} className="px-4 py-2 rounded-xl border border-white/5 bg-white/5 text-[10px] font-bold hover:border-[#ff6b6b]/50 hover:text-white transition-all">
                  {g}
                </button>
              ))}
            </div>
          </section>

          {/* Better Constraints */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6b6b] mb-4 block">Discovery Logic</label>
            <div className="space-y-2">
              <label className="flex items-center justify-between glass p-4 rounded-xl border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold">Critically Acclaimed</p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">Focus on award winners and high critic scores</p>
                </div>
                <input type="checkbox" className="accent-[#ff6b6b] w-4 h-4" defaultChecked />
              </label>
              
              <label className="flex items-center justify-between glass p-4 rounded-xl border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold">Niche & Experimental</p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">Exclude blockbusters and massive franchises</p>
                </div>
                <input type="checkbox" className="accent-[#ff6b6b] w-4 h-4" />
              </label>

              <label className="flex items-center justify-between glass p-4 rounded-xl border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold">Budget Fit</p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">Only titles fitting group's remaining monthly hours</p>
                </div>
                <input type="checkbox" className="accent-[#ff6b6b] w-4 h-4" defaultChecked />
              </label>
            </div>
          </section>
        </div>

        <div className="p-8 border-t border-white/5 bg-[#0d0d0d] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-[#ff6b6b] text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all no-glow"
          >
            Apply Engine
          </button>
          <button className="px-6 border border-white/10 rounded-2xl text-xs font-bold text-gray-500 hover:text-white transition-all">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterDrawer;
