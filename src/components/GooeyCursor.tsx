import { useEffect, useRef, memo } from 'react';

interface GooeyCursorProps {
  size?: number;
}

const GooeyCursor = memo(function GooeyCursor({ size = 24 }: GooeyCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if device supports hover (not touch-only)
    const mediaQuery = window.matchMedia('(pointer: fine)');
    
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let trailX = 0;
    let trailY = 0;
    let alive = true;
    let lastTime = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      // Use direct DOM opacity instead of React state to avoid re-render
      if (cursorRef.current) cursorRef.current.style.opacity = '1';
      if (trailRef.current) trailRef.current.style.opacity = '0.4';
    };

    const handleMouseLeave = () => {
      if (cursorRef.current) cursorRef.current.style.opacity = '0';
      if (trailRef.current) trailRef.current.style.opacity = '0';
    };

    // Detect hoverable elements via pointer delegation (less noisy than mouseover)
    const handleElementHover = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.classList.contains('module-link') ||
        target.closest('.module-link');

      isHoveringRef.current = !!isInteractive;
    };

    const animate = (now: number) => {
      if (!alive) return;

      // Frame-rate independent damping: normalize to 60fps baseline
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 1 / 60;
      lastTime = now;
      const dt60 = dt * 60; // 1.0 at 60fps

      // Exponential decay damping — consistent at any framerate
      const dampMain = 1 - Math.pow(1 - 0.15, dt60);
      const dampTrail = 1 - Math.pow(1 - 0.08, dt60);

      cursorX += (mouseX - cursorX) * dampMain;
      cursorY += (mouseY - cursorY) * dampMain;

      trailX += (mouseX - trailX) * dampTrail;
      trailY += (mouseY - trailY) * dampTrail;

      const hovering = isHoveringRef.current;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${cursorX - size / 2}px, ${cursorY - size / 2}px) scale(${hovering ? 2 : 1})`;
      }

      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${trailX - size * 1.5 / 2}px, ${trailY - size * 1.5 / 2}px) scale(${hovering ? 1.5 : 1})`;
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    const attach = () => {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
      document.addEventListener('pointerover', handleElementHover);
      rafIdRef.current = requestAnimationFrame(animate);
    };

    const detach = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('pointerover', handleElementHover);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (cursorRef.current) cursorRef.current.style.opacity = '0';
      if (trailRef.current) trailRef.current.style.opacity = '0';
    };

    // Listen for dynamic pointer capability changes (e.g. tablet dock/undock)
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        attach();
      } else {
        detach();
      }
    };

    if (mediaQuery.matches) attach();
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      alive = false;
      detach();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [size]);

  return (
    <>
      {/* Main cursor blob */}
      <div
        id="gooey-cursor"
        ref={cursorRef}
        className="cursor-gooey gooey-cursor"
        style={{
          width: size,
          height: size,
          opacity: 0,
          transition: 'opacity 0.3s ease',
        }}
        aria-hidden="true"
      />
      {/* Trail blob for gooey effect */}
      <div
        id="gooey-cursor-trail"
        ref={trailRef}
        className="cursor-gooey gooey-cursor"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          opacity: 0,
          transition: 'opacity 0.4s ease',
        }}
        aria-hidden="true"
      />
    </>
  );
});

export default GooeyCursor;
