/**
 * useScrollTriggerCleanup
 *
 * Kills all ScrollTrigger instances when navigating AWAY from
 * pages that use scroll-driven GSAP animations. This prevents
 * animation stacking and memory leaks across route changes.
 *
 * Safe behavior:
 * - Only kills ScrollTriggers when leaving an animated page
 * - Does NOT kill on every render or on arrival at a new page
 * - Uses useLocation to detect route changes
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Routes that create ScrollTrigger instances */
const ANIMATED_ROUTES = [
  '/home',
  '/resale',
  '/accommodation',
  '/essentials',
  '/academics',
  '/mess',
  '/hospital',
];

export function useScrollTriggerCleanup() {
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);

  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;

    // Only kill when LEAVING an animated page
    if (prev !== pathname && ANIMATED_ROUTES.includes(prev)) {
      // Defer kill to next frame so GSAP context cleanup runs first.
      // gsap.context().revert() in page components handles its own triggers;
      // this catches any orphaned ones the page didn't clean up.
      requestAnimationFrame(() => {
        ScrollTrigger.getAll().forEach((t) => {
          // Only kill orphaned triggers whose trigger element is no longer
          // in the DOM. This prevents accidentally killing triggers that
          // belong to the newly-mounted page.
          const triggerEl = t.vars?.trigger as Element | undefined;
          if (triggerEl && !document.contains(triggerEl)) {
            t.kill();
          }
        });
        ScrollTrigger.refresh();
      });
    }
  }, [pathname]);
}
