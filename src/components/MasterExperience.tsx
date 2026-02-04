import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Module preview images
import resalePreview from '@/assets/resale-preview.jpg';
import housingPreview from '@/assets/housing-preview.jpg';
import essentialsPreview from '@/assets/essentials-preview.jpg';
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
    title: 'RESALE',
    subtitle: 'Resource Exchange',
    preview: resalePreview,
    path: '/resale',
  },
  {
    id: 'accommodation',
    number: '02',
    title: 'ACCOMMODATION',
    subtitle: 'Housing Discovery',
    preview: housingPreview,
    path: '/accommodation',
  },
  {
    id: 'essentials',
    number: '03',
    title: 'ESSENTIALS',
    subtitle: 'Food & Health',
    preview: essentialsPreview,
    path: '/essentials',
  },
  {
    id: 'academics',
    number: '04',
    title: 'ACADEMICS',
    subtitle: 'Syllabus & Notes',
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
          {/* Left Column: Module List (40%) */}
          <div className="w-full md:w-2/5 h-full flex flex-col justify-center px-8 md:px-16">
            <div className="module-item mb-8">
              <p className="text-portal-foreground/60 text-sm uppercase tracking-widest mb-2">
                Platform Modules
              </p>
              <h2 className="text-portal-foreground text-2xl md:text-3xl font-display font-bold">
                BErozgar
              </h2>
            </div>

            <nav className="space-y-6 md:space-y-8">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="module-item group cursor-pointer"
                  onMouseEnter={() => handleModuleHover(module.id)}
                  onMouseLeave={() => handleModuleHover(null)}
                  onClick={() => handleModuleClick(module.path)}
                >
                  <div className="flex items-baseline gap-4">
                    <span className="module-number text-portal-foreground/40">
                      {module.number}
                    </span>
                    <div>
                      <h3 className="text-module-title text-portal-foreground module-link transition-smooth">
                        {module.title}
                      </h3>
                      <p className="text-portal-foreground/50 text-sm mt-1 font-body">
                        {module.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </nav>

            {/* CTA */}
            <div className="mt-12">
              <button className="px-8 py-4 border border-portal-foreground/30 text-portal-foreground hover:bg-portal-foreground hover:text-portal transition-all duration-300 font-display uppercase tracking-wider text-sm">
                Explore Platform
              </button>
            </div>
          </div>

          {/* Right Column: Preview Stage (60%) */}
          <div className="hidden md:flex w-3/5 h-full items-center justify-center relative">
            {/* Fixed position image container */}
            <div className="relative w-4/5 h-3/5 overflow-hidden">
              {currentPreview && (
                <img
                  key={imageKey}
                  src={currentPreview}
                  alt="Module preview"
                  className="absolute inset-0 w-full h-full object-cover animate-glitch"
                  style={{
                    clipPath: 'inset(0 0 0 0)',
                  }}
                />
              )}

              {/* Placeholder when no module is hovered */}
              {!currentPreview && (
                <div className="absolute inset-0 flex items-center justify-center border border-portal-foreground/10">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border border-portal-foreground/20 rounded-full flex items-center justify-center">
                      <div className="w-8 h-8 border border-portal-foreground/30 rotate-45" />
                    </div>
                    <p className="text-portal-foreground/30 text-sm uppercase tracking-widest">
                      Hover to Preview
                    </p>
                  </div>
                </div>
              )}

              {/* Scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  background:
                    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
                }}
              />
            </div>
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
