import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '@/contexts/AuthContext';
import { safeNavigate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/lib/app-meta';

const Portal3D = lazy(() => import('@/components/Portal3D'));

/* ──────────────────────────────────────────────────
   BErozgar Landing / Splash Page
   
   Inspired by cappen.com — cinematic, typography-
   heavy entry with a loading sequence, oversized 
   type reveal, and a single CTA directing users 
   into the authenticated Campus OS.
   ────────────────────────────────────────────────── */

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const hasRedirected = useRef(false);
  const isMobile = useIsMobile();

  /* Refs */
  const containerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const line3Ref = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const portalContainerRef = useRef<HTMLDivElement>(null);
  const metaLeftRef = useRef<HTMLDivElement>(null);
  const metaRightRef = useRef<HTMLDivElement>(null);
  const navBrandRef = useRef<HTMLDivElement>(null);
  const navStatusRef = useRef<HTMLDivElement>(null);

  const [loadComplete, setLoadComplete] = useState(false);

  /* ── Auto-redirect authenticated users to /home ── */
  useEffect(() => {
    if (isAuthenticated && !authLoading && !hasRedirected.current) {
      hasRedirected.current = true;
      safeNavigate(navigate, location.pathname, '/home');
    }
  }, [isAuthenticated, authLoading, navigate, location.pathname]);

  /* ── Loading sequence ── */
  // useLayoutEffect for GSAP animations to prevent flash of unstyled content
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => setLoadComplete(true),
      });

      // Counter from 0 → 100 (shortened for better LCP)
      tl.to(
        { val: 0 },
        {
          val: 100,
          duration: 0.4,
          ease: 'power2.inOut',
          onUpdate: function () {
            if (counterRef.current) {
              counterRef.current.textContent = Math.round(this.targets()[0].val).toString();
            }
          },
        },
        0
      );

      // Progress bar fill
      tl.to(
        barRef.current,
        {
          scaleX: 1,
          duration: 0.4,
          ease: 'power2.inOut',
        },
        0
      );

      // Loader exit — slide up
      tl.to(loaderRef.current, {
        yPercent: -100,
        duration: 0.5,
        ease: 'power4.inOut',
        onComplete: () => {
          if (loaderRef.current) {
            loaderRef.current.style.display = 'none';
          }
        }
      });

      // CSS fallback: ensure all content is visible even if GSAP fails
      gsap.set(
        [navBrandRef.current, navStatusRef.current, line1Ref.current, line2Ref.current,
         line3Ref.current, taglineRef.current, ctaRef.current, portalContainerRef.current,
         metaLeftRef.current, metaRightRef.current],
        { opacity: 1 }
      );

      // Content reveal — stagger from bottom
      tl.fromTo(
        navBrandRef.current,
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' },
        '-=0.2'
      );

      tl.fromTo(
        navStatusRef.current,
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' },
        '-=0.3'
      );

      // Line 1: BUILDING
      tl.fromTo(
        line1Ref.current,
        { yPercent: 80, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power4.out' },
        '-=0.2'
      );

      // Line 2: CAMPUS
      tl.fromTo(
        line2Ref.current,
        { yPercent: 80, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power4.out' },
        '-=0.35'
      );

      // Line 3: TRUST
      tl.fromTo(
        line3Ref.current,
        { yPercent: 80, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power4.out' },
        '-=0.35'
      );

      // Portal logo
      tl.fromTo(
        portalContainerRef.current,
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' },
        '-=0.3'
      );

      // Tagline
      tl.fromTo(
        taglineRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' },
        '-=0.25'
      );

      // CTA
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' },
        '-=0.2'
      );

      // Meta corners
      tl.fromTo(
        [metaLeftRef.current, metaRightRef.current],
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' },
        '-=0.2'
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);



  /* ── CTA handler ── */
  const handleEnter = () => {
    if (hasRedirected.current) return; // Prevent navigation if already redirected

    if (isAuthenticated) {
      hasRedirected.current = true;
      safeNavigate(navigate, location.pathname, '/home', { replace: false });
    } else {
      safeNavigate(navigate, location.pathname, '/login', { replace: false });
    }
  };

  return (
    <div ref={containerRef} className="relative h-[100dvh] w-full overflow-hidden bg-[#050505] select-none">
      {/* ═══════════════════════════════════════════
          LOADER OVERLAY 
          ═══════════════════════════════════════════ */}
      <div
        ref={loaderRef}
        className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center"
      >
        {/* Counter */}
        <div className="flex items-baseline gap-1 mb-8">
          <span
            ref={counterRef}
            className="text-white font-display text-[5rem] md:text-[8rem] leading-none font-bold tracking-tighter"
          >
            0
          </span>
          <span className="text-white/30 font-display text-3xl md:text-4xl font-bold">%</span>
        </div>

        {/* Progress bar */}
        <div className="w-[min(80vw,400px)] h-px bg-white/10 relative overflow-hidden">
          <div
            ref={barRef}
            className="absolute inset-0 bg-white/60 origin-left"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>

        {/* Loading label */}
        <p className="mt-6 text-white/20 text-[10px] uppercase tracking-[0.5em] font-body">
          Initializing Campus OS
        </p>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT (revealed after loader)
          ═══════════════════════════════════════════ */}
      <div ref={contentRef} className="relative h-full w-full flex flex-col">
        {/* ── Top Nav Bar ── */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 md:px-12 py-6 pointer-events-none">
          {/* Brand */}
          <div ref={navBrandRef} className="flex items-center gap-3 opacity-0 pointer-events-auto">
            <div className="flex items-center justify-center w-7 h-7 bg-white rounded-md overflow-hidden border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              <img 
                src="/logo.png" 
                alt="BErozgar Logo" 
                className="w-full h-full object-contain scale-90" 
              />
            </div>
            <span className="text-white font-display font-bold text-lg tracking-tight uppercase hidden md:block">
              BErozgar
            </span>
          </div>

          {/* Status indicator */}
          <div ref={navStatusRef} className="flex items-center gap-3 opacity-0">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--color-status-online))]" />
            <span className="text-white/40 text-[10px] uppercase tracking-[0.3em] font-body hidden md:block">
              System Online
            </span>
          </div>

          <div className="pointer-events-auto hidden md:block">
            {isAuthenticated ? (
              <Button variant="primary" size="sm" onClick={() => safeNavigate(navigate, location.pathname, '/home')}>
                OPEN HOME
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => safeNavigate(navigate, location.pathname, '/login')}>
                LOGIN
              </Button>
            )}
          </div>
        </div>

        {/* ── Central Typography Block ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
          {/* Main heading — oversized type, cappen-style */}
          <div className="text-center space-y-0">
            <div className="overflow-hidden">
              <div ref={line1Ref}>
                <span className="text-white/30 font-display text-[clamp(2rem,12vw,7rem)] md:text-[clamp(4rem,12vw,10rem)] font-bold uppercase leading-[0.85] tracking-tighter block">
                  BUILDING
                </span>
              </div>
            </div>

            <div className="overflow-hidden">
              <div ref={line2Ref}>
                <span className="text-white font-display text-[clamp(2rem,12vw,7rem)] md:text-[clamp(4rem,12vw,10rem)] font-bold uppercase leading-[0.85] tracking-tighter block">
                  CAMPUS
                </span>
              </div>
            </div>

            <div className="overflow-hidden flex items-center justify-center gap-4 md:gap-8">
              <div ref={line3Ref}>
                <span className="text-white font-display text-[clamp(2rem,12vw,7rem)] md:text-[clamp(4rem,12vw,10rem)] font-bold uppercase leading-[0.85] tracking-tighter block">
                  TRUST
                </span>
              </div>

              {/* Portal inside the text row */}
              <div
                ref={portalContainerRef}
                className="relative w-[clamp(60px,8vw,120px)] h-[clamp(60px,8vw,120px)] shrink-0 opacity-0 flex items-center justify-center pointer-events-none"
              >
                <Suspense fallback={<div className="absolute inset-0 m-auto w-4/5 h-4/5 border border-primary/20 bg-primary/10 rounded-full rotate-45 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_40px_rgba(0,188,212,0.1)]" />}>
                  <Portal3D className="w-full h-full pointer-events-none" />
                </Suspense>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div ref={taglineRef} className="mt-8 md:mt-12 text-center">
            <p className="text-white/40 text-sm md:text-base font-body max-w-lg mx-auto leading-relaxed tracking-wide">
              A trust-centric digital ecosystem crafting secure &amp; seamless interactions for campus life.
            </p>
          </div>

          {/* CTA Button */}
          <div ref={ctaRef} className="mt-10 md:mt-14">
            <Button
              onClick={handleEnter}
              variant="primary"
              size="lg"
              className="group relative z-30 overflow-hidden px-8 py-4 font-display text-xs tracking-[0.3em] text-white/80 transition-all duration-500 hover:tracking-[0.45em] md:px-12 md:py-5 md:text-sm md:tracking-[0.4em]"
            >
              <span className="relative z-10 flex items-center gap-3 transition-colors duration-500 group-hover:text-black md:gap-4">
                ENTER CAMPUS OS
                <span className="inline-block transition-transform duration-500 group-hover:translate-x-3 text-lg md:text-xl leading-none">→</span>
              </span>
              {/* Fill animation on hover */}
              <div className="absolute inset-0 bg-white scale-x-0 origin-left transition-transform duration-600 group-hover:scale-x-100" />
            </Button>
          </div>
        </div>

        {/* ── Bottom Meta ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between px-6 md:px-12 py-6 pointer-events-none">
          {/* Left */}
          <div ref={metaLeftRef} className="opacity-0 pointer-events-auto">
            <p className="text-white/15 text-[9px] font-mono tracking-[0.3em] uppercase">
              MCTRGIT // 2026
            </p>
          </div>

          {/* Center — scroll hint */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center gap-2">
            <span className="text-white/15 text-[9px] font-mono tracking-[0.3em] uppercase">
              Click to Enter
            </span>
            <div className="w-px h-8 bg-white/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-white/40 animate-pulse" />
            </div>
          </div>

          {/* Right */}
          <div ref={metaRightRef} className="opacity-0 text-right pointer-events-auto">
            <p className="text-white/15 text-[9px] font-mono tracking-[0.3em] uppercase">
              {APP_VERSION} // Campus OS
            </p>
          </div>
        </div>

        {/* ── Background grid texture ── */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />

        {/* ── Ambient glow ── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,191,255,0.025) 0%, transparent 70%)',
          }}
        />
      </div>
    </div>
  );
};

export default LandingPage;
