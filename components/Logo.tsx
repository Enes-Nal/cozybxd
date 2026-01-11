'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

// Map accent colors to logo file names
const accentToLogo: Record<string, string> = {
  '#FF47C8': 'cozybxd pink.png',  // Pink
  '#ff6b6b': 'cozybxd red.png',   // Rose
  '#6366f1': 'cozybxd blue.png',  // Indigo
  '#10b981': 'cozybxd green.png', // Emerald
  '#f59e0b': 'cozybxd yellow.png', // Amber
  '#8b5cf6': 'cozybxd purple.png' // Violet
};

const getLogoFromAccent = (accentColor: string): string => {
  return accentToLogo[accentColor] || 'cozybxd pink.png'; // Default to pink
};

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = false }) => {
  const [logoSource, setLogoSource] = useState<string>('/cozybxd pink.png');

  useEffect(() => {
    // Get initial accent color
    const getAccentColor = () => {
      if (typeof window === 'undefined') return '#FF47C8';
      const savedAccent = localStorage.getItem('accent');
      if (savedAccent) return savedAccent;
      // Fallback to CSS variable if available
      const cssAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
      return cssAccent || '#FF47C8';
    };

    const updateLogo = () => {
      const accentColor = getAccentColor();
      const logoFile = getLogoFromAccent(accentColor);
      setLogoSource(`/${logoFile}`);
    };

    // Set initial logo
    updateLogo();

    // Listen for storage changes (when accent color changes in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accent') {
        updateLogo();
      }
    };

    // Listen for custom accent change events (same tab)
    const handleAccentChange = () => {
      updateLogo();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('accentColorChanged', handleAccentChange);

    // Watch for CSS variable changes using MutationObserver
    const observer = new MutationObserver(() => {
      updateLogo();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('accentColorChanged', handleAccentChange);
      observer.disconnect();
    };
  }, []);

  const sizeClasses = {
    sm: { width: 120, height: 40 },
    md: { width: 180, height: 60 },
    lg: { width: 240, height: 80 }
  };

  const dimensions = sizeClasses[size];

  return (
    <div className={`${className} relative`} style={{ width: dimensions.width, height: dimensions.height }}>
      <Image
        src={logoSource}
        alt="cozybxd logo"
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full object-contain transition-opacity duration-300"
        priority
      />
    </div>
  );
};

export default Logo;
