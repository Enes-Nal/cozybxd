'use client';

import React, { useEffect, useState } from 'react';
import { useAnimations } from './AnimationProvider';

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string | number;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, transitionKey }) => {
  const { experimentalAnimations } = useAnimations();
  const [isExiting, setIsExiting] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [displayKey, setDisplayKey] = useState(transitionKey);

  useEffect(() => {
    if (transitionKey !== displayKey) {
      if (experimentalAnimations) {
        setIsExiting(true);
        setTimeout(() => {
          setDisplayChildren(children);
          setDisplayKey(transitionKey);
          setIsExiting(false);
        }, 350);
      } else {
        setDisplayChildren(children);
        setDisplayKey(transitionKey);
      }
    } else {
      setDisplayChildren(children);
    }
  }, [transitionKey, children, displayKey, experimentalAnimations]);

  if (!experimentalAnimations) {
    return <>{children}</>;
  }

  return (
    <div
      className={isExiting ? 'page-transition-out' : 'page-transition-in'}
      style={{ animation: isExiting ? undefined : 'none' }}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;

