import { useEffect, useRef, useState, useCallback } from 'react';

interface MagneticCursorProps {
  size?: number;
  springStrength?: number;
  dampening?: number;
}

const MagneticCursor = ({ 
  size = 28, 
  springStrength = 0.08,
  dampening = 0.85 
}: MagneticCursorProps) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMagnetic, setIsMagnetic] = useState(false);

  // Spring physics state
  const physics = useRef({
    mouseX: 0,
    mouseY: 0,
    cursorX: 0,
    cursorY: 0,
    cursorVelX: 0,
    cursorVelY: 0,
    trailX: 0,
    trailY: 0,
    trailVelX: 0,
    trailVelY: 0,
    glowX: 0,
    glowY: 0,
    glowVelX: 0,
    glowVelY: 0,
    magnetTarget: null as HTMLElement | null,
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    physics.current.mouseX = e.clientX;
    physics.current.mouseY = e.clientY;
    setIsVisible(true);
  }, []);

  const handleMouseEnter = useCallback(() => setIsVisible(true), []);
  const handleMouseLeave = useCallback(() => setIsVisible(false), []);

  const handleElementHover = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check for magnetic elements (buttons, links)
    const magneticEl = target.closest('[data-magnetic]') || 
                       target.closest('button') || 
                       target.closest('a');
    
    if (magneticEl) {
      physics.current.magnetTarget = magneticEl as HTMLElement;
      setIsMagnetic(true);
    } else {
      physics.current.magnetTarget = null;
      setIsMagnetic(false);
    }
    
    // Check for interactive elements
    const isInteractive = 
      target.tagName === 'A' || 
      target.tagName === 'BUTTON' ||
      target.closest('a') ||
      target.closest('button') ||
      target.classList.contains('module-link') ||
      target.closest('.module-link') ||
      target.closest('[data-hover]');
    
    setIsHovering(!!isInteractive);
  }, []);

  useEffect(() => {
    // Check if device supports hover
    const mediaQuery = window.matchMedia('(pointer: fine)');
    if (!mediaQuery.matches) return;

    let animationId: number;

    const animate = () => {
      const p = physics.current;
      
      // Calculate target position (with magnetic pull if applicable)
      let targetX = p.mouseX;
      let targetY = p.mouseY;
      
      if (p.magnetTarget && isMagnetic) {
        const rect = p.magnetTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Pull cursor towards center of magnetic element
        const pullStrength = 0.3;
        targetX = p.mouseX + (centerX - p.mouseX) * pullStrength;
        targetY = p.mouseY + (centerY - p.mouseY) * pullStrength;
      }
      
      // Spring physics for main cursor (heavy, laggy feel)
      const dx = targetX - p.cursorX;
      const dy = targetY - p.cursorY;
      
      p.cursorVelX += dx * springStrength;
      p.cursorVelY += dy * springStrength;
      p.cursorVelX *= dampening;
      p.cursorVelY *= dampening;
      p.cursorX += p.cursorVelX;
      p.cursorY += p.cursorVelY;
      
      // Slower spring for trail (more lag)
      const trailDx = targetX - p.trailX;
      const trailDy = targetY - p.trailY;
      
      p.trailVelX += trailDx * (springStrength * 0.5);
      p.trailVelY += trailDy * (springStrength * 0.5);
      p.trailVelX *= dampening * 0.95;
      p.trailVelY *= dampening * 0.95;
      p.trailX += p.trailVelX;
      p.trailY += p.trailVelY;
      
      // Even slower for glow (maximum lag for liquid effect)
      const glowDx = targetX - p.glowX;
      const glowDy = targetY - p.glowY;
      
      p.glowVelX += glowDx * (springStrength * 0.25);
      p.glowVelY += glowDy * (springStrength * 0.25);
      p.glowVelX *= dampening * 0.98;
      p.glowVelY *= dampening * 0.98;
      p.glowX += p.glowVelX;
      p.glowY += p.glowVelY;
      
      // Calculate stretch based on velocity for liquid deformation
      const velocity = Math.sqrt(p.cursorVelX ** 2 + p.cursorVelY ** 2);
      const stretch = Math.min(velocity * 0.02, 0.4);
      const angle = Math.atan2(p.cursorVelY, p.cursorVelX) * (180 / Math.PI);
      
      // Apply transforms
      if (cursorRef.current) {
        const scale = isHovering ? 2 : 1;
        cursorRef.current.style.transform = `
          translate(${p.cursorX - size / 2}px, ${p.cursorY - size / 2}px) 
          scale(${scale + stretch}, ${scale - stretch * 0.5})
          rotate(${angle}deg)
        `;
      }
      
      if (trailRef.current) {
        const trailScale = isHovering ? 1.5 : 1;
        trailRef.current.style.transform = `
          translate(${p.trailX - size * 0.75}px, ${p.trailY - size * 0.75}px)
          scale(${trailScale})
        `;
      }
      
      if (glowRef.current) {
        glowRef.current.style.transform = `
          translate(${p.glowX - size * 1.5}px, ${p.glowY - size * 1.5}px)
        `;
      }
      
      animationId = requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseover', handleElementHover);
    
    animationId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseover', handleElementHover);
      cancelAnimationFrame(animationId);
    };
  }, [size, springStrength, dampening, isHovering, isMagnetic, handleMouseMove, handleMouseEnter, handleMouseLeave, handleElementHover]);

  return (
    <>
      {/* Outer glow layer - slowest, creates depth */}
      <div
        ref={glowRef}
        className="fixed top-0 left-0 pointer-events-none z-[9997] mix-blend-difference will-change-transform"
        style={{
          width: size * 3,
          height: size * 3,
          opacity: isVisible ? 0.15 : 0,
          background: 'radial-gradient(circle, white 0%, transparent 70%)',
          transition: 'opacity 0.4s ease',
        }}
        aria-hidden="true"
      />
      
      {/* Trail blob - medium speed, gooey connection */}
      <div
        ref={trailRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998] rounded-full bg-white mix-blend-difference will-change-transform"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          opacity: isVisible ? 0.4 : 0,
          filter: 'blur(2px)',
          transition: 'opacity 0.3s ease',
        }}
        aria-hidden="true"
      />
      
      {/* Main cursor blob - fastest, sharp */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full bg-white mix-blend-difference will-change-transform"
        style={{
          width: size,
          height: size,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        aria-hidden="true"
      />
    </>
  );
};

export default MagneticCursor;
