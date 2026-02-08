import { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FluidMaskCursor from '@/components/FluidMaskCursor';

// Module preview images
import resaleTech from '@/assets/resale-tech.jpg';
import housingHandover from '@/assets/housing-handover.jpg';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
const academicsPreview = '/Academics.jpg';

// Components
const Portal3D = lazy(() => import('@/components/Portal3D'));

gsap.registerPlugin(ScrollTrigger);

interface Module {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  preview: string;
  path: string;
}

const modules: Module[] = [
  {
    id: 'resale',
    number: '01',
    title: 'RESOURCE RESALE',
    subtitle: 'VERIFIED P2P EXCHANGE',
    preview: resaleTech,
    path: '/resale',
  },
  {
    id: 'accommodation',
    number: '02',
    title: 'ACCOMMODATION',
    subtitle: 'PRIVACY-FIRST DISCOVERY',
    preview: housingHandover,
    path: '/accommodation',
  },
  {
    id: 'essentials',
    number: '03',
    title: 'ESSENTIALS',
    subtitle: 'HEALTHCARE & FOOD GUIDE',
    preview: essentialsTiffin,
    path: '/essentials',
  },
  {
    id: 'academics',
    number: '04',
    title: 'ACADEMICS HUB',
    subtitle: 'CENTRALIZED SYLLABUS & NOTES',
    preview: academicsPreview,
    path: '/academics',
  },
];

/* ───────────────────────────────────────────────────
   Cappen-style Full-Page Fluid Splash Reveal

   Architecture (bottom → top):
   ┌──────────────────────────────────────────────┐
   │  Layer 1 — BASE (z-10)                       │
   │  White bg  +  Black text + BErozgar + Menu   │
   │  Always visible                               │
   ├──────────────────────────────────────────────┤
   │  WebGL SplashCursor canvas (z-12)            │
   │  Transparent + colourful fluid (visual only) │
   ├──────────────────────────────────────────────┤
   │  Layer 2 — REVEAL (z-[14])                   │
   │  Black bg + White text + BErozgar + Menu     │
   │  Masked by WebGL canvas luminance via        │
   │  CSS mask-image data-URL from the canvas.    │
   │  Only visible inside the fluid splash shape. │
   └──────────────────────────────────────────────┘
   ─────────────────────────────────────────────────── */

/* Shared hero content rendered twice — once normal, once inverted.
   Includes BErozgar logo + Menu button duplicates so the splash
   effect works on the nav elements too. */
function HeroContent({
  heroTopRef,
  heroMiddleRef,
  heroBottomRef,
  inverted = false,
}: {
  heroTopRef?: React.RefObject<HTMLDivElement | null>;
  heroMiddleRef?: React.RefObject<HTMLDivElement | null>;
  heroBottomRef?: React.RefObject<HTMLDivElement | null>;
  inverted?: boolean;
}) {
  const textColor = inverted ? 'text-[#00BFFF]' : 'text-foreground';
  const subTextColor = inverted ? 'text-[#00BFFF]/40' : 'text-foreground/30';
  const subTextAccent = inverted ? 'text-[#00BFFF]' : 'text-foreground';
  const borderColor = inverted ? 'bg-[#00BFFF]/20' : 'bg-foreground/20';
  const fgClass = inverted ? 'border-[#00BFFF]' : 'border-foreground';
  const fgBg = inverted ? 'bg-[#00BFFF]' : 'bg-foreground';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-12">
      {/* ── Nav-mirror: BErozgar logo (top-left) ── */}
      <div className="absolute top-6 left-6 md:left-12 flex items-center gap-2 z-10">
        <div className={`w-8 h-8 border-2 ${fgClass} rotate-45 flex items-center justify-center`}>
          <div className={`w-3 h-3 ${fgBg}`} />
        </div>
        <span className={`hidden md:block uppercase font-display font-bold text-xl tracking-tight ${textColor}`}>
          BErozgar
        </span>
      </div>

      {/* ── Nav-mirror: section indicator (top-center) ── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-4 z-10">
        <div className={`h-px w-12 ${inverted ? 'bg-background/30' : 'bg-foreground/30'}`} />
        <span className={`text-xs uppercase tracking-widest opacity-60 font-body ${textColor}`}>
          Welcome
        </span>
        <div className={`h-px w-12 ${inverted ? 'bg-background/30' : 'bg-foreground/30'}`} />
      </div>

      {/* ── Nav-mirror: Menu button (top-right) ── */}
      <div className="absolute top-6 right-6 md:right-12 flex items-center gap-3 z-10">
        <span className={`text-xs uppercase tracking-widest opacity-60 font-body ${textColor}`}>
          Menu
        </span>
        <div className="relative w-8 h-8 flex items-center justify-center">
          <span className={`absolute block w-6 h-0.5 ${fgBg} -translate-y-1.5`} />
          <span className={`absolute block w-6 h-0.5 ${fgBg} translate-y-1.5`} />
        </div>
      </div>

      {/* ── Hero text ── */}
      <div className="relative w-full max-w-[85vw] h-full flex flex-col items-center justify-center" style={{ gap: 0 }}>
        {/* Row 1: TRUST */}
        <div ref={heroTopRef || undefined} className="will-change-transform">
          <span className={`text-hero-massive ${textColor} whitespace-nowrap select-none block`}>
            TRUST
          </span>
        </div>

        {/* Row 2: CENTRIC */}
        <div ref={heroMiddleRef || undefined} className="will-change-transform">
          <span className={`text-hero-massive ${textColor} whitespace-nowrap select-none block`}>
            CENTRIC
          </span>
        </div>

        {/* Row 3: EXCHANGE */}
        <div ref={heroBottomRef || undefined} className="will-change-transform">
          <span className={`text-hero-massive ${textColor} whitespace-nowrap select-none block`}>
            EXCHANGE
          </span>
        </div>

        {/* Side description */}
        <div className="absolute right-0 top-[15%] max-w-[180px] text-right hidden xl:block opacity-30">
          <p className={`text-[10px] font-body ${subTextAccent} leading-relaxed uppercase tracking-[0.2em]`}>
            A student-centric digital ecosystem crafting trust & seamless interactions for campus life since 2026.
          </p>
        </div>
      </div>

      {/* Corner branding */}
      <div className="absolute bottom-8 left-8">
        <p className={`text-[10px] font-mono tracking-[0.3em] ${subTextColor} uppercase`}>
          MCTRGIT // CAMPUS_ECOSYSTEM
        </p>
      </div>
      <div className="absolute bottom-8 right-8">
        <div className="flex items-center gap-4">
          <p className={`text-[10px] font-mono tracking-[0.3em] ${subTextColor} uppercase`}>
            EST. 2026 // v0.1.0
          </p>
          <div className={`w-8 h-px ${borderColor}`} />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={`absolute bottom-0 left-0 w-full h-px ${borderColor}`}>
        <div
          className={`h-full ${inverted ? 'bg-background/40' : 'bg-foreground/40'} transition-all duration-300`}
          style={{ width: '15%' }}
        />
      </div>
    </div>
  );
}

