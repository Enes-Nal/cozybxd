'use client'


import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@/lib/types';
import EditProfileModal from './EditProfileModal';
import AdvancedSettingsModal from './AdvancedSettingsModal';
import { useAnimations } from './AnimationProvider';

const SettingsView: React.FC = () => {
  const { data: session } = useSession();
  const { experimentalAnimations, setExperimentalAnimations } = useAnimations();
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  
  // Navbar experimental feature
  const [useNavbar, setUseNavbar] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('useNavbar');
      return saved === 'true';
    }
    return false;
  });

  const toggleNavbar = () => {
    const newVal = !useNavbar;
    setUseNavbar(newVal);
    localStorage.setItem('useNavbar', newVal ? 'true' : 'false');
    // Reload page to apply navbar change
    window.location.reload();
  };
  
  // Fetch current user data
  const { data: currentUserData, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
    enabled: !!session,
  });

  const currentUser: User | null = currentUserData || null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Default to dark mode - check localStorage first, then fallback to checking body class
  const [isLightMode, setIsLightMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') return true;
    if (savedTheme === 'dark') return false;
    // If no saved theme, default to dark mode (false = not light mode)
    return false;
  });
  const [currentAccent, setCurrentAccent] = useState(() => localStorage.getItem('accent') || '#FF47C8');
  const [cornerRadius, setCornerRadius] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cornerRadius');
      return saved || '25px';
    }
    return '25px';
  });
  const [fontFamily, setFontFamily] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fontFamily');
      return saved || 'Inter';
    }
    return 'Inter';
  });

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
    // Dispatch custom event for Logo component to react immediately
    window.dispatchEvent(new Event('accentColorChanged'));
  };

  const changeCornerRadius = (radius: string) => {
    setCornerRadius(radius);
    document.documentElement.style.setProperty('--corner-radius', radius);
    localStorage.setItem('cornerRadius', radius);
  };

  const changeFontFamily = (font: string) => {
    setFontFamily(font);
    let fontFamilyValue = '';
    switch (font) {
      case 'Inter':
        fontFamilyValue = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        break;
      case 'Roboto':
        fontFamilyValue = "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        break;
      case 'Poppins':
        fontFamilyValue = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        break;
      default:
        fontFamilyValue = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    }
    document.documentElement.style.setProperty('--font-family', fontFamilyValue);
    localStorage.setItem('fontFamily', font);
  };

  const accents = [
    { name: 'Pink', color: '#FF47C8' },
    { name: 'Rose', color: '#ff6b6b' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Emerald', color: '#10b981' },
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Violet', color: '#8b5cf6' }
  ];

  // Apply accent color, corner radius, and font family on mount if not already set
  useEffect(() => {
    const savedAccent = localStorage.getItem('accent');
    if (!savedAccent) {
      document.documentElement.style.setProperty('--accent-color', '#FF47C8');
    } else {
      document.documentElement.style.setProperty('--accent-color', savedAccent);
    }
    
    const savedCornerRadius = localStorage.getItem('cornerRadius') || '25px';
    document.documentElement.style.setProperty('--corner-radius', savedCornerRadius);
    
    const savedFontFamily = localStorage.getItem('fontFamily') || 'Inter';
    let fontFamilyValue = '';
    switch (savedFontFamily) {
      case 'Inter':
        fontFamilyValue = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        break;
      case 'Roboto':
        fontFamilyValue = "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        break;
      case 'Poppins':
        fontFamilyValue = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        break;
      default:
        fontFamilyValue = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    }
    document.documentElement.style.setProperty('--font-family', fontFamilyValue);
  }, []);

  return (
    <div className="py-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      <h2 className="text-3xl font-black uppercase tracking-tight mb-10 text-main">Settings</h2>
      
      <div className="space-y-10">
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">Profile</h3>
          <div className="glass p-8 rounded-[2.5rem] border-main flex items-center gap-6">
            <div className="relative">
              <img 
                src={currentUser?.avatar || session?.user?.image || "https://picsum.photos/seed/user/200/200"} 
                className="w-20 h-20 rounded-[1.5rem] border-2 border-[var(--accent-color)]/30" 
                alt="Avatar" 
              />
            </div>
            <div className="flex-1">
              <p className="font-black text-xl text-main">
                {userLoading ? 'Loading...' : (currentUser?.name || session?.user?.name || 'User')}
              </p>
              <p className="text-sm text-gray-500 font-medium">
                {session?.user?.email || 'No email'}
              </p>
            </div>
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="glass px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-125 text-main border-main transition-all"
            >
              Edit
            </button>
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
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">Advanced</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between glass p-6 rounded-2xl border-main">
              <div>
                <p className="text-sm font-bold text-main">Experimental Animations</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">Enable premium motion design and physics-based transitions.</p>
              </div>
              <div 
                onClick={() => {
                  if (!experimentalAnimations) {
                    setIsAdvancedSettingsOpen(true);
                  } else {
                    setExperimentalAnimations(false);
                  }
                }}
                className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${experimentalAnimations ? 'bg-[var(--accent-color)]' : 'bg-gray-400/20'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${experimentalAnimations ? 'right-1' : 'left-1'}`}></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between glass p-6 rounded-2xl border-main">
              <div>
                <p className="text-sm font-bold text-main">Navbar Layout</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">Use horizontal navbar instead of sidebar (experimental).</p>
              </div>
              <div 
                onClick={toggleNavbar}
                className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${useNavbar ? 'bg-[var(--accent-color)]' : 'bg-gray-400/20'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useNavbar ? 'right-1' : 'left-1'}`}></div>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl border-main">
              <p className="text-sm font-bold text-main mb-4">Corner Radius</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mb-4">Adjust the roundness of UI elements (experimental).</p>
              <div className="flex gap-3">
                {['0px', '25px', '50px'].map(radius => (
                  <button
                    key={radius}
                    onClick={() => changeCornerRadius(radius)}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all border-2 ${
                      cornerRadius === radius
                        ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                        : 'bg-transparent text-main border-main hover:bg-main/5'
                    }`}
                    style={{ borderRadius: radius }}
                  >
                    {radius}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass p-6 rounded-2xl border-main">
              <p className="text-sm font-bold text-main mb-4">Font Family</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mb-4">Change the default font used throughout the website (experimental).</p>
              <div className="flex gap-3 flex-wrap">
                {['Inter', 'Roboto', 'Poppins'].map(font => (
                  <button
                    key={font}
                    onClick={() => changeFontFamily(font)}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all border-2 ${
                      fontFamily === font
                        ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                        : 'bg-transparent text-main border-main hover:bg-main/5'
                    }`}
                    style={{ fontFamily: font === 'Inter' ? "'Inter', sans-serif" : font === 'Roboto' ? "'Roboto', sans-serif" : "'Poppins', sans-serif" }}
                  >
                    {font}
                  </button>
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

      {isEditModalOpen && (
        <EditProfileModal
          onClose={() => setIsEditModalOpen(false)}
          currentUser={currentUser}
          currentEmail={session?.user?.email || undefined}
          currentUsername={currentUserData?.username || null}
        />
      )}

      <AdvancedSettingsModal
        isOpen={isAdvancedSettingsOpen}
        onClose={() => setIsAdvancedSettingsOpen(false)}
        onConfirm={() => setExperimentalAnimations(true)}
      />
    </div>
  );
};

export default SettingsView;
