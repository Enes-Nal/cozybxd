'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@/lib/types';
import Logo from './Logo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onGroupSelect: (id: string) => void;
  onFriendSelect: (user: User) => void;
  onProfileClick: () => void;
  onAddFriendClick: () => void;
}

type VisibilityStatus = 'Online' | 'Idle' | 'Do Not Disturb' | 'Invisible';

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onGroupSelect, 
  onFriendSelect, 
  onProfileClick,
  onAddFriendClick
}) => {
  const { data: session } = useSession();
  const [showVisibilityPopup, setShowVisibilityPopup] = useState(false);
  const [userStatus, setUserStatus] = useState<VisibilityStatus>('Online');
  const popupRef = useRef<HTMLDivElement>(null);
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const gearButtonRef = useRef<HTMLButtonElement>(null);
  
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

  const friends: (User & { statusText: string })[] = friendsData.map((friend: User) => ({
    ...friend,
    statusText: friend.status === 'Online' ? 'Online' : friend.status === 'Ready' ? 'Ready' : 'Offline',
  }));

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

  const getStatusColor = (status: string, statusText?: string) => {
    if (status === 'Offline') return 'bg-[#ff4444]';
    const text = statusText?.toLowerCase() || '';
    if (text.includes('away') || text.includes('idle')) return 'bg-[#ffcc00]';
    return 'bg-[#00c851]';
  };

  const getVisibilityStatusColor = (status: VisibilityStatus) => {
    switch (status) {
      case 'Online':
        return 'bg-[#00c851]';
      case 'Idle':
        return 'bg-[#ffcc00]';
      case 'Do Not Disturb':
        return 'bg-[#ff4444]';
      case 'Invisible':
        return 'bg-gray-500';
      default:
        return 'bg-[#00c851]';
    }
  };

  const getVisibilityStatusText = (status: VisibilityStatus) => {
    switch (status) {
      case 'Online':
        return 'ONLINE';
      case 'Idle':
        return 'IDLE';
      case 'Do Not Disturb':
        return 'DND';
      case 'Invisible':
        return 'INVISIBLE';
      default:
        return 'ONLINE';
    }
  };

  const visibilityOptions: { status: VisibilityStatus; icon: string; description: string }[] = [
    { status: 'Online', icon: 'fa-circle', description: 'Active and available' },
    { status: 'Idle', icon: 'fa-moon', description: 'Away from keyboard' },
    { status: 'Do Not Disturb', icon: 'fa-circle-minus', description: 'Mute notifications' },
    { status: 'Invisible', icon: 'fa-eye-slash', description: 'Appear offline' },
  ];

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        statusButtonRef.current &&
        !statusButtonRef.current.contains(event.target as Node) &&
        gearButtonRef.current &&
        !gearButtonRef.current.contains(event.target as Node)
      ) {
        setShowVisibilityPopup(false);
      }
    };

    if (showVisibilityPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showVisibilityPopup]);

  const handleStatusChange = (status: VisibilityStatus) => {
    setUserStatus(status);
    setShowVisibilityPopup(false);
    // TODO: Update user status via API
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
                className={`w-full flex items-center gap-4 relative px-5 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-accent/10 text-accent font-bold' 
                    : 'text-gray-400 hover:text-main hover:bg-black/[0.03]'
                }`}
              >
                <div className="relative">
                  <i className={`fa-solid ${item.icon} text-sm w-5`}></i>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ff4444] rounded-full border-2 border-sidebar"></span>
                  )}
                </div>
                <span className="text-sm font-semibold">{item.id}</span>
              </button>
            ))}
          </nav>

          <section className="space-y-1">
            <div className="flex items-center justify-between px-5 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Friends</p>
              <button onClick={onAddFriendClick} className="text-accent hover:opacity-80 p-1"><i className="fa-solid fa-user-plus text-xs"></i></button>
            </div>
            <div className="space-y-2">
              {friends.map(friend => (
                <div 
                  key={friend.id} 
                  onClick={() => onFriendSelect(friend)}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-black/[0.03] transition-all group cursor-pointer"
                >
                  <div className="relative">
                    <img src={friend.avatar} className="w-8 h-8 rounded-full border border-main" alt={friend.name} />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(friend.status, friend.statusText)} rounded-full border-[1.5px] border-white shadow-sm`}></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-main">{friend.name}</p>
                    <p className="text-[9px] text-gray-400 font-medium truncate">{friend.statusText}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black px-5 mb-4">Groups</p>
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => onGroupSelect(ws.id)}
                className="w-full flex items-center gap-4 px-5 py-3 rounded-xl transition-all text-gray-400 hover:text-main hover:bg-black/[0.03]"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${ws.color}`}></div>
                <span className="text-sm font-semibold truncate text-main">{ws.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Profile */}
      {session && (
        <div className="mt-auto p-2 border-t border-main bg-sidebar relative">
          <div className="relative">
            <button 
              onClick={onProfileClick}
              className="w-full glass rounded-lg p-2.5 border-main hover:bg-black/[0.05] transition-all text-left flex items-center gap-3 overflow-hidden min-w-[200px] group"
            >
              <div className="relative shrink-0">
                 <img 
                   src={session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || 'User')}`} 
                   className="w-9 h-9 min-w-[36px] rounded-md border border-main object-cover" 
                   alt="User" 
                 />
                 <button
                   ref={statusButtonRef}
                   onClick={(e) => {
                     e.stopPropagation();
                     setShowVisibilityPopup(!showVisibilityPopup);
                   }}
                   className={`absolute -top-1 -right-1 w-3.5 h-3.5 ${getVisibilityStatusColor(userStatus)} border-2 border-sidebar rounded-full shadow-sm hover:scale-110 transition-transform cursor-pointer group`}
                   title="Set Status"
                 >
                   {userStatus === 'Do Not Disturb' && (
                     <i className="fa-solid fa-minus text-[6px] text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                   )}
                   {userStatus === 'Invisible' && (
                     <i className="fa-solid fa-eye-slash text-[6px] text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                   )}
                 </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black truncate text-main leading-none mb-1">{session.user?.name || 'User'}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-accent uppercase tracking-tighter">{getVisibilityStatusText(userStatus)}</span>
                  <button
                    ref={gearButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVisibilityPopup(!showVisibilityPopup);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity p-0.5 hover:bg-black/[0.1] rounded"
                    title="Set Status"
                  >
                    <i className="fa-solid fa-gear text-[7px] text-gray-400 hover:text-accent transition-colors"></i>
                  </button>
                </div>
              </div>
            </button>

            {/* Visibility Popup */}
            {showVisibilityPopup && (
              <div
                ref={popupRef}
                className="absolute bottom-full left-0 mb-2 w-[240px] glass border border-main rounded-xl overflow-hidden z-[200] animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-2xl bg-[#111]"
              >
                <div className="p-2">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Set Status</p>
                  </div>
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.status}
                      onClick={() => handleStatusChange(option.status)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left ${
                        userStatus === option.status ? 'bg-white/[0.08]' : ''
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`w-4 h-4 ${getVisibilityStatusColor(option.status)} rounded-full flex items-center justify-center`}>
                          {option.status === 'Do Not Disturb' && (
                            <i className="fa-solid fa-minus text-[6px] text-white"></i>
                          )}
                          {option.status === 'Invisible' && (
                            <i className="fa-solid fa-eye-slash text-[6px] text-white"></i>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${userStatus === option.status ? 'text-accent' : 'text-main'}`}>
                          {option.status}
                        </p>
                        <p className="text-[9px] text-gray-400 font-medium">{option.description}</p>
                      </div>
                      {userStatus === option.status && (
                        <i className="fa-solid fa-check text-accent text-xs"></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
