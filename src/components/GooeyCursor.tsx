import { useEffect, useRef, useState } from 'react';

interface GooeyCursorProps {
  size?: number;
}

const GooeyCursor = ({ size = 24 }: GooeyCursorProps) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    // Check if device supports hover (not touch-only)
    const mediaQuery = window.matchMedia('(pointer: fine)');
    if (!mediaQuery.matches) return;

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let trailX = 0;
    let trailY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setIsVisible(true);
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    // Detect hoverable elements
    const handleElementHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = 
        target.tagName === 'A' || 
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.classList.contains('module-link') ||
        target.closest('.module-link');
      
      setIsHovering(!!isInteractive);
    };

    const animate = () => {
      // Smooth follow for main cursor
      const easingMain = 0.15;
      cursorX += (mouseX - cursorX) * easingMain;
      cursorY += (mouseY - cursorY) * easingMain;

      // Slower follow for trail (gooey effect)
      const easingTrail = 0.08;
      trailX += (mouseX - trailX) * easingTrail;
      trailY += (mouseY - trailY) * easingTrail;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${cursorX - size / 2}px, ${cursorY - size / 2}px) scale(${isHovering ? 2 : 1})`;
      }

      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${trailX - size * 1.5 / 2}px, ${trailY - size * 1.5 / 2}px) scale(${isHovering ? 1.5 : 1})`;
      }

      requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseover', handleElementHover);
    
    const animationId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseover', handleElementHover);
      cancelAnimationFrame(animationId);
    };
  }, [size, isHovering]);

  return (
    <>
      {/* Main cursor blob */}
      <div
        ref={cursorRef}
        className="cursor-gooey gooey-cursor"
        style={{
          width: size,
          height: size,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease, width 0.3s ease, height 0.3s ease',
        }}
        aria-hidden="true"
      />
      {/* Trail blob for gooey effect */}
      <div
        ref={trailRef}
        className="cursor-gooey gooey-cursor"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          opacity: isVisible ? 0.4 : 0,
          transition: 'opacity 0.4s ease',
        }}
        aria-hidden="true"
      />
    </>
  );
};

export default GooeyCursor;
