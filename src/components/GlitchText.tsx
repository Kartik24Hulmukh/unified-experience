import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface GlitchTextProps {
  children: string;
  className?: string;
  /** Accent color for the first ghost layer (tailwind text-color class, e.g. "text-cyan-400/30") */
  accentColorClass?: string;
}

/**
 * GlitchText — Cyberpunk hover‑glitch text with mouseenter skew.
 * Shared across module pages with per‑page accent color.
 */
const GlitchText = ({
  children,
  className = '',
  accentColorClass = 'text-cyan-400/30',
}: GlitchTextProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ctx = gsap.context(() => {}, el);

    const handleEnter = () => {
      ctx.add(() => {
        gsap.to(el, {
          skewX: 2,
          duration: 0.1,
          yoyo: true,
          repeat: 3,
          ease: 'power4.inOut',
          onComplete: () => {
            gsap.set(el, { skewX: 0 });
          },
        });
      });
    };

    el.addEventListener('mouseenter', handleEnter);
    return () => {
      el.removeEventListener('mouseenter', handleEnter);
      ctx.revert();
    };
  }, []);

  return (
    <div ref={ref} className={`relative group ${className}`}>
      <span className="relative z-10">{children}</span>
      <span
        className={`absolute top-0 left-0 ${accentColorClass} z-0 translate-x-[2px] translate-y-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}
        aria-hidden="true"
      >
        {children}
      </span>
      <span
        className="absolute top-0 left-0 text-red-400/20 z-0 -translate-x-[1px] -translate-y-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        aria-hidden="true"
      >
        {children}
      </span>
    </div>
  );
};

export default GlitchText;
