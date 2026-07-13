import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { APP_VERSION } from '@/lib/app-meta';

const PRINCIPLES = [
  { title: 'Trust First',         desc: 'Verified users, admin oversight' },
  { title: 'Privacy by Design',   desc: 'No public personal data' },
  { title: 'Governance',          desc: 'Admin arbitration over automation' },
  { title: 'Institutional',       desc: 'Aligned with campus culture' },
];

const STATS = [
  { label: 'Institution', value: 'MCTRGIT' },
  { label: 'Status',      value: 'Active Development' },
  { label: 'Users',       value: 'MCTRGIT Students Only' },
];

const MODULES = [
  { label: 'Resale', path: '/resale' },
  { label: 'Accommodation', path: '/accommodation' },
  { label: 'Academics', path: '/academics' },
  { label: 'Essentials', path: '/essentials' },
];

const FooterSection = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // ── Eyebrow ──────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-eyebrow',
        {
          opacity: 0, y: 20, duration: 0.8, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: section, start: 'top 95%' },
        }
      );

      // ── Main heading ───────────────────────────────────────────────────────
      gsap.from(
        '.ftr-heading',
        {
          opacity: 0, y: 50, duration: 1, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: section, start: 'top 90%' },
        },
      );

      // ── Description ────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-desc',
        {
          opacity: 0, y: 30, duration: 0.9, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: section, start: 'top 85%' },
        },
      );

      // ── Stats row ──────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-stat',
        {
          opacity: 0, y: 25, stagger: 0.1, duration: 0.7, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: '.ftr-stats', start: 'top 95%' },
        },
      );

      // ── Module links ───────────────────────────────────────────────────────
      gsap.from(
        '.ftr-module',
        {
          opacity: 0, y: 15, stagger: 0.05, duration: 0.5, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: '.ftr-modules', start: 'top 95%' },
        },
      );

      // ── Principles ─────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-principle',
        {
          opacity: 0, x: -15, stagger: 0.1, duration: 0.6, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: '.ftr-principles', start: 'top 95%' },
        },
      );

      // ── Bottom bar ─────────────────────────────────────────────────────────
      gsap.fromTo(
        '.ftr-divider',
        { scaleX: 0, transformOrigin: 'left' },
        {
          scaleX: 1, duration: 1, ease: 'power3.inOut',
          scrollTrigger: { trigger: '.ftr-bottom', start: 'top bottom' },
        },
      );

      gsap.from(
        '.ftr-bottom-text',
        {
          opacity: 0, y: 10, stagger: 0.1, duration: 0.6, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: '.ftr-bottom', start: 'top bottom' },
        },
      );

      requestAnimationFrame(() => ScrollTrigger.refresh());

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={sectionRef}
      className="relative bg-portal min-h-[85vh] flex flex-col pt-24 pb-12 overflow-hidden"
    >
      {/* Dynamic Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--color-accent-secondary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--color-accent-secondary)) 1px, transparent 1px)',
          backgroundSize: '100px 100px',
        }}
      />

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 sm:px-12 md:px-20 flex-1 flex flex-col">
        
        {/* ── Eyebrow Tag ────────────────────────────────────────────────────── */}
        <div className="ftr-eyebrow flex items-center justify-center gap-4 mb-8">
          <div className="hidden h-px w-8 bg-[hsl(var(--color-accent-secondary)/0.3)] sm:block" />
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.5em] text-[hsl(var(--color-accent-secondary))]">
            Institutional Platform
          </span>
          <div className="hidden h-px w-8 bg-[hsl(var(--color-accent-secondary)/0.3)] sm:block" />
        </div>

        {/* ── Heading ────────────────────────────────────────────────────────── */}
        <h2
          className="ftr-heading font-display font-bold uppercase leading-[0.9] tracking-[-0.05em] text-center text-portal-foreground mb-10"
          style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)' }}
        >
          A Trust-Centric
          <br />
          <span className="text-portal-foreground/55">Campus Ecosystem</span>
        </h2>

        {/* ── Description ────────────────────────────────────────────────────── */}
        <p className="ftr-desc text-portal-foreground/60 font-body text-base leading-relaxed text-center max-w-xl mx-auto mb-20">
          BErozgar transforms informal student practices into a structured,
          trusted platform for academic exchange, accommodation discovery,
          and daily living support.
        </p>

        {/* ── Stats Row ──────────────────────────────────────────────────────── */}
        <div className="ftr-stats grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6 mb-24 max-w-4xl mx-auto w-full">
          {STATS.map((s) => (
            <div key={s.label} className="ftr-stat flex flex-col items-center text-center px-4">
              <p className="text-portal-foreground/55 font-mono text-[9px] uppercase tracking-[0.4em] mb-3">
                {s.label}
              </p>
              <p className="text-portal-foreground font-display text-xl uppercase tracking-wide">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Modules Quick Links ────────────────────────────────────────────── */}
        <div className="ftr-modules flex flex-wrap justify-center gap-x-10 gap-y-6 mb-20 py-8 border-y border-portal-foreground/5">
          {MODULES.map((mod) => (
            <Link
              key={mod.path}
              to={mod.path}
              className="ftr-module font-mono text-[10px] md:text-xs uppercase tracking-[0.4em] text-portal-foreground/60 hover:text-portal-foreground/90 transition-colors"
            >
              {mod.label}
            </Link>
          ))}
        </div>

        {/* ── Principles Grid ────────────────────────────────────────────────── */}
        <div className="ftr-principles grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-24">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="ftr-principle group border-l border-[hsl(var(--color-accent-secondary)/0.2)] pl-6">
              <h3 className="mb-3 font-display text-sm uppercase tracking-wider text-portal-foreground transition-colors duration-300 group-hover:text-[hsl(var(--color-accent-secondary))]">
                {p.title}
              </h3>
              <p className="text-portal-foreground/50 text-[12px] font-body leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Bottom Section ─────────────────────────────────────────────────── */}
        <div className="ftr-bottom mt-auto">
          <div className="ftr-divider h-px bg-portal-foreground/15 mb-10" />

          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 pb-4">
            {/* Logo/Context Branding */}
            <div className="ftr-bottom-text flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[hsl(var(--color-accent-secondary))] font-display text-[12px] font-bold text-black">B</div>
              <div className="flex flex-col">
                <span className="text-portal-foreground font-display text-[11px] uppercase tracking-tighter leading-none">BErozgar</span>
                <span className="mt-1 font-mono text-[8px] uppercase leading-none tracking-[0.2em] text-portal-foreground/55">Campus Portal {APP_VERSION}</span>
              </div>
            </div>

            <p className="ftr-bottom-text text-portal-foreground/55 font-mono text-[9px] uppercase tracking-[0.3em] order-3 lg:order-2">
              © 2026 BErozgar — Rozgar for Resources
            </p>

            {/* Legal links */}
            <div className="ftr-bottom-text flex items-center gap-4 order-2 lg:order-3">
              <Link
                to="/privacy"
                className="font-mono text-[9px] uppercase tracking-[0.3em] text-portal-foreground/40 hover:text-portal-foreground/70 transition-colors"
              >
                Privacy Policy
              </Link>
              <span className="text-portal-foreground/20 text-[9px]">·</span>
              <Link
                to="/terms"
                className="font-mono text-[9px] uppercase tracking-[0.3em] text-portal-foreground/40 hover:text-portal-foreground/70 transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};


export default FooterSection;
