import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

interface AuthPortalProps {
    children: React.ReactNode;
}

const AuthPortal = ({ children }: AuthPortalProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // useLayoutEffect prevents FOUC — sets initial clip/opacity before paint
    useLayoutEffect(() => {
        if (!containerRef.current || !portalRef.current || !contentRef.current) return;

        const ctx = gsap.context(() => {
            const tl = gsap.timeline();

            // Reset initial states — use clipPath instead of borderRadius for GPU compositing
            gsap.set(portalRef.current!, { scale: 0.5, clipPath: 'circle(50%)', opacity: 0 });
            gsap.set(contentRef.current!, { opacity: 0, y: 50 });

            // Portal expansion animation
            tl.to(portalRef.current!, {
                scale: 1,
                clipPath: 'inset(0%)',
                opacity: 1,
                duration: 1.2,
                ease: 'power4.inOut',
            })
                .to(contentRef.current!, {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                }, '-=0.4');
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-white"
        >
            {/* The Black Portal */}
            <div
                ref={portalRef}
                className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 md:p-12"
            >
                <div ref={contentRef} className="w-full max-w-4xl mx-auto h-full flex flex-col justify-center">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthPortal;
