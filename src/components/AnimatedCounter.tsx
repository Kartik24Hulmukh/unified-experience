import { useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  /** Target number to count up to */
  target: number;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Optional suffix appended after the number (e.g. "%" or "+") */
  suffix?: string;
}

/**
 * AnimatedCounter — Counts from 0 to `target` with cubic ease-out.
 * Uses IntersectionObserver to trigger only when visible.
 * Shared across module pages.
 *
 * PERF: Uses direct DOM writes instead of React state to avoid ~120
 * synchronous reconciliations per 2s animation which caused INP spikes.
 */
const AnimatedCounter = ({ target, duration = 2000, suffix = '' }: AnimatedCounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Set initial display
    el.textContent = `0${suffix}`;
    let alive = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();

          const animate = (now: number) => {
            if (!alive) return;
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // cubic ease-out
            const eased = 1 - Math.pow(1 - progress, 3);
            const display = progress < 1 ? Math.floor(eased * target) : target;
            // Direct DOM write — bypasses React reconciler entirely, zero re-renders
            if (ref.current) ref.current.textContent = `${display}${suffix}`;
            if (progress < 1) rafId.current = requestAnimationFrame(animate);
          };

          rafId.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId.current);
      observer.disconnect();
    };
  }, [target, duration, suffix]);

  return <span ref={ref}>0{suffix}</span>;
};

export default AnimatedCounter;
