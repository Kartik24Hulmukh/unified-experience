import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Module preview images
import resalePreview from '@/assets/resale-preview.jpg';
import resaleTech from '@/assets/resale-tech.jpg';
import housingPreview from '@/assets/housing-preview.jpg';
import housingHandover from '@/assets/housing-handover.jpg';
import essentialsPreview from '@/assets/essentials-preview.jpg';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
import academicsPreview from '@/assets/academics-preview.jpg';

// Lazy load 3D component
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

const MasterExperience = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const heroTopRef = useRef<HTMLDivElement>(null);
  const heroBottomRef = useRef<HTMLDivElement>(null);
  const modulesRef = useRef<HTMLDivElement>(null);
  const symbolRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState(0);

  // Handle module hover
  const handleModuleHover = (moduleId: string | null) => {
    if (moduleId !== activeModule) {
      setActiveModule(moduleId);
      setImageKey(prev => prev + 1); // Trigger glitch animation
    }
  };

  // Handle module click - navigate to page
  const handleModuleClick = (path: string) => {
    navigate(path);
  };

  // Get current preview image
  const currentPreview = modules.find(m => m.id === activeModule)?.preview || null;

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Main timeline for the unified scroll experience
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        },
      });

      // =====================================================
      // Phase 1: White Room (0% -> 5%)
      // State: White screen, small black portal centered,
      // "TRUST/EXCHANGE" visible, modules hidden
      // No animation needed - this is the initial state
      // =====================================================

      // =====================================================
      // Phase 2: The Swallow (5% -> 25%)
      // Text flies away with glitch, portal expands to fullscreen
      // =====================================================

      // "TRUST" flies Up-Left with clip-path glitch
      tl.to(
        heroTopRef.current,
        {
          y: '-150vh',
          x: '-20vw',
          opacity: 0,
          clipPath: 'inset(0 0 0 100%)',
          duration: 0.20, // 5% to 25% = 20% of timeline
          ease: 'power3.inOut',
        },
        0.05 // Start at 5%
      )
        // "EXCHANGE" flies Down-Right with clip-path glitch
        .to(
          heroBottomRef.current,
          {
            y: '150vh',
            x: '20vw',
            opacity: 0,
            clipPath: 'inset(0 100% 0 0)',
            duration: 0.20,
            ease: 'power3.inOut',
          },
          0.05
        )
        // Portal expands to full screen - CRITICAL for eliminating white gap
        .to(
          portalRef.current,
          {
            width: '100vw',
            height: '100vh',
            borderRadius: '0px',
            duration: 0.20,
            ease: 'power2.inOut',
          },
          0.05
        )
        // 3D Symbol scales slightly during portal expansion (1.0 -> 1.2)
        .to(
          symbolRef.current,
          {
            scale: 1.2,
            duration: 0.20,
            ease: 'power2.out',
          },
          0.05
        );

      // =====================================================
      // Phase 3: The Arrival (25% -> 60%)
      // Screen is black, modules fade in with staggered slide-up
      // =====================================================

      // Modules container becomes visible
      tl.to(
        modulesRef.current,
        {
          opacity: 1,
          pointerEvents: 'auto',
          duration: 0.10,
          ease: 'power2.out',
        },
        0.25 // Start at 25%
      );

      // Staggered module items slide up from y:100 to y:0
      const moduleItems = modulesRef.current?.querySelectorAll('.module-item');
      if (moduleItems) {
        tl.fromTo(
          moduleItems,
          {
            y: 100,
            opacity: 0,
          },
          {
            y: 0,
            opacity: 1,
            duration: 0.30, // 25% to 55% for staggered animation
            stagger: 0.05,
            ease: 'power3.out',
          },
          0.28 // Slight delay after container fades in
        );
      }

      // =====================================================
      // Phase 4: The Departure (60% -> 90%)
      // 3D Symbol fades out, modules remain visible on black
      // =====================================================

      tl.to(
        symbolRef.current,
        {
          opacity: 0,
          scale: 0.8,
          duration: 0.30, // 60% to 90% = 30% of timeline
          ease: 'power2.inOut',
        },
        0.60 // Start at 60%
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="h-[500vh] bg-background">
      {/* Sticky Viewport - Everything happens inside here */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center"
      >
        {/* Z-10: Hero Text Layer */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          {/* Top word - TRUST */}
          <div
            ref={heroTopRef}
            className="text-hero-massive text-foreground select-none will-change-transform"
            style={{ clipPath: 'inset(0 0 0 0)' }}
          >
            TRUST
          </div>

          {/* Bottom word - EXCHANGE */}
          <div
            ref={heroBottomRef}
            className="text-hero-massive text-foreground select-none will-change-transform"
            style={{ clipPath: 'inset(0 0 0 0)' }}
          >
            EXCHANGE
          </div>
        </div>

        {/* Z-20: The Portal (Black Background) */}
        <div
          ref={portalRef}
          className="absolute z-20 bg-portal will-change-[width,height,border-radius] flex items-center justify-center"
          style={{
            width: '350px',
            height: '400px',
            borderRadius: '8px',
          }}
        >
          {/* 3D Symbol inside portal */}
          <div
            ref={symbolRef}
            className="flex items-center justify-center w-full h-full"
            style={{ transform: 'scale(1)' }}
          >
            <Suspense fallback={
              <div className="relative w-24 h-24 md:w-32 md:h-32 animate-spin-slow">
                <div className="absolute inset-0 border-2 border-portal-foreground/40 rotate-45" />
                <div className="absolute inset-2 border border-portal-foreground/25 rotate-12 animate-pulse" />
                <div className="absolute inset-4 bg-portal-foreground/15 rotate-45" />
              </div>
            }>
              <Portal3D className="w-32 h-32 md:w-48 md:h-48" />
            </Suspense>
          </div>
        </div>

        {/* Z-30: Modules Content Layer */}
        <div
          ref={modulesRef}
          className="absolute inset-0 z-30 flex opacity-0 will-change-[opacity,transform]"
          style={{ pointerEvents: 'none' }}
        >
          {/* Unified Column: Module List with HUD Preview */}
          <div className="w-full h-full flex flex-col justify-center px-8 md:px-32">
            <div className="module-item mb-12 border-l-2 border-primary pl-6">
              <p className="text-primary text-[10px] font-mono uppercase tracking-[0.4em] mb-2">
                SYS_CORE_MODULES // DIRECTION_@1_NOIR
              </p>
              <h2 className="text-portal-foreground text-4xl md:text-5xl font-display font-bold italic-syne">
                COMMAND CENTER
              </h2>
            </div>

            <nav className="flex flex-col gap-0">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="module-item group relative cursor-pointer py-2 md:py-1"
                  onMouseEnter={() => handleModuleHover(module.id)}
                  onMouseLeave={() => handleModuleHover(null)}
                  onClick={() => handleModuleClick(module.path)}
                >
                  <div className="flex items-center justify-between group-hover:bg-white/5 px-4 transition-all duration-300">
                    <div className="flex items-baseline gap-12">
                      <span className={`font-mono text-xl md:text-2xl transition-all duration-500 ${activeModule === module.id ? 'text-[#a3ff12] opacity-100' : 'text-portal-foreground/20'}`}>
                        {module.number}
                      </span>

                      <div className="relative">
                        <h3 className={`text-hero-massive text-[4rem] md:text-[8rem] transition-all duration-500 will-change-transform leading-[0.85] ${activeModule === module.id ? 'text-[#a3ff12]' : 'text-portal-foreground'
                          }`}>
                          {module.title}
                        </h3>

                        {/* HOVER HUD BOX - Positioned Right of text */}
                        {activeModule === module.id && (
                          <div className="absolute top-1/2 left-[105%] -translate-y-1/2 flex items-center gap-6 z-50 pointer-events-none">
                            {/* Blinking Arrow */}
                            <div className="flex items-center gap-2">
                              <span className="text-[#a3ff12] font-mono text-4xl animate-blink-arrow">→</span>
                            </div>

                            {/* HUD Image Box */}
                            <div className="hud-image-box w-64 md:w-80 aspect-video scale-in-hor-left">
                              <img
                                key={imageKey}
                                src={module.preview}
                                alt=""
                                className="w-full h-full object-cover animate-glitch scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute bottom-2 left-3">
                                <p className="text-[9px] text-white/40 font-mono tracking-widest uppercase">Entity Preview: {module.id}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden xl:block">
                      <p className={`text-[10px] font-bold tracking-[0.3em] uppercase transition-all duration-500 ${activeModule === module.id ? 'text-white' : 'text-white/10'
                        }`}>
                        {module.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Subtle separator line */}
                  <div className={`h-px w-full transition-all duration-700 ${activeModule === module.id ? 'bg-[#a3ff12]/30 scale-x-100' : 'bg-white/5 scale-x-90'
                    }`} />
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Corner branding */}
        <div className="absolute top-8 left-8 z-40">
          <p className="text-sm font-display tracking-widest text-foreground/60">
            MCTRGIT
          </p>
        </div>

        <div className="absolute top-8 right-8 z-40">
          <p className="text-sm font-body text-foreground/40">
            Trust-Centric Platform
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-foreground/40 uppercase tracking-widest">
              Scroll
            </p>
            <div className="w-px h-12 bg-foreground/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-4 bg-foreground/60 animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterExperience;
