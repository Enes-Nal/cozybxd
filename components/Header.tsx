'use client';

import React, { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  groupName: string;
  isHome?: boolean;
  onNotificationClick: () => void;
  onProfileClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ groupName, isHome, onNotificationClick, onProfileClick }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between no-glow relative pb-4">
      <div className="flex-1">
        {/* Title area or context info */}
      </div>

      <div className="flex items-center gap-6">
        {!isHome && (
          <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl border-main no-glow">
            <i className="fa-solid fa-magnifying-glass text-gray-500 text-xs"></i>
            <input 
              type="text" 
              placeholder="Search titles..." 
              className="bg-transparent border-none outline-none text-xs w-56 placeholder:text-gray-600 font-medium text-main"
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
