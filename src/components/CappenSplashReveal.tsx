import React, { useRef, useEffect, useState } from 'react';

interface CappenSplashRevealProps {
    texts: string[];
}

export const CappenSplashReveal: React.FC<CappenSplashRevealProps> = ({ texts }) => {
    const blobsRef = useRef<(SVGCircleElement | null)[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const targetScale = useRef(0);
    const currentScale = useRef(0);

    useEffect(() => {
        let mouseX = -1000;
        let mouseY = -1000;

        let active = true;
        const numBlobs = 8;
        const followers = Array.from({ length: numBlobs }, () => ({ x: mouseX, y: mouseY, vx: 0, vy: 0 }));

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        };

        const animate = () => {
            if (!active) return;

            // Interpolate the scale for smooth hover in/out
            targetScale.current = isHovering ? 1 : 0;
            currentScale.current += (targetScale.current - currentScale.current) * 0.1;

            followers.forEach((f, i) => {
                if (i === 0) {
                    f.x += (mouseX - f.x) * 0.25;
                    f.y += (mouseY - f.y) * 0.25;
                } else {
                    const target = followers[i - 1];
                    const dx = target.x - f.x;
                    const dy = target.y - f.y;

                    f.vx += dx * 0.3;
                    f.vy += dy * 0.3;
                    f.vx *= 0.55; // Friction
                    f.vy *= 0.55;

                    f.x += f.vx;
                    f.y += f.vy;
                }

                const el = blobsRef.current[i];
                if (el) {
                    el.setAttribute('cx', f.x.toString());
                    el.setAttribute('cy', f.y.toString());
                    // Scale size based on hover and position in tail
                    // Base size: 280 for head, dropping off heavily to give a stringy tail
                    const baseRadius = 260 - (i * 25);
                    const scaledRadius = Math.max(0, baseRadius * currentScale.current);
                    el.setAttribute('r', scaledRadius.toString());
                }
            });
            requestAnimationFrame(animate);
        };

        containerRef.current?.addEventListener('mousemove', handleMouseMove);
        requestAnimationFrame(animate);

        return () => {
            active = false;
            containerRef.current?.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isHovering]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden cursor-crosshair z-10"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                <defs>
                    <filter id="cappen-liquid-filter" colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="25" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  
                       0 1 0 0 0  
                       0 0 1 0 0  
                       0 0 0 100 -50"
                            result="liquid" />
                        <feComposite in="SourceGraphic" in2="liquid" operator="atop" />
                    </filter>

                    <mask id="cappen-liquid-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" className="w-full h-full">
                        {/* White makes the layer visible by default */}
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {/* The liquid blob is black, PUNCHING A HOLE in the layer to reveal what's underneath */}
                        <g filter="url(#cappen-liquid-filter)">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <circle
                                    key={i}
                                    ref={el => blobsRef.current[i] = el}
                                    cx="-1000" cy="-1000" r="0"
                                    fill="black"
                                />
                            ))}
                        </g>
                    </mask>
                </defs>
            </svg>

            {/* --- LAYER 1: BOTTOM (HIDDEN UNDERNEATH BY DEFAULT) --- */}
            {/* This layer is revealed when the mask punches a hole in the top layer. */}
            {/* We make it highly dynamic and interactive, exactly like a high-end agency site. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden">
                {/* Animated fluid background */}
                <div className="absolute inset-0 bg-[#00BCD4] opacity-20" />
                <div
                    className="absolute inset-0 opacity-80"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 50% 50%, #a3ff12, #00BFFF, transparent)',
                        backgroundSize: '200% 200%',
                        animation: 'pulse 8s ease-in-out infinite alternate',
                        mixBlendMode: 'color-burn'
                    }}
                />

                {/* Bottom Text */}
                <div className="relative flex flex-col items-center justify-center leading-[0.75] w-full text-center">
                    {texts.map((txt, i) => (
                        <span
                            key={i}
                            className="text-[17vw] md:text-[14vw] font-display font-black uppercase tracking-[-0.04em] whitespace-nowrap block text-[#a3ff12] select-none"
                            style={{ marginTop: i > 0 ? '-1vw' : '0', textShadow: '0 0 40px rgba(163,255,18,0.8)' }}
                        >
                            {txt}
                        </span>
                    ))}
                </div>
            </div>

            {/* --- LAYER 2: TOP (FULLY VISIBLE BY DEFAULT) --- */}
            {/* This layer is masked. Where the cursor is, the mask is black, revealing Layer 1! */}
            <div
                className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-white"
                style={{
                    maskImage: 'url(#cappen-liquid-mask)',
                    WebkitMaskImage: 'url(#cappen-liquid-mask)',
                    maskSize: '100% 100%',
                    WebkitMaskSize: '100% 100%',
                }}
            >
                <div className="relative flex flex-col items-center justify-center leading-[0.75] w-full text-center">
                    {texts.map((txt, i) => (
                        <span
                            key={i}
                            className="text-[17vw] md:text-[14vw] font-display font-black uppercase tracking-[-0.04em] whitespace-nowrap block text-black select-none pointer-events-auto"
                            style={{ marginTop: i > 0 ? '-1vw' : '0' }}
                        >
                            {txt}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
