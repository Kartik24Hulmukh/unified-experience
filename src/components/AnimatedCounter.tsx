import { useState, useEffect, useRef } from 'react';

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
 */
const AnimatedCounter = ({ target, duration = 2000, suffix = '' }: AnimatedCounterProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (!ref.current) return;
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
            setCount(Math.floor(eased * target));

            if (progress < 1) {
              rafId.current = requestAnimationFrame(animate);
            } else {
              setCount(target);
            }
          };

          rafId.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(ref.current);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId.current);
      observer.disconnect();
    };
  }, [target, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
};

export default AnimatedCounter;
