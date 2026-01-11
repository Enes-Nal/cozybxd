
import React from 'react';

const InboxView: React.FC = () => {
  const notifications = [
    { id: 1, type: 'invite', from: 'Elena R.', content: 'invited you to join "Midnight Thrillers"', time: '2h ago', action: 'Join' },
    { id: 2, type: 'vote', from: 'Family Night', content: 'New vote poll: What should we watch on Friday?', time: '5h ago', action: 'Vote' },
    { id: 3, type: 'alert', from: 'System', content: 'Your watchlist item "Dune" is now on Max.', time: '1d ago', action: 'View' },
  ];

  return (
    <div className="py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-black uppercase tracking-tight mb-10 text-main">Inbox</h2>
      
      <div className="space-y-4">
        {notifications.map((n) => (
          <div key={n.id} className="glass p-8 rounded-[2rem] border-white/5 flex items-center justify-between group hover:bg-black/[0.02] transition-all">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-black/[0.03] flex items-center justify-center text-accent border border-main">
                <i className={`fa-solid ${n.type === 'invite' ? 'fa-user-group' : n.type === 'vote' ? 'fa-check-to-slot' : 'fa-bell'} text-lg`}></i>
              </div>
              <div>
                <p className="text-sm font-bold">
                  <span className="text-accent font-black">{n.from}</span> 
                  <span className="text-main ml-1">{n.content}</span>
                </p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5">{n.time}</p>
              </div>
            </div>
            <button className="bg-accent hover:brightness-110 text-white px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all no-glow shadow-lg shadow-accent/10">
              {n.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InboxView;
