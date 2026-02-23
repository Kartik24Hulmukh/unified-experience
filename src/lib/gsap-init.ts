/**
 * GSAP + Lenis Initialization — Centralized Smooth Scroll + Plugin Registration
 * 
 * This file should be imported ONCE at the app root (main.tsx).
 * Do not call gsap.registerPlugin in individual components.
 * 
 * Lenis provides buttery-smooth scroll normalization (converts discrete
 * wheel events into interpolated continuous values), while GSAP ScrollTrigger
 * drives all scroll-linked animations. Together they produce the cappen.com
 * level of smoothness.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register GSAP plugins globally - only happens once
gsap.registerPlugin(ScrollTrigger);

// Configure ScrollTrigger defaults for better performance
ScrollTrigger.config({
  // Reduce frequency of scroll checks for performance
  limitCallbacks: true,
  // Ignore resize on mobile (prevents layout thrash)
  ignoreMobileResize: true,
});

/* ─── Lenis smooth scroll ─── */
let lenisInstance: Lenis | null = null;

if (typeof window !== 'undefined') {
  // Skip Lenis smooth scroll when user prefers reduced motion
  const prefersRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersRM) {
    lenisInstance = new Lenis({
      // Core smoothness controls
      lerp: 0.08,            // Lower = smoother/slower interpolation (silk-like)
      duration: 1.4,         // Scroll duration in seconds
      smoothWheel: true,     // Smooth mouse wheel
      wheelMultiplier: 0.9,  // Slightly reduce wheel sensitivity for elegance
      touchMultiplier: 1.5,  // Keep touch responsive on mobile

      // Prevent smooth scroll on inputs (accessibility)
      syncTouch: false,
    });

    // Connect Lenis to GSAP's ticker so ScrollTrigger gets smooth values
    lenisInstance.on('scroll', ScrollTrigger.update);

    // Drive Lenis from GSAP's RAF loop (single RAF = no duplicate frames)
    gsap.ticker.add((time) => {
      lenisInstance?.raf(time * 1000); // GSAP time is in seconds, Lenis expects ms
    });

    // Use relaxed lag smoothing instead of disabling it entirely
    gsap.ticker.lagSmoothing(500, 33);
  }
}

// Debounced resize handler for ScrollTrigger refresh
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
const RESIZE_DEBOUNCE_MS = 200;

function handleResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Refresh ScrollTrigger calculations after resize settles
    ScrollTrigger.refresh();
  }, RESIZE_DEBOUNCE_MS);
}

// Add resize listener for ScrollTrigger refresh
if (typeof window !== 'undefined') {
  window.addEventListener('resize', handleResize, { passive: true });
}

// Export for type safety if needed
export { gsap, ScrollTrigger, lenisInstance };

// Export reduced motion check for legacy consumers.
// Prefer the `useReducedMotion()` hook in components for reactive updates.
export const prefersReducedMotion = typeof window !== 'undefined' 
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mark as initialized (only in dev)
if (import.meta.env.DEV) {
  console.debug('[GSAP] Plugins registered + Lenis smooth scroll active');
}
