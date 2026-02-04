import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';

interface PageTransitionProps {
  children: React.ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!overlayRef.current || !containerRef.current) return;

    // Skip transition on initial load
    if (!isTransitioning && displayChildren === children) return;

    const tl = gsap.timeline({
      onComplete: () => {
        setDisplayChildren(children);
        setIsTransitioning(false);
      },
    });

    // Transition out (portal wipe effect)
    tl.to(overlayRef.current, {
      clipPath: 'circle(150% at 50% 50%)',
      duration: 0.6,
      ease: 'power3.inOut',
    })
      .to(
        containerRef.current,
        {
          opacity: 0,
          scale: 0.95,
          duration: 0.3,
        },
        0
      )
      // Hold
      .to({}, { duration: 0.1 })
      // Transition in
      .set(containerRef.current, { opacity: 0, scale: 0.95 })
      .to(overlayRef.current, {
        clipPath: 'circle(0% at 50% 50%)',
        duration: 0.6,
        ease: 'power3.inOut',
      })
      .to(
        containerRef.current,
        {
          opacity: 1,
          scale: 1,
          duration: 0.4,
          ease: 'power2.out',
        },
        '-=0.3'
      );

    return () => {
      tl.kill();
    };
  }, [children, displayChildren, isTransitioning]);

  // Trigger transition when location changes
  useEffect(() => {
    if (children !== displayChildren) {
      setIsTransitioning(true);
    }
  }, [children, displayChildren]);

  return (
    <>
      {/* Portal wipe overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-portal z-[60] pointer-events-none"
        style={{ clipPath: 'circle(0% at 50% 50%)' }}
      />
      
      {/* Page content */}
      <div ref={containerRef}>{displayChildren}</div>
    </>
  );
};

export default PageTransition;
