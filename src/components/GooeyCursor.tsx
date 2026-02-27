import { useEffect, useRef, memo } from 'react';

interface GooeyCursorProps {
  size?: number;
}

const GooeyCursor = memo(function GooeyCursor({ size = 50 }: GooeyCursorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blobsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: fine)');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let alive = true;

    // We'll use 5 blobs for the liquid trail
    const numBlobs = 5;
    const followers = Array.from({ length: numBlobs }, () => ({ x: mouseX, y: mouseY, vx: 0, vy: 0 }));

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (containerRef.current) containerRef.current.style.opacity = '1';
    };

    const handleMouseLeave = () => {
      if (containerRef.current) containerRef.current.style.opacity = '0';
    };

    const animate = () => {
      if (!alive) return;

      followers.forEach((f, i) => {
        if (i === 0) {
          // Snappy lead blob
          f.x += (mouseX - f.x) * 0.4;
          f.y += (mouseY - f.y) * 0.4;
        } else {
          // Physics-based trailing blobs for liquid string effect
          const target = followers[i - 1];
          const dx = target.x - f.x;
          const dy = target.y - f.y;

          f.vx += dx * 0.18;
          f.vy += dy * 0.18;
          f.vx *= 0.65; // Friction
          f.vy *= 0.65;

          f.x += f.vx;
          f.y += f.vy;
        }

        const el = blobsRef.current[i];
        if (el) {
          // The scale drops off to make the tail thinner
          const scale = 1 - (i * 0.15);
          el.style.transform = `translate(${f.x - size / 2}px, ${f.y - size / 2}px) scale(${scale})`;
        }
      });

      requestAnimationFrame(animate);
    };

    const attach = () => {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
      requestAnimationFrame(animate);
    };

    const detach = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };

    if (mediaQuery.matches) attach();
    mediaQuery.addEventListener('change', (e) => (e.matches ? attach() : detach()));

    return () => {
      alive = false;
      detach();
    };
  }, [size]);

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 pointer-events-none z-[9999] opacity-0 transition-opacity duration-300"
        style={{
          filter: 'url(#gooey-cursor-filter)',
          mixBlendMode: 'difference',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            ref={el => blobsRef.current[i] = el}
            className="absolute rounded-full bg-white will-change-transform"
            style={{
              width: size,
              height: size,
            }}
          />
        ))}
      </div>

      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="gooey-cursor-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
    </>
  );
});

export default GooeyCursor;
