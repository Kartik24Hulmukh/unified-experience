import { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
import { useListings } from '@/hooks/api/useApi';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import GlitchText from '@/components/GlitchText';
import AnimatedCounter from '@/components/AnimatedCounter';
import FaqItem from '@/components/FaqItem';
import WordMarquee from '@/components/WordMarquee';
const hospitalHero = '/Hospital.png';
import {
  Search, X, ArrowRight, Phone, Clock, Activity,
  Heart, Stethoscope, Pill, AlertTriangle,
  ChevronDown, MapPin, Shield, Siren,
  Cross, Ambulance, Thermometer, BriefcaseMedical
} from 'lucide-react';

// ScrollTrigger registered in lib/gsap-init.ts

/* ── Data ─────────────────────────────────────────────── */

const hospitals = [
  {
    id: 'hp1',
    title: 'Campus Medical Center',
    price: '50',
    category: 'On-Campus',
    institution: 'Campus Unit',
    distance: '0 km',
    emergency: false,
    hours: '9 AM - 5 PM',
    services: ['General OPD', 'First Aid', 'Basic Tests'],
  },
  {
    id: 'hp2',
    title: 'Bombay Hospital & MRC',
    price: '500',
    category: 'Hospital',
    institution: 'Premium',
    distance: '4.2 km',
    emergency: true,
    hours: '24/7',
    services: ['Emergency', 'Surgery', 'ICU', 'Diagnostics'],
  },
  {
    id: 'hp3',
    title: 'City Pediatric Clinic',
    price: '300',
    category: 'Clinic',
    institution: 'Private Partner',
    distance: '2.5 km',
    emergency: false,
    hours: '10 AM - 8 PM',
    services: ['General', 'Dental', 'Eye Care'],
  },
  {
    id: 'hp4',
    title: 'LifeLine Pharmacy 24/7',
    price: '0',
    category: 'Pharmacy',
    institution: 'Verified Store',
    distance: '0.3 km',
    emergency: false,
    hours: '24/7',
    services: ['Medicines', 'First Aid Kits', 'Health Supplements'],
  },
  {
    id: 'hp5',
    title: 'MedPlus Diagnostics',
    price: '200',
    category: 'Diagnostics',
    institution: 'Student Discount',
    distance: '1.8 km',
    emergency: false,
    hours: '7 AM - 9 PM',
    services: ['Blood Tests', 'X-Ray', 'MRI', 'ECG'],
  },
  {
    id: 'hp6',
    title: 'Government General Hospital',
    price: '20',
    category: 'Hospital',
    institution: 'Public',
    distance: '5.5 km',
    emergency: true,
    hours: '24/7',
    services: ['Emergency', 'General Ward', 'Outpatient', 'Surgery'],
  },
];

const emergencyContacts = [
  { label: 'Campus Medical', number: '108 (On Campus)', icon: Cross, priority: 'high' },
  { label: 'Ambulance', number: '102', icon: Ambulance, priority: 'critical' },
  { label: 'National Emergency', number: '112', icon: Phone, priority: 'critical' },
  { label: 'Poison Control', number: '1800-11-6117', icon: AlertTriangle, priority: 'high' },
];

const serviceCategories = [
  {
    icon: Stethoscope,
    title: 'General Checkup',
    desc: 'Routine health examinations, seasonal illness, fever, cold, basic consultations available near campus.',
    code: 'SVC_GEN',
    facilities: 4,
  },
  {
    icon: Siren,
    title: 'Emergency Care',
    desc: '24/7 emergency services with ambulance support. Two hospitals within 5km radius offer emergency rooms.',
    code: 'SVC_EMR',
    facilities: 2,
  },
  {
    icon: Pill,
    title: 'Pharmacy',
    desc: 'Round-the-clock pharmacies near campus. Student discounts available at selected partners.',
    code: 'SVC_PHR',
    facilities: 3,
  },
  {
    icon: Thermometer,
    title: 'Diagnostics',
    desc: 'Blood work, imaging, and pathology labs with student-friendly pricing and quick turnaround.',
    code: 'SVC_DIA',
    facilities: 2,
  },
];

const healthTips = [
  { title: 'Health Card', desc: 'Carry your student health card for free/discounted treatment at campus medical center.' },
  { title: 'Insurance', desc: 'Check if your college fee includes medical insurance. Most institutions cover basic OPD.' },
  { title: 'Medicine Kit', desc: 'Keep a basic medicine kit: paracetamol, ORS, bandages, antiseptic in your room.' },
  { title: 'Mental Health', desc: 'Campus counseling center offers free and confidential mental health support sessions.' },
];

const faqs = [
  {
    q: 'What medical facilities are available on campus?',
    a: 'The campus has a medical center open from 9 AM to 5 PM on weekdays. It handles general consultations, first aid, and basic tests. For emergencies outside hours, the nearest 24/7 hospital is 4.2 km away.',
  },
  {
    q: 'Is there ambulance access to campus?',
    a: 'Yes. The campus is accessible by ambulance. Call 102 (government ambulance) or 108 (medical emergency). The campus security desk can also coordinate emergency transport.',
  },
  {
    q: 'Do any hospitals offer student discounts?',
    a: 'Several partner clinics and diagnostic centers offer 10-20% discounts on showing a valid student ID. The listings indicate which services offer student-friendly pricing.',
  },
  {
    q: 'Where can I get medicines late at night?',
    a: 'LifeLine Pharmacy (0.3 km from campus) operates 24/7. There is also a medical shop near the main gate that stays open until midnight.',
  },
  {
    q: 'Does the college provide health insurance?',
    a: 'Most students are covered under a basic group medical insurance as part of their fees. Check with the admin office for your coverage details and claim procedures.',
  },
];

const scrollingWords = [
  'HOSPITAL', 'CLINIC', 'PHARMACY', 'EMERGENCY', 'DIAGNOSTICS',
  'AMBULANCE', 'HEALTH', 'MEDICAL', 'WELLNESS', 'CARE',
];

/* ── Reusable Components (imported from @/components) ── */

/* ── Emergency Banner ────────────────────────────────── */

const EmergencyBanner = () => (
  <div className="w-full bg-red-500/5 border-y border-red-500/10 py-4 px-8 md:px-16">
    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-red-400/70">
          Emergency? Call 112 or 102 immediately
        </span>
      </div>
      <div className="flex items-center gap-6">
        {emergencyContacts.slice(0, 2).map(c => (
          <a
            key={c.number}
            href={`tel:${c.number.replace(/[^0-9]/g, '')}`}
            className="flex items-center gap-2 text-[10px] font-mono text-red-400/60 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            <Phone className="w-3 h-3" />
            {c.number}
          </a>
        ))}
      </div>
    </div>
  </div>
);

/* ── Main Page ───────────────────────────────────────── */

const HospitalPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: listingsResponse, isLoading, isError, error, refetch } = useListings({ module: 'hospital' });
  const apiItems = listingsResponse?.data ?? [];

  const filteredItems = useMemo(() => {
    const listItems = apiItems.map((h: any) => ({
      id: h.id,
      title: h.title,
      price: h.price,
      category: h.category,
      institution: h.institution,
    }));
    return listItems.filter(
      item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, apiItems]);

  const scrollToBrowse = useCallback(() => {
    browseRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* GSAP Animations */
  // useLayoutEffect for GSAP animations to prevent flash of unstyled content
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Hero image reveal + parallax
      gsap.fromTo('.hosp-hero-img', { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 0.45, duration: 2, ease: 'power3.out' });
      gsap.to('.hosp-hero-img', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      // Title word reveal
      gsap.fromTo('.hosp-title-word', { y: 100, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 1, ease: 'power4.out', delay: 0.4 });

      // Subtitle
      gsap.fromTo('.hosp-subtitle', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 1.2 });

      // Stats
      gsap.fromTo('.hosp-stat', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power3.out', delay: 1.5 });

      // Scroll sections
      gsap.utils.toArray<HTMLElement>('.hosp-reveal').forEach(section => {
        gsap.fromTo(section, { y: 60, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 85%', toggleActions: 'play none none none' },
        });
      });

      // Service category cards
      gsap.fromTo('.svc-card', { y: 80, opacity: 0, scale: 0.95 }, {
        y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '.svc-grid', start: 'top 80%', toggleActions: 'play none none none' },
      });

      // Emergency contacts
      gsap.fromTo('.emergency-card', { x: -30, opacity: 0 }, {
        x: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: '.emergency-grid', start: 'top 85%', toggleActions: 'play none none none' },
      });

      // Health tip cards
      gsap.fromTo('.tip-card', { scale: 0.9, opacity: 0 }, {
        scale: 1, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'back.out(1.7)',
        scrollTrigger: { trigger: '.tips-grid', start: 'top 80%', toggleActions: 'play none none none' },
      });
    }, mainRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={mainRef} className="min-h-screen bg-black text-white overflow-hidden relative">

      {/* ═══════════════ HERO ═══════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-end overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={hospitalHero}
            alt=""
            className="hosp-hero-img absolute inset-0 w-full h-[130%] object-cover"
            style={{ opacity: 0 }}
          />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(16,185,129,0.06) 0%, transparent 60%)',
          }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>

        {/* Corner brackets */}
        <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-emerald-400/30 z-10" />
        <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-emerald-400/30 z-10" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-l-2 border-b-2 border-emerald-400/30 z-10" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-r-2 border-b-2 border-emerald-400/30 z-10" />

        {/* Top status bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 md:px-16 pt-28 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">Module 06 — Healthcare</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20 hidden md:block">
            HEALTH_SERVICE: ACTIVE
          </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full px-8 md:px-16 pb-20 md:pb-28">
          <div className="max-w-5xl">
            <div className="space-y-1 mb-8">
              <div className="overflow-hidden">
                <span className="hosp-title-word block text-white font-display text-6xl sm:text-7xl md:text-[7rem] lg:text-[9rem] font-extrabold leading-[0.85] tracking-tight" style={{ opacity: 0 }}>
                  HEALTH
                </span>
              </div>
              <div className="overflow-hidden">
                <span className="hosp-title-word block font-display text-6xl sm:text-7xl md:text-[7rem] lg:text-[9rem] font-extrabold leading-[0.85] tracking-tight" style={{ opacity: 0 }}>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">CARE</span>
                </span>
              </div>
            </div>

            <div className="hosp-subtitle max-w-xl" style={{ opacity: 0 }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-12 bg-gradient-to-r from-emerald-400/60 to-transparent" />
                <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-emerald-400/60">
                  Hospitals • Clinics • Pharmacy • Emergency
                </span>
              </div>
              <p className="text-white/40 text-sm md:text-base font-body leading-relaxed">
                Quick access to nearby hospitals, clinics, pharmacies, and emergency services.
                Student-verified with pricing transparency and distance mapping.
              </p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 md:gap-16 mt-12">
              <div className="hosp-stat" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl md:text-5xl font-bold">
                  <AnimatedCounter target={11} />
                  <span className="text-emerald-400">+</span>
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Medical Facilities</p>
              </div>
              <div className="hosp-stat" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl md:text-5xl font-bold">
                  <AnimatedCounter target={2} duration={1000} />
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">24/7 Hospitals</p>
              </div>
              <div className="hosp-stat hidden md:block" style={{ opacity: 0 }}>
                <p className="text-white font-display text-4xl md:text-5xl font-bold">
                  <AnimatedCounter target={5} duration={1000} suffix=" km" />
                </p>
                <p className="text-white/25 text-[10px] uppercase tracking-[0.3em] font-mono mt-2">Max Distance</p>
              </div>
            </div>
          </div>

          <button onClick={scrollToBrowse} className="group absolute bottom-8 right-8 md:right-16 flex flex-col items-center gap-3 text-white/20 hover:text-white/50 transition-colors">
            <span className="text-[9px] font-mono uppercase tracking-[0.4em]">Explore</span>
            <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent group-hover:from-emerald-400/50 transition-colors" />
          </button>
        </div>
      </section>

      {/* ═══════════════ EMERGENCY BANNER ═══════════════ */}
      <EmergencyBanner />

      {/* ═══════════════ WORD MARQUEE ═══════════════ */}
      <WordMarquee words={scrollingWords} accentBgClass="bg-emerald-400/20" />

      {/* ═══════════════ nvg8-STYLE VALUE PROP ═══════════════ */}
      <section className="py-24 md:py-40 px-8 md:px-16 hosp-reveal">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
            {/* Left — big statement */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-emerald-400/40 mb-6">Here's the reality</p>
              <h2 className="text-white font-display text-3xl md:text-5xl font-bold leading-[1.1] mb-6">
                Medical emergencies
                <br />
                <span className="text-white/30">don't wait for</span>
                <br />
                Google searches.
              </h2>
              <p className="text-white/30 text-sm font-body leading-relaxed max-w-md">
                When you're unwell at 2 AM, you need instant answers — which pharmacy is open,
                which hospital is closest, what's the ambulance number. We've mapped it all.
              </p>
            </div>

            {/* Right — emergency contacts grid */}
            <div className="emergency-grid space-y-3">
              {emergencyContacts.map((contact) => {
                const Icon = contact.icon;
                return (
                  <a
                    key={contact.number}
                    href={`tel:${contact.number.replace(/[^0-9]/g, '')}`}
                    className={`emergency-card group flex items-center gap-4 p-5 border transition-all duration-500 ${
                      contact.priority === 'critical'
                        ? 'border-red-500/20 bg-red-500/[0.03] hover:border-red-500/40 hover:bg-red-500/[0.06]'
                        : 'border-white/5 bg-white/[0.01] hover:border-emerald-400/20 hover:bg-emerald-400/[0.03]'
                    }`}
                  >
                    <div className={`w-10 h-10 border flex items-center justify-center transition-all duration-500 ${
                      contact.priority === 'critical'
                        ? 'border-red-500/20 group-hover:border-red-500/40'
                        : 'border-white/10 group-hover:border-emerald-400/30'
                    }`}>
                      <Icon className={`w-4 h-4 transition-colors duration-500 ${
                        contact.priority === 'critical'
                          ? 'text-red-400/60 group-hover:text-red-400'
                          : 'text-white/30 group-hover:text-emerald-400/80'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/60 text-xs font-display font-bold uppercase">{contact.label}</p>
                      <p className={`text-lg font-mono font-bold ${
                        contact.priority === 'critical' ? 'text-red-400/80' : 'text-white/50'
                      }`}>{contact.number}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-white/30 group-hover:translate-x-1 transition-all" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SERVICE CATEGORIES ═══════════════ */}
      <section className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 hosp-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Activity className="w-4 h-4 text-emerald-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Service Matrix</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4" accentColorClass="text-emerald-400/30">
            MEDICAL SERVICES
          </GlitchText>
          <p className="text-white/30 text-sm font-body max-w-lg mb-16">
            All categories of medical services mapped near campus.
            Verified locations, transparent costs, student-friendly options.
          </p>

          <div className="svc-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {serviceCategories.map(svc => {
              const Icon = svc.icon;
              return (
                <div key={svc.code} className="svc-card group relative bg-white/[0.02] border border-white/5 p-8 hover:border-emerald-400/20 hover:bg-emerald-400/[0.03] transition-all duration-500 overflow-hidden">
                  <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-white/5 group-hover:border-emerald-400/30 transition-colors duration-500" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-white/5 group-hover:border-emerald-400/30 transition-colors duration-500" />

                  <span className="text-[9px] font-mono text-white/15 uppercase tracking-[0.3em] group-hover:text-emerald-400/40 transition-colors">{svc.code}</span>

                  <div className="my-6">
                    <div className="w-12 h-12 border border-white/10 group-hover:border-emerald-400/30 flex items-center justify-center transition-all duration-500 group-hover:bg-emerald-400/5">
                      <Icon className="w-5 h-5 text-white/40 group-hover:text-emerald-400/80 transition-colors duration-500" />
                    </div>
                  </div>

                  <h3 className="text-white font-display text-lg font-bold uppercase mb-3 group-hover:text-emerald-400/90 transition-colors duration-500">{svc.title}</h3>
                  <p className="text-white/25 text-xs font-body leading-relaxed group-hover:text-white/40 transition-colors duration-500 mb-4">{svc.desc}</p>

                  <div className="flex items-center gap-2 mt-auto">
                    <MapPin className="w-3 h-3 text-white/15" />
                    <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">{svc.facilities} facilities nearby</span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent group-hover:via-emerald-400/30 transition-all duration-700" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ HEALTH TIPS ═══════════════ */}
      <section className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 bg-white/[0.01] hosp-reveal">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Quick Reference</span>
              <div className="h-px w-8 bg-white/10" />
            </div>
            <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4 inline-block" accentColorClass="text-emerald-400/30">
              HEALTH ESSENTIALS
            </GlitchText>
            <p className="text-white/25 text-sm font-body max-w-md mx-auto mt-4">
              Things every student should know about campus healthcare.
            </p>
          </div>

          <div className="tips-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {healthTips.map((tip, i) => (
              <div key={i} className="tip-card group p-6 md:p-8 border border-white/5 hover:border-emerald-400/20 hover:bg-emerald-400/[0.02] transition-all duration-500 text-center">
                <div className="w-10 h-10 mx-auto mb-4 border border-white/10 group-hover:border-emerald-400/30 flex items-center justify-center transition-all">
                  <span className="text-[10px] font-mono text-white/20 group-hover:text-emerald-400/60 font-bold transition-colors">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-white font-display text-sm font-bold uppercase mb-2 group-hover:text-emerald-400/90 transition-colors">{tip.title}</h3>
                <p className="text-white/25 text-xs font-body leading-relaxed group-hover:text-white/40 transition-colors">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ BROWSE FACILITIES ═══════════════ */}
      <section ref={browseRef} className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 hosp-reveal">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex items-center gap-4 mb-4">
            <Search className="w-4 h-4 text-emerald-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Facility Database</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-4" accentColorClass="text-emerald-400/30">
            BROWSE FACILITIES
          </GlitchText>

          <ModuleSearchFilter
            onSearch={setSearchQuery}
            onFilterChange={() => {}}
            resultCount={filteredItems.length}
            categories={[
              { id: 'hospital', label: 'Hospital', count: 2 },
              { id: 'clinic', label: 'Clinic', count: 1 },
              { id: 'pharmacy', label: 'Pharmacy', count: 1 },
              { id: 'diagnostics', label: 'Diagnostics', count: 1 },
            ]}
            priceRange={[0, 1000]}
          />

          {isLoading ? (
            <div className="py-16 flex flex-col items-center gap-4">
              <LoadingSpinner />
              <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-mono">Loading medical facilities…</p>
            </div>
          ) : isError ? (
            <ErrorFallback error={error} onRetry={refetch} compact />
          ) : (
            <>
              <ListingGrid items={filteredItems} />

              {filteredItems.length === 0 && (
                <div className="py-24 text-center space-y-6">
                  <div className="w-16 h-16 border border-white/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                    <X className="w-8 h-8 text-white -rotate-45" />
                  </div>
                  <p className="text-white/20 uppercase tracking-[0.4em] font-mono text-[10px]">No medical facilities found</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section className="py-24 md:py-32 px-8 md:px-16 border-t border-white/5 hosp-reveal">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <BriefcaseMedical className="w-4 h-4 text-emerald-400/60" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">You Ask, We Answer</span>
          </div>
          <GlitchText className="text-white font-display text-4xl md:text-6xl font-bold mb-12" accentColorClass="text-emerald-400/30">
            COMMON QUESTIONS
          </GlitchText>

          <div className="border-t border-white/5">
            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} index={i} accentTextClass="text-emerald-400/40" accentHoverClass="group-hover:text-emerald-400/90" accentButtonClass="bg-emerald-400/10 border-emerald-400/30" />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ DISCLAIMER ═══════════════ */}
      <section className="py-12 px-8 md:px-16 border-t border-white/5 hosp-reveal">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3 p-6 border border-red-500/10 bg-red-500/[0.02]">
            <AlertTriangle className="w-4 h-4 text-red-400/40 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-white/40 text-xs font-body leading-relaxed">
                <span className="text-red-400/70 font-bold">Medical Disclaimer:</span> This platform provides informational listings only and does not constitute medical advice, diagnosis, or treatment. 
                All healthcare decisions should be made in consultation with qualified medical professionals.
              </p>
              <p className="text-white/25 text-[10px] font-body leading-relaxed">
                We do not endorse, recommend, or guarantee any specific medical provider listed. Prices, hours, and services may vary. 
                For emergencies, always call 112 or 102 immediately. Verify all information independently before making healthcare decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="relative py-32 md:py-48 px-8 md:px-16 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-emerald-400/40 mb-8 block">// YOUR HEALTH MATTERS</span>

          <h2 className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-[0.9]">
            STAY
          </h2>
          <h2 className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.9]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">HEALTHY</span>
          </h2>

          <p className="text-white/30 text-sm md:text-base font-body max-w-xl mx-auto mb-12">
            All the medical resources you need — mapped, verified, and accessible.
            Because health should never be a guessing game.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={scrollToBrowse} className="group relative px-10 py-4 bg-white text-black font-display uppercase tracking-wider text-xs font-bold hover:bg-emerald-400 transition-colors duration-300 overflow-hidden">
              <span className="relative z-10 flex items-center gap-3">
                Find Facilities <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button className="px-10 py-4 border border-white/10 text-white/50 font-display uppercase tracking-wider text-xs font-bold hover:border-white/30 hover:text-white/80 transition-all duration-300">
              Report an Issue
            </button>
          </div>

          <div className="mt-20 flex items-center justify-center gap-6">
            <div className="h-px w-16 bg-white/5" />
            <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.3em]">HEALTH_MODULE // v1.0 // VERIFIED</span>
            <div className="h-px w-16 bg-white/5" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default HospitalPage;
