import { useRef, useEffect, useLayoutEffect, useState, useCallback, lazy, Suspense, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { safeNavigate } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import FluidMaskCursor from '@/components/FluidMaskCursor';

// Module preview images
import resaleTech from '@/assets/resale-tech.jpg';
import housingHandover from '@/assets/housing-handover.jpg';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
const academicsPreview = '/Academics.jpg';

// Components
const Portal3D = lazy(() => import('@/components/Portal3D'));

// ScrollTrigger registered in lib/gsap-init.ts

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
  {
    id: 'mess',
    number: '05',
    title: 'MESS & TIFFIN',
    subtitle: 'FOOD SERVICES DIRECTORY',
    preview: essentialsTiffin,
    path: '/mess',
  },
  {
    id: 'hospital',
    number: '06',
    title: 'HEALTHCARE',
    subtitle: 'MEDICAL SERVICES NEARBY',
    preview: housingHandover,
    path: '/hospital',
  },
];

/* ── Extracted module nav: hover state stays local, avoids full MasterExperience re-render ── */
const ModuleNavPanel = memo(function ModuleNavPanel({
  modules,
  onModuleClick,
}: {
  modules: Module[];
  onModuleClick: (path: string) => void;
}) {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  const handleModuleHover = (moduleId: string | null) => {
    if (moduleId !== activeModule) {
      setActiveModule(moduleId);
    }
  };

  return (
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
              role="button"
              tabIndex={0}
              aria-label={`Navigate to ${module.title}`}
              onMouseEnter={() => handleModuleHover(module.id)}
              onMouseLeave={() => handleModuleHover(null)}
              onClick={() => onModuleClick(module.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onModuleClick(module.path);
                }
              }}
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
                  loading="lazy"
                  width={400}
                  height={300}
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
  );
});

