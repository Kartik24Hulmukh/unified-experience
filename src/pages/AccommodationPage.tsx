import { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
import { CollegeVerificationBanner } from '@/components/CollegeVerificationBanner';
import GlitchText from '@/components/GlitchText';
import AnimatedCounter from '@/components/AnimatedCounter';
import { useTypewriter } from '@/hooks/useTypewriter';
import { Search, X, Shield, Lock, Eye, Users, MapPin, ArrowRight, Terminal, Database, Wifi, Plus } from 'lucide-react';
import ListingFormModal from '@/components/ListingFormModal';
import ResourceListingForm from '@/components/ResourceListingForm';
import { useAuth } from '@/contexts/AuthContext';
import { useRestriction } from '@/hooks/useRestriction';
import { toast } from '@/components/ui/use-toast';
import housingHandover from '@/assets/housing-handover.jpg';
import { useListings } from '@/hooks/api/useApi';
import { getBrowseVisibleListings } from '@/lib/browse-listings';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { SEO } from '@/components/SEO';

// ScrollTrigger registered in lib/gsap-init.ts

/* ── Data ─────────────────────────────────────────────── */

// Zone areas are descriptive location labels only — listing counts come from the API
const ZONE_LABELS = [
  { name: 'Near Campus', distance: '0-2 km', code: 'ZONE_A' },
  { name: 'City Center', distance: '3-5 km', code: 'ZONE_B' },
  { name: 'Outer Ring', distance: '5-10 km', code: 'ZONE_C' },
];

const protocols = [
  { icon: Lock, title: 'Privacy First', desc: 'No public phone numbers. Contact details shared only after mutual consent.', code: 'PRT_001' },
  { icon: Shield, title: 'Verified Only', desc: 'All listings go through institutional review before becoming visible.', code: 'PRT_002' },
  { icon: Users, title: 'Consent Based', desc: 'Both parties must agree before any personal data exchange happens.', code: 'PRT_003' },
  { icon: Eye, title: 'Admin Oversight', desc: 'Full auditability trail. Admins can intervene in disputes.', code: 'PRT_004' },
];

// Console lines reflect real module initialisation — no fabricated counts
const consoleLines = [
  '// INITIALIZING ACCOMMODATION_MODULE...',
  '> Loading listing database...',
  '> Establishing secure connection...',
  '> Privacy protocols ACTIVE',
  '> Authentication: VERIFIED',
  '> Module status: READY',
  '',
  'READY FOR ACCESS...',
];

/* ── Console Typewriter Hook (imported from @/hooks/useTypewriter) ── */

/* ── Glitch Text Component (imported from @/components/GlitchText) ── */

/* ── Data Ticker ─────────────────────────────────────── */

const DataTicker = ({ visibleItems = [] }: { visibleItems?: unknown[] }) => {
  const tickerRef = useRef<HTMLDivElement>(null);
  const data = [
    'ACCOMMODATION_MODULE v2.6',
    'PRIVACY_PROTOCOL: ACTIVE',
    `LISTINGS: ${visibleItems.length} AVAILABLE`,
    `ZONES: ${ZONE_LABELS.length} AREAS`,
    'CONSENT_ENGINE: ENABLED',
    'ADMIN_OVERSIGHT: ACTIVE',
  ];

  useEffect(() => {
    if (!tickerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(tickerRef.current!, {
        xPercent: -50,
        ease: 'none',
        duration: 30,
        repeat: -1,
      });
    }, tickerRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div className="w-full overflow-hidden border-y border-white/5 bg-black/50 py-3">
      <div ref={tickerRef} className="flex whitespace-nowrap gap-12" style={{ width: 'max-content' }}>
        {[...data, ...data].map((item, i) => (
          <span key={i} className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400/40 flex items-center gap-3">
            <span className="w-1 h-1 bg-cyan-400/60 rounded-full" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Animated Counter (imported from @/components/AnimatedCounter) ── */

const ACCOMMODATION_CATEGORIES = [
  { value: 'pg', label: 'PG Accommodation' },
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'flatmate', label: 'Flatmate Search' },
  { value: 'hostel', label: 'Hostel Room' },
];

/* ── Main Page ───────────────────────────────────────── */

const AccommodationPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [activeArea, setActiveArea] = useState(0);
  const [heroLoaded, setHeroLoaded] = useState(false);

  // URL-persisted search/filter state (survives refresh and enables deep links)
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const activeCategory = searchParams.get('category') ?? null;
  const setSearchQuery = (q: string) => setSearchParams(prev => { if (q) prev.set('q', q); else prev.delete('q'); return new URLSearchParams(prev); }, { replace: true });
  const setActiveCategory = (cat: string | null) => setSearchParams(prev => { if (cat) prev.set('category', cat); else prev.delete('category'); return new URLSearchParams(prev); }, { replace: true });

  const minPrice = searchParams.get('min_price') ? Number(searchParams.get('min_price')) : 0;
  const maxPrice = searchParams.get('max_price') ? Number(searchParams.get('max_price')) : 30000;
  const priceFilter = useMemo<[number, number]>(() => [minPrice, maxPrice], [minPrice, maxPrice]);

  const setPriceFilter = (val: [number, number]) => {
    setSearchParams(prev => {
      prev.set('min_price', val[0].toString());
      prev.set('max_price', val[1].toString());
      return new URLSearchParams(prev);
    }, { replace: true });
  };

  const { displayedLines, isComplete } = useTypewriter(consoleLines, 25, 150, 800);

  // Fetch listings from API
  const { data: listingsResponse, isLoading, isError, error, refetch } = useListings({ module: 'accommodation' });
  const visibleItems = useMemo(() => getBrowseVisibleListings(listingsResponse?.data ?? []), [listingsResponse?.data]);

  const filteredItems = useMemo(() => {
    return visibleItems.filter(
      item => {
        const itemTitle = item.title || '';
        const itemCategory = item.category || '';
        
        const matchesSearch =
          itemTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          itemCategory.toLowerCase().includes(searchQuery.toLowerCase());
          
        const matchesCategory = !activeCategory ||
          itemCategory.toLowerCase() === activeCategory.toLowerCase();
          
        const matchesPrice =
          Number(item.price) >= priceFilter[0] && Number(item.price) <= priceFilter[1];
          
        return matchesSearch && matchesCategory && matchesPrice;
      }
    );
  }, [searchQuery, activeCategory, priceFilter, visibleItems]);

  const categoryCounts = useMemo(() => {
    return visibleItems.reduce<Record<string, number>>((acc, item) => {
      const cat = (item.category || '').toLowerCase();
      if (cat) acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
  }, [visibleItems]);

  const handleFilterChange = (filters: { categories?: string[]; price?: [number, number] }) => {
    if (filters.categories !== undefined) {
      setActiveCategory(filters.categories.length > 0 ? filters.categories[0] : null);
    }
    if (filters.price !== undefined) {
      setPriceFilter(filters.price);
    }
  };

  const scrollToBrowse = useCallback(() => {
    browseRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { canPerform } = useRestriction();
  const canCreateListing = canPerform('CREATE_LISTING');

  /* GSAP Master Timeline */
  // useLayoutEffect for GSAP animations to prevent flash of unstyled content
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const heroStartScale = 1;
      // Hero image reveal
      gsap.fromTo('.accom-hero-img', { scale: heroStartScale, opacity: 0 }, { scale: 1, opacity: 0.4, duration: 1, ease: 'power2.out' });
      gsap.to('.accom-hero-img', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      // CSS fallback: ensure hero text visible even if GSAP fails
      gsap.set('.accom-title-char, .stat-block', { opacity: 1, y: 0, rotateX: 0 });
      setHeroLoaded(true);

      // Hero title reveal
      gsap.fromTo(
        '.accom-title-char',
        { y: 120, opacity: 0, rotateX: -90 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          stagger: 0.04,
          duration: 1.2,
          ease: 'power4.out',
          delay: 0.3,
          onComplete: () => setHeroLoaded(true),
        }
      );

      // Stats counter reveal
      gsap.fromTo(
        '.stat-block',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          duration: 0.8,
          ease: 'power3.out',
          delay: 1.5,
        }
      );

      // Scroll-triggered sections
      gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((section) => {
        gsap.fromTo(
          section,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Protocol cards stagger
      gsap.fromTo(
        '.protocol-card',
        { y: 80, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          stagger: 0.12,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.protocol-grid',
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Zone cards stagger
      gsap.fromTo(
        '.zone-card',
        { x: -40, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.zone-list',
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Info grid items
      gsap.fromTo(
        '.info-cell',
        { scale: 0.8, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.08,
          duration: 0.6,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: '.info-grid',
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, mainRef);

    return () => ctx.revert();
  }, []);

  // Dynamically calculate the rent range from visible listings instead of hardcoding
  const rentValues = visibleItems.map(item => Number(item.price)).filter(p => !isNaN(p) && p > 0);
  const minRent = rentValues.length ? Math.min(...rentValues) : null;
  const maxRent = rentValues.length ? Math.max(...rentValues) : null;
  const dynamicRentRange = minRent && maxRent 
    ? `₹${minRent.toLocaleString()} – ₹${maxRent.toLocaleString()} / mo` 
    : 'Contact for pricing';

  return (
    <>
    <SEO title="Campus Accommodations" description="Find verified flats, PGs, and hostels mapped close to your college. Connect with landlords directly through our secure platform." />
    <div ref={mainRef} className="dark min-h-[100dvh] bg-background text-foreground overflow-hidden relative pt-[var(--nav-height)]">

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex flex-col justify-between overflow-hidden">
        {/* Background image + overlays */}
        <div className="absolute inset-0 z-0">
          <img
            src={housingHandover}
            alt=""
            width={1920}
            height={1080}
            className="accom-hero-img absolute inset-0 w-full h-full max-w-full object-cover"
            style={{ opacity: 0 }}
            loading="eager"
          />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(34,211,238,0.06) 0%, transparent 60%)',
          }} />
          <div className="absolute inset-0 opacity-[0.03]" aria-hidden>
            <div className="absolute inset-0" style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>

        {/* Corner brackets */}
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 w-6 h-6 sm:w-12 sm:h-12 border-l-2 border-t-2 border-cyan-400/30" />
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 w-6 h-6 sm:w-12 sm:h-12 border-r-2 border-t-2 border-cyan-400/30" />
        <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 w-6 h-6 sm:w-12 sm:h-12 border-l-2 border-b-2 border-cyan-400/30" />
        <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 w-6 h-6 sm:w-12 sm:h-12 border-r-2 border-b-2 border-cyan-400/30" />

        {/* Top status bar */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 md:px-16 pt-28 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
              Module 02 — Accommodation
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20 hidden md:block">
            SYSTEM STATUS: OPERATIONAL
          </span>
        </div>

        {/* Main hero content */}
        <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center px-4 sm:px-8 md:px-16">
          {/* Left — Title block */}
          <div className="w-full md:w-3/5 py-12">
            {/* sr-only h1 for SEO/accessibility — visual title is animated spans below */}
            <h1 className="sr-only">Accommodation</h1>
            <div className="overflow-hidden mb-2">
              <div className="flex flex-wrap">
                {'ACCOMMO'.split('').map((char, i) => (
                  <span
                    key={`a-${i}`}
                    className="accom-title-char inline-block text-white font-display text-[clamp(3.25rem,14vw,5rem)] sm:text-7xl md:text-[8rem] lg:text-[10rem] font-extrabold leading-[0.9] tracking-tight"
                    style={{ opacity: 0 }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-hidden mb-8">
              <div className="flex flex-wrap">
                {'DATION'.split('').map((char, i) => (
                  <span
                    key={`b-${i}`}
                    className="accom-title-char inline-block text-white font-display text-[clamp(3.25rem,14vw,5rem)] sm:text-7xl md:text-[8rem] lg:text-[10rem] font-extrabold leading-[0.9] tracking-tight"
                    style={{ opacity: 0 }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>

            {/* Subtitle with typing cursor */}
            <div className={`transition-opacity duration-1000 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-white/40 text-sm md:text-base font-body max-w-lg leading-relaxed">
                Privacy-preserving housing discovery. Find PGs, flats, and
                flatmates without exposing personal data.
              </p>

              {/* Accent line */}
              <div className="flex items-center gap-4 mt-8">
                <div className="h-px w-16 bg-gradient-to-r from-cyan-400/60 to-transparent" />
                <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-cyan-400/60">
                  Secure • Verified • Consent-Based
                </span>
              </div>
            </div>

            {/* Stats row — live counts from API */}
            <div className="flex flex-wrap gap-8 sm:gap-12 mt-12">
              <div className="stat-block" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl sm:text-5xl md:text-6xl font-bold">
                  <AnimatedCounter target={visibleItems.length} />
                  {visibleItems.length > 0 && <span className="text-cyan-400">+</span>}
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Active Listings</p>
              </div>
              <div className="stat-block" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl sm:text-5xl md:text-6xl font-bold">
                  <AnimatedCounter target={ZONE_LABELS.length} duration={1000} />
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Coverage Zones</p>
              </div>
            </div>
          </div>

          {/* Right — Console terminal */}
          <div className="w-full md:w-2/5 md:pl-12 py-12">
            <div className="bg-black/80 border border-white/10 backdrop-blur-sm overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/20 ml-3">
                  ACCOM_CONSOLE.SH
                </span>
              </div>

              {/* Terminal body */}
              <div className="p-5 font-mono text-[11px] leading-relaxed min-h-[280px] max-h-[360px] overflow-hidden">
                {displayedLines.map((line, i) => (
                  <div key={i} className={`${
                    line.startsWith('//') ? 'text-white/20' :
                    line.startsWith('>') ? 'text-cyan-400/70' :
                    line === '' ? '' :
                    'text-green-400/80'
                  }`}>
                    {line}
                  </div>
                ))}
                {!isComplete && (
                  <span className="inline-block w-2 h-4 bg-cyan-400/80 animate-pulse ml-1" />
                )}
                {isComplete && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-cyan-400/80">{'>'}</span>
                    <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex flex-col items-center pb-12">
          <button
            onClick={scrollToBrowse}
            aria-label="Browse listings"
            className="group flex flex-col items-center gap-3 text-white/20 hover:text-white/50 transition-colors"
          >
            <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent group-hover:from-cyan-400/50 transition-colors" />
          </button>
        </div>
      </section>

      {/* ═══════════════ DATA TICKER ═══════════════ */}
      <DataTicker visibleItems={visibleItems} />

      {/* ═══════════════ ZONE EXPLORER ═══════════════ */}
      <section className="py-10 sm:py-16 md:py-20 px-4 sm:px-8 md:px-16 reveal-section">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="flex items-center gap-4 mb-4">
            <Terminal className="w-4 h-4 text-cyan-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
              Zone Classification
            </span>
          </div>
          <h2 className="sr-only">Coverage Zones</h2>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4">
            COVERAGE ZONES
          </GlitchText>
          <p className="text-white/30 text-sm font-body max-w-lg mb-16">
            Select your preferred zone to explore verified listings in that area.
            Each zone is monitored and listings are refreshed regularly.
          </p>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            {/* Zone list */}
            <div className="lg:w-2/5 zone-list space-y-3">
              {ZONE_LABELS.map((area, i) => (
                <button
                  key={area.name}
                  onClick={() => setActiveArea(i)}
                  className={`zone-card w-full text-left p-5 md:p-6 border transition-all duration-500 group relative overflow-hidden ${
                    activeArea === i
                      ? 'border-cyan-400/40 bg-cyan-400/5'
                      : 'border-white/5 hover:border-white/15 bg-white/[0.01]'
                  }`}
                >
                  {/* Active indicator bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-500 ${
                    activeArea === i ? 'bg-cyan-400' : 'bg-transparent'
                  }`} />

                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[9px] font-mono text-cyan-400/50 tracking-widest">{area.code}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${activeArea === i ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`} />
                      </div>
                      <h3 className="text-white font-display text-xl md:text-2xl font-bold uppercase">
                        {area.name}
                      </h3>
                      <p className="text-white/30 text-xs font-mono mt-1">{area.distance} from campus</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Zone detail panel */}
            <div className="lg:w-3/5 relative">
              <div className="aspect-[4/3] lg:aspect-video bg-black border border-white/10 relative overflow-hidden group">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: `
                    linear-gradient(rgba(0,212,170,0.3) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,212,170,0.3) 1px, transparent 1px)
                  `,
                  backgroundSize: '40px 40px',
                }} />

                {/* Pulse circle */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border border-cyan-400/20 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full border border-cyan-400/30 flex items-center justify-center animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-cyan-400/10 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-cyan-400/80" />
                        </div>
                      </div>
                    </div>
                    {/* Ripple rings */}
                    <div className="absolute inset-0 rounded-full border border-cyan-400/10 animate-ping" style={{ animationDuration: '3s' }} />
                    <div className="absolute -inset-8 rounded-full border border-cyan-400/5 animate-ping" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
                  </div>
                </div>

                {/* Data overlay */}
                <div className="absolute top-4 left-4 space-y-1">
                  <p className="text-[9px] font-mono text-cyan-400/50 uppercase tracking-widest">Active Zone</p>
                  <p className="text-white font-display text-2xl font-bold">{ZONE_LABELS[activeArea].name}</p>
                </div>

                <div className="absolute top-4 right-4 text-right space-y-1">
                  <p className="text-[9px] font-mono text-cyan-400/50 uppercase tracking-widest">Status</p>
                  <div className="flex items-center gap-2 justify-end">
                    {visibleItems.length > 0 ? (
                      <>
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-[10px] font-mono text-green-400/80">LISTINGS AVAILABLE</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                        <span className="text-[10px] font-mono text-white/30">NO LISTINGS YET</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-4 left-4">
                  <p className="text-[9px] font-mono text-white/20">{ZONE_LABELS[activeArea].code} // {ZONE_LABELS[activeArea].distance}</p>
                </div>

                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={scrollToBrowse}
                    className="flex items-center gap-2 px-5 py-2.5 border border-cyan-400/30 text-cyan-400/80 text-[10px] font-mono uppercase tracking-widest hover:bg-cyan-400/10 hover:border-cyan-400/50 transition-all duration-300"
                  >
                    Browse Listings
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Scanline effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="w-full h-px bg-cyan-400/10 animate-[scan-line_3s_linear_infinite]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SECURITY PROTOCOLS ═══════════════ */}
      <section className="py-10 sm:py-16 md:py-20 px-4 sm:px-8 md:px-16 border-t border-white/5 reveal-section">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Database className="w-4 h-4 text-cyan-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
              Trust Architecture
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
            <div>
              <h2 className="sr-only">Security Protocols</h2>
              <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4">
                SECURITY PROTOCOLS
              </GlitchText>
              <p className="text-white/30 text-sm font-body max-w-lg">
                Every interaction is governed by privacy-first protocols.
                Your data is yours until you explicitly decide to share it.
              </p>
            </div>
          </div>

          <div className="protocol-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {protocols.map((protocol) => {
              const Icon = protocol.icon;
              return (
                <div
                  key={protocol.code}
                  className="protocol-card group relative bg-white/[0.02] border border-white/5 p-6 md:p-8 hover:border-cyan-400/20 hover:bg-cyan-400/[0.03] transition-all duration-500 overflow-hidden"
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-white/5 group-hover:border-cyan-400/30 transition-colors duration-500" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-white/5 group-hover:border-cyan-400/30 transition-colors duration-500" />

                  {/* Protocol code */}
                  <span className="text-[9px] font-mono text-white/15 uppercase tracking-[0.3em] group-hover:text-cyan-400/40 transition-colors">
                    {protocol.code}
                  </span>

                  {/* Icon */}
                  <div className="my-6">
                    <div className="w-12 h-12 border border-white/10 group-hover:border-cyan-400/30 flex items-center justify-center transition-all duration-500 group-hover:bg-cyan-400/5">
                      <Icon className="w-5 h-5 text-white/40 group-hover:text-cyan-400/80 transition-colors duration-500" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-white font-display text-lg font-bold uppercase mb-3 group-hover:text-cyan-400/90 transition-colors duration-500">
                    {protocol.title}
                  </h3>
                  <p className="text-white/25 text-xs font-body leading-relaxed group-hover:text-white/40 transition-colors duration-500">
                    {protocol.desc}
                  </p>

                  {/* Bottom line */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/0 to-transparent group-hover:via-cyan-400/30 transition-all duration-700" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ BROWSE LISTINGS ═══════════════ */}
      <section ref={browseRef} className="py-10 sm:py-16 md:py-20 px-4 sm:px-8 md:px-16 border-t border-white/5 reveal-section">
        <div className="max-w-7xl mx-auto space-y-16">
          <CollegeVerificationBanner />
          <div className="flex items-center gap-4 mb-4">
            <Search className="w-4 h-4 text-cyan-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
              Database Query
            </span>
          </div>
          <h2 className="sr-only">Browse Listings</h2>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4">
            BROWSE LISTINGS
          </GlitchText>

          <ModuleSearchFilter
            onSearch={setSearchQuery}
            onFilterChange={handleFilterChange}
            resultCount={filteredItems.length}
            categories={ACCOMMODATION_CATEGORIES.map(cat => ({
              id: cat.value,
              label: cat.label,
              count: categoryCounts[cat.value.toLowerCase()] || 0
            }))}
            priceRange={[0, 30000]}
          />

          {isLoading && filteredItems.length === 0 ? (
            <LoadingSpinner className="py-16" />
          ) : isError ? (
            <div className="py-16 max-w-xl mx-auto">
              <ErrorFallback error={error} onRetry={refetch} />
            </div>
          ) : (
            <>
              <ListingGrid items={filteredItems} />

              {filteredItems.length === 0 && (
                <div className="py-24 text-center space-y-6">
                  <div className="w-16 h-16 border border-portal-foreground/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                    <X className="w-8 h-8 text-portal-foreground -rotate-45" />
                  </div>
                  <p className="text-portal-foreground/20 uppercase tracking-[0.4em] font-mono text-[10px]">
                    No accommodation protocols found
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══════════════ DATA MATRIX — What You'll See ═══════════════ */}
      <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-8 md:px-16 border-t border-white/5 bg-white/[0.01] reveal-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
                Data Matrix
              </span>
              <div className="h-px w-8 bg-white/10" />
            </div>
            <h2 className="sr-only">What You'll See</h2>
            <GlitchText className="text-white font-display text-3xl sm:text-4xl md:text-6xl font-bold mb-4 inline-block">
              WHAT YOU'LL SEE
            </GlitchText>
            <p className="text-white/25 text-sm font-body max-w-md mx-auto mt-4">
              Each listing displays only essential information.
              Contact details are shared only after mutual consent.
            </p>
          </div>

          <div className="info-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Area', value: 'Location Name', icon: MapPin },
              { label: 'Rent Range', value: dynamicRentRange, icon: Database },
              { label: 'Distance', value: 'Shown per listing', icon: Wifi },
              { label: 'Availability', value: 'Shown per listing', icon: Eye },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="info-cell group relative p-6 md:p-8 border border-white/5 text-center hover:border-cyan-400/20 hover:bg-cyan-400/[0.02] transition-all duration-500"
                >
                  <Icon className="w-4 h-4 text-white/10 group-hover:text-cyan-400/50 transition-colors mx-auto mb-4" />
                  <p className="text-white/25 text-[9px] uppercase tracking-[0.3em] font-mono mb-3">
                    {item.label}
                  </p>
                  <p className="text-white font-display text-xs sm:text-sm md:text-base font-bold group-hover:text-cyan-400/90 transition-colors">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 border border-white/5">
              <Lock className="w-3 h-3 text-white/20" />
              <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">
                Contact details shared only after mutual consent
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA SECTION ═══════════════ */}
      <section className="relative py-20 sm:py-32 md:py-48 px-4 sm:px-8 md:px-16 border-t border-white/5 overflow-hidden">
        {/* Background radial gradient */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.03) 0%, transparent 70%)',
        }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-cyan-400/40 mb-8 block">
            // READY TO INITIALIZE
          </span>

          <h2 className="text-white font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-[0.9]">
            FIND YOUR
          </h2>
          <h2 className="text-white font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.9]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">
              PLACE
            </span>
          </h2>

          <p className="text-white/30 text-sm md:text-base font-body max-w-xl mx-auto mb-12">
            Safe, private, trusted accommodation discovery for MCTRGIT students.
            Your privacy is the foundation, not an afterthought.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToBrowse}
              className="group relative px-10 py-4 bg-white text-black font-display uppercase tracking-wider text-xs font-bold hover:bg-cyan-400 transition-colors duration-300 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-3">
                Start Exploring
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <button
              onClick={scrollToBrowse}
              className="px-10 py-4 border border-white/10 text-white/50 font-display uppercase tracking-wider text-xs font-bold hover:border-white/30 hover:text-white/80 transition-all duration-300"
            >
              Learn More
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  toast({ title: 'Sign In Required', description: 'Please sign in to list your property.', variant: 'destructive' });
                  return;
                }
                if (!canCreateListing) {
                  toast({ title: 'Action Unavailable', description: 'Your account is currently restricted from creating listings.', variant: 'destructive' });
                  return;
                }
                setIsModalOpen(true);
              }}
              className="group flex items-center gap-3 px-8 py-3 border border-cyan-400/30 text-cyan-400/80 text-[10px] font-mono uppercase tracking-widest hover:bg-cyan-400/10 hover:border-cyan-400/50 transition-all duration-300"
            >
              <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-300" />
              List Your Property
            </button>
          </div>

          {/* Bottom decoration */}
          <div className="mt-20 flex items-center justify-center gap-6">
            <div className="h-px w-16 bg-white/5" />
            <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.3em]">
              ACCOM_MODULE // v2.6 // SECURE
            </span>
            <div className="h-px w-16 bg-white/5" />
          </div>
        </div>
      </section>

      <ListingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="List Your Property"
      >
        <ResourceListingForm
          moduleName="Accommodation"
          categories={ACCOMMODATION_CATEGORIES}
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
        />
      </ListingFormModal>
    </div>
    </>
  );
};

export default AccommodationPage;
