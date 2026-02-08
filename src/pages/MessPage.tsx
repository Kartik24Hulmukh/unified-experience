import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
const messHero = '/Mess.png';
import {
  Search, X, ArrowRight, Star, Clock, Utensils, Leaf,
  ChefHat, Flame, IndianRupee, Users, ChevronDown, ChevronUp,
  MapPin, Truck, ShieldCheck, Heart
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/* ── Data ─────────────────────────────────────────────── */

const messServices = [
  {
    id: 'm1',
    title: 'Annapurna Veg Mess',
    price: '3000',
    category: 'Vegetarian',
    institution: 'Student Favorite',
    type: 'Veg',
    meals: 'Lunch + Dinner',
    rating: 4.5,
    distance: '0.8 km',
  },
  {
    id: 'm2',
    title: 'Home-Style Tiffin Service',
    price: '2800',
    category: 'Tiffin',
    institution: 'Home Cooked',
    type: 'Veg',
    meals: 'Lunch + Dinner',
    rating: 4.7,
    distance: '1.2 km',
  },
  {
    id: 'm3',
    title: 'Campus Night Canteen',
    price: '50',
    category: 'Canteen',
    institution: 'Internal',
    type: 'Veg & Non-Veg',
    meals: 'Snacks + Dinner',
    rating: 3.8,
    distance: '0 km',
  },
  {
    id: 'm4',
    title: 'Sai Krupa Mess',
    price: '2500',
    category: 'Vegetarian',
    institution: 'Budget Pick',
    type: 'Veg',
    meals: 'Lunch + Dinner',
    rating: 4.0,
    distance: '1.5 km',
  },
  {
    id: 'm5',
    title: 'Mumbai Dabba Express',
    price: '3500',
    category: 'Tiffin',
    institution: 'Premium',
    type: 'Veg & Non-Veg',
    meals: 'Lunch',
    rating: 4.8,
    distance: '3 km',
  },
  {
    id: 'm6',
    title: 'Shree Balaji Bhojanalaya',
    price: '2200',
    category: 'Vegetarian',
    institution: 'Verified',
    type: 'Pure Veg',
    meals: 'Breakfast + Lunch + Dinner',
    rating: 4.2,
    distance: '0.5 km',
  },
];

const highlights = [
  {
    icon: Leaf,
    title: 'Hygiene Verified',
    desc: 'All listed services pass student-submitted hygiene reviews before appearing.',
    code: 'HYG_01',
  },
  {
    icon: Truck,
    title: 'Delivery Tracked',
    desc: 'Tiffin services with reliable delivery schedules mapped to campus timings.',
    code: 'DLV_02',
  },
  {
    icon: IndianRupee,
    title: 'Transparent Pricing',
    desc: 'Monthly costs, per-meal rates, and hidden charges — all disclosed upfront.',
    code: 'PRC_03',
  },
  {
    icon: ShieldCheck,
    title: 'Student Reviewed',
    desc: 'Ratings and reviews from verified MCTRGIT students only. No fake feedback.',
    code: 'REV_04',
  },
];

const mealPlans = [
  {
    name: 'Basic',
    price: '₹2,200',
    period: '/month',
    meals: ['Lunch', 'Dinner'],
    features: ['Standard menu', 'Fixed timings', 'Veg only'],
    popular: false,
  },
  {
    name: 'Standard',
    price: '₹3,000',
    period: '/month',
    meals: ['Lunch', 'Dinner'],
    features: ['Rotating menu', 'Flexible timings', 'Veg + Non-veg options', 'Weekend specials'],
    popular: true,
  },
  {
    name: 'Premium',
    price: '₹3,500',
    period: '/month',
    meals: ['Breakfast', 'Lunch', 'Dinner'],
    features: ['Custom diet plans', 'All-day access', 'Veg + Non-veg', 'Festival specials', 'Tiffin delivery'],
    popular: false,
  },
];

const faqs = [
  {
    q: 'How are mess services verified?',
    a: 'All listed mess and tiffin services go through a multi-step verification process. Current students submit reviews, admins validate hygiene standards, and services are periodically re-evaluated based on ongoing feedback.',
  },
  {
    q: 'Can I switch between mess providers?',
    a: 'Yes. Most services offer monthly subscriptions with no lock-in. You can switch providers at the end of any billing cycle. Some offer weekly trial plans.',
  },
  {
    q: 'What if I have dietary restrictions?',
    a: 'Many listed services offer Jain, vegan, and allergen-free options. Each listing displays dietary tags. You can filter specifically for your needs using the search filters.',
  },
  {
    q: 'How does the tiffin delivery work?',
    a: 'Tiffin services deliver directly to your hostel or PG. Delivery schedules are synced with typical class timings. Most services include dabba pickup and return in the monthly cost.',
  },
  {
    q: 'Are prices negotiable?',
    a: 'Prices listed are standard monthly rates. Some services offer discounts for semester-long commitments or group subscriptions. Contact the service through the platform for details.',
  },
];

const scrollingWords = [
  'TIFFIN', 'MESS', 'CANTEEN', 'HOMESTYLE', 'DABBA', 'THALI',
  'NUTRITION', 'AFFORDABLE', 'HYGIENIC', 'VERIFIED',
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
      <span className="absolute top-0 left-0 text-amber-400/30 z-0 translate-x-[2px] translate-y-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" aria-hidden>{children}</span>
      <span className="absolute top-0 left-0 text-red-400/20 z-0 -translate-x-[1px] -translate-y-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" aria-hidden>{children}</span>
    </div>
  );
};

