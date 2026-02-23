/**
 * useReducedMotion - Detects user's reduced motion preference
 * 
 * Returns true if user prefers reduced motion (vestibular disorders, etc.)
 * Used to disable GSAP animations, WebGL effects, and provide static fallbacks.
 * 
 * PRD Section 8: "Must work without animation", "Reduced-motion fallback"
 */

import { useState, useEffect } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Hook to detect user's reduced motion preference
 * @returns true if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check on initial render (SSR-safe)
    if (typeof window === 'undefined') return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes (user can toggle in system settings)
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Legacy browsers (Safari < 14)
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Static check for reduced motion (for non-React contexts)
 * @returns true if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export default useReducedMotion;
