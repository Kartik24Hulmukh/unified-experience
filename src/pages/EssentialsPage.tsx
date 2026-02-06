import { useRef, useEffect, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import ModuleSearchFilter from '@/components/ModuleSearchFilter';
import ListingGrid from '@/components/ListingGrid';
import essentialsTiffin from '@/assets/essentials-tiffin.jpg';
import { Search, X } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const tabs = [
  { id: 'health', label: 'Healthcare', icon: '🏥' },
  { id: 'food', label: 'Food & Mess', icon: '🍽' },
];

const healthcareData = [
  { name: 'Campus Medical Center', distance: '0 km', cost: '₹50-100', tags: ['Free for students', 'Crowded'] },
  { name: 'City Clinic', distance: '2.5 km', cost: '₹200-400', tags: ['Student-friendly', 'Quick'] },
  { name: 'General Hospital', distance: '5 km', cost: '₹100-300', tags: ['Affordable', 'All services'] },
];

const foodData = [
  { name: 'Campus Canteen', type: 'Veg & Non-veg', cost: '₹2,500/mo', tags: ['On campus', 'Basic'] },
  { name: 'Home Tiffin Service', type: 'Veg', cost: '₹3,000/mo', tags: ['Home-style', 'Hygienic'] },
  { name: 'Mess Near Gate', type: 'Veg', cost: '₹2,800/mo', tags: ['Affordable', 'Popular'] },
];

const EssentialsPage = () => {
  const [activeTab, setActiveTab] = useState('health');
  const [searchQuery, setSearchQuery] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

  const [items] = useState([
    { id: 'e1', title: 'Campus Medical Center', price: '100', category: 'Healthcare', institution: 'Campus Unit' },
    { id: 'e2', title: 'City Pediatric Clinic', price: '400', category: 'Healthcare', institution: 'Private Partner' },
    { id: 'e3', title: 'LifeLine Pharmacy 24/7', price: '0', category: 'Healthcare', institution: 'Verified Store' },
    { id: 'e4', title: 'Annapurna Mess', price: '3000', category: 'Food & Mess', institution: 'Student Favorite' },
    { id: 'e5', title: 'Healthy Tiffin Service', price: '2800', category: 'Food & Mess', institution: 'Home Cooked' },
    { id: 'e6', title: 'Campus Night Canteen', price: '50', category: 'Food & Mess', institution: 'Internal' },
  ]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'health' ? item.category === 'Healthcare' : item.category === 'Food & Mess';
      return matchesSearch && matchesTab;
    });
  }, [searchQuery, activeTab, items]);

  const scrollToBrowse = () => {
    browseRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero image zoom out
      gsap.fromTo(
        '.hero-image',
        { scale: 1.2, opacity: 0 },
        { scale: 1, opacity: 0.4, duration: 1.5, ease: 'power3.out' }
      );

      // Circular reveal for title
      gsap.fromTo(
        '.title-reveal',
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(100% at 50% 50%)', duration: 1, delay: 0.5, ease: 'power2.out' }
      );
    });

    return () => ctx.revert();
  }, []);

  const currentData = activeTab === 'health' ? healthcareData : foodData;

  return (
    <main id="main-content" className="min-h-screen bg-portal">
      {/* Hero - Centered with radial design */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <img
          src={essentialsTiffin}
          alt="Campus Essentials"
          className="hero-image absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-portal/80 to-portal" />

        {/* Radial decorative elements */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] border border-portal-foreground/5 rounded-full" />
          <div className="absolute w-[400px] h-[400px] border border-portal-foreground/10 rounded-full" />
          <div className="absolute w-[200px] h-[200px] border border-portal-foreground/20 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-8">
          <p className="text-portal-foreground/50 text-sm uppercase tracking-widest mb-6">
            Module 03
          </p>

          <div className="title-reveal">
            <h1 className="text-portal-foreground font-display text-6xl md:text-9xl font-bold leading-none">
              ESSENTIALS
            </h1>
          </div>

          <p className="text-portal-foreground/60 text-lg md:text-xl font-body max-w-xl mx-auto mt-8">
            Healthcare guides and food services for daily student needs. Curated by students, for students.
          </p>

          {/* Tab switcher */}
          <div className="flex justify-center gap-4 mt-12">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-8 py-4 border transition-all duration-300 ${activeTab === tab.id
                  ? 'border-portal-foreground bg-portal-foreground text-portal'
                  : 'border-portal-foreground/30 text-portal-foreground hover:border-portal-foreground/60'
                  }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Listings Section */}
      <section className="py-32 px-8 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
              {activeTab === 'health' ? 'Healthcare Guide' : 'Food Finder'}
            </p>
            <h2 className="text-portal-foreground font-display text-4xl md:text-5xl font-bold">
              {activeTab === 'health' ? 'Nearby Medical Services' : 'Mess & Tiffin Services'}
            </h2>
          </div>

          {/* Search and Grid Section */}
          <div ref={browseRef} className="space-y-12">
            <ModuleSearchFilter
              onSearch={setSearchQuery}
              onFilterChange={() => { }}
              resultCount={filteredItems.length}
              categories={[
                { id: 'health', label: 'Healthcare', count: items.filter(i => i.category === 'Healthcare').length },
                { id: 'food', label: 'Food & Mess', count: items.filter(i => i.category === 'Food & Mess').length }
              ]}
              priceRange={[0, 5000]}
            />

            <ListingGrid items={filteredItems} />

            {filteredItems.length === 0 && (
              <div className="py-24 text-center space-y-6">
                <div className="w-16 h-16 border border-white/10 rotate-45 mx-auto flex items-center justify-center opacity-20">
                  <X className="w-8 h-8 text-white -rotate-45" />
                </div>
                <p className="text-white/20 uppercase tracking-[0.4em] font-bold text-xs italic">Protocol Filter Failure: No Units Detected</p>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="mt-16 p-6 border border-portal-foreground/10 bg-portal-foreground/5">
            <p className="text-portal-foreground/50 text-sm">
              <strong className="text-portal-foreground">Disclaimer:</strong> Information based on student submissions and basic verification. Prices may vary. No medical advice or quality guarantees provided.
            </p>
          </div>
        </div>
      </section>

      {/* Community contribution CTA */}
      <section className="py-32 px-8 md:px-16 bg-portal-foreground/5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-8 border border-portal-foreground/20 rounded-full flex items-center justify-center">
            <span className="text-3xl">✍️</span>
          </div>
          <h2 className="text-portal-foreground font-display text-4xl md:text-5xl font-bold mb-6">
            Know a Great Place?
          </h2>
          <p className="text-portal-foreground/50 text-lg mb-12">
            Help fellow students by sharing your experiences with local services.
          </p>
          <button className="px-12 py-5 bg-portal-foreground text-portal font-display uppercase tracking-wider text-sm hover:bg-portal-foreground/90 transition-colors">
            Submit Information
          </button>
        </div>
      </section>
    </main>
  );
};

export default EssentialsPage;
