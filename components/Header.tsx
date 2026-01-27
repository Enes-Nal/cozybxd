'use client';

import React from 'react';

interface HeaderProps {
  groupName: string;
  isHome?: boolean;
  onNotificationClick: () => void;
  onProfileClick: () => void;
  onMovieSelect?: (movie: any) => void;
}

const Header: React.FC<HeaderProps> = ({ groupName, isHome, onNotificationClick, onProfileClick, onMovieSelect }) => {
  return (
    <header className="flex items-center justify-between no-glow relative pb-4">
      <div className="flex-1">
        {/* Title area or context info */}
      </div>

      <div className="flex items-center gap-6">
        {/* Search bar removed - now available in Navbar */}
      </div>
    </header>
  );
};

export default Header;