/* ───────────────────────────────────────────────────
   Hover-Reveal Fluid Splash — Stacked Text Architecture

   Two identical text layers stacked perfectly:
   ┌──────────────────────────────────────────────┐
   │  Layer 1 — REVEAL (z-10)                     │
   │  Black bg + Cyan/teal text + nav mirrors     │
   │  Hidden underneath, exposed by fluid mask    │
   ├──────────────────────────────────────────────┤
   │  Layer 2 — BASE (z-20, mask-image)            │
   │  White bg + Black text + nav mirrors          │
   │  CSS mask-image erases where fluid flows,     │
   │  revealing the dark layer beneath.            │
   ├──────────────────────────────────────────────┤
   │  FluidMaskCursor (hidden 256×256 canvas)      │
   │  Navier-Stokes sim → toDataURL → mask-image  │
   └──────────────────────────────────────────────┘
   On hover, fluid trails follow the cursor with inertia,
   creating soft, deforming, morphing edges that gently
   reveal the dark layer’s cyan text through the white cover.
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
  // Use explicit colors instead of CSS variables to ensure visibility
  const textColor = inverted ? 'text-[#00BFFF]' : 'text-black';
  const subTextColor = inverted ? 'text-[#00BFFF]/40' : 'text-black/30';
  const subTextAccent = inverted ? 'text-[#00BFFF]' : 'text-black';
  const borderColor = inverted ? 'bg-[#00BFFF]/20' : 'bg-black/20';
  const fgClass = inverted ? 'border-[#00BFFF]' : 'border-black';
  const fgBg = inverted ? 'bg-[#00BFFF]' : 'bg-black';

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

  // Base layer refs (for GSAP scroll animations — on the white/black text layer)
  const heroTopRef = useRef<HTMLDivElement>(null);
  const heroMiddleRef = useRef<HTMLDivElement>(null);
  const heroBottomRef = useRef<HTMLDivElement>(null);

  // Reveal layer refs (for GSAP scroll animations — on the black/cyan text layer)
  const heroTopRevealRef = useRef<HTMLDivElement>(null);
  const heroMiddleRevealRef = useRef<HTMLDivElement>(null);
  const heroBottomRevealRef = useRef<HTMLDivElement>(null);

  // Base layer ref for applying the fluid mask
  const baseLayerRef = useRef<HTMLDivElement>(null);

  const modulesRef = useRef<HTMLDivElement>(null);
  const symbolRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  const prefersReducedMotion = useReducedMotion();

  const [isHeavyMounted, setIsHeavyMounted] = useState(false);

  // Fluid mask URL — updated ~30fps by FluidMaskCursor
  const maskUrlRef = useRef<string>('');

  // Callback: receives the inverted luminance mask data URL from FluidMaskCursor
  // and applies it directly to the base layer's mask-image CSS property.
  // Uses ref + direct DOM mutation to avoid React re-renders at 30fps.
  const handleMaskFrame = useCallback((dataUrl: string) => {
    maskUrlRef.current = dataUrl;
    if (baseLayerRef.current) {
      baseLayerRef.current.style.maskImage = `url(${dataUrl})`;
      baseLayerRef.current.style.webkitMaskImage = `url(${dataUrl})`;
    }
  }, []);
  
  // Reset scroll position BEFORE paint to ensure GSAP starts at 0%
  // Must use useLayoutEffect to run before browser restores scroll
  useLayoutEffect(() => {
    // Disable browser scroll restoration to prevent mid-page load
    const prevScrollRestoration = history.scrollRestoration;
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    // Immediately scroll to top before GSAP initializes
    window.scrollTo(0, 0);
    
    // Set explicit initial states for portal (prevents "end state" flash)
    if (portalRef.current) {
      portalRef.current.style.width = 'clamp(120px, 16vw, 220px)';
      portalRef.current.style.height = 'clamp(100px, 13vw, 180px)';
    }
    if (stickyRef.current) {
      stickyRef.current.style.backgroundColor = '#ffffff';
    }
    
    // Delay ScrollTrigger refresh to next frame so DOM has settled
    const rafId = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => {
      cancelAnimationFrame(rafId);
      // Restore browser scroll restoration so other pages work correctly
      if ('scrollRestoration' in history) {
        history.scrollRestoration = prevScrollRestoration;
      }
    };
  }, []);

  useEffect(() => {
    // Delay heavy component mounting briefly to allow page transition curtain to start
    // New curtain transition is ~0.9s total — start WebGL at 300ms to overlap
    const timer = setTimeout(() => {
      setIsHeavyMounted(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleModuleClick = useCallback((path: string) => {
    safeNavigate(navigate, location.pathname, path, { replace: false });
  }, [navigate, location.pathname]);

  // useLayoutEffect for GSAP animations to prevent flash of unstyled content
  useLayoutEffect(() => {
    // Reduced-motion users still get scroll-driven navigation,
    // but with instant response (scrub: true) instead of smooth interpolation.
    // With Lenis providing smooth scroll input, a tighter scrub (0.8)
    // keeps the animation responsive while silky. Reduced-motion: instant.
    const scrubValue = prefersReducedMotion ? true : 0.8;
    
    const ctx = gsap.context(() => {
      // Ultra-smooth cinematic scroll — cappen.com style
      // Lenis normalizes raw wheel deltas into continuous interpolated values,
      // GSAP scrub smoothly maps those to the timeline position.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: scrubValue,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // Feed scroll progress to Portal3D for rotation acceleration
            scrollProgressRef.current = self.progress;
          },
        },
        defaults: { immediateRender: false },
      });

      // Phase 1: Background — slow elegant fade to black
      tl.fromTo(
        stickyRef.current,
        { backgroundColor: '#ffffff' },
        {
          backgroundColor: '#000000',
          duration: 0.18,
          ease: 'none',
        },
        0.0
      );

      // Phase 2: Text departure — dreamy parallax float
      // Cappen-style: elements drift away gently, never snap.
      // Short travel + long duration + expo ease = floating feeling.
      // Both base (white) and reveal (dark) layers must move in perfect sync
      // so the mask alignment stays pixel-perfect during scroll.
      tl.to(
        [heroTopRef.current, heroTopRevealRef.current],
        {
          y: '-25vh',
          opacity: 0,
          duration: 0.35,
          ease: 'power3.out',
        },
        0.02
      );

      tl.to(
        [heroMiddleRef.current, heroMiddleRevealRef.current],
        {
          y: '-18vh',
          opacity: 0,
          duration: 0.33,
          ease: 'power3.out',
        },
        0.04
      );

      tl.to(
        [heroBottomRef.current, heroBottomRevealRef.current],
        {
          y: '22vh',
          opacity: 0,
          duration: 0.35,
          ease: 'power3.out',
        },
        0.03
      );

      // Phase 3: Portal expansion — seamless overlap with text departure
      // Starts early while text is still floating away.
      // power3.inOut gives a smooth, luxurious S-curve.
      tl.fromTo(
        portalRef.current,
        {
          width: 'clamp(120px, 16vw, 220px)',
          height: 'clamp(100px, 13vw, 180px)',
        },
        {
          width: '100vw',
          height: '100vh',
          duration: 0.50,
          ease: 'power3.inOut',
        },
        0.08
      );

      // Phase 3b: Shield cinematic zoom — smooth depth illusion
      tl.fromTo(
        symbolRef.current,
        {
          scale: 1,
          rotateZ: 0,
          z: 0,
        },
        {
          scale: 4.5,
          rotateZ: -6,
          z: 60,
          duration: 0.48,
          ease: 'power3.inOut',
          transformPerspective: 1200,
        },
        0.08
      );

      // Phase 4: Modules reveal — gentle emergence
      tl.to(
        modulesRef.current,
        {
          opacity: 1,
          pointerEvents: 'auto',
          duration: 0.35,
          ease: 'power2.out',
        },
        0.36
      );

      const moduleItems = modulesRef.current?.querySelectorAll('.module-item');
      if (moduleItems) {
        tl.fromTo(
          moduleItems,
          { y: 10, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.28,
            stagger: 0.02,
            ease: 'power2.out',
          },
          0.40
        );
      }

      // Phase 5: Shield dissolve — smooth fade with continued momentum
      tl.to(
        symbolRef.current,
        {
          opacity: 0,
          scale: 7,
          rotateZ: -10,
          z: 150,
          duration: 0.22,
          ease: 'power2.in',
          transformPerspective: 1200,
        },
        0.44
      );
    }, containerRef);

    document.body.classList.add('hide-global-cursor');

    return () => {
      ctx.revert();
      document.body.classList.remove('hide-global-cursor');

      // Reset inline styles that GSAP `fromTo` leaves behind after ctx.revert().
      // Without this, toggling prefersReducedMotion mid-session or HMR leaves
      // elements stuck at their last GSAP-set values.
      if (stickyRef.current) stickyRef.current.style.backgroundColor = '#ffffff';
      if (portalRef.current) {
        portalRef.current.style.width = 'clamp(120px, 16vw, 220px)';
        portalRef.current.style.height = 'clamp(100px, 13vw, 180px)';
        portalRef.current.style.transform = 'translateZ(0)';
      }
      if (modulesRef.current) {
        modulesRef.current.style.opacity = '0';
        modulesRef.current.style.pointerEvents = 'none';
      }
      // Reset scroll progress so Portal3D rotation returns to base speed
      scrollProgressRef.current = 0;
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="h-[350vh]" style={{ backgroundColor: '#ffffff' }}>
      {/* Sticky Viewport */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* ============================================
            LAYER 1 — REVEAL: Black bg + Cyan text
            Hidden underneath the base layer.
            Exposed where the fluid mask erases the
            base layer above.
            ============================================ */}
        <div className="absolute inset-0 z-10 pointer-events-none bg-black" style={{ transform: 'translateZ(0)' }}>
          <HeroContent
            heroTopRef={heroTopRevealRef}
            heroMiddleRef={heroMiddleRevealRef}
            heroBottomRef={heroBottomRevealRef}
            inverted={true}
          />
        </div>

        {/* ============================================
            LAYER 2 — BASE: White bg + Black text
            Sits on top of the reveal layer. CSS
            mask-image (driven by the fluid sim)
            erases this layer where the cursor flows,
            revealing the cyan text beneath.
            mask-mode: luminance — white = visible,
            black = erased.
            ============================================ */}
        <div
          ref={baseLayerRef}
          className="absolute inset-0 z-20 pointer-events-none bg-white"
          style={{
            transform: 'translateZ(0)',
            maskSize: 'cover',
            WebkitMaskSize: 'cover',
            maskMode: 'luminance',
            // @ts-expect-error — webkit prefix needed for Safari
            WebkitMaskMode: 'luminance',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        >
          <HeroContent
            heroTopRef={heroTopRef}
            heroMiddleRef={heroMiddleRef}
            heroBottomRef={heroBottomRef}
            inverted={false}
          />
        </div>

        {/* ============================================
            FluidMaskCursor — Hidden 256×256 WebGL canvas
            Navier-Stokes fluid sim → inverted luminance
            → toDataURL('image/webp') at 30fps → feeds
            handleMaskFrame → applied as CSS mask-image
            on the base layer above.
            ============================================ */}
        <FluidMaskCursor
          onMaskFrame={handleMaskFrame}
          paused={!isHeavyMounted}
        />

        {/* Z-30: The Portal — auto-centered via inset+margin */}
        <div
          ref={portalRef}
          className="absolute z-30 bg-portal will-change-[width,height] overflow-hidden flex items-center justify-center"
          style={{
            width: 'clamp(120px, 16vw, 220px)',
            height: 'clamp(100px, 13vw, 180px)',
            inset: '0',
            margin: 'auto',
            transform: 'translateZ(0)',
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
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Mount guard: Portal3D only mounts after page transition completes
                to prevent GSAP + WebGL conflicts during navigation */}
            {isHeavyMounted ? (
              <Suspense
                fallback={
                  <div className="relative w-full h-full animate-spin-slow">
                    <div className="absolute inset-0 border-2 border-portal-foreground/40 rotate-45" />
                    <div className="absolute inset-2 border border-portal-foreground/25 rotate-12 animate-pulse" />
                    <div className="absolute inset-4 bg-portal-foreground/15 rotate-45" />
                  </div>
                }
              >
                <Portal3D scrollProgressRef={scrollProgressRef} />
              </Suspense>
            ) : (
              <div className="relative w-full h-full animate-spin-slow">
                <div className="absolute inset-0 border-2 border-portal-foreground/40 rotate-45" />
                <div className="absolute inset-2 border border-portal-foreground/25 rotate-12 animate-pulse" />
                <div className="absolute inset-4 bg-portal-foreground/15 rotate-45" />
              </div>
            )}
          </div>
        </div>

        {/* Z-40: Modules Content Layer */}
        <div
          ref={modulesRef}
          className="absolute inset-0 z-40 flex opacity-0 will-change-[opacity,transform] bg-portal"
          style={{ pointerEvents: 'none', transform: 'translateZ(0)' }}
        >
          <ModuleNavPanel modules={modules} onModuleClick={handleModuleClick} />
        </div>
      </div>
    </div>
  );
};

export default MasterExperience;
