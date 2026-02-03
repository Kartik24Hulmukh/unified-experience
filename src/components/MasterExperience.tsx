import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Module preview images
import resalePreview from '@/assets/resale-preview.jpg';
import housingPreview from '@/assets/housing-preview.jpg';
import essentialsPreview from '@/assets/essentials-preview.jpg';
import academicsPreview from '@/assets/academics-preview.jpg';

gsap.registerPlugin(ScrollTrigger);

interface Module {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  preview: string;
}

const modules: Module[] = [
  {
    id: 'resale',
    number: '01',
    title: 'RESALE',
    subtitle: 'Resource Exchange',
    preview: resalePreview,
  },
  {
    id: 'accommodation',
    number: '02',
    title: 'ACCOMMODATION',
    subtitle: 'Housing Discovery',
    preview: housingPreview,
  },
  {
    id: 'essentials',
    number: '03',
    title: 'ESSENTIALS',
    subtitle: 'Food & Health',
    preview: essentialsPreview,
  },
  {
    id: 'academics',
    number: '04',
    title: 'ACADEMICS',
    subtitle: 'Syllabus & Notes',
    preview: academicsPreview,
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

  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState(0);

  // Handle module hover
  const handleModuleHover = (moduleId: string | null) => {
    if (moduleId !== activeModule) {
      setActiveModule(moduleId);
      setImageKey(prev => prev + 1); // Trigger glitch animation
    }
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
          // markers: true, // Uncomment for debugging
        },
      });

      // Phase 1: The Swallow (0% -> 25%)
      // Hero text splits up/down, Portal expands
      tl.to(
        heroTopRef.current,
        {
          y: '-120vh',
          opacity: 0,
          duration: 0.25,
          ease: 'power2.inOut',
        },
        0
      )
        .to(
          heroBottomRef.current,
          {
            y: '120vh',
            opacity: 0,
            duration: 0.25,
            ease: 'power2.inOut',
          },
          0
        )
        .to(
          portalRef.current,
          {
            width: '100vw',
            height: '100vh',
            borderRadius: '0px',
            duration: 0.25,
            ease: 'power2.inOut',
          },
          0
        );

      // Phase 2: The Arrival (25% -> 60%)
      // Modules fade in and slide up
      tl.to(
        modulesRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: 'power2.out',
        },
        0.25
      );

      // Phase 3: The Departure (60% -> 90%)
      // Symbol fades out
      tl.to(
        symbolRef.current,
        {
          opacity: 0,
          scale: 0.8,
          duration: 0.3,
          ease: 'power2.inOut',
        },
        0.6
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
          >
            TRUST
          </div>

          {/* Bottom word - EXCHANGE */}
          <div
            ref={heroBottomRef}
            className="text-hero-massive text-foreground select-none will-change-transform"
          >
            EXCHANGE
          </div>
        </div>

        {/* Z-20: The Portal (Black Background) */}
        <div
          ref={portalRef}
          className="absolute z-20 bg-portal rounded-full will-change-[width,height,border-radius] flex items-center justify-center"
          style={{
            width: '350px',
            height: '350px',
          }}
        >
          {/* 3D Symbol inside portal */}
          <div
            ref={symbolRef}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="relative w-24 h-24 md:w-32 md:h-32">
              {/* Geometric trust symbol */}
              <div className="absolute inset-0 border-2 border-portal-foreground/30 rotate-45 animate-pulse" />
              <div className="absolute inset-2 border border-portal-foreground/20 rotate-12" />
              <div className="absolute inset-4 bg-portal-foreground/10 rotate-45" />
            </div>
          </div>
        </div>

        {/* Z-30: Modules Content Layer */}
        <div
          ref={modulesRef}
          className="absolute inset-0 z-30 flex opacity-0 translate-y-20 will-change-[opacity,transform]"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Left Column: Module List (40%) */}
          <div className="w-full md:w-2/5 h-full flex flex-col justify-center px-8 md:px-16">
            <div className="mb-8">
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
                  className="group cursor-pointer"
                  onMouseEnter={() => handleModuleHover(module.id)}
                  onMouseLeave={() => handleModuleHover(null)}
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