const AnimatedCounter = ({ target, duration = 2000, suffix = '' }: { target: number; duration?: number; suffix?: string }) => {
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
  return <span ref={ref}>{count}{suffix}</span>;
};

/* ── FAQ Accordion Item ──────────────────────────────── */

const FaqItem = ({ q, a, index }: { q: string; a: string; index: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.to(contentRef.current, {
      height: isOpen ? 'auto' : 0,
      opacity: isOpen ? 1 : 0,
      duration: 0.4,
      ease: 'power3.out',
    });
  }, [isOpen]);

  return (
    <div className="border-b border-white/5 group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-6 md:py-8 text-left hover:bg-white/[0.01] transition-colors px-2"
      >
        <div className="flex items-center gap-4 md:gap-6">
          <span className="text-[10px] font-mono text-amber-400/40 tracking-widest">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="text-white font-display text-base md:text-xl font-bold uppercase group-hover:text-amber-400/90 transition-colors">
            {q}
          </h3>
        </div>
        <div className={`w-8 h-8 border border-white/10 flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-amber-400/10 border-amber-400/30 rotate-180' : ''}`}>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </div>
      </button>
      <div ref={contentRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
        <p className="text-white/40 text-sm font-body leading-relaxed pb-6 md:pb-8 pl-10 md:pl-16 pr-12 max-w-2xl">
          {a}
        </p>
      </div>
    </div>
  );
};

/* ── Word Marquee ────────────────────────────────────── */

