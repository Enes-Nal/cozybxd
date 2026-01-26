'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AnimationContextType {
  experimentalAnimations: boolean;
  setExperimentalAnimations: (enabled: boolean) => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export const useAnimations = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimations must be used within an AnimationProvider');
  }
  return context;
};

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [experimentalAnimations, setExperimentalAnimationsState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('experimentalAnimations');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (experimentalAnimations) {
        document.documentElement.classList.add('experimental-animations');
      } else {
        document.documentElement.classList.remove('experimental-animations');
      }
    }
  }, [experimentalAnimations]);

  const setExperimentalAnimations = (enabled: boolean) => {
    setExperimentalAnimationsState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('experimentalAnimations', enabled ? 'true' : 'false');
      if (enabled) {
        document.documentElement.classList.add('experimental-animations');
      } else {
        document.documentElement.classList.remove('experimental-animations');
      }
    }
  };

  return (
    <AnimationContext.Provider value={{ experimentalAnimations, setExperimentalAnimations }}>
      {children}
    </AnimationContext.Provider>
  );
};

