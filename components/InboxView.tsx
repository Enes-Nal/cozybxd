'use client';

import React from 'react';

const InboxView: React.FC = () => {
  const notifications: any[] = [];

  return (
    <div className="py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-black uppercase tracking-tight mb-10 text-main">Inbox</h2>
      
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-black/[0.03] flex items-center justify-center text-gray-400 border border-main mb-6">
            <i className="fa-solid fa-inbox text-3xl"></i>
          </div>
          <h3 className="text-xl font-black text-main mb-2">No notifications</h3>
          <p className="text-sm text-gray-500 text-center max-w-md">
            Your inbox is empty. You'll see team invitations, vote polls, and watchlist updates here.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default InboxView;