const WordMarquee = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!trackRef.current) return;
    gsap.to(trackRef.current, { xPercent: -50, ease: 'none', duration: 25, repeat: -1 });
  }, []);
  return (
    <div className="w-full overflow-hidden border-y border-white/5 py-6 bg-black/30">
      <div ref={trackRef} className="flex whitespace-nowrap gap-8" style={{ width: 'max-content' }}>
        {[...scrollingWords, ...scrollingWords].map((word, i) => (
          <span key={i} className="text-white/[0.04] font-display text-5xl md:text-7xl font-extrabold uppercase tracking-tight flex items-center gap-8">
            {word}
            <span className="w-2 h-2 bg-amber-400/20 rotate-45" />
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Main Page ───────────────────────────────────────── */

const MessPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const listItems = messServices.map(s => ({
      id: s.id,
      title: s.title,
      price: s.price,
      category: s.category,
      institution: s.institution,
    }));
    return listItems.filter(
      item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const scrollToBrowse = useCallback(() => {
    browseRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* GSAP Animations */
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero image reveal + parallax
      gsap.fromTo('.mess-hero-img', { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 0.45, duration: 2, ease: 'power3.out' });
      gsap.to('.mess-hero-img', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      // Title word reveal — nvg8 style staggered
      gsap.fromTo(
        '.mess-title-word',
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.12, duration: 1, ease: 'power4.out', delay: 0.4 }
      );

      // Subtitle fade
      gsap.fromTo('.mess-subtitle', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 1.2 });

      // Stats
      gsap.fromTo('.mess-stat', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power3.out', delay: 1.5 });

      // Scroll-triggered sections
      gsap.utils.toArray<HTMLElement>('.mess-reveal').forEach(section => {
        gsap.fromTo(section, { y: 60, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 85%', toggleActions: 'play none none none' },
        });
      });

      // Highlight cards
      gsap.fromTo('.highlight-card', { y: 80, opacity: 0, scale: 0.95 }, {
        y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '.highlight-grid', start: 'top 80%', toggleActions: 'play none none none' },
      });

      // Pricing cards
      gsap.fromTo('.price-card', { y: 60, opacity: 0 }, {
        y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: '.pricing-grid', start: 'top 80%', toggleActions: 'play none none none' },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <main id="main-content" className="min-h-screen bg-black text-white overflow-hidden relative">
      <ScanlineOverlay />

      {/* ═══════════════ HERO ═══════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-end overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={messHero}
            alt=""
            className="mess-hero-img absolute inset-0 w-full h-[130%] object-cover"
            style={{ opacity: 0 }}
          />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(251,191,36,0.06) 0%, transparent 60%)',
          }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>

        {/* Corner brackets */}
        <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-amber-400/30 z-10" />
        <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-amber-400/30 z-10" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-l-2 border-b-2 border-amber-400/30 z-10" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-r-2 border-b-2 border-amber-400/30 z-10" />

        {/* Top status bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 md:px-16 pt-28 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
              Module 05 — Mess & Tiffin
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20 hidden md:block">
            FOOD_SERVICE: ACTIVE
          </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full px-8 md:px-16 pb-20 md:pb-28">
          <div className="max-w-5xl">
            {/* nvg8-style big words stacking */}
            <div className="space-y-1 mb-8">
              <div className="overflow-hidden">
                <span className="mess-title-word block text-white font-display text-6xl sm:text-7xl md:text-[7rem] lg:text-[9rem] font-extrabold leading-[0.85] tracking-tight" style={{ opacity: 0 }}>
                  MESS &
                </span>
              </div>
              <div className="overflow-hidden">
                <span className="mess-title-word block font-display text-6xl sm:text-7xl md:text-[7rem] lg:text-[9rem] font-extrabold leading-[0.85] tracking-tight" style={{ opacity: 0 }}>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-300">TIFFIN</span>
                </span>
              </div>
            </div>

            {/* Subtitle — nvg8 style descriptive block */}
            <div className="mess-subtitle max-w-xl" style={{ opacity: 0 }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-12 bg-gradient-to-r from-amber-400/60 to-transparent" />
                <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-amber-400/60">
                  Curated • Verified • Affordable
                </span>
              </div>
              <p className="text-white/40 text-sm md:text-base font-body leading-relaxed">
                Discover verified mess services, tiffin providers, and campus canteens.
                Student-reviewed, hygiene-checked, and priced for your budget.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8 md:gap-16 mt-12">
              <div className="mess-stat" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl md:text-5xl font-bold">
                  <AnimatedCounter target={18} />
                  <span className="text-amber-400">+</span>
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Verified Services</p>
              </div>
              <div className="mess-stat" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl md:text-5xl font-bold">
                  <AnimatedCounter target={4} duration={1000} suffix=".5" />
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Avg Rating</p>
              </div>
              <div className="mess-stat hidden md:block" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl md:text-5xl font-bold">
                  ₹<AnimatedCounter target={2200} />
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Starting From</p>
              </div>
            </div>
          </div>

          {/* Scroll CTA */}
          <button onClick={scrollToBrowse} className="group absolute bottom-8 right-8 md:right-16 flex flex-col items-center gap-3 text-white/20 hover:text-white/50 transition-colors">
            <span className="text-[9px] font-mono uppercase tracking-[0.4em]">Explore</span>
            <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent group-hover:from-amber-400/50 transition-colors" />
          </button>
        </div>
      </section>

      {/* ═══════════════ WORD MARQUEE ═══════════════ */}
      <WordMarquee />

      {/* ═══════════════ nvg8-STYLE FUN FACT / VALUE PROP ═══════════════ */}
      <section className="py-24 md:py-40 px-8 md:px-16 mess-reveal">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
            {/* Left — big statement text (nvg8 "fun fact" style) */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-amber-400/40 mb-6">Here's the reality</p>
              <h2 className="text-white font-display text-3xl md:text-5xl font-bold leading-[1.1] mb-6">
                Every student needs
                <br />
                <span className="text-white/30">affordable, hygienic</span>
                <br />
                food — daily.
              </h2>
              <p className="text-white/30 text-sm font-body leading-relaxed max-w-md">
                Yet finding a good mess or tiffin near campus is still word-of-mouth.
                No reviews, no price transparency, no accountability. We're changing that.
              </p>
            </div>

            {/* Right — floating feature pills (nvg8 badge style) */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Hygiene Scores', icon: ShieldCheck },
                  { label: 'Live Menus', icon: Utensils },
                  { label: 'Price Comparison', icon: IndianRupee },
                  { label: 'Student Reviews', icon: Star },
                  { label: 'Delivery Tracking', icon: Truck },
                  { label: 'Diet Filters', icon: Heart },
                ].map((badge, i) => {
                  const Icon = badge.icon;
                  return (
                    <div
                      key={i}
                      className="group flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 hover:border-amber-400/20 hover:bg-amber-400/[0.03] transition-all duration-500"
                    >
                      <Icon className="w-4 h-4 text-white/20 group-hover:text-amber-400/70 transition-colors flex-shrink-0" />
                      <span className="text-[11px] font-mono uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors">
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Decorative corner */}
              <div className="absolute -top-4 -right-4 w-8 h-8 border-t border-r border-amber-400/15" />
              <div className="absolute -bottom-4 -left-4 w-8 h-8 border-b border-l border-amber-400/15" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ HIGHLIGHTS / TRUST ═══════════════ */}
      <section className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 mess-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Flame className="w-4 h-4 text-amber-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Trust Architecture</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4">
            WHY TRUST US
          </GlitchText>
          <p className="text-white/30 text-sm font-body max-w-lg mb-16">
            Every listing is verified by students who've actually eaten there.
            Not algorithms — real people, real reviews.
          </p>

          <div className="highlight-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {highlights.map(h => {
              const Icon = h.icon;
              return (
                <div key={h.code} className="highlight-card group relative bg-white/[0.02] border border-white/5 p-8 hover:border-amber-400/20 hover:bg-amber-400/[0.03] transition-all duration-500 overflow-hidden">
                  <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-white/5 group-hover:border-amber-400/30 transition-colors duration-500" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-white/5 group-hover:border-amber-400/30 transition-colors duration-500" />
                  <span className="text-[9px] font-mono text-white/15 uppercase tracking-[0.3em] group-hover:text-amber-400/40 transition-colors">{h.code}</span>
                  <div className="my-6">
                    <div className="w-12 h-12 border border-white/10 group-hover:border-amber-400/30 flex items-center justify-center transition-all duration-500 group-hover:bg-amber-400/5">
                      <Icon className="w-5 h-5 text-white/40 group-hover:text-amber-400/80 transition-colors duration-500" />
                    </div>
                  </div>
                  <h3 className="text-white font-display text-lg font-bold uppercase mb-3 group-hover:text-amber-400/90 transition-colors duration-500">{h.title}</h3>
                  <p className="text-white/25 text-xs font-body leading-relaxed group-hover:text-white/40 transition-colors duration-500">{h.desc}</p>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/0 to-transparent group-hover:via-amber-400/30 transition-all duration-700" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ MEAL PLANS (nvg8 Products-style) ═══════════════ */}
      <section className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 mess-reveal">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Pricing Matrix</span>
              <div className="h-px w-8 bg-white/10" />
            </div>
            <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4 inline-block">
              MEAL PLANS
            </GlitchText>
            <p className="text-white/25 text-sm font-body max-w-md mx-auto mt-4">
              Average monthly costs across verified services. Actual prices vary by provider.
            </p>
          </div>

          <div className="pricing-grid grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {mealPlans.map(plan => (
              <div
                key={plan.name}
                className={`price-card group relative p-8 md:p-10 border transition-all duration-500 ${
                  plan.popular
                    ? 'border-amber-400/30 bg-amber-400/[0.03]'
                    : 'border-white/5 bg-white/[0.01] hover:border-white/15'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-8 px-4 py-1 bg-amber-400 text-black text-[9px] font-mono font-bold uppercase tracking-widest">
                    Most Popular
                  </div>
                )}

                <h3 className="text-white font-display text-xl font-bold uppercase mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-white font-display text-4xl md:text-5xl font-bold">{plan.price}</span>
                  <span className="text-white/30 text-sm font-mono">{plan.period}</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {plan.meals.map(meal => (
                    <span key={meal} className="px-3 py-1 text-[9px] font-mono uppercase tracking-widest bg-white/5 border border-white/10 text-white/50">
                      {meal}
                    </span>
                  ))}
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map(feat => (
                    <div key={feat} className="flex items-center gap-3">
                      <div className={`w-1 h-1 rounded-full ${plan.popular ? 'bg-amber-400' : 'bg-white/20'}`} />
                      <span className="text-white/40 text-xs font-body">{feat}</span>
                    </div>
                  ))}
                </div>

                <button className={`w-full py-3 text-[10px] font-mono uppercase tracking-widest border transition-all duration-300 ${
                  plan.popular
                    ? 'border-amber-400/50 text-amber-400 hover:bg-amber-400/10'
                    : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                }`}>
                  View Services
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ BROWSE LISTINGS ═══════════════ */}
      <section ref={browseRef} className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 mess-reveal">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex items-center gap-4 mb-4">
            <Search className="w-4 h-4 text-amber-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Service Database</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4">
            BROWSE SERVICES
          </GlitchText>

          <ModuleSearchFilter
            onSearch={setSearchQuery}
            onFilterChange={() => {}}
            resultCount={filteredItems.length}
            categories={[
              { id: 'veg', label: 'Vegetarian', count: 3 },
              { id: 'tiffin', label: 'Tiffin', count: 2 },
              { id: 'canteen', label: 'Canteen', count: 1 },
            ]}
            priceRange={[0, 5000]}
          />

          <ListingGrid items={filteredItems} />

          {filteredItems.length === 0 && (
            <div className="py-24 text-center space-y-6">
              <div className="w-16 h-16 border border-white/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                <X className="w-8 h-8 text-white -rotate-45" />
              </div>
              <p className="text-white/20 uppercase tracking-[0.4em] font-mono text-[10px]">No food services found</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════ FAQ (nvg8-style accordion) ═══════════════ */}
      <section className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 mess-reveal">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <ChefHat className="w-4 h-4 text-amber-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">You Ask, We Answer</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-12">
            COMMON QUESTIONS
          </GlitchText>

          <div className="border-t border-white/5">
            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ DISCLAIMER ═══════════════ */}
      <section className="py-12 px-8 md:px-16 border-t border-white/5 mess-reveal">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3 p-6 border border-amber-400/10 bg-amber-400/[0.02]">
            <ChefHat className="w-4 h-4 text-amber-400/40 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-white/40 text-xs font-body leading-relaxed">
                <span className="text-amber-400/70 font-bold">Service Disclaimer:</span> All mess and tiffin information is based on student submissions and basic verification. 
                Prices, menus, and availability may change without notice.
              </p>
              <p className="text-white/25 text-[10px] font-body leading-relaxed">
                This platform does not facilitate online ordering, delivery, or payment processing. Transactions occur directly between students and service providers. 
                We do not guarantee food quality, hygiene standards, or service reliability. Always verify details independently before committing to any service.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="relative py-32 md:py-48 px-8 md:px-16 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.04) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-amber-400/40 mb-8 block">
            // READY TO ORDER
          </span>
          <h2 className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-[0.9]">
            NEVER GO
          </h2>
          <h2 className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.9]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-300">HUNGRY</span>
          </h2>
          <p className="text-white/30 text-sm md:text-base font-body max-w-xl mx-auto mb-12">
            Verified mess, tiffin, and canteen services — all in one place.
            Transparent pricing. Real student reviews. No surprises.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={scrollToBrowse} className="group relative px-10 py-4 bg-white text-black font-display uppercase tracking-wider text-xs font-bold hover:bg-amber-400 transition-colors duration-300 overflow-hidden">
              <span className="relative z-10 flex items-center gap-3">
                Find Your Mess <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button className="px-10 py-4 border border-white/10 text-white/50 font-display uppercase tracking-wider text-xs font-bold hover:border-white/30 hover:text-white/80 transition-all duration-300">
              Submit a Service
            </button>
          </div>

          <div className="mt-20 flex items-center justify-center gap-6">
            <div className="h-px w-16 bg-white/5" />
            <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.3em]">MESS_MODULE // v1.0 // VERIFIED</span>
            <div className="h-px w-16 bg-white/5" />
          </div>
        </div>
      </section>
    </main>
  );
};

export default MessPage;
