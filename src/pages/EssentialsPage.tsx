import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import essentialsPreview from '@/assets/essentials-preview.jpg';

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
  const heroRef = useRef<HTMLDivElement>(null);

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
    <div className="min-h-screen bg-portal">
      {/* Hero - Centered with radial design */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <img
          src={essentialsPreview}
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
                className={`px-8 py-4 border transition-all duration-300 ${
                  activeTab === tab.id
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

          {/* Cards */}
          <div className="space-y-6">
            {currentData.map((item, i) => (
              <div
                key={i}
                className="group flex flex-col md:flex-row md:items-center justify-between p-8 border border-portal-foreground/10 hover:border-portal-foreground/30 transition-all duration-300"
              >
                <div className="flex-1">
                  <h3 className="text-portal-foreground font-display text-2xl font-bold group-hover:translate-x-2 transition-transform">
                    {item.name}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-portal-foreground/10 text-portal-foreground/70 text-xs uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-8 mt-6 md:mt-0">
                  {'distance' in item && (
                    <div className="text-right">
                      <p className="text-portal-foreground/40 text-xs uppercase tracking-wider">Distance</p>
                      <p className="text-portal-foreground font-display text-lg">{item.distance}</p>
                    </div>
                  )}
                  {'type' in item && (
                    <div className="text-right">
                      <p className="text-portal-foreground/40 text-xs uppercase tracking-wider">Type</p>
                      <p className="text-portal-foreground font-display text-lg">{item.type}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-portal-foreground/40 text-xs uppercase tracking-wider">Cost</p>
                    <p className="text-portal-foreground font-display text-lg">{item.cost}</p>
                  </div>
                </div>
              </div>
            ))}
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
    </div>
  );
};

export default EssentialsPage;
