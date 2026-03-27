import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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

const MODULES = ['Resale', 'Requests', 'Accommodation', 'Essentials', 'Hospital', 'Mess'];

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
          scrollTrigger: { trigger: section, start: 'top 95%' },
        }
      );

      // ── Main heading ───────────────────────────────────────────────────────
      gsap.from(
        '.ftr-heading',
        {
          opacity: 0, y: 50, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 90%' },
        },
      );

      // ── Description ────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-desc',
        {
          opacity: 0, y: 30, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 85%' },
        },
      );

      // ── Stats row ──────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-stat',
        {
          opacity: 0, y: 25, stagger: 0.1, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: '.ftr-stats', start: 'top 95%' },
        },
      );

      // ── Module links ───────────────────────────────────────────────────────
      gsap.from(
        '.ftr-module',
        {
          opacity: 0, y: 15, stagger: 0.05, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: '.ftr-modules', start: 'top 95%' },
        },
      );

      // ── Principles ─────────────────────────────────────────────────────────
      gsap.from(
        '.ftr-principle',
        {
          opacity: 0, x: -15, stagger: 0.1, duration: 0.6, ease: 'power2.out',
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
          scrollTrigger: { trigger: '.ftr-bottom', start: 'top bottom' },
        },
      );

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
            'linear-gradient(rgba(163,255,18,1) 1px, transparent 1px), linear-gradient(90deg, rgba(163,255,18,1) 1px, transparent 1px)',
          backgroundSize: '100px 100px',
        }}
      />

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 sm:px-12 md:px-20 flex-1 flex flex-col">
        
        {/* ── Eyebrow Tag ────────────────────────────────────────────────────── */}
        <div className="ftr-eyebrow flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-8 bg-[#a3ff12]/30 hidden sm:block" />
          <span className="text-[#a3ff12] font-mono text-[9px] uppercase tracking-[0.5em] font-medium">
            Institutional Platform
          </span>
          <div className="h-px w-8 bg-[#a3ff12]/30 hidden sm:block" />
        </div>

        {/* ── Heading ────────────────────────────────────────────────────────── */}
        <h2
          className="ftr-heading font-display font-bold uppercase leading-[0.9] tracking-[-0.05em] text-center text-portal-foreground mb-10"
          style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)' }}
        >
          A Trust-Centric
          <br />
          <span className="text-portal-foreground/40">Campus Ecosystem</span>
        </h2>

        {/* ── Description ────────────────────────────────────────────────────── */}
        <p className="ftr-desc text-portal-foreground/40 font-body text-base leading-relaxed text-center max-w-xl mx-auto mb-20">
          BErozgar transforms informal student practices into a structured,
          trusted platform for academic exchange, accommodation discovery,
          and daily living support.
        </p>

        {/* ── Stats Row ──────────────────────────────────────────────────────── */}
        <div className="ftr-stats grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6 mb-24 max-w-4xl mx-auto w-full">
          {STATS.map((s) => (
            <div key={s.label} className="ftr-stat flex flex-col items-center text-center px-4">
              <p className="text-portal-foreground/25 font-mono text-[9px] uppercase tracking-[0.4em] mb-3">
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
            <span
              key={mod}
              className="ftr-module font-mono text-[10px] md:text-xs uppercase tracking-[0.4em] text-portal-foreground/60 hover:text-[#a3ff12] transition-colors duration-300 cursor-pointer"
            >
              {mod}
            </span>
          ))}
        </div>

        {/* ── Principles Grid ────────────────────────────────────────────────── */}
        <div className="ftr-principles grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-24">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="ftr-principle border-l border-[#a3ff12]/20 pl-6 group">
              <h3 className="text-portal-foreground font-display text-sm uppercase tracking-wider mb-3 group-hover:text-[#a3ff12] transition-colors duration-300">
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
               <div className="w-8 h-8 rounded-sm bg-[#a3ff12] flex items-center justify-center font-display font-bold text-black text-[12px]">B</div>
               <div className="flex flex-col">
                  <span className="text-portal-foreground font-display text-[11px] uppercase tracking-tighter leading-none">BErozgar</span>
                  <span className="text-portal-foreground/30 font-mono text-[8px] uppercase tracking-[0.2em] leading-none mt-1">Campus Portal v1.4</span>
               </div>
            </div>

            <p className="ftr-bottom-text text-portal-foreground/40 font-mono text-[9px] uppercase tracking-[0.3em] order-3 lg:order-2">
              © 2026 BErozgar — Rozgar for Resources
            </p>

            <div className="ftr-bottom-text flex gap-8 order-2 lg:order-3">
               <span className="text-portal-foreground/30 font-mono text-[9px] uppercase tracking-[0.2em] hover:text-[#a3ff12] cursor-pointer transition-colors">Privacy</span>
               <span className="text-portal-foreground/30 font-mono text-[9px] uppercase tracking-[0.2em] hover:text-[#a3ff12] cursor-pointer transition-colors">Security</span>
               <span className="text-portal-foreground/30 font-mono text-[9px] uppercase tracking-[0.2em] hover:text-[#a3ff12] cursor-pointer transition-colors">Governance</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default FooterSection;
