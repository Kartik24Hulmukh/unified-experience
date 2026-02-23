import { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import ListingFormModal from '@/components/ListingFormModal';
import ResourceListingForm from '@/components/ResourceListingForm';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
import resaleTech from '@/assets/resale-tech.jpg';
import { Plus, X } from 'lucide-react';
import { useRestriction } from '@/hooks/useRestriction';
import { toast } from '@/components/ui/use-toast';
import { useListings } from '@/hooks/api/useApi';
import { LoadingSpinner, ErrorFallback } from '@/components/FallbackUI';

// ScrollTrigger registered in lib/gsap-init.ts

const categories = [
  { id: 'books', title: 'Engineering Books', count: '150+' },
  { id: 'calculators', title: 'Scientific Calculators', count: '45+' },
  { id: 'instruments', title: 'Drawing Instruments', count: '80+' },
  { id: 'lab', title: 'Lab Equipment', count: '30+' },
];

const ResalePage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { canPerform } = useRestriction();
  const canCreateListing = canPerform('CREATE_LISTING');

  // Fetch listings from API
  const { data: listingsResponse, isLoading, isError, error, refetch } = useListings({ module: 'resale' });
  const items = listingsResponse?.data ?? [];

  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, items]);

  // useLayoutEffect for GSAP animations to prevent flash of unstyled content
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax hero image
      gsap.to(imageRef.current, {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      // Categories stagger in
      gsap.fromTo(
        '.category-card',
        { opacity: 0, y: 60, rotateY: -15 },
        {
          opacity: 1,
          y: 0,
          rotateY: 0,
          stagger: 0.15,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: categoriesRef.current,
            start: 'top 70%',
          },
        }
      );
    }, mainRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={mainRef} className="min-h-screen bg-portal">
      {/* Hero Section - Full bleed with diagonal split */}
      <section ref={heroRef} className="relative h-screen overflow-hidden">
        {/* Background Image with Parallax */}
        <div className="absolute inset-0 z-0">
          <img
            ref={imageRef}
            src={resaleTech}
            alt="Resource Resale"
            className="w-full h-[130%] object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-portal/30 via-portal/50 to-portal" />
        </div>

        {/* Diagonal Overlay */}
        <div
          className="absolute inset-0 z-10"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)',
            background: 'linear-gradient(135deg, transparent 40%, hsl(var(--portal)) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative z-20 h-full flex flex-col justify-end pb-20 px-8 md:px-16">
          <div className="max-w-4xl">
            <p className="text-portal-foreground/50 text-sm uppercase tracking-widest mb-4">
              Module 01
            </p>
            <h1 className="text-portal-foreground font-display text-6xl md:text-9xl font-bold leading-none mb-6">
              <SplitText animation="fadeUp" trigger="load" delay={0.3}>
                RESALE
              </SplitText>
            </h1>
            <p className="text-portal-foreground/60 text-xl md:text-2xl font-body max-w-xl">
              Secure peer-to-peer exchange of academic resources. Verified sellers, trusted buyers.
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 right-8 flex items-center gap-4">
            <span className="text-portal-foreground/40 text-xs uppercase tracking-widest">Explore</span>
            <div className="w-12 h-px bg-portal-foreground/30" />
          </div>
        </div>
      </section>

      {/* Categories Grid - Asymmetric layout */}
      <section ref={categoriesRef} className="py-32 px-8 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
              Available Categories
            </p>
            <h2 className="text-portal-foreground font-display text-4xl md:text-6xl font-bold">
              What's Being Exchanged
            </h2>
          </div>

          {/* Asymmetric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {categories.map((cat, i) => (
              <div
                key={cat.id}
                className={`category-card group cursor-pointer ${i === 0 ? 'md:col-span-7' : i === 1 ? 'md:col-span-5' : i === 2 ? 'md:col-span-4' : 'md:col-span-8'
                  }`}
                style={{ perspective: '1000px' }}
              >
                <div className="relative h-64 md:h-80 border border-portal-foreground/20 overflow-hidden transition-all duration-500 group-hover:border-portal-foreground/50">
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-portal-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Content */}
                  <div className="absolute inset-0 p-8 flex flex-col justify-between">
                    <span className="text-portal-foreground/30 text-sm font-body">
                      {cat.count} listings
                    </span>
                    <div>
                      <h3 className="text-portal-foreground font-display text-2xl md:text-3xl font-bold group-hover:translate-x-4 transition-transform duration-500">
                        {cat.title}
                      </h3>
                      <div className="mt-4 w-0 h-px bg-portal-foreground/50 group-hover:w-full transition-all duration-700" />
                    </div>
                  </div>

                  {/* Corner accent */}
                  <div className="absolute top-0 right-0 w-16 h-16 border-l border-b border-portal-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Horizontal scroll section */}
      <section className="py-32 bg-portal-foreground/5">
        <div className="px-8 md:px-16 mb-16">
          <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
            Trust Flow
          </p>
          <h2 className="text-portal-foreground font-display text-4xl md:text-6xl font-bold">
            How Exchange Works
          </h2>
        </div>

        <div className="flex gap-8 overflow-x-auto px-8 md:px-16 pb-8 scrollbar-hide">
          {[
            { step: '01', title: 'List Your Item', desc: 'Upload details, set your price, await approval' },
            { step: '02', title: 'Verification', desc: 'Admin reviews and approves your listing' },
            { step: '03', title: 'Connect', desc: 'Buyer initiates contact through platform' },
            { step: '04', title: 'Exchange', desc: 'Meet on campus, confirm transaction' },
            { step: '05', title: 'Complete', desc: 'Both parties confirm, listing closes' },
          ].map((item) => (
            <div
              key={item.step}
              className="flex-shrink-0 w-80 p-8 border border-portal-foreground/10 bg-portal hover:border-portal-foreground/30 transition-colors duration-300"
            >
              <span className="text-portal-foreground/20 font-display text-6xl font-bold">
                {item.step}
              </span>
              <h3 className="text-portal-foreground font-display text-xl font-bold mt-8 mb-4">
                {item.title}
              </h3>
              <p className="text-portal-foreground/50 font-body text-sm">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Browse Section */}
      <section className="py-32 px-8 md:px-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto space-y-16">
          <ModuleSearchFilter
            onSearch={setSearchQuery}
            onFilterChange={() => { }}
            resultCount={filteredItems.length}
            categories={[
              { id: 'books', label: 'Books', count: 2 },
              { id: 'calculators', label: 'Calculators', count: 1 },
              { id: 'instruments', label: 'Instruments', count: 2 },
              { id: 'electronics', label: 'Electronics', count: 3 }
            ]}
            priceRange={[0, 5000]}
          />

          {isLoading ? (
            <LoadingSpinner className="py-16" />
          ) : isError ? (
            <ErrorFallback error={error} onRetry={() => refetch()} compact />
          ) : (
            <>
              <ListingGrid items={filteredItems} />

              {filteredItems.length === 0 && (
                <div className="py-24 text-center space-y-6">
                  <div className="w-16 h-16 border border-white/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                    <X className="w-8 h-8 text-white -rotate-45" />
                  </div>
                  <p className="text-white/20 uppercase tracking-[0.4em] font-bold text-xs italic">Zero Entities Detected in Search Field</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-8 md:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-portal-foreground font-display text-4xl md:text-6xl font-bold mb-8">
            Ready to Exchange?
          </h2>
          <p className="text-portal-foreground/50 text-lg mb-12 max-w-xl mx-auto">
            Join verified MCTRGIT students in creating a sustainable resource exchange ecosystem.
          </p>
          <button
            onClick={() => {
              if (!canCreateListing) {
                toast({ title: 'Action Unavailable', description: 'Your account is currently restricted from creating listings.', variant: 'destructive' });
                return;
              }
              setIsModalOpen(true);
            }}
            disabled={!canCreateListing}
            className={`px-12 py-5 font-display uppercase tracking-wider text-sm group relative overflow-hidden transition-colors ${
              canCreateListing
                ? 'bg-portal-foreground text-portal hover:bg-teal-400'
                : 'bg-portal-foreground/30 text-portal/50 cursor-not-allowed'
            }`}
          >
            <span className="relative z-10 flex items-center justify-center">
              List Your First Item <Plus className="ml-2 w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            </span>
            <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 opacity-20" />
          </button>
        </div>
      </section>

      {/* Listing Form Modal */}
      <ListingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Resale Resource"
      >
        <ResourceListingForm
          moduleName="Resale"
          onSuccess={() => setIsModalOpen(false)}
        />
      </ListingFormModal>
    </div>
  );
};

export default ResalePage;
