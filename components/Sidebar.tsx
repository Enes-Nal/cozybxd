'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from '@/lib/types';
import Logo from './Logo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onGroupSelect: (id: string) => void;
  onFriendSelect: (user: User) => void;
  onProfileClick: () => void;
  onAddFriendClick: () => void;
  onCreateGroupClick: () => void;
  onJoinGroupClick: () => void;
}

// Group item component with image error handling
const GroupItem: React.FC<{
  id: string;
  name: string;
  color: string;
  pictureUrl?: string | null;
  onSelect: (id: string) => void;
}> = ({ id, name, color, pictureUrl, onSelect }) => {
  const [imageError, setImageError] = React.useState(false);
  const hasPicture = pictureUrl && !imageError;

  return (
    <button
      onClick={() => onSelect(id)}
      className="w-full flex items-center gap-4 px-5 py-3 rounded-xl transition-all duration-200 text-gray-400 hover:text-main hover:bg-black/[0.05] active:scale-[0.98] group"
    >
      {hasPicture ? (
        <div className="relative shrink-0 transition-transform duration-200 group-hover:scale-110">
          <img 
            src={pictureUrl} 
            alt={name}
            className="w-6 h-6 rounded-lg border border-main object-cover transition-all duration-200"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className={`w-1.5 h-1.5 rounded-full ${color} transition-transform duration-200 group-hover:scale-125 shrink-0`}></div>
      )}
      <span className="text-sm font-semibold truncate text-main transition-colors duration-200 group-hover:text-accent">{name}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onGroupSelect, 
  onFriendSelect,
  onProfileClick,
  onAddFriendClick,
  onCreateGroupClick,
  onJoinGroupClick
}) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);
  
  // Fetch friends
  const { data: friendsData = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await fetch('/api/friends');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  // Fetch teams
  const { data: teamsData = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await fetch('/api/teams');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  const friends: User[] = friendsData;


  const navItems = [
    { id: 'Home', icon: 'fa-house' },
    { id: 'Inbox', icon: 'fa-envelope', badge: false },
    { id: 'Watchlists', icon: 'fa-list-check' },
    { id: 'History', icon: 'fa-clock-rotate-left' }
  ];

  // Map teams to workspaces format
  const workspaces = teamsData.map((team: any, index: number) => {
    const colors = ['bg-orange-500', 'bg-indigo-500', 'bg-red-900', 'bg-blue-500', 'bg-green-500'];
    return {
      id: team.id,
      name: team.name,
      color: colors[index % colors.length],
      pictureUrl: team.picture_url || team.pictureUrl || null,
    };
  });


  return (
    <aside className="w-72 flex flex-col bg-sidebar no-glow border-r border-main h-screen transition-all duration-300 relative shrink-0 overflow-hidden">
      {/* Brand Section */}
      <div 
        onClick={() => setActiveTab('Home')}
        className="flex items-center justify-center cursor-pointer group/logo px-6 pt-6 pb-4 shrink-0"
      >
        <div className="transition-all duration-300 group-hover/logo:scale-105">
          <Logo size="sm" />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-3 pb-32 scrollbar-hide">
        <div className="space-y-8">
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 relative px-5 py-3 rounded-xl transition-all duration-300 ease-out ${
                  activeTab === item.id 
                    ? 'bg-accent/10 text-accent font-bold scale-[1.02]' 
                    : 'text-gray-400 hover:text-main hover:bg-black/[0.05] hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                <div className="relative transition-transform duration-300">
                  <i className={`fa-solid ${item.icon} text-sm w-5 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : ''}`}></i>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ff4444] rounded-full border-2 border-sidebar animate-pulse"></span>
                  )}
                </div>
                <span className="text-sm font-semibold transition-all duration-300">{item.id}</span>
              </button>
            ))}
          </nav>

          <section className="space-y-1">
            <div className="flex items-center justify-between px-5 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Friends</p>
              <button onClick={onAddFriendClick} className="text-accent hover:opacity-80 p-1 transition-all duration-200 active:scale-90 hover:scale-110"><i className="fa-solid fa-user-plus text-xs"></i></button>
            </div>
            <div className="space-y-2">
              {friends.map(friend => (
                <div 
                  key={friend.id} 
                  onClick={() => onFriendSelect(friend)}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-black/[0.05] transition-all duration-200 group cursor-pointer relative active:scale-[0.98]"
                >
                  <div className="relative transition-transform duration-200 group-hover:scale-110">
                    <img src={friend.avatar} className="w-8 h-8 rounded-full border border-main transition-all duration-200" alt={friend.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-main transition-colors duration-200 group-hover:text-accent">{friend.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-5 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Groups</p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onCreateGroupClick} 
                  className="text-accent hover:opacity-80 p-1 transition-all duration-200 active:scale-90 hover:scale-110" 
                  title="Create Group"
                >
                  <i className="fa-solid fa-plus text-xs"></i>
                </button>
                <button 
                  onClick={onJoinGroupClick} 
                  className="text-accent hover:opacity-80 p-1 transition-all duration-200 active:scale-90 hover:scale-110" 
                  title="Join Group"
                >
                  <i className="fa-solid fa-key text-xs"></i>
                </button>
              </div>
            </div>
            {workspaces.length > 0 ? (
              workspaces.map((ws: { id: string; name: string; color: string; pictureUrl?: string | null }) => (
                <GroupItem
                  key={ws.id}
                  id={ws.id}
                  name={ws.name}
                  color={ws.color}
                  pictureUrl={ws.pictureUrl}
                  onSelect={onGroupSelect}
                />
              ))
            ) : (
              <div className="px-5 py-3 text-xs text-gray-500 text-center transition-opacity duration-200">
                No groups yet. Create or join one to get started!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Profile */}
      {session && (
        <div className="mt-auto p-2 border-t border-main bg-sidebar relative" ref={userMenuRef}>
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full glass rounded-lg p-2.5 border-main hover:bg-black/[0.05] transition-all duration-200 text-left flex items-center gap-3 overflow-hidden min-w-[200px] active:scale-[0.98]"
          >
            <div className="relative shrink-0">
               <img 
                 src={session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || 'User')}`} 
                 className="w-9 h-9 min-w-[36px] rounded-md border border-main object-cover" 
                 alt="User" 
               />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black truncate text-main leading-none">{session.user?.name || 'User'}</p>
            </div>
            <i className={`fa-solid fa-chevron-up text-xs text-gray-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}></i>
          </button>
          
          {/* User Menu Popup */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 glass rounded-lg border border-main overflow-hidden shadow-lg z-50 animate-slide-down">
              <button
                onClick={() => {
                  setActiveTab('Settings');
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.05] transition-all duration-200 text-sm font-semibold text-main active:scale-[0.98]"
              >
                <i className="fa-solid fa-gear text-xs w-5 text-gray-400"></i>
                <span>Settings</span>
              </button>
              <button
                onClick={() => {
                  onProfileClick();
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.05] transition-all duration-200 text-sm font-semibold text-main active:scale-[0.98]"
              >
                <i className="fa-solid fa-user text-xs w-5 text-gray-400"></i>
                <span>Your Profile</span>
              </button>
              <div className="border-t border-main"></div>
              <button
                onClick={() => {
                  signOut({ callbackUrl: '/' });
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 text-sm font-semibold text-main active:scale-[0.98]"
              >
                <i className="fa-solid fa-right-from-bracket text-xs w-5 text-gray-400"></i>
                <span>Log-out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
