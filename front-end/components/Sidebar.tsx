
import React from 'react';
import { User } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onGroupSelect: (id: string) => void;
  onFriendSelect: (user: User) => void;
  onProfileClick: () => void;
  onAddFriendClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onGroupSelect, 
  onFriendSelect, 
  onProfileClick,
  onAddFriendClick
}) => {
  const friends: (User & { statusText: string })[] = [
    { id: 'u2', name: 'Sarah J.', avatar: 'https://picsum.photos/seed/sarah/100/100', status: 'Online', role: 'Editor', statusText: 'Watching Dune' },
    { id: 'u1', name: 'Marcus L.', avatar: 'https://picsum.photos/seed/marcus/100/100', status: 'Online', role: 'Admin', statusText: 'Browsing' },
    { id: 'u4', name: 'Elena R.', avatar: 'https://picsum.photos/seed/elena/100/100', status: 'Offline', role: 'Viewer', statusText: 'Away' },
  ];

  const navItems = [
    { id: 'Home', icon: 'fa-house' },
    { id: 'Inbox', icon: 'fa-envelope', badge: true },
    { id: 'Watchlists', icon: 'fa-list-check' },
    { id: 'History', icon: 'fa-clock-rotate-left' },
    { id: 'Settings', icon: 'fa-gear' }
  ];

  const workspaces = [
    { id: 'w1', name: 'Family Night', color: 'bg-orange-500' },
    { id: 'w2', name: 'Cinephiles', color: 'bg-indigo-500' },
    { id: 'w3', name: 'Horror Club', color: 'bg-red-900' }
  ];

  const getStatusColor = (status: string, statusText?: string) => {
    if (status === 'Offline') return 'bg-[#ff4444]';
    const text = statusText?.toLowerCase() || '';
    if (text.includes('away') || text.includes('idle')) return 'bg-[#ffcc00]';
    return 'bg-[#00c851]';
  };

  return (
    <aside className="w-72 flex flex-col bg-sidebar no-glow border-r border-main h-screen transition-all duration-300 relative shrink-0 overflow-hidden">
      {/* Brand Section */}
      <div 
        onClick={() => setActiveTab('Home')}
        className="flex items-center gap-3 cursor-pointer group/logo px-6 pt-10 pb-12 shrink-0"
      >
        <div className="w-12 h-12 min-w-[48px] overflow-hidden rounded-xl bg-black/20 flex items-center justify-center transition-all duration-300 group-hover/logo:scale-105">
          <img src="https://raw.githubusercontent.com/username/repo/main/logo.png" className="w-full h-full object-contain" alt="cozybxd" onError={(e) => {
            e.currentTarget.parentElement!.innerHTML = '<i class="fa-solid fa-clapperboard text-white"></i>';
          }} />
        </div>
        <span className="text-2xl font-black tracking-tighter whitespace-nowrap text-main italic">cozybxd</span>
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
      <div className="mt-auto p-2 border-t border-main bg-sidebar">
        <button 
          onClick={onProfileClick}
          className="w-full glass rounded-lg p-2.5 border-main hover:bg-black/[0.05] transition-all text-left flex items-center gap-3 overflow-hidden min-w-[200px]"
        >
          <div className="relative shrink-0">
             <img src="https://picsum.photos/seed/user/50/50" className="w-9 h-9 min-w-[36px] rounded-md border border-main object-cover" alt="User" />
             <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent border-2 border-sidebar rounded-full shadow-sm"></span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black truncate text-main leading-none mb-1">Marcus Aurelius</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black text-accent uppercase tracking-tighter">ONLINE</span>
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
