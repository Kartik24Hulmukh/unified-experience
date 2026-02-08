import { useRef, useEffect, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
const academicsHero = '/Academics.jpg';
import { Search, X } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const branches = [
  { code: 'CSE', name: 'Computer Science', semesters: 8 },
  { code: 'ECE', name: 'Electronics & Communication', semesters: 8 },
  { code: 'ME', name: 'Mechanical Engineering', semesters: 8 },
  { code: 'CE', name: 'Civil Engineering', semesters: 8 },
  { code: 'EE', name: 'Electrical Engineering', semesters: 8 },
];

const resources = [
  { type: 'Syllabus', icon: '📋', desc: 'Official curriculum and course structure' },
  { type: 'Question Banks', icon: '📝', desc: 'Previous years papers and practice sets' },
  { type: 'Notes', icon: '📚', desc: 'Curated study materials and summaries' },
  { type: 'Exam Patterns', icon: '🎯', desc: 'Marking schemes and important topics' },
];

const AcademicsPage = () => {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

  const [items] = useState([
    { id: 'a1', title: 'Calculus Question Bank 2024', price: '0', category: 'Question Banks', institution: 'MCTRGIT Admin' },
    { id: 'a2', title: 'CSE Semester 3 Syllabus', price: '0', category: 'Syllabus', institution: 'Academic Office' },
    { id: 'a3', title: 'Heat & Mass Transfer Notes', price: '0', category: 'Notes', institution: 'Student Council' },
    { id: 'a4', title: 'Workshop Practice Manual', price: '0', category: 'Notes', institution: 'ME Department' },
    { id: 'a5', title: 'Internal Exam Pattern 2025', price: '0', category: 'Exam Patterns', institution: 'Authorized' },
    { id: 'a6', title: 'Discrete Mathematics PPTs', price: '0', category: 'Notes', institution: 'CSE Faculty' },
  ]);

  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, items]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero image reveal + parallax
      gsap.fromTo('.acad-hero-img', { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 0.45, duration: 2, ease: 'power3.out' });
      gsap.to('.acad-hero-img', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      // Staggered branch code reveal
      gsap.fromTo(
        '.branch-code',
        { opacity: 0, y: 100, rotateZ: -10 },
        {
          opacity: 1,
          y: 0,
          rotateZ: 0,
          stagger: 0.1,
          duration: 0.8,
          ease: 'power3.out',
          delay: 0.5,
        }
      );

      // Resource cards parallax
      if (cardsRef.current) {
        gsap.to('.resource-card', {
          y: (i) => (i % 2 === 0 ? -30 : 30),
          ease: 'none',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <main id="main-content" className="min-h-screen bg-portal">
      {/* Hero - Typography-focused with branch codes as design elements */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={academicsHero}
            alt=""
            className="acad-hero-img absolute inset-0 w-full h-[130%] object-cover"
            style={{ opacity: 0 }}
          />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(139,92,246,0.06) 0%, transparent 60%)',
          }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-portal via-portal/40 to-portal/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-portal/50 via-transparent to-transparent" />
        </div>

        {/* Background pattern - branch codes */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none z-[1]">
          <div className="flex gap-8 opacity-[0.03]">
            {branches.map((branch, i) => (
              <span
                key={branch.code}
                className="branch-code font-display text-[20rem] font-bold text-portal-foreground whitespace-nowrap"
                style={{ transform: `translateY(${i * 50}px)` }}
              >
                {branch.code}
              </span>
            ))}
          </div>
        </div>

        {/* Corner brackets */}
        <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-violet-400/30 z-10" />
        <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-violet-400/30 z-10" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-l-2 border-b-2 border-violet-400/30 z-10" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-r-2 border-b-2 border-violet-400/30 z-10" />

        {/* Top status bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 md:px-16 pt-28 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
              Module 04 — Academics
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20 hidden md:block">
            ACADEMIC_REGISTRY: ACTIVE
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col justify-center px-8 md:px-16 py-20">
          <div className="max-w-4xl">
            <p className="text-portal-foreground/50 text-sm uppercase tracking-widest mb-4">
              Module 04
            </p>

            <h1 className="text-portal-foreground font-display text-6xl md:text-9xl font-bold leading-none mb-8">
              <SplitText animation="reveal" trigger="load" type="chars" stagger={0.02}>
                ACADEMICS
              </SplitText>
            </h1>

            <p className="text-portal-foreground/60 text-xl font-body max-w-xl">
              Centralized academic resources. Syllabus, question banks, notes, and exam patterns — all admin-approved.
            </p>

            {/* Branch selector */}
            <div className="mt-16">
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-6">
                Select Your Branch
              </p>
              <div className="flex flex-wrap gap-4">
                {branches.map((branch) => (
                  <button
                    key={branch.code}
                    onClick={() => setSelectedBranch(branch.code)}
                    className={`px-6 py-4 border transition-all duration-300 ${selectedBranch === branch.code
                      ? 'border-portal-foreground bg-portal-foreground text-portal'
                      : 'border-portal-foreground/20 text-portal-foreground hover:border-portal-foreground/50'
                      }`}
                  >
                    <span className="font-display font-bold text-lg">{branch.code}</span>
                    <span className="hidden md:inline text-sm ml-2 opacity-60">{branch.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Grid - Bento-style */}
      <section ref={cardsRef} className="py-32 px-8 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
              Available Resources
            </p>
            <h2 className="text-portal-foreground font-display text-4xl md:text-5xl font-bold">
              What's Inside
            </h2>
          </div>

          {/* Bento Grid */}
          {/* Search and Resources Section */}
          <div ref={browseRef} className="space-y-16">
            <ModuleSearchFilter
              onSearch={setSearchQuery}
              onFilterChange={() => { }}
              resultCount={filteredItems.length}
              categories={[
                { id: 'syllabus', label: 'Syllabus', count: 1 },
                { id: 'qbank', label: 'Question Banks', count: 1 },
                { id: 'notes', label: 'Notes', count: 3 },
                { id: 'pattern', label: 'Exam Patterns', count: 1 }
              ]}
              priceRange={[0, 1000]}
            />

            <ListingGrid items={filteredItems} />

            {filteredItems.length === 0 && (
              <div className="py-24 text-center space-y-6">
                <div className="w-16 h-16 border border-white/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                  <X className="w-8 h-8 text-white -rotate-45" />
                </div>
                <p className="text-white/20 uppercase tracking-[0.4em] font-bold text-xs italic">Academic Index Mismatch: Entity Not Found</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Semester Navigator - If branch selected */}
      {selectedBranch && (
        <section className="py-32 px-8 md:px-16 bg-portal-foreground/5">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
                {selectedBranch} — {branches.find((b) => b.code === selectedBranch)?.name}
              </p>
              <h2 className="text-portal-foreground font-display text-4xl md:text-5xl font-bold">
                Select Semester
              </h2>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {Array.from({ length: 8 }, (_, i) => (
                <button
                  key={i}
                  className="group aspect-square border border-portal-foreground/10 flex items-center justify-center hover:border-portal-foreground/50 hover:bg-portal-foreground/10 transition-all duration-300"
                >
                  <span className="text-portal-foreground font-display text-3xl font-bold group-hover:scale-110 transition-transform">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contribution note */}
      <section className="py-32 px-8 md:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block p-6 border border-portal-foreground/10 mb-8">
            <p className="text-portal-foreground/40 text-xs uppercase tracking-widest">Note</p>
          </div>
          <h2 className="text-portal-foreground font-display text-3xl md:text-4xl font-bold mb-6">
            Admin-Approved Content Only
          </h2>
          <p className="text-portal-foreground/50 text-lg max-w-xl mx-auto">
            All resources are reviewed for accuracy and compliance with academic guidelines before being made available.
          </p>
        </div>
      </section>
    </main>
  );
};

export default AcademicsPage;
