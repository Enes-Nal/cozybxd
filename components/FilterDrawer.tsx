'use client'


import React, { useState, useEffect } from 'react';
import { getGenres } from '@/lib/api/tmdb';

export interface FilterState {
  contentType: 'movie' | 'tv';
  maxRuntime: number;
  minRating: number;
  genres: number[];
  criticallyAcclaimed: boolean;
  nicheExperimental: boolean;
  budgetFit: boolean;
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: FilterState) => void;
  onClearFilters?: () => void;
  initialFilters?: FilterState;
}

// All TMDB movie genres (ID, Name)
const ALL_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

const FilterDrawer: React.FC<FilterDrawerProps> = ({ isOpen, onClose, onApplyFilters, onClearFilters, initialFilters }) => {
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie');
  const [runtimeRange, setRuntimeRange] = useState(240); // Max value = no filter
  const [ratingMin, setRatingMin] = useState(0); // 0 = no filter
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [criticallyAcclaimed, setCriticallyAcclaimed] = useState(false);
  const [nicheExperimental, setNicheExperimental] = useState(false);
  const [budgetFit, setBudgetFit] = useState(false);
  const [availableGenres, setAvailableGenres] = useState(ALL_GENRES);

  // Load genres from TMDB API
  useEffect(() => {
    getGenres().then(genres => {
      if (genres && genres.length > 0) {
        setAvailableGenres(genres);
      }
    }).catch(() => {
      // Fallback to hardcoded genres if API fails
      setAvailableGenres(ALL_GENRES);
    });
  }, []);

  // Initialize from props if provided
  useEffect(() => {
    if (initialFilters) {
      setContentType(initialFilters.contentType);
      setRuntimeRange(initialFilters.maxRuntime);
      setRatingMin(initialFilters.minRating);
      setSelectedGenres(initialFilters.genres);
      setCriticallyAcclaimed(initialFilters.criticallyAcclaimed);
      setNicheExperimental(initialFilters.nicheExperimental);
      setBudgetFit(initialFilters.budgetFit);
    }
  }, [initialFilters]);

  const handleGenreToggle = (genreId: number) => {
    setSelectedGenres(prev => 
      prev.includes(genreId) 
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const handleReset = () => {
    setContentType('movie');
    setRuntimeRange(240); // Max value = no filter
    setRatingMin(0); // 0 = no filter
    setSelectedGenres([]);
    setCriticallyAcclaimed(false);
    setNicheExperimental(false);
    setBudgetFit(false);
    // Clear filters in parent
    onClearFilters?.();
  };

  const handleApply = () => {
    // Check if any meaningful filter has been set
    const hasFilters = 
      runtimeRange < 240 || // Runtime filter is set
      ratingMin > 0 || // Rating filter is set
      selectedGenres.length > 0 || // Genres are selected
      criticallyAcclaimed || // Critically acclaimed is enabled
      nicheExperimental || // Niche/experimental is enabled
      budgetFit; // Budget fit is enabled
    
    // Only apply filters if user has actually set something
    if (hasFilters) {
      const filters: FilterState = {
        contentType,
        maxRuntime: runtimeRange,
        minRating: ratingMin,
        genres: selectedGenres,
        criticallyAcclaimed,
        nicheExperimental,
        budgetFit,
      };
      onApplyFilters?.(filters);
    } else {
      // No filters set, clear them
      onClearFilters?.();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-[#0d0d0d] h-full shadow-2xl border-l border-white/5 flex flex-col animate-slide-in-right">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Discovery Filters</h2>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Refine your search parameters</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-all duration-200 active:scale-90 hover:rotate-90">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Type Section */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-4 block">Content Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setContentType('movie')}
                className={`py-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                  contentType === 'movie' 
                    ? 'bg-[var(--accent-color)] text-black scale-105' 
                    : 'bg-white/5 text-gray-500 hover:text-white'
                }`}
              >
                Movies
              </button>
              <button 
                onClick={() => setContentType('tv')}
                className={`py-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                  contentType === 'tv' 
                    ? 'bg-[var(--accent-color)] text-black scale-105' 
                    : 'bg-white/5 text-gray-500 hover:text-white'
                }`}
              >
                TV Shows
              </button>
            </div>
          </section>

          {/* Runtime Slider */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">Max Runtime</label>
              <span className="text-xs font-bold text-white">{runtimeRange === 240 ? 'No limit' : `${runtimeRange} min`}</span>
            </div>
            <input 
              type="range" 
              min="30" 
              max="240" 
              value={runtimeRange}
              onChange={(e) => setRuntimeRange(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none"
              style={{ accentColor: 'var(--accent-color)' }}
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
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">Min Rating</label>
              <span className="text-xs font-bold text-white">{ratingMin === 0 ? 'Any' : `${ratingMin}.0+`}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setRatingMin(0)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 border active:scale-95 ${
                  ratingMin === 0 ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black scale-105' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'
                }`}
              >
                Any
              </button>
              {[5, 6, 7, 8, 9].map(r => (
                <button 
                  key={r}
                  onClick={() => setRatingMin(r)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 border active:scale-95 ${
                    ratingMin === r ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black scale-105' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  {r}+
                </button>
              ))}
            </div>
          </section>

          {/* Genres (Multi-select) */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-4 block">Genres</label>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map(genre => {
                const isSelected = selectedGenres.includes(genre.id);
                return (
                  <button 
                    key={genre.id}
                    onClick={() => handleGenreToggle(genre.id)}
                    className={`px-4 py-2 rounded-xl border text-[10px] font-bold active:scale-95 transition-all duration-200 ${
                      isSelected
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black scale-105'
                        : 'border-white/5 bg-white/5 text-gray-500 hover:border-[var(--accent-color)]/50 hover:text-white'
                    }`}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Better Constraints */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-4 block">Discovery Logic</label>
            <div className="space-y-2">
              <label className="flex items-center justify-between glass p-4 rounded-xl border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold">Critically Acclaimed</p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">Focus on award winners and high critic scores</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-4 h-4" 
                  style={{ accentColor: 'var(--accent-color)' }} 
                  checked={criticallyAcclaimed}
                  onChange={(e) => setCriticallyAcclaimed(e.target.checked)}
                />
              </label>
              
              <label className="flex items-center justify-between glass p-4 rounded-xl border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold">Niche & Experimental</p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">Exclude blockbusters and massive franchises</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-4 h-4" 
                  style={{ accentColor: 'var(--accent-color)' }} 
                  checked={nicheExperimental}
                  onChange={(e) => setNicheExperimental(e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between glass p-4 rounded-xl border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold">Budget Fit</p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">Only titles fitting group's remaining monthly hours</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-4 h-4" 
                  style={{ accentColor: 'var(--accent-color)' }} 
                  checked={budgetFit}
                  onChange={(e) => setBudgetFit(e.target.checked)}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="p-8 border-t border-white/5 bg-[#0d0d0d] flex gap-3">
          <button 
            onClick={handleApply}
            className="flex-1 bg-[var(--accent-color)] text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all no-glow"
          >
            Apply Engine
          </button>
          <button 
            onClick={handleReset}
            className="px-6 border border-white/10 rounded-2xl text-xs font-bold text-gray-500 hover:text-white active:scale-95 transition-all duration-200"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterDrawer;
