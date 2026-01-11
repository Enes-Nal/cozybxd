
import React, { useState } from 'react';

const SettingsView: React.FC = () => {
  const [isLightMode, setIsLightMode] = useState(() => document.body.classList.contains('light-mode'));
  const [currentAccent, setCurrentAccent] = useState(() => localStorage.getItem('accent') || '#ff6b6b');

  const toggleLightMode = () => {
    const newVal = !isLightMode;
    setIsLightMode(newVal);
    document.body.classList.toggle('light-mode', newVal);
    localStorage.setItem('theme', newVal ? 'light' : 'dark');
  };

  const changeAccent = (color: string) => {
    setCurrentAccent(color);
    document.documentElement.style.setProperty('--accent-color', color);
    localStorage.setItem('accent', color);
  };

  const accents = [
    { name: 'Rose', color: '#ff6b6b' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Emerald', color: '#10b981' },
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Violet', color: '#8b5cf6' }
  ];

  return (
    <div className="py-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      <h2 className="text-3xl font-black uppercase tracking-tight mb-10 text-main">Settings</h2>
      
      <div className="space-y-10">
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">Profile</h3>
          <div className="glass p-8 rounded-[2.5rem] border-main flex items-center gap-6">
            <div className="relative">
              <img src="https://picsum.photos/seed/user/200/200" className="w-20 h-20 rounded-[1.5rem] border-2 border-[var(--accent-color)]/30" alt="Avatar" />
            </div>
            <div className="flex-1">
              <p className="font-black text-xl text-main">Marcus Aurelius</p>
              <p className="text-sm text-gray-500 font-medium">marcus.cine@gmail.com</p>
            </div>
            <button className="glass px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-125 text-main border-main">Edit</button>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">Preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between glass p-6 rounded-2xl border-main">
              <div>
                <p className="text-sm font-bold text-main">Light Mode</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">High-contrast white theme for daytime.</p>
              </div>
              <div 
                onClick={toggleLightMode}
                className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${isLightMode ? 'bg-[var(--accent-color)]' : 'bg-gray-400/20'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isLightMode ? 'right-1' : 'left-1'}`}></div>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl border-main">
              <p className="text-sm font-bold text-main mb-4">Accent Color</p>
              <div className="flex gap-4">
                {accents.map(acc => (
                  <button 
                    key={acc.name}
                    onClick={() => changeAccent(acc.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${currentAccent === acc.color ? 'border-main scale-125' : 'border-transparent'}`}
                    style={{ backgroundColor: acc.color }}
                    title={acc.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">Danger Zone</h3>
          <button className="w-full text-left p-6 rounded-2xl border border-[var(--accent-color)]/20 text-[var(--accent-color)] text-sm font-black uppercase tracking-widest hover:bg-[var(--accent-color)]/5 transition-all">
            Delete cozybxd account
          </button>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;
