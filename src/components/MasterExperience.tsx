import { useRef, useState, useCallback, lazy, Suspense, memo } from 'react';
import { useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { safeNavigate } from '@/lib/utils';
import { CappenSplashReveal } from './CappenSplashReveal';

// Module preview images
import resaleTech from '@/assets/resale-tech.jpg';
import housingHandover from '@/assets/housing-handover.jpg';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
const academicsPreview = '/Academics.jpg';

const Portal3D = lazy(() => import('@/components/Portal3D'));

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
  const handleModuleHover = (moduleId: string | null) => { if (moduleId !== activeModule) setActiveModule(moduleId); };

  return (
    <div className="w-full h-full flex flex-row items-stretch">
      <div className="w-full lg:w-[62%] h-full flex flex-col justify-center">
        <div className="max-w-[900px] w-full px-12 md:px-20 lg:px-24">
          <div className="module-item mb-6 border-l-2 border-[#a3ff12] pl-6 opacity-60">
            <p className="text-[#a3ff12] text-[10px] font-mono uppercase tracking-[0.4em] mb-1">CORE_SYST_V_01 // SECURE_LINK</p>
          </div>
          <nav className="flex flex-col gap-1 md:gap-2">
            {modules.map((module) => (
              <div key={module.id} className="module-item group relative cursor-pointer" role="button" tabIndex={0} onMouseEnter={() => handleModuleHover(module.id)} onMouseLeave={() => handleModuleHover(null)} onClick={() => onModuleClick(module.path)}>
                <div className="flex items-center gap-6 md:gap-8 py-4 md:py-6 px-4 md:px-6 group-hover:bg-white/[0.04] transition-all duration-500">
                  <span className={`font-mono text-base md:text-lg transition-all duration-500 shrink-0 w-8 ${activeModule === module.id ? 'text-[#a3ff12] opacity-100' : 'text-portal-foreground/15'}`}>{module.number}</span>
                  <div className="flex-1">
                    <h3 className={`text-4xl md:text-5xl lg:text-7xl font-display font-bold uppercase transition-all duration-500 leading-[0.8] tracking-[-0.05em] translate-z-0 will-change-transform ${activeModule === module.id ? 'text-[#a3ff12] scale-[1.01] translate-x-3' : 'text-portal-foreground opacity-80'}`}>{module.title}</h3>
                    <p className={`text-[10px] md:text-[11px] font-mono tracking-[0.4em] uppercase mt-2 transition-all duration-500 ${activeModule === module.id ? 'text-white/50' : 'text-white/5'}`}>{module.subtitle}</p>
                  </div>
                  <span className={`text-[#a3ff12] font-mono text-2xl md:text-3xl transition-all duration-400 shrink-0 ${activeModule === module.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}>→</span>
                </div>
                <div className={`h-px w-full transition-all duration-500 ${activeModule === module.id ? 'bg-[#a3ff12]/30' : 'bg-white/5'}`} />
              </div>
            ))}
          </nav>
        </div>
      </div>
      <div className="hidden lg:flex w-[38%] h-full items-center justify-center p-6 lg:p-14">
        <div className="relative w-full max-w-md aspect-square">
          {modules.map((module) => activeModule === module.id && (
            <div key={module.id} className="absolute inset-0 transition-all duration-500 opacity-100 scale-100">
              <div className="hud-image-box w-full h-full rounded-none overflow-hidden">
                <img src={module.preview} alt={module.title} className="w-full h-full object-cover grayscale-[0.2]" loading="lazy" />
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

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const timer = setTimeout(() => setIsHeavyMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleModuleClick = useCallback((path: string) => safeNavigate(navigate, location.pathname, path, { replace: false }), [navigate, location.pathname]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom bottom', scrub: 1, onUpdate: (self) => { scrollProgressRef.current = self.progress; } } });

      tl.fromTo(stickyRef.current, { backgroundColor: '#ffffff' }, { backgroundColor: '#050505', duration: 0.8 }, 0);

      // Fade out the entire hero logic
      tl.to(heroContainerRef.current, { y: '-10vh', scale: 0.8, opacity: 0, duration: 1, ease: 'power3.inOut' }, 0);

      tl.fromTo(portalRef.current, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: 1.5, ease: 'expo.inOut' }, 0.2);

      tl.fromTo(symbolRef.current, { scale: 0.2, opacity: 0, rotateZ: -15 }, { scale: 5, z: 120, opacity: 1, rotateZ: 0, duration: 1.4, ease: 'expo.inOut' }, 0.2);
      tl.to(symbolRef.current, { opacity: 0, scale: 12, duration: 0.5, ease: 'power2.in' }, 0.9);

      tl.to(modulesRef.current, { opacity: 1, pointerEvents: 'auto', duration: 0.4 }, 0.6);
      const items = modulesRef.current?.querySelectorAll('.module-item');
      if (items) tl.fromTo(items, { y: 40, opacity: 0, rotateX: 10 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.8, stagger: 0.08, ease: 'power4.out' }, 0.7);

      tl.add(() => ScrollTrigger.refresh(), 1.0);
    });
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="h-[250vh] bg-white">
      <div ref={stickyRef} className="sticky top-0 h-screen w-full overflow-hidden bg-white">

        <div ref={baseLayerRef} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto">
          <div ref={heroContainerRef} className="w-full h-full">
            <CappenSplashReveal texts={['TRUST', 'CENTRIC', 'EXCHANGE']} />
          </div>
        </div>

        <div ref={portalRef} className="absolute inset-0 z-30 bg-portal flex items-center justify-center pointer-events-none" style={{ clipPath: 'circle(0% at 50% 50%)' }}>
          <div ref={symbolRef} className="will-change-transform -mt-[10vh]" style={{ width: '160px', height: '160px', transformStyle: 'preserve-3d' }}>
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
