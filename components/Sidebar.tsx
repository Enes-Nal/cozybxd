'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

type UserStatus = 'Online' | 'Idle' | 'Do Not Disturb' | 'Invisible';

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
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  
  // Get user status from database, with localStorage fallback
  const [userStatus, setUserStatus] = useState<UserStatus>('Online');
  
  // Fetch status from database on mount
  const { data: userStatusData } = useQuery({
    queryKey: ['userStatus'],
    queryFn: async () => {
      const res = await fetch('/api/users/me/status');
      if (res.ok) {
        const data = await res.json();
        return data.status || 'Online';
      }
      // Fallback to localStorage if API fails
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('userStatus') as UserStatus;
        return saved || 'Online';
      }
      return 'Online';
    },
    enabled: !!session,
  });

  // Update status when data changes (replaces onSuccess callback)
  useEffect(() => {
    if (userStatusData) {
      setUserStatus(userStatusData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('userStatus', userStatusData);
      }
    }
  }, [userStatusData]);
  
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

  const friends: (User & { statusText: string })[] = friendsData.map((friend: User) => {
    // Determine statusText based on the friend's status
    // The status now preserves the original database values:
    // 'Online', 'Idle', 'Do Not Disturb', 'Offline'
    
    let statusText = 'Offline';
    if (friend.status === 'Online') {
      statusText = 'Online';
    } else if (friend.status === 'Idle') {
      statusText = 'Idle';
    } else if (friend.status === 'Do Not Disturb') {
      statusText = 'Do Not Disturb';
    } else if (friend.status === 'Offline') {
      statusText = 'Offline';
    } else {
      // If status is undefined or unexpected, default to Offline but log it
      console.warn('[SIDEBAR] Unexpected friend status:', friend.status, 'for friend:', friend.name);
      statusText = 'Offline';
    }
    
    return {
      ...friend,
      statusText,
    };
  });


  const navItems = [
    { id: 'Home', icon: 'fa-house' },
    { id: 'Inbox', icon: 'fa-envelope', badge: false },
    { id: 'Watchlists', icon: 'fa-list-check' },
    { id: 'History', icon: 'fa-clock-rotate-left' },
    { id: 'Settings', icon: 'fa-gear' }
  ];

  // Map teams to workspaces format
  const workspaces = teamsData.map((team: any, index: number) => {
    const colors = ['bg-orange-500', 'bg-indigo-500', 'bg-red-900', 'bg-blue-500', 'bg-green-500'];
    return {
      id: team.id,
      name: team.name,
      color: colors[index % colors.length],
    };
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: UserStatus) => {
      try {
        const res = await fetch('/api/users/me/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          // Fall back to localStorage if API fails
          throw new Error('Failed to update status');
        }
        return res.json();
      } catch (error) {
        // Still update locally even if API fails
        console.warn('Status update failed, using localStorage:', error);
        throw error;
      }
    },
    onSuccess: (data, newStatus) => {
      setUserStatus(newStatus);
      localStorage.setItem('userStatus', newStatus);
      // Invalidate friends query to refresh their status display
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      // Also refetch user status to ensure sync
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
    },
    onError: (error, newStatus) => {
      // Fallback: update locally even if API fails
      setUserStatus(newStatus);
      localStorage.setItem('userStatus', newStatus);
    },
  });

  // Close status menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };

    if (isStatusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isStatusMenuOpen]);

  const getStatusColor = (status: string, statusText?: string) => {
    if (status === 'Offline' || status === 'Invisible') return 'bg-[#747f8d]';
    if (status === 'Do Not Disturb' || statusText?.toLowerCase().includes('dnd') || statusText?.toLowerCase().includes('do not disturb')) return 'bg-[#ed4245]';
    if (status === 'Idle' || statusText?.toLowerCase().includes('away') || statusText?.toLowerCase().includes('idle')) return 'bg-[#faa61a]';
    return 'bg-[#23a55a]';
  };

  const getStatusColorHex = (status: string, statusText?: string): string => {
    if (status === 'Offline' || status === 'Invisible') return '#747f8d';
    if (status === 'Do Not Disturb' || statusText?.toLowerCase().includes('dnd') || statusText?.toLowerCase().includes('do not disturb')) return '#ed4245';
    if (status === 'Idle' || statusText?.toLowerCase().includes('away') || statusText?.toLowerCase().includes('idle')) return '#faa61a';
    return '#23a55a';
  };

  const getStatusDisplayText = (status: UserStatus) => {
    switch (status) {
      case 'Idle': return 'IDLE';
      case 'Do Not Disturb': return 'DND';
      case 'Invisible': return 'INVISIBLE';
      default: return 'ONLINE';
    }
  };

  const statusOptions: { value: UserStatus; label: string; icon: string; color: string }[] = [
    { value: 'Online', label: 'Online', icon: 'fa-circle', color: '#23a55a' },
    { value: 'Idle', label: 'Idle', icon: 'fa-moon', color: '#faa61a' },
    { value: 'Do Not Disturb', label: 'Do Not Disturb', icon: 'fa-circle-minus', color: '#ed4245' },
    { value: 'Invisible', label: 'Invisible', icon: 'fa-eye-slash', color: '#747f8d' },
  ];

  const handleStatusChange = (newStatus: UserStatus) => {
    updateStatusMutation.mutate(newStatus);
    setIsStatusMenuOpen(false);
  };

  const handleProfileButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsStatusMenuOpen(!isStatusMenuOpen);
  };

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
                    <span className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(friend.status, friend.statusText)} rounded-full border-[1.5px] border-white shadow-sm transition-all duration-200`}></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-main transition-colors duration-200 group-hover:text-accent">{friend.name}</p>
                    <p className="text-[9px] text-gray-400 font-medium truncate">{friend.statusText}</p>
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
                  <i className="fa-solid fa-user-plus text-xs"></i>
                </button>
              </div>
            </div>
            {workspaces.length > 0 ? (
              workspaces.map((ws: { id: string; name: string; color: string }) => (
                <button
                  key={ws.id}
                  onClick={() => onGroupSelect(ws.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 rounded-xl transition-all duration-200 text-gray-400 hover:text-main hover:bg-black/[0.05] active:scale-[0.98] group"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${ws.color} transition-transform duration-200 group-hover:scale-125`}></div>
                  <span className="text-sm font-semibold truncate text-main transition-colors duration-200 group-hover:text-accent">{ws.name}</span>
                </button>
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
        <div className="mt-auto p-2 border-t border-main bg-sidebar relative">
          <button 
            onClick={handleProfileButtonClick}
            className="w-full glass rounded-lg p-2.5 border-main hover:bg-black/[0.05] transition-all duration-200 text-left flex items-center gap-3 overflow-hidden min-w-[200px] active:scale-[0.98]"
          >
            <div className="relative shrink-0">
               <img 
                 src={session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || 'User')}`} 
                 className="w-9 h-9 min-w-[36px] rounded-md border border-main object-cover" 
                 alt="User" 
               />
               <span 
                 className={`absolute -top-1 -right-1 w-3 h-3 border-2 border-sidebar rounded-full shadow-sm`}
                 style={{ backgroundColor: getStatusColorHex(userStatus) }}
               ></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black truncate text-main leading-none mb-1">{session.user?.name || 'User'}</p>
              <div className="flex items-center gap-1.5">
                <span 
                  className="text-[8px] font-black uppercase tracking-tighter"
                  style={{ color: getStatusColorHex(userStatus) }}
                >
                  {getStatusDisplayText(userStatus)}
                </span>
              </div>
            </div>
            <i className="fa-solid fa-chevron-up text-[8px] text-gray-400 transition-transform duration-300 ease-out" style={{ transform: isStatusMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}></i>
          </button>

          {/* Status Dropdown Menu */}
          {isStatusMenuOpen && (
            <div 
              ref={statusMenuRef}
              className="absolute bottom-full left-2 right-2 mb-2 bg-sidebar border border-main rounded-lg shadow-xl overflow-hidden z-50 animate-scale-in"
            >
              <div className="p-1">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-left active:scale-[0.98] ${
                      userStatus === option.value
                        ? 'bg-accent/10'
                        : 'hover:bg-black/[0.05]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-sidebar"
                        style={{ backgroundColor: option.color }}
                      ></div>
                      {userStatus === option.value && (
                        <i className="fa-solid fa-check absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-sidebar"></i>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-main">{option.label}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-main p-1">
                <button
                  onClick={() => {
                    setIsStatusMenuOpen(false);
                    onProfileClick();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-black/[0.05] transition-all duration-200 text-left active:scale-[0.98]"
                >
                  <i className="fa-solid fa-user text-xs text-gray-400 w-4"></i>
                  <span className="text-xs font-semibold text-main">View Profile</span>
                </button>
              </div>
              <div className="border-t border-main p-1">
                <button
                  onClick={() => {
                    setIsStatusMenuOpen(false);
                    signOut({ callbackUrl: '/api/auth/signin' });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-red-500/10 transition-all duration-200 text-left active:scale-[0.98]"
                >
                  <i className="fa-solid fa-sign-out-alt text-xs text-red-500 w-4"></i>
                  <span className="text-xs font-semibold text-red-500">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
