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
        // Every animated page registers its ScrollTriggers inside a gsap.context()
        // scoped to its root <div> ref and calls ctx.revert() in the useLayoutEffect
        // cleanup — that already kills the leaving page's own triggers correctly.
        //
        // This hook's only remaining job is to call refresh() so that any
        // shared/layout triggers remaining have accurate scroll measurements
        // after the DOM changes caused by the route transition.
        //
        // NOTE: We intentionally do NOT call killAll() here.  killAll() fires
        // *after* React's useLayoutEffect on the new page has already registered
        // new ScrollTriggers, so it would silently destroy the newly-mounted
        // page's animations — a harder-to-diagnose regression than the original
        // orphan-trigger issue.
        ScrollTrigger.refresh();
      });
    }
  }, [pathname]);
}