const MasterExperience = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  // Base layer refs (for GSAP scroll animations)
  const heroTopRef = useRef<HTMLDivElement>(null);
  const heroMiddleRef = useRef<HTMLDivElement>(null);
  const heroBottomRef = useRef<HTMLDivElement>(null);

  // Reveal (inverted) layer refs — must animate in sync
  const heroTopRevealRef = useRef<HTMLDivElement>(null);
  const heroMiddleRevealRef = useRef<HTMLDivElement>(null);
  const heroBottomRevealRef = useRef<HTMLDivElement>(null);

  const modulesRef = useRef<HTMLDivElement>(null);
  const symbolRef = useRef<HTMLDivElement>(null);
  const revealLayerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [activeModule, setActiveModule] = useState<string | null>(null);

  const handleModuleHover = (moduleId: string | null) => {
    if (moduleId !== activeModule) {
      setActiveModule(moduleId);
    }
  };

  const handleModuleClick = (path: string) => {
    navigate(path);
  };

  /* ── Mask callback: update the reveal layer's CSS mask every frame ── */
  const handleMaskFrame = useCallback((dataUrl: string) => {
    const el = revealLayerRef.current;
    if (!el) return;
    el.style.maskImage = `url(${dataUrl})`;
    el.style.webkitMaskImage = `url(${dataUrl})`;
    el.style.maskSize = '100% 100%';
    (el.style as any).webkitMaskSize = '100% 100%';
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Ultra-smooth cinematic scroll — cappen.com style
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 4, // Very high scrub = buttery smooth transitions
        },
      });

      const baseTexts = [heroTopRef.current, heroMiddleRef.current, heroBottomRef.current];
      const revealTexts = [heroTopRevealRef.current, heroMiddleRevealRef.current, heroBottomRevealRef.current];

      // Phase 1: Gentle background color transition (0% -> 15%)
      tl.to(
        stickyRef.current,
        {
          backgroundColor: '#000000',
          duration: 0.15,
          ease: 'none', // Linear for smooth scrub
        },
        0.0
      );

      // Phase 2: Text departure — staggered parallax with smooth ease
      // TRUST floats up first
      tl.to(
        [heroTopRef.current, heroTopRevealRef.current],
        {
          y: '-100vh',
          opacity: 0,
          duration: 0.35,
          ease: 'power2.in',
        },
        0.03
      );

      // CENTRIC follows
      tl.to(
        [heroMiddleRef.current, heroMiddleRevealRef.current],
        {
          y: '-60vh',
          opacity: 0,
          duration: 0.32,
          ease: 'power2.in',
        },
        0.06
      );

      // EXCHANGE drifts down
      tl.to(
        [heroBottomRef.current, heroBottomRevealRef.current],
        {
          y: '80vh',
          opacity: 0,
          duration: 0.35,
          ease: 'power2.in',
        },
        0.04
      );

      // Phase 3: Portal expansion — cinematic reveal
      tl.to(
        portalRef.current,
        {
          width: '100vw',
          height: '100vh',
          duration: 0.50,
          ease: 'power4.inOut',
        },
        0.08
      );

      // Symbol scales up gently
      tl.to(
        symbolRef.current,
        {
          scale: 2.0,
          duration: 0.55,
          ease: 'power4.inOut',
        },
        0.08
      );

      // Phase 4: Modules reveal — gradual, elegant fade in
      tl.to(
        modulesRef.current,
        {
          opacity: 1,
          pointerEvents: 'auto',
          duration: 0.30,
          ease: 'power3.out',
        },
        0.38
      );

      const moduleItems = modulesRef.current?.querySelectorAll('.module-item');
      if (moduleItems) {
        tl.fromTo(
          moduleItems,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.28,
            stagger: 0.02,
            ease: 'power3.out',
          },
          0.42
        );
      }

      // Phase 5: Symbol fades out — slow cinematic dissolve
      tl.to(
        symbolRef.current,
        {
          opacity: 0,
          scale: 1.6,
          filter: 'blur(8px)',
          duration: 0.35,
          ease: 'power4.inOut',
        },
        0.55
      );
    }, containerRef);

    document.body.classList.add('hide-global-cursor');

    return () => {
      ctx.revert();
      document.body.classList.remove('hide-global-cursor');
    };
  }, []);

  return (
    <div ref={containerRef} className="h-[500vh] bg-background">
      {/* Sticky Viewport */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center"
      >
        {/* ============================================
            LAYER 1 — BASE: White bg + Black text
            Always visible, sits at the bottom.
            Includes duplicated nav elements (BErozgar
            logo + Menu) so splash works on them.
            ============================================ */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <HeroContent
            heroTopRef={heroTopRef}
            heroMiddleRef={heroMiddleRef}
            heroBottomRef={heroBottomRef}
            inverted={false}
          />
        </div>

        {/* ============================================
            WebGL Fluid Splash Mask (INVISIBLE)
            Full Navier-Stokes fluid sim on a hidden
            canvas. Renders white luminance mask,
            exports via readPixels + toDataURL every
            frame for CSS mask-image on reveal layer.
            ============================================ */}
        <FluidMaskCursor
          onMaskFrame={handleMaskFrame}
        />

        {/* ============================================
            LAYER 2 — REVEAL: Black bg + White text
            CSS-masked by the WebGL canvas luminance.
            Only visible inside the fluid splash shape.
            Includes duplicated nav elements.
            ============================================ */}
        <div
          ref={revealLayerRef}
          className="absolute inset-0 z-[14] pointer-events-none"
          style={{
            maskImage: 'none',
            WebkitMaskImage: 'none',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat' as any,
          }}
        >
          {/* Full-screen black fill — becomes the splash background */}
          <div className="absolute inset-0 bg-foreground" />
          {/* Inverted hero content on top */}
          <HeroContent
            heroTopRef={heroTopRevealRef}
            heroMiddleRef={heroMiddleRevealRef}
            heroBottomRef={heroBottomRevealRef}
            inverted={true}
          />
        </div>

        {/* Z-20: The Portal — auto-centered via inset+margin */}
        <div
          ref={portalRef}
          className="absolute z-20 bg-portal will-change-[width,height] overflow-hidden flex items-center justify-center"
          style={{
            width: 'clamp(120px, 16vw, 220px)',
            height: 'clamp(100px, 13vw, 180px)',
            inset: '0',
            margin: 'auto',
          }}
        >
          {/* Symbol - centered via flexbox, transform-origin center */}
          <div
            ref={symbolRef}
            className="flex items-center justify-center flex-shrink-0 will-change-transform"
            style={{
              width: 'clamp(100px, 14vw, 180px)',
              height: 'clamp(100px, 14vw, 180px)',
              transformOrigin: 'center center',
            }}
          >
            <Suspense fallback={
              <div className="relative w-full h-full animate-spin-slow">
                <div className="absolute inset-0 border-2 border-portal-foreground/40 rotate-45" />
                <div className="absolute inset-2 border border-portal-foreground/25 rotate-12 animate-pulse" />
                <div className="absolute inset-4 bg-portal-foreground/15 rotate-45" />
              </div>
            }>
              <Portal3D className="w-full h-full" />
            </Suspense>
          </div>
        </div>

        {/* Z-30: Modules Content Layer */}
        <div
          ref={modulesRef}
          className="absolute inset-0 z-30 flex opacity-0 will-change-[opacity,transform] bg-portal"
          style={{ pointerEvents: 'none' }}
        >
          <div className="w-full h-full flex flex-row items-stretch">
            {/* ─── Left Column: Module List (~60%) ─── */}
            <div className="w-full lg:w-[62%] h-full flex flex-col justify-center px-8 md:px-12 lg:px-16">
              {/* Header */}
              <div className="module-item mb-10 border-l-2 border-primary pl-6">
                <p className="text-primary text-[10px] font-mono uppercase tracking-[0.4em] mb-2">
                  SYS_CORE_MODULES // FIXED_REVEAL
                </p>
              </div>

              {/* Module nav list */}
              <nav className="flex flex-col gap-0">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    className="module-item group relative cursor-pointer"
                    onMouseEnter={() => handleModuleHover(module.id)}
                    onMouseLeave={() => handleModuleHover(null)}
                    onClick={() => handleModuleClick(module.path)}
                  >
                    <div className="flex items-center gap-6 md:gap-8 py-6 md:py-8 px-4 group-hover:bg-white/[0.03] transition-all duration-300">
                      {/* Number */}
                      <span className={`font-mono text-lg md:text-xl transition-all duration-400 shrink-0 w-10 ${activeModule === module.id ? 'text-[#a3ff12] opacity-100' : 'text-portal-foreground/20'}`}>
                        {module.number}
                      </span>

                      {/* Title + Subtitle */}
                      <div className="flex-1">
                        <h3 className={`text-module-title transition-all duration-400 will-change-transform ${activeModule === module.id ? 'text-[#a3ff12]' : 'text-portal-foreground'}`}>
                          {module.title}
                        </h3>
                        <p className={`text-[10px] md:text-xs font-mono tracking-[0.3em] uppercase mt-2 transition-all duration-400 ${activeModule === module.id ? 'text-white/50' : 'text-white/10'}`}>
                          {module.subtitle}
                        </p>
                      </div>

                      {/* Arrow */}
                      <span className={`text-[#a3ff12] font-mono text-3xl md:text-4xl transition-all duration-300 shrink-0 ${activeModule === module.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>
                        →
                      </span>
                    </div>

                    {/* Divider */}
                    <div className={`h-px w-full transition-all duration-500 ${activeModule === module.id ? 'bg-[#a3ff12]/30' : 'bg-white/5'}`} />
                  </div>
                ))}
              </nav>
            </div>

            {/* ─── Right Column: Preview Image (~38%) ─── */}
            <div className="hidden lg:flex w-[38%] h-full items-center justify-center p-6 lg:p-10">
              <div className="relative w-full max-w-lg aspect-[4/3]">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    className={`absolute inset-0 transition-all duration-500 ${activeModule === module.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                  >
                    <div className="hud-image-box w-full h-full rounded-none">
                      <img
                        src={module.preview}
                        alt={module.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
                    </div>
                    {/* Label below image */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[#a3ff12] font-mono text-[10px] tracking-wider">[{module.number}]</span>
                      <span className="text-white/40 font-mono text-[10px] tracking-widest uppercase">{module.title}</span>
                    </div>
                  </div>
                ))}

                {/* Placeholder when nothing hovered */}
                <div className={`absolute inset-0 border border-dashed border-white/10 flex items-center justify-center transition-opacity duration-300 ${activeModule ? 'opacity-0' : 'opacity-100'}`}>
                  <p className="text-white/10 font-mono text-[10px] tracking-widest uppercase">
                    Hover a module
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterExperience;
