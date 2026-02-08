import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
import {
  ArrowRight, Utensils, Stethoscope, Pill, Truck,
  ShieldCheck, Heart, Flame, Phone, Ambulance,
  BookOpen, Wifi, AlertTriangle,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/* ── Data ─────────────────────────────────────────────── */

const modules = [
  {
    id: 'mess',
    number: '05',
    title: 'MESS & TIFFIN',
    subtitle: 'Food services, tiffin delivery, campus canteens — verified, priced, reviewed.',
    accent: 'amber',
    path: '/mess',
    stats: [
      { value: '18+', label: 'Verified Services' },
      { value: '4.5', label: 'Avg Rating' },
      { value: '₹2.2k', label: 'Starting From' },
    ],
    features: ['Hygiene Scores', 'Live Menus', 'Price Comparison', 'Student Reviews', 'Delivery Tracking', 'Diet Filters'],
    icon: Utensils,
  },
  {
    id: 'hospital',
    number: '06',
    title: 'HEALTHCARE',
    subtitle: 'Hospitals, clinics, pharmacies, emergency services — mapped and accessible.',
    accent: 'emerald',
    path: '/hospital',
    stats: [
      { value: '11+', label: 'Medical Facilities' },
      { value: '2', label: '24/7 Hospitals' },
      { value: '5 km', label: 'Max Distance' },
    ],
    features: ['Emergency Contacts', 'Student Discounts', 'Distance Mapping', 'Service Categories', 'Insurance Info', '24/7 Pharmacy'],
    icon: Stethoscope,
  },
];

const quickLinks = [
  { icon: Ambulance, label: 'Ambulance', value: '102', type: 'emergency', href: 'tel:102' },
  { icon: Phone, label: 'Emergency', value: '112', type: 'emergency', href: 'tel:112' },
  { icon: Pill, label: '24/7 Pharmacy', value: '0.3 km', type: 'info', href: '/hospital' },
  { icon: Truck, label: 'Tiffin Delivery', value: 'Active', type: 'info', href: '/mess' },
];

const essentialTips = [
  {
    icon: ShieldCheck,
    title: 'Student Health Card',
    desc: 'Always carry it for free/discounted campus medical center visits.',
  },
  {
    icon: Heart,
    title: 'Mental Health',
    desc: 'Free, confidential counseling available at the campus wellness center.',
  },
  {
    icon: Flame,
    title: 'Meal Planning',
    desc: 'Compare mess plans before committing. Most offer weekly trials.',
  },
  {
    icon: BookOpen,
    title: 'Insurance Check',
    desc: 'Your college fee likely includes basic medical coverage. Verify with admin.',
  },
];

const scrollingWords = [
  'ESSENTIALS', 'HEALTH', 'FOOD', 'MESS', 'HOSPITAL', 'PHARMACY',
  'TIFFIN', 'CLINIC', 'CAMPUS', 'WELLNESS', 'NUTRITION', 'CARE',
];

/* ── Reusable Components ─────────────────────────────── */

const ScanlineOverlay = () => (
  <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden>
    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
  </div>
);

const GlitchText = ({ children, className = '' }: { children: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const handleEnter = () => {
      gsap.to(el, { skewX: 2, duration: 0.1, yoyo: true, repeat: 3, ease: 'power4.inOut', onComplete: () => gsap.set(el, { skewX: 0 }) });
    };
    el.addEventListener('mouseenter', handleEnter);
    return () => el.removeEventListener('mouseenter', handleEnter);
  }, []);
  return (
    <div ref={ref} className={`relative group ${className}`}>
      <span className="relative z-10">{children}</span>
      <span className="absolute top-0 left-0 text-violet-400/30 z-0 translate-x-[2px] translate-y-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" aria-hidden>{children}</span>
      <span className="absolute top-0 left-0 text-red-400/20 z-0 -translate-x-[1px] -translate-y-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" aria-hidden>{children}</span>
    </div>
  );
};

