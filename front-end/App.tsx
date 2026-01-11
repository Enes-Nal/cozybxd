
import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MovieGrid from './components/MovieGrid';
import InboxView from './components/InboxView';
import WatchlistView from './components/WatchlistView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import GroupView from './components/GroupView';
import ProfileView from './components/ProfileView';
import TitleDetailView from './components/TitleDetailView';
import CustomSortModal from './components/CustomSortModal';
import AIRecommendationModal from './components/AIRecommendationModal';
import SchedulingModal from './components/SchedulingModal';
import RandomPickerModal from './components/RandomPickerModal';
import FilterDrawer from './components/FilterDrawer';
import AddFriendModal from './components/AddFriendModal';
import { MOCK_MOVIES, MOCK_GROUP, MOCK_USERS } from './constants';
import { Movie, User } from './types';

const App: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>(MOCK_MOVIES);
  const [activeTab, setActiveTab] = useState('Home');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<User | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [schedulingMovie, setSchedulingMovie] = useState<Movie | null>(null);
  const [sortBy, setSortBy] = useState<string>('Trending');
  const [searchQuery, setSearchQuery] = useState('');

  const currentUser: User = MOCK_USERS[0];

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
    }
    const savedAccent = localStorage.getItem('accent');
    if (savedAccent) {
      document.documentElement.style.setProperty('--accent-color', savedAccent);
    }
    const savedGlass = localStorage.getItem('glass');
    if (savedGlass === 'off') {
      document.documentElement.style.setProperty('--glass-blur', '0px');
    }
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveGroup(null);
    setActiveProfile(null);
    setSelectedMovie(null);
  };

  const handleGroupSelect = (groupId: string) => {
    setActiveGroup(groupId);
    setActiveTab('Group');
    setActiveProfile(null);
    setSelectedMovie(null);
  };

  const handleProfileSelect = (user: User) => {
    setActiveProfile(user);
    setActiveTab('Profile');
    setActiveGroup(null);
    setSelectedMovie(null);
  };

  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
    setActiveTab('Detail');
    setActiveGroup(null);
    setActiveProfile(null);
  };

  const filteredAndSortedMovies = useMemo(() => {
    let result = [...movies, ...movies, ...movies];
    if (searchQuery) {
      result = result.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'Top Rated': return b.votes - a.votes;
        case 'New Releases': return b.year - a.year;
        case 'Trending':
        default: return 0;
      }
    });
  }, [movies, sortBy, searchQuery]);

  const renderContent = () => {
    const key = selectedMovie?.id || activeProfile?.id || activeGroup || activeTab;
    
    let content;
    if (selectedMovie) content = <TitleDetailView movie={selectedMovie} onBack={() => setSelectedMovie(null)} />;
    else if (activeProfile) content = <ProfileView user={activeProfile} movies={movies} />;
    else if (activeGroup) content = <GroupView group={MOCK_GROUP} movies={movies} />;
    else {
      switch (activeTab) {
        case 'Inbox': content = <InboxView />; break;
        case 'Watchlists': content = <WatchlistView movies={movies} />; break;
        case 'History': content = <HistoryView movies={movies} />; break;
        case 'Settings': content = <SettingsView />; break;
        default:
          content = (
            <div className="mt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-2xl relative group mr-12">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[var(--accent-color)] transition-colors"></i>
                    <input 
                      type="text" 
                      placeholder="Search titles, actors, or moods..." 
                      className="w-full bg-[#111] border border-[#222] rounded-xl py-2.5 pl-12 pr-4 outline-none focus:border-[var(--accent-color)]/50 transition-all text-xs font-medium text-main"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsFilterDrawerOpen(true)}
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all text-main"
                    >
                      <i className="fa-solid fa-sliders text-[var(--accent-color)]"></i>
                      Filters
                    </button>
                    <button 
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all text-main"
                    >
                      <i className="fa-solid fa-bookmark text-[var(--accent-color)]"></i>
                      Presets
                    </button>
                    <button 
                      onClick={() => setIsCustomSortOpen(true)}
                      className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] active:scale-95 transition-all text-main"
                    >
                      <i className="fa-solid fa-arrow-down-wide-short text-[var(--accent-color)]"></i>
                      Sort
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['Trending', 'Top Rated', 'New Releases'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`whitespace-nowrap px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                        sortBy === opt 
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black' 
                          : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-20">
                <MovieGrid 
                  movies={filteredAndSortedMovies} 
                  onVote={(id) => setMovies(prev => prev.map(m => m.id === id ? {...m, votes: m.votes+1} : m))}
                  onSchedule={(id) => setSchedulingMovie(movies.find(m => m.id === id) || null)} 
                  onSelect={handleMovieSelect}
                  users={MOCK_USERS} 
                />
              </div>
            </div>
          );
      }
    }

    return (
      <div key={key} className="page-transition flex-1 flex flex-col min-h-0">
        {content}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-main text-main overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        onGroupSelect={handleGroupSelect} 
        onFriendSelect={handleProfileSelect}
        onProfileClick={() => handleProfileSelect(currentUser)}
        onAddFriendClick={() => setIsAddFriendOpen(true)}
      />

      <main className="flex-1 flex flex-col px-8 pt-6 transition-all duration-300 overflow-hidden">
        <Header 
          groupName={activeGroup ? MOCK_GROUP.name : (selectedMovie ? selectedMovie.title : "cozybxd")} 
          isHome={activeTab === 'Home' && !activeGroup && !activeProfile && !selectedMovie}
          onNotificationClick={() => handleTabChange('Inbox')}
          onProfileClick={() => handleProfileSelect(currentUser)}
        />
        {renderContent()}
      </main>

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} />
      {isAddFriendOpen && <AddFriendModal onClose={() => setIsAddFriendOpen(false)} />}
      {isCustomSortOpen && <CustomSortModal onClose={() => setIsCustomSortOpen(false)} />}
      {isAIModalOpen && <AIRecommendationModal onClose={() => setIsAIModalOpen(false)} onAdd={(m) => setMovies([m, ...movies])} groupContext={{ members: MOCK_USERS, history: movies }} />}
      {isRandomModalOpen && <RandomPickerModal movies={movies} onClose={() => setIsRandomModalOpen(false)} onSelect={(m) => { setSchedulingMovie(m); setSelectedMovie(null); }} />}
      {schedulingMovie && <SchedulingModal movie={schedulingMovie} onClose={() => setSchedulingMovie(null)} onConfirm={() => setSchedulingMovie(null)} />}
    </div>
  );
};

export default App;
