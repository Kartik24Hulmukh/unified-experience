import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// ScrollTrigger registered in lib/gsap-init.ts

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

      // ── Main heading ───────────────────────────────────────────────────────
      gsap.from(
        '.ftr-heading',
        {
          opacity: 0, y: 60, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 95%' },
        },
      );

      // ── Description paragraph ──────────────────────────────────────────────
      gsap.from(
        '.ftr-desc',
        {
          opacity: 0, y: 30, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 95%' },
        },
      );

      // ── Stats row — staggered ──────────────────────────────────────────────
      gsap.from(
        '.ftr-stat',
        {
          opacity: 0, y: 25, stagger: 0.12, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: '.ftr-stats', start: 'top 95%' },
        },
      );

      // ── Module links — staggered ───────────────────────────────────────────
      gsap.from(
        '.ftr-module',
        {
          opacity: 0, y: 16, stagger: 0.07, duration: 0.55, ease: 'power2.out',
          scrollTrigger: { trigger: '.ftr-modules', start: 'top 95%' },
        },
      );

      // ── Principles grid — staggered ────────────────────────────────────────
      gsap.from(
        '.ftr-principle',
        {
          opacity: 0, x: -18, stagger: 0.1, duration: 0.65, ease: 'power2.out',
          scrollTrigger: { trigger: '.ftr-principles', start: 'top 98%' },
        },
      );

      // ── Bottom divider scaleX on enter ────────────────────────────────────
      gsap.fromTo(
        '.ftr-divider',
        { scaleX: 0, transformOrigin: 'left' },
        {
          scaleX: 1, duration: 1.1, ease: 'power3.inOut',
          scrollTrigger: { trigger: '.ftr-bottom', start: 'top bottom' },
        },
      );

      // ── Bottom bar text ────────────────────────────────────────────────────
      gsap.from(
        '.ftr-bottom-text',
        {
          opacity: 0, y: 12, stagger: 0.15, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: '.ftr-bottom', start: 'top bottom' },
        },
      );

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={sectionRef}
      className="relative bg-portal min-h-[90vh] flex flex-col pt-32 pb-16"
    >
      {/* Grid overlay — same density as CampusEventsSection */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(163,255,18,0.02) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(163,255,18,0.02) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(163,255,18,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[1800px] mx-auto px-6 sm:px-12 md:px-24 flex-1 flex flex-col justify-between">

        {/* ── Eyebrow ────────────────────────────────────────────────────────── */}


        {/* ── Main heading ───────────────────────────────────────────────────── */}
        <h2
          className="ftr-heading font-display font-bold uppercase leading-[0.9] tracking-[-0.05em] text-center text-portal-foreground mb-8"
          style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}
        >
          A Trust-Centric
          <br />
          <span className="text-portal-foreground/40">Campus Ecosystem</span>
        </h2>

        {/* ── Description ────────────────────────────────────────────────────── */}
        <p className="ftr-desc text-portal-foreground/40 font-body text-base leading-relaxed text-center max-w-xl mx-auto mb-16">
          BErozgar transforms informal student practices into a structured,
          trusted platform for academic exchange, accommodation discovery,
          and daily living support.
        </p>

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <div className="ftr-stats flex flex-col sm:flex-row justify-between items-center sm:items-start gap-8 md:gap-12 mb-16 w-full mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="ftr-stat text-center sm:text-left flex flex-col items-center sm:items-start w-full sm:w-1/3">
              <p className="text-portal-foreground/25 font-mono text-[9px] uppercase tracking-[0.4em] mb-2">
                {s.label}
              </p>
              <p className="text-portal-foreground font-display text-lg uppercase tracking-wide">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Horizontal rule ────────────────────────────────────────────────── */}
        <div className="h-px bg-portal-foreground/10 mb-12" />

        {/* ── Module quick-links ─────────────────────────────────────────────── */}
        <div className="ftr-modules flex flex-wrap justify-center gap-x-8 gap-y-6 mb-14">
          {MODULES.map((mod) => (
            <span
              key={mod}
              className="ftr-module font-mono text-[10px] md:text-xs uppercase tracking-[0.4em] text-portal-foreground/60 hover:text-[#a3ff12] transition-colors duration-300 cursor-default"
            >
              {mod}
            </span>
          ))}
        </div>

        {/* ── Core Principles ────────────────────────────────────────────────── */}
        <div className="ftr-principles grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-20 w-full">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="ftr-principle border-l border-[#a3ff12]/20 pl-4 w-full">
              <h3 className="text-portal-foreground font-display text-sm md:text-xs uppercase tracking-wider mb-2">
                {p.title}
              </h3>
              <p className="text-portal-foreground/50 text-xs font-body leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
        <div className="ftr-bottom w-full">
          <div className="ftr-divider h-px bg-portal-foreground/20 mb-7" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="ftr-bottom-text text-portal-foreground/40 font-mono text-[10px] uppercase tracking-[0.3em] text-center md:text-left">
              © 2026 BErozgar — Rozgar for Resources
            </p>
            <p className="ftr-bottom-text text-portal-foreground/40 font-mono text-[10px] uppercase tracking-[0.3em] text-center md:text-right">
              Non-Commercial · Privacy-Aware · Admin-Governed
            </p>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default FooterSection;