const AnimatedCounter = ({ target, duration = 2000 }: { target: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const start = Date.now();
        const animate = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{count}</span>;
};

/* ── Word Marquee ────────────────────────────────────── */

const WordMarquee = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!trackRef.current) return;
    gsap.to(trackRef.current, { xPercent: -50, ease: 'none', duration: 30, repeat: -1 });
  }, []);
  return (
    <div className="w-full overflow-hidden border-y border-white/5 py-6 bg-black/30">
      <div ref={trackRef} className="flex whitespace-nowrap gap-8" style={{ width: 'max-content' }}>
        {[...scrollingWords, ...scrollingWords].map((word, i) => (
          <span key={i} className="text-white/[0.04] font-display text-5xl md:text-7xl font-extrabold uppercase tracking-tight flex items-center gap-8">
            {word}
            <span className="w-2 h-2 bg-violet-400/20 rotate-45" />
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Main Page ───────────────────────────────────────── */

const EssentialsPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);

  /* GSAP Animations */
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero image reveal with opacity
      gsap.fromTo('.ess-hero-img', { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 0.5, duration: 2, ease: 'power3.out' });

      // Hero bg parallax
      gsap.to('.ess-hero-img', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      // Title words
      gsap.fromTo('.ess-title-word', { y: 120, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 1, ease: 'power4.out', delay: 0.5 });

      // Subtitle
      gsap.fromTo('.ess-subtitle', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 1.3 });

      // Quick links
      gsap.fromTo('.quick-link', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power3.out', delay: 1.6 });

      // Scroll-revealed sections
      gsap.utils.toArray<HTMLElement>('.ess-reveal').forEach(section => {
        gsap.fromTo(section, { y: 60, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 85%', toggleActions: 'play none none none' },
        });
      });

      // Module cards stagger
      gsap.fromTo('.module-card', { y: 100, opacity: 0, scale: 0.96 }, {
        y: 0, opacity: 1, scale: 1, stagger: 0.2, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.module-grid', start: 'top 80%', toggleActions: 'play none none none' },
      });

      // Tip cards
      gsap.fromTo('.ess-tip', { scale: 0.9, opacity: 0 }, {
        scale: 1, opacity: 1, stagger: 0.08, duration: 0.5, ease: 'back.out(1.7)',
        scrollTrigger: { trigger: '.tips-section', start: 'top 80%', toggleActions: 'play none none none' },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <main id="main-content" className="min-h-screen bg-black text-white overflow-hidden relative">
      <ScanlineOverlay />

      {/* ═══════════════ HERO ═══════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-end overflow-hidden">
        {/* Background — essentials-tiffin.jpg at low opacity */}
        <div className="absolute inset-0 z-0">
          <img
            src={essentialsTiffin}
            alt=""
            className="ess-hero-img absolute inset-0 w-full h-[130%] object-cover"
            style={{ opacity: 0 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        {/* Corner brackets */}
        <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-violet-400/30 z-10" />
        <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-violet-400/30 z-10" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-l-2 border-b-2 border-violet-400/30 z-10" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-r-2 border-b-2 border-violet-400/30 z-10" />

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 md:px-16 pt-28 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">Module 03 — Essentials Hub</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20 hidden md:block">
            SYS_STATUS: ALL_MODULES_ACTIVE
          </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full px-8 md:px-16 pb-20 md:pb-28">
          <div className="max-w-5xl">
            <div className="space-y-1 mb-8">
              <div className="overflow-hidden">
                <span className="ess-title-word block text-white font-display text-5xl sm:text-6xl md:text-[5.5rem] lg:text-[7rem] font-extrabold leading-[0.85] tracking-tight" style={{ opacity: 0, textShadow: '0 2px 40px rgba(0,0,0,0.6)' }}>
                  CAMPUS
                </span>
              </div>
              <div className="overflow-hidden">
                <span className="ess-title-word block font-display text-5xl sm:text-6xl md:text-[5.5rem] lg:text-[7rem] font-extrabold leading-[0.85] tracking-tight" style={{ opacity: 0, textShadow: '0 2px 40px rgba(0,0,0,0.6)' }}>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">ESSENTIALS</span>
                </span>
              </div>
            </div>

            <div className="ess-subtitle max-w-xl" style={{ opacity: 0 }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-12 bg-gradient-to-r from-violet-400/60 to-transparent" />
                <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-violet-400/60">
                  Food • Healthcare • Emergency • Wellness
                </span>
              </div>
              <p className="text-white/40 text-sm md:text-base font-body leading-relaxed">
                Your one-stop hub for daily campus needs. Mess services, medical facilities,
                pharmacies, and emergency contacts — verified and mapped by students.
              </p>
            </div>

            {/* Quick access row */}
            <div className="flex flex-wrap gap-3 mt-12">
              {quickLinks.map((link, i) => {
                const Icon = link.icon;
                const isEmergency = link.type === 'emergency';
                return (
                  <a
                    key={i}
                    href={link.href}
                    className={`quick-link group flex items-center gap-3 px-5 py-3 border transition-all duration-500 ${
                      isEmergency
                        ? 'border-red-500/20 bg-red-500/[0.03] hover:border-red-500/40 hover:bg-red-500/[0.06]'
                        : 'border-white/5 bg-white/[0.02] hover:border-violet-400/20 hover:bg-violet-400/[0.03]'
                    }`}
                    style={{ opacity: 0 }}
                  >
                    <Icon className={`w-4 h-4 ${isEmergency ? 'text-red-400/60' : 'text-white/25 group-hover:text-violet-400/70'} transition-colors`} />
                    <div>
                      <p className={`text-[9px] font-mono uppercase tracking-widest ${isEmergency ? 'text-red-400/50' : 'text-white/30'}`}>{link.label}</p>
                      <p className={`text-xs font-mono font-bold ${isEmergency ? 'text-red-400/80' : 'text-white/50'}`}>{link.value}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ WORD MARQUEE ═══════════════ */}
      <WordMarquee />

      {/* ═══════════════ MODULES OVERVIEW ═══════════════ */}
      <section className="py-24 md:py-40 px-8 md:px-16 ess-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Wifi className="w-4 h-4 text-violet-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Essential Modules</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4">
            WHAT WE COVER
          </GlitchText>
          <p className="text-white/30 text-sm font-body max-w-lg mb-16">
            Two things you'll use every single day — food and health.
            Tap into either module for the full experience.
          </p>

          <div className="module-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
            {modules.map(mod => {
              const Icon = mod.icon;
              const accentColor = mod.accent === 'amber' ? {
                border: 'hover:border-amber-400/30',
                bg: 'hover:bg-amber-400/[0.02]',
                text: 'text-amber-400',
                textMuted: 'text-amber-400/60',
                textFaint: 'text-amber-400/40',
                dot: 'bg-amber-400',
                gradient: 'from-amber-400 to-orange-300',
                btnBorder: 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10',
                featureBorder: 'hover:border-amber-400/20 hover:bg-amber-400/[0.03]',
                featureIcon: 'group-hover:text-amber-400/60',
              } : {
                border: 'hover:border-emerald-400/30',
                bg: 'hover:bg-emerald-400/[0.02]',
                text: 'text-emerald-400',
                textMuted: 'text-emerald-400/60',
                textFaint: 'text-emerald-400/40',
                dot: 'bg-emerald-400',
                gradient: 'from-emerald-400 to-teal-300',
                btnBorder: 'border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10',
                featureBorder: 'hover:border-emerald-400/20 hover:bg-emerald-400/[0.03]',
                featureIcon: 'group-hover:text-emerald-400/60',
              };

              return (
                <div
                  key={mod.id}
                  className={`module-card group relative border border-white/5 bg-white/[0.01] ${accentColor.border} ${accentColor.bg} transition-all duration-700 overflow-hidden`}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/5 group-hover:border-white/15 transition-colors duration-500" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/5 group-hover:border-white/15 transition-colors duration-500" />

                  {/* Header */}
                  <div className="p-8 md:p-10 pb-0">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 ${accentColor.dot} rounded-full animate-pulse`} />
                        <span className={`text-[10px] font-mono uppercase tracking-[0.3em] ${accentColor.textFaint}`}>
                          Module {mod.number}
                        </span>
                      </div>
                      <div className="w-10 h-10 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition-colors">
                        <Icon className={`w-4 h-4 text-white/25 group-hover:${accentColor.featureIcon} transition-colors`} />
                      </div>
                    </div>

                    <h3 className="text-white font-display text-3xl md:text-4xl font-bold mb-3 leading-tight">
                      {mod.title.split(' ').map((word, i) => (
                        <span key={i}>
                          {i === mod.title.split(' ').length - 1 ? (
                            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${accentColor.gradient}`}>{word}</span>
                          ) : (
                            word + ' '
                          )}
                        </span>
                      ))}
                    </h3>
                    <p className="text-white/30 text-sm font-body leading-relaxed max-w-md mb-8">
                      {mod.subtitle}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="px-8 md:px-10 pb-6">
                    <div className="flex gap-8">
                      {mod.stats.map((stat, i) => (
                        <div key={i}>
                          <p className="text-white font-display text-2xl font-bold">{stat.value}</p>
                          <p className="text-white/20 text-[9px] uppercase tracking-[0.3em] font-mono mt-1">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature tags */}
                  <div className="px-8 md:px-10 pb-6">
                    <div className="flex flex-wrap gap-2">
                      {mod.features.slice(0, 4).map((feat, i) => (
                        <span
                          key={i}
                          className="group/tag px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest bg-white/[0.02] border border-white/5 text-white/30 hover:text-white/50 transition-colors"
                        >
                          {feat}
                        </span>
                      ))}
                      {mod.features.length > 4 && (
                        <span className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/15">
                          +{mod.features.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="p-8 md:p-10 pt-4 border-t border-white/[0.03]">
                    <Link
                      to={mod.path}
                      className={`inline-flex items-center gap-3 px-6 py-3 border text-[10px] font-mono uppercase tracking-widest transition-all duration-300 ${accentColor.btnBorder}`}
                    >
                      Explore Module <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>

                  {/* Bottom glow line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:via-white/10 transition-all duration-700`} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ QUICK TIPS ═══════════════ */}
      <section className="tips-section py-24 md:py-32 px-8 md:px-16 border-t border-white/5 bg-white/[0.01] ess-reveal">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Pro Tips</span>
              <div className="h-px w-8 bg-white/10" />
            </div>
            <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4 inline-block">
              GOOD TO KNOW
            </GlitchText>
            <p className="text-white/25 text-sm font-body max-w-md mx-auto mt-4">
              Things every new student should know on day one.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {essentialTips.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <div key={i} className="ess-tip group p-6 md:p-8 border border-white/5 hover:border-violet-400/20 hover:bg-violet-400/[0.02] transition-all duration-500 text-center">
                  <div className="w-12 h-12 mx-auto mb-5 border border-white/10 group-hover:border-violet-400/30 flex items-center justify-center transition-all group-hover:bg-violet-400/5">
                    <Icon className="w-5 h-5 text-white/25 group-hover:text-violet-400/70 transition-colors" />
                  </div>
                  <h3 className="text-white font-display text-sm font-bold uppercase mb-2 group-hover:text-violet-400/90 transition-colors">{tip.title}</h3>
                  <p className="text-white/25 text-xs font-body leading-relaxed group-hover:text-white/40 transition-colors">{tip.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ DISCLAIMER ═══════════════ */}
      <section className="py-12 px-8 md:px-16 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3 p-6 border border-white/5 bg-white/[0.01]">
            <AlertTriangle className="w-4 h-4 text-white/15 mt-0.5 flex-shrink-0" />
            <p className="text-white/25 text-xs font-body leading-relaxed">
              <span className="text-white/50 font-bold">Disclaimer:</span> All information is based on student submissions and basic verification.
              Prices may vary. We provide no medical advice, quality guarantees, or endorsements. Always verify independently for critical decisions.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="relative py-32 md:py-48 px-8 md:px-16 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.04) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-violet-400/40 mb-8 block">// YOUR CAMPUS, SIMPLIFIED</span>

          <h2 className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-[0.9]">
            LIVE
          </h2>
          <h2 className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.9]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">BETTER</span>
          </h2>

          <p className="text-white/30 text-sm md:text-base font-body max-w-xl mx-auto mb-12">
            Food. Health. Safety. Everything a student needs — mapped, verified, and one click away.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/mess" className="group relative px-10 py-4 bg-white text-black font-display uppercase tracking-wider text-xs font-bold hover:bg-violet-400 transition-colors duration-300 overflow-hidden">
              <span className="relative z-10 flex items-center gap-3">
                Find Food <Utensils className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link to="/hospital" className="px-10 py-4 border border-white/10 text-white/50 font-display uppercase tracking-wider text-xs font-bold hover:border-white/30 hover:text-white/80 transition-all duration-300 flex items-center gap-3">
              Find Healthcare <Stethoscope className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-20 flex items-center justify-center gap-6">
            <div className="h-px w-16 bg-white/5" />
            <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.3em]">ESSENTIALS_HUB // v1.0 // ACTIVE</span>
            <div className="h-px w-16 bg-white/5" />
          </div>
        </div>
      </section>
    </main>
  );
};

export default EssentialsPage;
