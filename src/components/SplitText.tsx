import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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

  useEffect(() => {
    if (!textRef.current) return;

    const text = children;
    let elements: string[] = [];

    // Split text based on type
    switch (type) {
      case 'chars':
        elements = text.split('');
        break;
      case 'words':
        elements = text.split(' ');
        break;
      case 'lines':
        elements = text.split('\n');
        break;
    }

    // Create span elements
    textRef.current.innerHTML = elements
      .map((el) => {
        const content = el === ' ' ? '&nbsp;' : el;
        return `<span class="split-element inline-block" style="opacity: 0">${content}</span>`;
      })
      .join(type === 'words' ? '<span class="inline-block">&nbsp;</span>' : '');

    const splitElements = textRef.current.querySelectorAll('.split-element');

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

    if (trigger === 'scroll') {
      gsap.fromTo(splitElements, from, {
        ...to,
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });
    } else if (trigger === 'load') {
      gsap.fromTo(splitElements, from, to);
    }

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [children, type, animation, delay, stagger, trigger]);

  return (
    <div ref={containerRef} className={className}>
      <span ref={textRef} className="inline-block" style={{ perspective: '1000px' }}>
        {children}
      </span>
    </div>
  );
};

export default SplitText;
