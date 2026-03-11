import { useEffect, useRef, memo } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface GooeyCursorProps {
  size?: number;
}

const GooeyCursor = memo(function GooeyCursor({ size = 50 }: GooeyCursorProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const blobsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Skip all cursor animation when user prefers reduced motion
    if (prefersReducedMotion) return;

    const mediaQuery = window.matchMedia('(pointer: fine)');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let alive = true;

    // We'll use 5 blobs for the liquid trail
    const numBlobs = 5;
    const followers = Array.from({ length: numBlobs }, () => ({ x: mouseX, y: mouseY, vx: 0, vy: 0 }));

    // ── Idle-aware RAF loop ────────────────────────────────────────────────
    // The loop stops itself when all blobs have settled, then restarts on the
    // next mousemove. This eliminates the baseline 60fps CPU cost of running
    // physics + SVG feGaussianBlur every frame while the mouse is stationary.
    let rafHandle: number | undefined;
    let isLoopActive = false;

    const wakeUpLoop = () => {
      if (isLoopActive || !alive) return;
      isLoopActive = true;
      rafHandle = requestAnimationFrame(animate);
    };

    const animate = () => {
      if (!alive) {
        isLoopActive = false;
        return;
      }

      let anyMoving = false;

      followers.forEach((f, i) => {
        if (i === 0) {
          // Snappy lead blob
          const dx = mouseX - f.x;
          const dy = mouseY - f.y;
          if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) anyMoving = true;
          f.x += dx * 0.4;
          f.y += dy * 0.4;
        } else {
          // Physics-based trailing blobs for liquid string effect
          const target = followers[i - 1];
          const dx = target.x - f.x;
          const dy = target.y - f.y;

          f.vx += dx * 0.18;
          f.vy += dy * 0.18;
          f.vx *= 0.65; // Friction
          f.vy *= 0.65;

          f.x += f.vx;
          f.y += f.vy;

          if (Math.abs(f.vx) > 0.05 || Math.abs(f.vy) > 0.05) anyMoving = true;
        }

        const el = blobsRef.current[i];
        if (el) {
          // The scale drops off to make the tail thinner
          const scale = 1 - (i * 0.15);
          el.style.transform = `translate(${f.x - size / 2}px, ${f.y - size / 2}px) scale(${scale})`;
        }
      });

      // Continue loop only while blobs are still in motion; pause when settled.
      // mousemove will call wakeUpLoop() to restart.
      if (anyMoving) {
        rafHandle = requestAnimationFrame(animate);
      } else {
        isLoopActive = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      wakeUpLoop(); // Re-engage loop if it paused due to idle
      if (containerRef.current) containerRef.current.style.opacity = '1';
    };

    const handleMouseLeave = () => {
      if (containerRef.current) containerRef.current.style.opacity = '0';
    };

    // Guard prevents starting a second RAF loop if mediaQuery fires while already attached
    let attached = false;

    const attach = () => {
      if (attached) return;
      attached = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
      wakeUpLoop(); // Start with initial cursor position
    };

    const detach = () => {
      attached = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };

    // Named reference so the listener can be removed in cleanup (CRIT-02 fix)
    const handleMediaChange = (e: MediaQueryListEvent) => (e.matches ? attach() : detach());

    if (mediaQuery.matches) attach();
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      alive = false;
      detach();
      if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [size, prefersReducedMotion]);

  // Render nothing when reduced motion is preferred — no cursor decoration needed
  if (prefersReducedMotion) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 pointer-events-none z-[9999] opacity-0 transition-opacity duration-300"
        style={{
          filter: 'url(#gooey-cursor-filter)',
          mixBlendMode: 'difference',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            ref={el => blobsRef.current[i] = el}
            className="absolute rounded-full bg-white"
            style={{
              width: size,
              height: size,
              // PERF: will-change managed by GSAP internally during animation.
              // Static will-change-transform promoted 5 permanent compositor layers.
            }}
          />
        ))}
      </div>

      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="gooey-cursor-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
    </>
  );
});

export default GooeyCursor;
