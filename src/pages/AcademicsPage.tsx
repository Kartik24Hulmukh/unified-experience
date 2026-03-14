import { useRef, useLayoutEffect, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
import ListingFormModal from '@/components/ListingFormModal';
import ResourceListingForm from '@/components/ResourceListingForm';
const academicsHero = '/Academics.jpg';
import { Search, X, Plus } from 'lucide-react';
import { useListings } from '@/hooks/api/useApi';
import { getBrowseVisibleListings } from '@/lib/browse-listings';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';
import { useAuth } from '@/contexts/AuthContext';
import { useRestriction } from '@/hooks/useRestriction';
import { toast } from '@/components/ui/use-toast';

const ACADEMIC_CATEGORIES = [
  { value: 'notes', label: 'Lecture Notes' },
  { value: 'questionbank', label: 'Question Banks' },
  { value: 'textbook', label: 'Textbooks' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'other', label: 'Other Resources' },
];

// ScrollTrigger registered in lib/gsap-init.ts

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();
  const { canPerform } = useRestriction();
  const canCreateListing = canPerform('CREATE_LISTING');

  // Fetch listings from API
  const { data: listingsResponse, isLoading, isError, error, refetch } = useListings({ module: 'academics' });
  const visibleItems = useMemo(() => getBrowseVisibleListings(listingsResponse?.data ?? []), [listingsResponse?.data]);

  const filteredItems = useMemo(() => {
    const defaultAcademics = [
      {
        id: 'acad1',
        title: 'BTech First Year Notes',
        price: '350',
        category: 'notes',
        institution: 'MCTRGIT',
        image: '/Academics.jpg'
      },
      {
        id: 'acad2',
        title: 'Engineering Mechanics Books',
        price: '500',
        category: 'books',
        institution: 'MCTRGIT',
        image: '/Academics.jpg'
      }
    ];
    const combinedVisible = [...defaultAcademics, ...visibleItems];

    return combinedVisible.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      // Branch filter: check if category or title contains the selected branch code
      const matchesBranch = !selectedBranch ||
        item.category.toLowerCase().includes(selectedBranch.toLowerCase()) ||
        item.title.toLowerCase().includes(selectedBranch.toLowerCase());
      return matchesSearch && matchesBranch;
    });
  }, [searchQuery, selectedBranch, visibleItems]);

  // useLayoutEffect for GSAP animations to prevent flash of unstyled content
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Hero image reveal + parallax
      gsap.fromTo('.acad-hero-img', { scale: 1.05, opacity: 0 }, { scale: 1, opacity: 0.45, duration: 1, ease: 'power2.out' });
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
    }, mainRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={mainRef} className="min-h-screen bg-portal">
      {/* Hero - Typography-focused with branch codes as design elements */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={academicsHero}
            alt=""
            fetchPriority="high"
            loading="eager"
            className="acad-hero-img absolute inset-0 w-full h-full sm:h-[130%] object-cover block"
            style={{ opacity: 0, contentVisibility: 'auto' }}
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
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 w-6 h-6 sm:w-12 sm:h-12 border-l-2 border-t-2 border-violet-400/30 z-10" />
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 w-6 h-6 sm:w-12 sm:h-12 border-r-2 border-t-2 border-violet-400/30 z-10" />
        <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 w-6 h-6 sm:w-12 sm:h-12 border-l-2 border-b-2 border-violet-400/30 z-10" />
        <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 w-6 h-6 sm:w-12 sm:h-12 border-r-2 border-b-2 border-violet-400/30 z-10" />

        {/* Top status bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-8 md:px-16 pt-28 pb-4">
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
        <div className="relative z-10 min-h-screen flex flex-col justify-center px-4 sm:px-8 md:px-16 py-20">
          <div className="max-w-4xl">
            <p className="text-portal-foreground/50 text-sm uppercase tracking-widest mb-4">
              Module 04
            </p>

            <h1 className="text-portal-foreground font-display text-5xl sm:text-6xl md:text-9xl font-bold leading-none mb-8">
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
      <section ref={cardsRef} className="py-20 sm:py-32 px-4 sm:px-8 md:px-16">
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
                    <div className="w-16 h-16 border border-white/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                      <X className="w-8 h-8 text-white -rotate-45" />
                    </div>
                    <p className="text-white/20 uppercase tracking-[0.4em] font-bold text-xs italic">Academic Index Mismatch: Entity Not Found</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Semester Navigator - If branch selected */}
      {selectedBranch && (
        <section className="py-20 sm:py-32 px-4 sm:px-8 md:px-16 bg-portal-foreground/5">
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

      {/* CTA Section — create academic resource listing */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 md:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-portal-foreground font-display text-4xl md:text-6xl font-bold mb-8">
            Share Your Resources
          </h2>
          <p className="text-portal-foreground/50 text-lg mb-4 max-w-xl mx-auto">
            Have notes, question banks, or textbooks to share? List them for verified MCTRGIT students.
          </p>
          <p className="text-portal-foreground/30 text-xs uppercase tracking-widest mb-12">
            All submissions go through admin review before becoming visible.
          </p>
          <button
            onClick={() => {
              if (!isAuthenticated) {
                toast({ title: 'Sign In Required', description: 'Please sign in to share academic resources.', variant: 'destructive' });
                return;
              }
              if (!canCreateListing) {
                toast({ title: 'Action Unavailable', description: 'Your account is restricted from creating listings.', variant: 'destructive' });
                return;
              }
              setIsModalOpen(true);
            }}
            className="px-12 py-5 font-display uppercase tracking-wider text-sm group relative overflow-hidden transition-colors bg-portal-foreground text-portal hover:bg-violet-400"
          >
            <span className="relative z-10 flex items-center justify-center">
              Share a Resource <Plus className="ml-2 w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            </span>
            <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 opacity-20" />
          </button>
        </div>
      </section>

      {/* Listing Form Modal */}
      <ListingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Share Academic Resource"
      >
        <ResourceListingForm
          moduleName="Academics"
          categories={ACADEMIC_CATEGORIES}
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
        />
      </ListingFormModal>
    </div>
  );
};

export default AcademicsPage;
