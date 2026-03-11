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

        let active = true;
        let rafHandle = 0;
        let isLoopActive = false;

        const render = () => {
            if (!active) return;

            let anyMoving = false;

            followers.forEach((f, i) => {
                // Each blob follows the previous one (or the mouse for the first)
                // This gives the "inertia to the edge" and "soft trailing motion"
                const targetX = i === 0 ? mouseX : followers[i - 1].x;
                const targetY = i === 0 ? mouseY : followers[i - 1].y;
                const factor  = i === 0 ? 0.15 : 0.35;

                f.x += (targetX - f.x) * factor;
                f.y += (targetY - f.y) * factor;

                if (Math.abs(targetX - f.x) > 0.05 || Math.abs(targetY - f.y) > 0.05) {
                    anyMoving = true;
                }

                if (blobsRef.current[i]) {
                    blobsRef.current[i].setAttribute('cx', f.x.toString());
                    blobsRef.current[i].setAttribute('cy', f.y.toString());
                }
            });

            // PERF: idle-aware — stop the RAF when blobs have settled.
            // Mouse move restarts the loop, so CPU is only used while animating.
            if (anyMoving) {
                rafHandle = requestAnimationFrame(render);
            } else {
                isLoopActive = false;
            }
        };

        // Wake up the loop on mousemove (no-op if already running)
        const wakeUp = () => {
            if (!isLoopActive && active) {
                isLoopActive = true;
                rafHandle = requestAnimationFrame(render);
            }
        };

        const onMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            wakeUp();
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        // Start with an initial render so blobs appear at cursor position
        wakeUp();

        return () => {
            active = false;
            cancelAnimationFrame(rafHandle);
            window.removeEventListener('mousemove', onMove);
        };
    }, []);

    return (
        <svg width="0" height="0" className={className}>
            <defs>
                <filter id="goo">
                    {/* PERF: stdDeviation reduced 25→12 — stays in GPU-acceleratable range.
                        Values above ~15 fall back to CPU rasterization on most browsers. */}
                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                    {/* High contrast threshold to create the sharp liquid edge.
                        Alpha multiplier reduced 50→25 to compensate for the tighter blur. */}
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="
              1 0 0 0 0  
              0 1 0 0 0  
              0 0 1 0 0  
              0 0 0 25 -8
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
