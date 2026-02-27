import { lazy, Suspense } from 'react';

const SplashCursor = lazy(() => import('@/components/SplashCursor'));

/**
 * Standalone test page for the SplashCursor effect.
 * No auth required — access at /splash-test
 * 
 * Pixel-perfect replica of the "Trust Centric Exchange" hero
 * with the Splash simulation enabled.
 */
export default function SplashTestPage() {
    return (
        <div className="relative h-screen w-full overflow-hidden bg-black select-none">
            {/* Real Live Preview: Splash Simulation Overlay */}
            <Suspense fallback={null}>
                <SplashCursor
                    SIM_RESOLUTION={256}
                    DYE_RESOLUTION={768}
                    DENSITY_DISSIPATION={2.5}
                    VELOCITY_DISSIPATION={2.5}
                    PRESSURE={0.6}
                    CURL={20}
                    SPLAT_RADIUS={0.15}
                    SPLAT_FORCE={6500}
                    COLOR_UPDATE_SPEED={50}
                    className="z-[15]"
                />
            </Suspense>

            {/* Real Hero Content: TRUST CENTRIC EXCHANGE */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden pointer-events-none">
                <div className="relative w-full max-w-[80vw] h-full flex flex-col items-center justify-center -mt-8" style={{ gap: 0 }}>
                    <div className="will-change-transform">
                        <span className="text-[12vw] md:text-[8vw] font-display font-black leading-[0.75] text-[#00BFFF] whitespace-nowrap select-none block tracking-[-0.07em]">TRUST</span>
                    </div>
                    <div className="will-change-transform -mt-[0.05em]">
                        <span className="text-[12vw] md:text-[8vw] font-display font-black leading-[0.75] text-[#00BFFF] whitespace-nowrap select-none block tracking-[-0.07em]">CENTRIC</span>
                    </div>
                    <div className="will-change-transform -mt-[0.05em]">
                        <span className="text-[12vw] md:text-[8vw] font-display font-black leading-[0.75] text-[#00BFFF] whitespace-nowrap select-none block tracking-[-0.05em]">EXCHANGE</span>
                    </div>
                </div>
            </div>

            {/* Status indicators like real home */}
            <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
                <p className="text-[#00BFFF]/40 text-sm font-mono tracking-widest uppercase italic">
                    Real-time Fluid Simulation // Hero Section Preview
                </p>
            </div>

            <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="text-white/10 text-[9px] font-mono tracking-[0.5em] uppercase">
                    No Auth Required // Standalone Test
                </span>
            </div>
        </div>
    );
}
