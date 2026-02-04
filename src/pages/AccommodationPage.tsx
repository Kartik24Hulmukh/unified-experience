import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import housingPreview from '@/assets/housing-preview.jpg';

gsap.registerPlugin(ScrollTrigger);

const areas = [
  { name: 'Near Campus', distance: '0-2 km', listings: 45 },
  { name: 'City Center', distance: '3-5 km', listings: 32 },
  { name: 'Outer Ring', distance: '5-10 km', listings: 28 },
];

const features = [
  { icon: '🔒', title: 'Privacy First', desc: 'No public phone numbers' },
  { icon: '✓', title: 'Verified Only', desc: 'Student-verified listings' },
  { icon: '🤝', title: 'Consent Based', desc: 'Mutual contact sharing' },
  { icon: '👁', title: 'Admin Oversight', desc: 'Full auditability' },
];

const AccommodationPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeArea, setActiveArea] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Reveal animation for hero text
      gsap.fromTo(
        '.hero-reveal',
        { clipPath: 'inset(100% 0 0 0)' },
        {
          clipPath: 'inset(0% 0 0 0)',
          duration: 1.2,
          stagger: 0.2,
          ease: 'power4.out',
          delay: 0.5,
        }
      );

      // Floating cards animation
      gsap.to('.floating-card', {
        y: -20,
        duration: 2,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.3,
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-portal">
      {/* Hero - Split screen with floating elements */}
      <section ref={heroRef} className="min-h-screen flex flex-col md:flex-row">
        {/* Left Content */}
        <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 py-20">
          <p className="text-portal-foreground/50 text-sm uppercase tracking-widest mb-4">
            Module 02
          </p>
          
          <div className="overflow-hidden">
            <h1 className="hero-reveal text-portal-foreground font-display text-5xl md:text-8xl font-bold leading-none">
              ACCOMMO
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1 className="hero-reveal text-portal-foreground font-display text-5xl md:text-8xl font-bold leading-none">
              DATION
            </h1>
          </div>
          
          <p className="text-portal-foreground/60 text-lg md:text-xl font-body max-w-md mt-8">
            Privacy-preserving housing discovery. Find PGs, flats, and flatmates without exposing personal data.
          </p>

          {/* Stats */}
          <div className="flex gap-12 mt-12">
            <div>
              <p className="text-portal-foreground font-display text-4xl font-bold">105+</p>
              <p className="text-portal-foreground/40 text-sm">Active Listings</p>
            </div>
            <div>
              <p className="text-portal-foreground font-display text-4xl font-bold">3</p>
              <p className="text-portal-foreground/40 text-sm">Coverage Areas</p>
            </div>
          </div>
        </div>

        {/* Right Visual */}
        <div className="w-full md:w-1/2 relative overflow-hidden">
          <img
            src={housingPreview}
            alt="Housing Discovery"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-portal" />
          
          {/* Floating info cards */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full max-w-sm mx-8">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className={`floating-card absolute bg-portal/90 backdrop-blur-sm border border-portal-foreground/20 p-4 ${
                    i === 0 ? 'top-0 left-0' :
                    i === 1 ? 'top-20 right-0' :
                    i === 2 ? 'bottom-20 left-4' :
                    'bottom-0 right-4'
                  }`}
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <h4 className="text-portal-foreground font-display text-sm font-bold mt-2">
                    {feature.title}
                  </h4>
                  <p className="text-portal-foreground/50 text-xs">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Areas Section - Interactive tabs */}
      <section className="py-32 px-8 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-16">
            {/* Left - Area tabs */}
            <div className="md:w-1/3">
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
                Explore By Area
              </p>
              <h2 className="text-portal-foreground font-display text-3xl md:text-4xl font-bold mb-12">
                Where Are You Looking?
              </h2>

              <div className="space-y-4">
                {areas.map((area, i) => (
                  <button
                    key={area.name}
                    onClick={() => setActiveArea(i)}
                    className={`w-full text-left p-6 border transition-all duration-300 ${
                      activeArea === i
                        ? 'border-portal-foreground/50 bg-portal-foreground/10'
                        : 'border-portal-foreground/10 hover:border-portal-foreground/30'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-portal-foreground font-display text-xl font-bold">
                          {area.name}
                        </h3>
                        <p className="text-portal-foreground/40 text-sm mt-1">
                          {area.distance} from campus
                        </p>
                      </div>
                      <span className="text-portal-foreground/30 text-sm">
                        {area.listings} listings
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right - Map placeholder / Details */}
            <div className="md:w-2/3 relative">
              <div className="aspect-video bg-portal-foreground/5 border border-portal-foreground/10 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 border border-portal-foreground/20 rounded-full flex items-center justify-center">
                    <span className="text-4xl">📍</span>
                  </div>
                  <h3 className="text-portal-foreground font-display text-2xl font-bold">
                    {areas[activeArea].name}
                  </h3>
                  <p className="text-portal-foreground/50 text-sm mt-2">
                    {areas[activeArea].listings} verified listings available
                  </p>
                  <button className="mt-8 px-8 py-3 border border-portal-foreground/30 text-portal-foreground text-sm uppercase tracking-wider hover:bg-portal-foreground/10 transition-colors">
                    Browse Listings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards - What's displayed */}
      <section className="py-32 px-8 md:px-16 bg-portal-foreground/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-4">
              Information Available
            </p>
            <h2 className="text-portal-foreground font-display text-4xl md:text-5xl font-bold">
              What You'll See
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Area', value: 'Location name' },
              { label: 'Rent Range', value: '₹X,XXX - ₹X,XXX' },
              { label: 'Distance', value: 'X.X km from campus' },
              { label: 'Availability', value: 'Available / Occupied' },
            ].map((item) => (
              <div
                key={item.label}
                className="p-6 border border-portal-foreground/10 text-center hover:border-portal-foreground/30 transition-colors"
              >
                <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">
                  {item.label}
                </p>
                <p className="text-portal-foreground font-display text-lg font-bold">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-portal-foreground/30 text-sm mt-12">
            Contact details shared only after mutual consent
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-8 md:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-portal-foreground font-display text-4xl md:text-6xl font-bold mb-8">
            Find Your Place
          </h2>
          <p className="text-portal-foreground/50 text-lg mb-12">
            Safe, private, trusted accommodation discovery for MCTRGIT students.
          </p>
          <button className="px-12 py-5 bg-portal-foreground text-portal font-display uppercase tracking-wider text-sm hover:bg-portal-foreground/90 transition-colors">
            Start Exploring
          </button>
        </div>
      </section>
    </div>
  );
};

export default AccommodationPage;
