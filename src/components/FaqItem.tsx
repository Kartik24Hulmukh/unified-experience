import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ChevronDown } from 'lucide-react';

interface FaqItemProps {
  q: string;
  a: string;
  index: number;
  /** Tailwind text-color class for the index number (e.g. "text-amber-400/40") */
  accentTextClass?: string;
  /** Tailwind hover text-color class for the title (e.g. "group-hover:text-amber-400/90") */
  accentHoverClass?: string;
  /** Tailwind bg/border classes for the open‑state chevron button (e.g. "bg-amber-400/10 border-amber-400/30") */
  accentButtonClass?: string;
}

/**
 * FaqItem — Accordion FAQ row with GSAP slide animation.
 * Shared across module pages with configurable accent color.
 */
const FaqItem = ({
  q,
  a,
  index,
  accentTextClass = 'text-white/40',
  accentHoverClass = 'group-hover:text-white/90',
  accentButtonClass = 'bg-white/10 border-white/30',
}: FaqItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const gsapCtxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    gsapCtxRef.current = gsap.context(() => {});
    return () => {
      gsapCtxRef.current?.revert();
    };
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    gsapCtxRef.current?.add(() => {
      if (isOpen) {
        // Use maxHeight instead of height:'auto' to avoid layout read/write thrash
        const scrollH = contentRef.current!.scrollHeight;
        gsap.to(contentRef.current!, {
          maxHeight: scrollH,
          opacity: 1,
          duration: 0.4,
          ease: 'power3.out',
        });
      } else {
        gsap.to(contentRef.current!, {
          maxHeight: 0,
          opacity: 0,
          duration: 0.4,
          ease: 'power3.out',
        });
      }
    });
  }, [isOpen]);

  return (
    <div className="border-b border-white/5 group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-6 md:py-8 text-left hover:bg-white/[0.01] transition-colors px-2"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4 md:gap-6">
          <span className={`text-[10px] font-mono ${accentTextClass} tracking-widest`}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className={`text-white font-display text-base md:text-xl font-bold uppercase transition-colors ${accentHoverClass}`}>
            {q}
          </h3>
        </div>
        <div
          className={`w-8 h-8 border border-white/10 flex items-center justify-center transition-all duration-300 ${
            isOpen ? `${accentButtonClass} rotate-180` : ''
          }`}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </div>
      </button>
      <div ref={contentRef} className="overflow-hidden" style={{ maxHeight: 0, opacity: 0 }}>
        <p className="text-white/40 text-sm font-body leading-relaxed pb-6 md:pb-8 pl-10 md:pl-16 pr-12 max-w-2xl">
          {a}
        </p>
      </div>
    </div>
  );
};

export default FaqItem;
