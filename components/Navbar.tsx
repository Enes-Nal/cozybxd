'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from '@/lib/types';
import Logo from './Logo';

interface NavbarProps {
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
  onClose: () => void;
}> = ({ id, name, color, pictureUrl, onSelect, onClose }) => {
  const [imageError, setImageError] = React.useState(false);
  const hasPicture = pictureUrl && !imageError;

  return (
    <button
      onClick={() => {
        onSelect(id);
        onClose();
      }}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-gray-400 hover:text-main hover:bg-black/[0.05] active:scale-[0.98] group"
    >
      {hasPicture ? (
        <div className="relative shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
          <img 
            src={pictureUrl} 
            alt={name}
            className="w-5 h-5 rounded-md border border-main object-cover transition-all duration-200"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className={`w-1.5 h-1.5 rounded-full ${color} transition-transform duration-200 group-hover:scale-125 shrink-0`}></div>
      )}
      <span className="text-xs font-semibold truncate text-main transition-colors duration-200 group-hover:text-accent">{name}</span>
    </button>
  );
};

const Navbar: React.FC<NavbarProps> = ({ 
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
  const [isGroupsMenuOpen, setIsGroupsMenuOpen] = useState(false);
  const [isFriendsMenuOpen, setIsFriendsMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const groupsMenuRef = useRef<HTMLDivElement>(null);
  const friendsMenuRef = useRef<HTMLDivElement>(null);
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (groupsMenuRef.current && !groupsMenuRef.current.contains(event.target as Node)) {
        setIsGroupsMenuOpen(false);
      }
      if (friendsMenuRef.current && !friendsMenuRef.current.contains(event.target as Node)) {
        setIsFriendsMenuOpen(false);
      }
    };

    if (isUserMenuOpen || isGroupsMenuOpen || isFriendsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, isGroupsMenuOpen, isFriendsMenuOpen]);
  
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

  // Fetch incoming friend requests for inbox notification
  const { data: incomingRequests = [] } = useQuery({
    queryKey: ['friendRequests', 'incoming'],
    queryFn: async () => {
      const res = await fetch('/api/friends/requests?type=incoming');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
    refetchInterval: 30000,
  });

  const friends: User[] = friendsData;

  // Calculate unread count
  const unreadCount = incomingRequests.filter((req: any) => 
    req.status === 'pending' && !req.read_at
  ).length;

  const navItems = [
    { id: 'Home', icon: 'fa-house' },
    { id: 'Inbox', icon: 'fa-envelope', badge: unreadCount > 0 },
    { id: 'My Stuff', icon: 'fa-box' }
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
    <nav className="w-full h-16 flex items-center justify-between bg-sidebar no-glow border-b border-main px-6 shrink-0 relative z-50">
      {/* Left Section: Logo and Main Nav */}
      <div className="flex items-center gap-6">
        <div 
          onClick={() => setActiveTab('Home')}
          className="cursor-pointer group/logo transition-all duration-300 group-hover/logo:scale-105"
        >
          <Logo size="sm" />
        </div>

        <div className="flex items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ease-out ${
                activeTab === item.id 
                  ? 'bg-accent/10 text-accent font-bold' 
                  : 'text-gray-400 hover:text-main hover:bg-black/[0.05] active:scale-[0.98]'
              }`}
            >
              <div className="relative transition-transform duration-300">
                <i className={`fa-solid ${item.icon} text-sm transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : ''}`}></i>
                {item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-sidebar shadow-lg shadow-red-500/50 animate-pulse"></span>
                )}
              </div>
              <span className="text-xs font-semibold transition-all duration-300">{item.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right Section: Groups, Friends, User */}
      <div className="flex items-center gap-4">
        {/* Groups Dropdown */}
        <div className="relative" ref={groupsMenuRef}>
          <button
            onClick={() => {
              setIsGroupsMenuOpen(!isGroupsMenuOpen);
              setIsFriendsMenuOpen(false);
              setIsUserMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
              isGroupsMenuOpen
                ? 'bg-accent/10 text-accent'
                : 'text-gray-400 hover:text-main hover:bg-black/[0.05]'
            } active:scale-[0.98]`}
          >
            <i className="fa-solid fa-users text-sm"></i>
            <span className="text-xs font-semibold">Groups</span>
            {workspaces.length > 0 && (
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                {workspaces.length}
              </span>
            )}
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isGroupsMenuOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isGroupsMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 glass rounded-xl border border-main overflow-hidden shadow-lg z-50 animate-slide-down max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-main">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Groups</p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateGroupClick();
                        setIsGroupsMenuOpen(false);
                      }}
                      className="text-accent hover:opacity-80 p-1 transition-all duration-200 active:scale-90 hover:scale-110" 
                      title="Create Group"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoinGroupClick();
                        setIsGroupsMenuOpen(false);
                      }}
                      className="text-accent hover:opacity-80 p-1 transition-all duration-200 active:scale-90 hover:scale-110" 
                      title="Join Group"
                    >
                      <i className="fa-solid fa-key text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-2">
                {workspaces.length > 0 ? (
                  workspaces.map((ws: { id: string; name: string; color: string; pictureUrl?: string | null }) => (
                    <GroupItem
                      key={ws.id}
                      id={ws.id}
                      name={ws.name}
                      color={ws.color}
                      pictureUrl={ws.pictureUrl}
                      onSelect={onGroupSelect}
                      onClose={() => setIsGroupsMenuOpen(false)}
                    />
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-500 text-center">
                    No groups yet. Create or join one to get started!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Friends Dropdown */}
        <div className="relative" ref={friendsMenuRef}>
          <button
            onClick={() => {
              setIsFriendsMenuOpen(!isFriendsMenuOpen);
              setIsGroupsMenuOpen(false);
              setIsUserMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
              isFriendsMenuOpen
                ? 'bg-accent/10 text-accent'
                : 'text-gray-400 hover:text-main hover:bg-black/[0.05]'
            } active:scale-[0.98]`}
          >
            <i className="fa-solid fa-user-group text-sm"></i>
            <span className="text-xs font-semibold">Friends</span>
            {friends.length > 0 && (
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                {friends.length}
              </span>
            )}
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isFriendsMenuOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isFriendsMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 glass rounded-xl border border-main overflow-hidden shadow-lg z-50 animate-slide-down max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-main">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Friends</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddFriendClick();
                      setIsFriendsMenuOpen(false);
                    }}
                    className="text-accent hover:opacity-80 p-1 transition-all duration-200 active:scale-90 hover:scale-110"
                  >
                    <i className="fa-solid fa-user-plus text-xs"></i>
                  </button>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {friends.length > 0 ? (
                  friends.map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => {
                        onFriendSelect(friend);
                        setIsFriendsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/[0.05] transition-all duration-200 group cursor-pointer active:scale-[0.98]"
                    >
                      <div className="relative transition-transform duration-200 group-hover:scale-110">
                        <img src={friend.avatar} className="w-7 h-7 rounded-full border border-main transition-all duration-200" alt={friend.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-main transition-colors duration-200 group-hover:text-accent">{friend.name}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-500 text-center">
                    No friends yet. Add some to get started!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        {session && (
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen);
                setIsGroupsMenuOpen(false);
                setIsFriendsMenuOpen(false);
              }}
              className="flex items-center gap-2 glass rounded-lg px-3 py-2 border-main hover:bg-black/[0.05] transition-all duration-200 active:scale-[0.98]"
            >
              <div className="relative shrink-0">
                <img 
                  src={session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || 'User')}`} 
                  className="w-7 h-7 min-w-[28px] rounded-md border border-main object-cover" 
                  alt="User" 
                />
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] text-gray-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}></i>
            </button>
            
            {/* User Menu Popup */}
            {isUserMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 glass rounded-lg border border-main overflow-hidden shadow-lg z-50 animate-slide-down">
                <button
                  onClick={() => {
                    setActiveTab('Settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.05] transition-all duration-200 text-xs font-semibold text-main active:scale-[0.98]"
                >
                  <i className="fa-solid fa-gear text-xs w-4 text-gray-400"></i>
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => {
                    onProfileClick();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.05] transition-all duration-200 text-xs font-semibold text-main active:scale-[0.98]"
                >
                  <i className="fa-solid fa-user text-xs w-4 text-gray-400"></i>
                  <span>Your Profile</span>
                </button>
                <div className="border-t border-main"></div>
                <button
                  onClick={() => {
                    signOut({ callbackUrl: '/' });
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 text-xs font-semibold text-main active:scale-[0.98]"
                >
                  <i className="fa-solid fa-right-from-bracket text-xs w-4 text-gray-400"></i>
                  <span>Log-out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

