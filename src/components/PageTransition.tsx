import { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { unlockNavigation, lockNavigation } from '@/lib/utils';
import { lenisInstance } from '@/lib/gsap-init';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition — Cappen-style vertical curtain wipe.
 *
 * 1. A dark curtain slides DOWN from the top (scaleY 0→1, origin top).
 * 2. Old content fades out simultaneously.
 * 3. At full coverage: swap route content.
 * 4. Curtain slides UP and out (scaleY 1→0, origin bottom).
 * 5. New content fades in as curtain lifts.
 *
 * The result is a luxurious, directional transition that feels
 * like turning a page — much smoother than a radial wipe.
 */
const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const isFirstRender = useRef(true);
  const displayLocationRef = useRef(location.pathname);

  // Store pending data in refs to avoid re-render mid-animation killing the timeline
  const pendingChildrenRef = useRef<React.ReactNode>(null);
  const pendingLocationRef = useRef<string | null>(null);

  // Safety: On mount, ensure curtain and container have correct initial state
  useEffect(() => {
    if (curtainRef.current) {
      curtainRef.current.style.transform = 'scaleY(0)';
      curtainRef.current.style.transformOrigin = 'top';
    }
    if (containerRef.current) {
      containerRef.current.style.opacity = '1';
      containerRef.current.style.transform = 'none';
    }
  }, []);

  // Swap content mid-animation — uses refs so GSAP closure is never stale
  const swapContent = useCallback(() => {
    if (pendingChildrenRef.current) {
      setDisplayChildren(pendingChildrenRef.current);
      displayLocationRef.current = pendingLocationRef.current || location.pathname;
      pendingChildrenRef.current = null;
      pendingLocationRef.current = null;
    }
  }, []); // stable — no deps, reads from refs

  // Use useLayoutEffect for immediate cleanup before paint
  useLayoutEffect(() => {
    if (!curtainRef.current || !containerRef.current) return;

    // Skip animation when not transitioning
    if (!isTransitioning) return;

    // Kill any existing timeline before creating new one
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    const curtain = curtainRef.current;
    const container = containerRef.current;

    // Hoist safety timer so cleanup can clear it
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const ctx = gsap.context(() => {
      // Pause smooth scroll during transition to prevent interference
      lenisInstance?.stop();

      const tl = gsap.timeline({
        onComplete: () => {
          if (safetyTimer) clearTimeout(safetyTimer);
          setIsTransitioning(false);
          unlockNavigation();
          // Scroll to top of new page, then resume smooth scroll
          window.scrollTo(0, 0);
          lenisInstance?.start();
        },
      });

      timelineRef.current = tl;

      // Safety fallback: if timeline doesn't complete within 3s, force recovery
      safetyTimer = setTimeout(() => {
        if (timelineRef.current === tl && tl.isActive()) {
          tl.progress(1).kill();
          setIsTransitioning(false);
          unlockNavigation();
          lenisInstance?.start();
          if (container) {
            container.style.opacity = '1';
            container.style.transform = 'none';
          }
          if (curtain) {
            curtain.style.transform = 'scaleY(0)';
          }
        }
      }, 3000);

      // ── Phase 1: Curtain slides DOWN, old content fades ──
      tl.set(curtain, { transformOrigin: 'top', scaleY: 0 })
        .to(curtain, {
          scaleY: 1,
          duration: 0.65,
          ease: 'power3.inOut',
        })
        .to(
          container,
          {
            opacity: 0,
            y: -20,
            duration: 0.4,
            ease: 'power2.in',
          },
          0 // concurrent with curtain
        )

        // ── Phase 2: Swap content at full coverage ──
        .call(swapContent)
        .set(container, { opacity: 0, y: 20 })

        // ── Phase 3: Curtain lifts UP, new content fades in ──
        .set(curtain, { transformOrigin: 'bottom' })
        .to(curtain, {
          scaleY: 0,
          duration: 0.65,
          ease: 'power3.inOut',
        })
        .to(
          container,
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power2.out',
          },
          '-=0.45' // overlap with curtain lift for silk-smooth feel
        );
    });

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      ctx.revert();
      // ISSUE-04 fix: always unlock navigation on cleanup — idempotent, safe to call twice
      unlockNavigation();
      // Safety: ensure container is always visible after cleanup
      if (container) {
        container.style.opacity = '1';
        container.style.transform = 'none';
      }
      // Safety: ensure curtain is always hidden after cleanup
      if (curtain) {
        curtain.style.transform = 'scaleY(0)';
      }
    };
  }, [isTransitioning, swapContent]);

  // Trigger transition when LOCATION changes (not children reference)
  useLayoutEffect(() => {
    // Skip transition on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      displayLocationRef.current = location.pathname;
      return;
    }

    // Only trigger transition if the route actually changed
    if (location.pathname !== displayLocationRef.current && !isTransitioning) {
      lockNavigation(2000);
      // Store pending data in refs (no state update = no re-render mid-animation)
      pendingChildrenRef.current = children;
      pendingLocationRef.current = location.pathname;
      setIsTransitioning(true);
    } else if (location.pathname === displayLocationRef.current) {
      // Same route — just update children silently (e.g. context/prop changes)
      setDisplayChildren(children);
    }
  }, [location.pathname, isTransitioning, children]);

  return (
    <>
      {/* Vertical curtain — dark overlay that slides in/out */}
      <div
        ref={curtainRef}
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{
          transform: 'scaleY(0)',
          transformOrigin: 'top',
          backgroundColor: '#0a0a0a',
          // PERF-07: no static willChange — avoids idle GPU layer promotion.
          // GSAP manages will-change internally during the animation.
        }}
      >
        {/* Subtle center label during transition */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 opacity-40">
            <div className="w-6 h-6 border border-white/30 rotate-45 flex items-center justify-center">
              <div className="w-2 h-2 bg-white/40" />
            </div>
            <span className="text-white/30 text-xs font-mono tracking-[0.4em] uppercase">
              Loading
            </span>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div
        ref={containerRef}
        style={{
          opacity: isTransitioning ? undefined : 1,
          transform: isTransitioning ? undefined : 'none',
          willChange: isTransitioning ? 'opacity, transform' : 'auto',
        }}
      >
        {displayChildren}
      </div>
    </>
  );
};

export default PageTransition;
