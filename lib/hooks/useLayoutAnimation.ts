'use client';

import { useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createLayout, type AutoLayout } from 'animejs';

interface UseLayoutAnimationOptions {
  duration?: number;
  // anime.js allows delay to be a number or a function; its internal typing uses a broad "Target".
  // We keep this flexible and cast when passing into anime to avoid overly strict TS incompatibilities.
  delay?: number | ((target: any, i: number) => number);
  ease?: string;
  enabled?: boolean;
}

/**
 * React hook for animating layout changes using anime.js Layout API
 * 
 * This hook automatically animates layout changes when the dependency array changes.
 * It records the layout state before React updates the DOM, then animates after.
 * 
 * @param rootRef - React ref to the root element
 * @param options - Animation options
 * @param deps - Dependency array - animation triggers when these change
 * 
 * @example
 * const gridRef = useRef<HTMLDivElement>(null);
 * useLayoutAnimation(gridRef, { duration: 600 }, [movies.length]);
 */
export function useLayoutAnimation<T extends HTMLElement>(
  rootRef: React.RefObject<T | null>,
  options: UseLayoutAnimationOptions = {},
  deps: React.DependencyList = []
) {
  const layoutRef = useRef<AutoLayout | null>(null);
  const prevDepsRef = useRef<React.DependencyList>(deps);
  const {
    duration = 600,
    delay = 0,
    ease = 'easeOutExpo',
    enabled = true,
  } = options;

  // Initialize layout instance
  useEffect(() => {
    if (!enabled || !rootRef.current) return;

    try {
      layoutRef.current = createLayout(rootRef.current, {
        duration,
        delay: delay as any,
        ease,
      });
    } catch (error) {
      console.warn('Failed to create layout animation:', error);
    }

    return () => {
      if (layoutRef.current) {
        try {
          layoutRef.current.revert?.();
        } catch (error) {
          // Ignore cleanup errors
        }
        layoutRef.current = null;
      }
    };
  }, [enabled, duration, delay, ease]);

  // Handle layout animation when deps change
  useLayoutEffect(() => {
    if (!enabled || !layoutRef.current || !rootRef.current) {
      prevDepsRef.current = deps;
      return;
    }

    // Check if deps actually changed
    const depsChanged = deps.some((dep, i) => dep !== prevDepsRef.current[i]);
    
    if (depsChanged) {
      // Record current layout state
      try {
        layoutRef.current.record();
      } catch (error) {
        // Ignore recording errors
      }
    }

    // Update prev deps
    prevDepsRef.current = deps;
  });

  // Animate after React updates the DOM
  useEffect(() => {
    if (!enabled || !layoutRef.current || !rootRef.current) return;

    // Check if deps actually changed (compare with current prevDepsRef)
    const depsChanged = deps.some((dep, i) => {
      const prevDeps = prevDepsRef.current;
      return prevDeps.length !== deps.length || dep !== prevDeps[i];
    });

    if (!depsChanged) return;

    // Wait for DOM to update, then animate
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          layoutRef.current?.animate({
            duration,
            delay: delay as any,
            ease,
          });
        } catch (error) {
          console.warn('Layout animation failed:', error);
        }
      });
    });

    return () => {
      cancelAnimationFrame(timer);
    };
  }, deps);

  // Manual update method for programmatic control
  const updateLayout = useCallback((callback: () => void) => {
    if (!enabled || !layoutRef.current) {
      callback();
      return;
    }

    try {
      layoutRef.current.update(callback, {
        duration,
        delay: delay as any,
        ease,
      });
    } catch (error) {
      console.warn('Layout animation failed, executing callback without animation:', error);
      callback();
    }
  }, [enabled, duration, delay, ease]);

  return { updateLayout };
}

