import { useRef, useState, useCallback, lazy, Suspense, memo } from 'react';
import { useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { safeNavigate } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Module preview images
import resaleTech from '@/assets/resale-tech.jpg';
import housingHandover from '@/assets/housing-handover.jpg';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
const academicsPreview = '/Academics.jpg';

const Portal3D = lazy(() => import('@/components/Portal3D'));
const SplashCursor = lazy(() => import('@/components/SplashCursor'));

interface Module {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  preview: string;
  path: string;
}

const modules: Module[] = [
  { id: 'academics', number: '01', title: 'ACADEMICS', subtitle: 'RESOURCES & NOTES', preview: academicsPreview, path: '/academics' },
  { id: 'accommodation', number: '02', title: 'ACCOMMODATION', subtitle: 'STAY & DISCOVERY', preview: housingHandover, path: '/accommodation' },
  { id: 'essentials', number: '03', title: 'ESSENTIALS', subtitle: 'MESS & HEALTHCARE', preview: essentialsTiffin, path: '/essentials' },
  { id: 'resale', number: '04', title: 'RESALE', subtitle: 'P2P EXCHANGE', preview: resaleTech, path: '/resale' },
];

const ModuleNavPanel = memo(function ModuleNavPanel({ modules, onModuleClick }: { modules: Module[]; onModuleClick: (path: string) => void; }) {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // MED-07 FIX: replaced per-item inline arrow functions with stable useCallback
  // handlers that read the target module id/path from data-* attributes.
  // Inline arrows inside .map() create new function references on every render,
  // defeating the memo() wrapper and causing every ModuleNavPanel child to
  // re-render whenever unrelated parent state changes.
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const id = (e.currentTarget as HTMLDivElement).dataset.moduleId ?? null;
    setActiveModule((prev) => (prev === id ? prev : id));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveModule((prev) => (prev === null ? prev : null));
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const path = (e.currentTarget as HTMLDivElement).dataset.modulePath;
    if (path) onModuleClick(path);
  }, [onModuleClick]);

  return (
    <div className="w-full h-full flex flex-row items-stretch">
      <div className="w-full lg:w-[62%] h-full flex flex-col justify-center">
        <div className="max-w-[900px] w-full px-6 sm:px-12 md:px-20 lg:px-24">

          <nav className="flex flex-col gap-1 md:gap-2">
            {modules.map((module) => (
              <div key={module.id} data-module-id={module.id} data-module-path={module.path} className="module-item group relative cursor-pointer" role="button" tabIndex={0} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={handleClick}>
                <div className="flex items-center gap-6 md:gap-8 py-4 md:py-6 px-4 md:px-6 group-hover:bg-white/[0.04] transition-[background-color] duration-500">
                  <span className={`font-mono text-base md:text-lg transition-[color,opacity] duration-500 shrink-0 w-8 ${activeModule === module.id ? 'text-[#a3ff12] opacity-100' : 'text-portal-foreground/15'}`}>{module.number}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-3xl sm:text-4xl md:text-5xl lg:text-4xl xl:text-5xl font-display font-bold uppercase transition-[color,transform,opacity] duration-500 leading-[0.85] tracking-[-0.05em] translate-z-0 will-change-transform ${activeModule === module.id ? 'text-[#a3ff12] scale-[1.01] translate-x-3' : 'text-portal-foreground opacity-80'}`}>{module.title}</h3>
                    <p className={`text-[10px] md:text-[11px] font-mono tracking-[0.4em] uppercase mt-2 transition-[color,opacity] duration-500 ${activeModule === module.id ? 'text-white/50' : 'text-white/5'}`}>{module.subtitle}</p>
                  </div>
                  <span className={`text-[#a3ff12] font-mono text-2xl md:text-3xl transition-[opacity,transform] duration-300 shrink-0 ${activeModule === module.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}>→</span>
                </div>
                <div className={`h-px w-full transition-[background-color] duration-500 ${activeModule === module.id ? 'bg-[#a3ff12]/30' : 'bg-white/5'}`} />
              </div>
            ))}
          </nav>
        </div>
      </div>
      <div className="hidden lg:flex w-[38%] h-full items-center justify-center p-6 lg:p-14">
        <div className="relative w-full max-w-md aspect-square">
          {modules.map((module) => (
            <div
              key={module.id}
              // MED-D FIX: always keep image divs mounted so the browser can
              // prefetch/decode in the background. Toggle visibility via CSS
              // opacity + pointer-events instead of && conditional unmounting,
              // which forced a full DOM remove/re-add on every hover.
              className={`absolute inset-0 transition-all duration-500 ${
                activeModule === module.id
                  ? 'opacity-100 scale-100 pointer-events-auto'
                  : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              <div className="hud-image-box w-full h-full rounded-none overflow-hidden">
                <img src={module.preview} alt={module.title} className="w-full h-full object-cover grayscale-[0.2]" fetchPriority="high" loading="eager" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              </div>
            </div>
          ))}
          <div className={`absolute inset-0 border border-dashed border-white/10 flex items-center justify-center transition-opacity duration-300 ${activeModule ? 'opacity-0' : 'opacity-100'}`}>
            <p className="text-white/5 font-mono text-[9px] tracking-widest uppercase italic">Awaiting Module Selection...</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const MasterExperience = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const baseLayerRef = useRef<HTMLDivElement>(null);
  const modulesRef = useRef<HTMLDivElement>(null);
  const symbolRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [isHeavyMounted, setIsHeavyMounted] = useState(false);
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const timer = setTimeout(() => setIsHeavyMounted(true), 100);
    return () => {
      clearTimeout(timer);
      // CRIT-04 FIX: restore scrollRestoration so back-button UX works on other pages
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    };
  }, []);

  const handleModuleClick = useCallback((path: string) => safeNavigate(navigate, location.pathname, path, { replace: false }), [navigate, location.pathname]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // MED-06 FIX: ScrollTrigger.refresh() forces synchronous style/layout recalculation.
      // Calling it via tl.add() at position 1.0 runs it mid-scrub while the timeline
      // is still active, causing forced reflow inside a scroll handler and jank.
      // Move it to onComplete so it only runs once after the animation fully finishes.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom bottom', scrub: 1, onUpdate: (self) => { scrollProgressRef.current = self.progress; } },
        onComplete: () => requestAnimationFrame(() => ScrollTrigger.refresh()),
      });

      // Fade out the entire hero logic
      tl.to(heroContainerRef.current, { y: '-10vh', scale: 0.8, opacity: 0, duration: 1, ease: 'power3.inOut' }, 0);

      tl.fromTo(portalRef.current, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: 1.5, ease: 'expo.inOut' }, 0.2);

      tl.fromTo(symbolRef.current, { scale: 0.2, opacity: 0, rotateZ: -15 }, { scale: 5, z: 120, opacity: 1, rotateZ: 0, duration: 1.4, ease: 'expo.inOut' }, 0.2);
      tl.to(symbolRef.current, { opacity: 0, scale: 12, duration: 0.5, ease: 'power2.in' }, 0.9);

      tl.to(modulesRef.current, { opacity: 1, pointerEvents: 'auto', duration: 0.4 }, 0.6);
      const items = modulesRef.current?.querySelectorAll('.module-item');
      if (items) tl.fromTo(items, { y: 40, opacity: 0, rotateX: 10 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.8, stagger: 0.08, ease: 'power4.out' }, 0.7);

      // Add idle scrolling time so the 4 modules stay visible for the user to read/click
      tl.to({}, { duration: 0.8 });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="h-[200vh] bg-portal">
      <div ref={stickyRef} className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-portal">

        <div ref={baseLayerRef} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto">
          <div ref={heroContainerRef} className="w-full h-full relative overflow-hidden bg-background">
            {/* WebGL fluid splash — desktop only; mobile skips the heavy GPU sim */}
            {isHeavyMounted && (
              <Suspense fallback={null}>
                <SplashCursor
                  SIM_RESOLUTION={isMobile ? 64 : 128}
                  DYE_RESOLUTION={isMobile ? 256 : 768}
                  DENSITY_DISSIPATION={isMobile ? 4.5 : 3.5}
                  VELOCITY_DISSIPATION={isMobile ? 3.5 : 2.8}
                  PRESSURE={0.1}
                  CURL={isMobile ? 1 : 3}
                  SPLAT_RADIUS={isMobile ? 0.4 : 0.2}
                  SPLAT_FORCE={6000}
                  SHADING={!isMobile}
                  COLOR_UPDATE_SPEED={10}
                  containerStyle={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                />
              </Suspense>
            )}
            {/* High-End Editorial Hero Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none select-none px-4 md:px-8">
              <div className="w-full max-w-[1800px] flex flex-col relative overflow-visible mt-12 md:mt-0 gap-2 md:gap-4">
                
                {/* Row 1: Left */}
                <div className="animate-fade-in-up flex items-end justify-start w-full relative z-10" style={{ animationDelay: '0.1s', opacity: 0 }}>
                  <div className="flex-col items-start pb-4 mr-8 hidden lg:flex">
                     <span className="text-[10px] uppercase font-mono tracking-widest text-foreground/40 mb-4 whitespace-nowrap">
                       Verified User Base
                     </span>
                     <div className="w-[1px] h-12 bg-foreground/30"></div>
                  </div>
                  <h1 className="text-[17vw] sm:text-[14vw] lg:text-[11vw] font-display font-medium uppercase tracking-[-0.04em] text-foreground leading-[0.75] m-0 p-0">
                    TRUST
                  </h1>
                </div>

                {/* Row 2: Right */}
                <div className="animate-fade-in-up flex items-start justify-end w-full relative z-20" style={{ animationDelay: '0.2s', opacity: 0 }}>
                  <h1 className="text-[17vw] sm:text-[14vw] lg:text-[11vw] font-display font-medium uppercase tracking-[-0.04em] text-foreground leading-[0.75] m-0 p-0 pr-2 lg:pr-8">
                    CENTRIC
                  </h1>
                  <div className="flex-col items-end pt-4 ml-8 hidden lg:flex">
                     <div className="w-[1px] h-12 bg-foreground/30 mb-4"></div>
                     <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-foreground/40 max-w-[140px] text-right leading-relaxed">
                       Admin Authenticated
                     </span>
                  </div>
                </div>

                {/* Row 3: Left Offset */}
                <div className="animate-fade-in-up flex justify-start lg:justify-center w-full relative z-30" style={{ animationDelay: '0.3s', opacity: 0 }}>
                  <h1 className="text-[15vw] sm:text-[13vw] lg:text-[11vw] font-display font-medium uppercase tracking-[-0.05em] text-foreground leading-[0.75] m-0 p-0 relative ml-8 lg:ml-0">
                    <span className="animate-fade-in-up absolute -top-4 -left-6 md:-top-6 md:-left-12 text-2xl md:text-5xl text-[#a3ff12]/80 font-serif italic font-light" style={{ animationDelay: '0.6s', opacity: 0 }}>
                      *
                    </span>
                    EXCHANGE
                  </h1>
                </div>

              </div>
              
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-60">
                <div className="w-[1px] h-16 bg-gradient-to-b from-foreground/50 to-transparent"></div>
                <p className="text-[9px] font-mono uppercase tracking-[0.4em] text-foreground">
                  Scroll to explore
                </p>
              </div>
            </div>
          </div>
        </div>

        <div ref={portalRef} className="absolute inset-0 z-30 bg-portal flex items-center justify-center pointer-events-none" style={{ clipPath: 'circle(0% at 50% 50%)' }}>
          <div ref={symbolRef} className="will-change-transform -mt-[10vh]" style={{ width: '160px', height: '160px', transformStyle: 'preserve-3d' }}>
            {/* Portal3D is heavy ΓÇö skip on mobile to avoid GPU/WASM overhead */}
            {isHeavyMounted && <Suspense fallback={null}><Portal3D scrollProgressRef={scrollProgressRef} /></Suspense>}
          </div>
        </div>

        <div ref={modulesRef} className="absolute inset-0 z-40 bg-portal opacity-0 pointer-events-none">
          <ModuleNavPanel modules={modules} onModuleClick={handleModuleClick} />
        </div>
      </div>
    </div>
  );
};

export default MasterExperience;
