import { useEffect, useRef, memo } from 'react';

interface GooeyRevealMaskProps {
    maskId?: string;
    className?: string;
}

export const GooeyRevealMask = memo(function GooeyRevealMask({
    maskId = "fluidMask",
    className = "absolute pointer-events-none"
}: GooeyRevealMaskProps) {
    const blobsRef = useRef<SVGCircleElement[]>([]);

    useEffect(() => {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;

        // Create followers for the trailing fluid effect
        const numBlobs = 6;
        const followers = Array.from({ length: numBlobs }, () => ({
            x: mouseX, y: mouseY,
        }));

        const onMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };
        window.addEventListener('mousemove', onMove, { passive: true });

        let active = true;
        const render = () => {
            if (!active) return;

            followers.forEach((f, i) => {
                // Each blob follows the previous one (or the mouse for the first)
                // This gives the "inertia to the edge" and "soft trailing motion"
                if (i === 0) {
                    f.x += (mouseX - f.x) * 0.15; // Primary easing
                    f.y += (mouseY - f.y) * 0.15;
                } else {
                    f.x += (followers[i - 1].x - f.x) * 0.35; // Trailing inertia
                    f.y += (followers[i - 1].y - f.y) * 0.35;
                }

                if (blobsRef.current[i]) {
                    blobsRef.current[i].setAttribute('cx', f.x.toString());
                    blobsRef.current[i].setAttribute('cy', f.y.toString());
                }
            });
            requestAnimationFrame(render);
        };
        render();

        return () => {
            active = false;
            window.removeEventListener('mousemove', onMove);
        };
    }, []);

    return (
        <svg width="0" height="0" className={className}>
            <defs>
                <filter id="goo">
                    {/* Strong blur for the liquid morphing */}
                    <feGaussianBlur in="SourceGraphic" stdDeviation="25" result="blur" />
                    {/* High contrast threshold to create the sharp liquid edge */}
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="
              1 0 0 0 0  
              0 1 0 0 0  
              0 0 1 0 0  
              0 0 0 50 -20
            "
                        result="goo"
                    />
                    <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                </filter>
                <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" width="100%" height="100%">
                    {/* White means layer is visible */}
                    <rect width="100%" height="100%" fill="white" />
                    {/* Black punches holes revealing the layer underneath */}
                    <g filter="url(#goo)">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <circle
                                key={i}
                                ref={el => blobsRef.current[i] = el!}
                                cx="-100" cy="-100"
                                r={140 - (i * 15)}
                                fill="black"
                            />
                        ))}
                    </g>
                </mask>
            </defs>
        </svg>
    );
});

export default GooeyRevealMask;
