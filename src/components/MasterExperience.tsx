import { useRef, useState, useCallback, lazy, Suspense, memo } from 'react';
import { useLayoutEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { safeNavigate } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Module preview images
import resaleTech from '@/assets/resale-tech.jpg';
import housingHandover from '@/assets/housing-handover.jpg';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
import academicsPreview from '@/assets/Academics.jpg';

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

const ModuleItemCard = memo(function ModuleItemCard({
  module,
  index,
  activeModule,
  handleMouseEnter,
  handleMouseLeave,
}: {
  module: Module;
  index: number;
  activeModule: string | null;
  handleMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  handleMouseLeave: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  const titleClass = (index === 2 || index === 3)
    ? "text-xl sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl font-display font-bold uppercase transition-colors duration-500 leading-[0.9] tracking-[-0.04em]"
    : "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold uppercase transition-colors duration-500 leading-[0.9] tracking-[-0.04em]";

  return (
    <Link
      to={module.path}
      data-module-id={module.id}
      className={`module-item group relative overflow-hidden rounded-2xl border border-portal-foreground/10 bg-portal-foreground/[0.02] transform transition-all duration-500 hover:scale-[1.02] hover:bg-portal-foreground/[0.04] hover:shadow-[0_0_30px_hsla(var(--portal-foreground),0.1)] flex flex-col justify-between p-6 sm:p-8 ${
        index === 0 ? 'md:col-span-2 lg:col-span-2 lg:row-span-2' : ''
      } ${
        index === 1 ? 'md:col-span-2 lg:col-span-2' : ''
      } ${
        index === 2 ? 'lg:col-span-1' : ''
      } ${
        index === 3 ? 'lg:col-span-1' : ''
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Image Setup */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${activeModule === module.id ? 'opacity-100' : 'opacity-40 grayscale-[0.8]'}`}>
         {!isLoaded && (
           <div className="absolute inset-0 bg-neutral-850 animate-pulse bg-white/5 border border-white/10" />
         )}
         <img
           src={module.preview}
           alt={module.title}
           onLoad={() => setIsLoaded(true)}
           className={`w-full h-full object-cover scale-105 transition-transform duration-1000 group-hover:scale-100 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
           loading="lazy"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
      </div>

      {/* Content Setup */}
      <div className="relative z-10 space-y-4">
         <div>
            <span className={`font-mono text-sm md:text-base font-medium inline-block px-3 py-1 rounded-full border transition-colors duration-500 ${activeModule === module.id ? 'border-[#a3ff12]/50 text-[#a3ff12] bg-[#a3ff12]/10' : 'border-white/20 text-white/50 bg-black/30'}`}>
               {module.number}
            </span>
         </div>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-8 md:mt-0">
         <div>
            <h3 className={`${titleClass} ${activeModule === module.id ? 'text-white' : 'text-white/80'}`}>
               {module.title}
            </h3>
            <p className={`text-[10px] md:text-[11px] font-mono tracking-[0.3em] uppercase mt-3 transition-colors duration-500 line-clamp-2 ${activeModule === module.id ? 'text-[#a3ff12]' : 'text-white/50'}`}>
               {module.subtitle}
            </p>
         </div>
         <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 transition-all duration-500 group-hover:bg-[#a3ff12] group-hover:border-[#a3ff12] group-hover:text-black`}>
            <span className="font-mono text-lg transition-transform duration-300 group-hover:translate-x-1">→</span>
         </div>
      </div>
    </Link>
  );
});

const ModuleNavPanel = memo(function ModuleNavPanel({ modules }: { modules: Module[] }) {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const id = (e.currentTarget as HTMLAnchorElement).dataset.moduleId ?? null;
    setActiveModule((prev) => (prev === id ? prev : id));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveModule((prev) => (prev === null ? prev : null));
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 md:p-12 lg:p-24 overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-[minmax(200px,auto)] md:auto-rows-[minmax(300px,auto)]">
        {modules.map((module, index) => (
          <ModuleItemCard
            key={module.id}
            module={module}
            index={index}
            activeModule={activeModule}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
          />
        ))}
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

      // Module items animate in (module panel is visible by default for accessibility)
      const items = modulesRef.current?.querySelectorAll('.module-item');
      if (items) tl.fromTo(items, { y: 40, opacity: 0, rotateX: 10 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.8, stagger: 0.08, ease: 'power4.out' }, 0.6);

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
              
              {/* Unified h1 — split visually across three rows */}
              <h1 className="sr-only">Trust-Centric Exchange</h1>
              
              {/* Row 1: Left */}
              <div className="animate-fade-in-up flex items-end justify-start w-full relative z-10" style={{ animationDelay: '0.1s' }}>
                <div className="flex-col items-start pb-4 mr-8 hidden lg:flex">
                   <span className="text-[10px] uppercase font-mono tracking-widest text-foreground/40 mb-4 whitespace-nowrap">
                     Verified User Base
                   </span>
                   <div className="w-[1px] h-12 bg-foreground/30"></div>
                </div>
                <span aria-hidden="true" className="text-[14vw] sm:text-[14vw] lg:text-[10vw] font-display font-medium uppercase tracking-[-0.04em] text-foreground leading-[0.75] m-0 p-0">
                  TRUST
                </span>
              </div>

              {/* Row 2: Right */}
              <div className="animate-fade-in-up flex items-start justify-end w-full relative z-20" style={{ animationDelay: '0.2s' }}>
                <span aria-hidden="true" className="text-[13vw] sm:text-[14vw] lg:text-[10vw] font-display font-medium uppercase tracking-[-0.04em] text-foreground leading-[0.75] m-0 p-0 pr-2 lg:pr-8">
                  CENTRIC
                </span>
                <div className="flex-col items-end pt-4 ml-8 hidden lg:flex">
                   <div className="w-[1px] h-12 bg-foreground/30 mb-4"></div>
                   <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-foreground/40 max-w-[140px] text-right leading-relaxed">
                     Admin Authenticated
                   </span>
                </div>
              </div>

              {/* Row 3: Left Offset */}
              <div className="animate-fade-in-up flex justify-start lg:justify-center w-full relative z-30" style={{ animationDelay: '0.3s' }}>
                <span aria-hidden="true" className="text-[12vw] sm:text-[13vw] lg:text-[10vw] font-display font-medium uppercase tracking-[-0.05em] text-foreground leading-[0.75] m-0 p-0 relative ml-8 lg:ml-0">
                  <span className="animate-fade-in-up absolute -top-4 -left-6 md:-top-6 md:-left-12 text-2xl md:text-5xl text-[#a3ff12]/80 font-serif italic font-light" style={{ animationDelay: '0.6s' }}>
                    *
                  </span>
                  EXCHANGE
                </span>
              </div>

            </div>
              
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-60" aria-hidden="true">
                <div className="w-[1px] h-16 bg-gradient-to-b from-foreground/50 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>

        <div ref={portalRef} className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none" style={{ clipPath: 'circle(0% at 50% 50%)' }}>
          <div ref={symbolRef} className="will-change-transform -mt-[10vh] md:mt-0" style={{ width: '160px', height: '160px', transformStyle: 'preserve-3d' }}>
            {/* Logo/Shield completely removed from homepage (Explore section) */}
          </div>
        </div>

        <div ref={modulesRef} className="absolute inset-0 z-30 bg-transparent pt-[20vh] md:pt-[10vh]">
          <ModuleNavPanel modules={modules} />
        </div>
      </div>
    </div>
  );
};

export default MasterExperience;
