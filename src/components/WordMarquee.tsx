import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface WordMarqueeProps {
  /** Array of words/phrases to scroll */
  words: string[];
  /** Scroll animation duration in seconds */
  duration?: number;
  /** Tailwind background-color class for the diamond accent (e.g. "bg-amber-400/20") */
  accentBgClass?: string;
}

/**
 * WordMarquee — Infinite horizontal scrolling text strip.
 * Shared across module pages with configurable words, accent, and speed.
 */
const WordMarquee = ({
  words,
  duration = 25,
  accentBgClass = 'bg-white/20',
}: WordMarqueeProps) => {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackRef.current) return;
    const ctx = gsap.context(() => {
      // Triple the track and animate to -33.33% for truly seamless looping
      gsap.to(trackRef.current!, {
        xPercent: -33.333,
        ease: 'none',
        duration,
        repeat: -1,
      });
    }, trackRef);
    return () => ctx.revert();
  }, [duration]);

  // Triple content for seamless loop
  const tripled = [...words, ...words, ...words];

  return (
    <div className="w-full overflow-hidden border-y border-white/5 py-6 bg-black/30" aria-hidden="true">
      <div
        ref={trackRef}
        className="flex whitespace-nowrap gap-8"
        style={{ width: 'max-content' }}
      >
        {tripled.map((word, i) => (
          <span
            key={i}
            className="text-white/[0.04] font-display text-5xl md:text-7xl font-extrabold uppercase tracking-tight flex items-center gap-8"
          >
            {word}
            <span className={`w-2 h-2 ${accentBgClass} rotate-45`} />
          </span>
        ))}
      </div>
    </div>
  );
};

export default WordMarquee;
