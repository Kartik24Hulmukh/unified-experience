import { useRef, useLayoutEffect, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ScrollTrigger registered in lib/gsap-init.ts

interface SplitTextProps {
  children: string;
  className?: string;
  type?: 'chars' | 'words' | 'lines';
  animation?: 'fadeUp' | 'stagger' | 'reveal' | 'glitch';
  delay?: number;
  stagger?: number;
  trigger?: 'scroll' | 'load' | 'none';
}

const SplitText = ({
  children,
  className = '',
  type = 'chars',
  animation = 'fadeUp',
  delay = 0,
  stagger = 0.03,
  trigger = 'scroll',
}: SplitTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  // Split text into elements using React state instead of DOM manipulation
  const splitElements = useMemo(() => {
    const text = children;
    let parts: string[] = [];
    switch (type) {
      case 'chars':
        parts = text.split('');
        break;
      case 'words':
        parts = text.split(' ');
        break;
      case 'lines':
        parts = text.split('\n');
        break;
    }
    return parts;
  }, [children, type]);

  useLayoutEffect(() => {
    if (!textRef.current || !containerRef.current) return;

    const splitEls = textRef.current.querySelectorAll('.split-element');
    if (!splitEls.length) return;

    // Animation configurations
    const getAnimation = () => {
      switch (animation) {
        case 'fadeUp':
          return {
            from: { opacity: 0, y: 40, rotateX: -90 },
            to: { opacity: 1, y: 0, rotateX: 0, stagger, delay, ease: 'power3.out', duration: 0.8 },
          };
        case 'stagger':
          return {
            from: { opacity: 0, x: -20 },
            to: { opacity: 1, x: 0, stagger, delay, ease: 'power2.out', duration: 0.5 },
          };
        case 'reveal':
          return {
            from: { opacity: 0, y: '100%' },
            to: { opacity: 1, y: 0, stagger, delay, ease: 'power4.out', duration: 1 },
          };
        case 'glitch':
          return {
            from: { opacity: 0, x: () => gsap.utils.random(-20, 20), y: () => gsap.utils.random(-10, 10) },
            to: { opacity: 1, x: 0, y: 0, stagger: stagger * 0.5, delay, ease: 'power2.out', duration: 0.3 },
          };
        default:
          return {
            from: { opacity: 0 },
            to: { opacity: 1, stagger, delay, duration: 0.5 },
          };
      }
    };

    const { from, to } = getAnimation();

    // Use gsap.context for proper scoping and cleanup
    const ctx = gsap.context(() => {
      if (trigger === 'scroll') {
        gsap.fromTo(splitEls, from, {
          ...to,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
      } else if (trigger === 'load') {
        gsap.fromTo(splitEls, from, to);
      }
    }, containerRef);

    return () => {
      // Revert all GSAP animations and ScrollTriggers in this context
      ctx.revert();
      // Reset inline opacity on split elements so text is visible
      // if GSAP context reverts but component stays mounted (e.g., HMR)
      if (textRef.current) {
        const els = textRef.current.querySelectorAll('.split-element');
        els.forEach(el => {
          (el as HTMLElement).style.opacity = '1';
        });
      }
    };
  }, [children, type, animation, delay, stagger, trigger]);

  return (
    <div ref={containerRef} className={className}>
      <span ref={textRef} className="inline-block" style={{ perspective: '1000px' }}>
        {splitElements.map((el, i) => (
          <span key={`${el}-${i}`}>
            {type === 'words' && i > 0 && <span className="inline-block">&nbsp;</span>}
            <span className="split-element inline-block" style={{ opacity: 0 }}>
              {el === ' ' ? '\u00A0' : el}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
};

export default SplitText;
