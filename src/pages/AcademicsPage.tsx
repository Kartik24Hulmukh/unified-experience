import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '@/components/SplitText';
import academicsPreview from '@/assets/academics-preview.jpg';

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
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
    <div className="min-h-screen bg-portal">
      {/* Hero - Typography-focused with branch codes as design elements */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        {/* Background pattern - branch codes */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
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
                    className={`px-6 py-4 border transition-all duration-300 ${
                      selectedBranch === branch.code
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources.map((resource, i) => (
              <div
                key={resource.type}
                className={`resource-card group relative overflow-hidden ${
                  i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''
                }`}
              >
                <div
                  className={`h-full border border-portal-foreground/10 bg-gradient-to-br from-portal-foreground/5 to-transparent p-8 flex flex-col justify-between transition-all duration-500 group-hover:border-portal-foreground/30 ${
                    i === 0 ? 'min-h-[400px]' : 'min-h-[200px]'
                  }`}
                >
                  <span className={`text-${i === 0 ? '6xl' : '4xl'}`}>{resource.icon}</span>
                  <div>
                    <h3 className={`text-portal-foreground font-display font-bold ${i === 0 ? 'text-3xl' : 'text-xl'}`}>
                      {resource.type}
                    </h3>
                    <p className="text-portal-foreground/50 text-sm mt-2">
                      {resource.desc}
                    </p>
                  </div>

                  {/* Hover accent */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-portal-foreground scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                </div>
              </div>
            ))}
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
    </div>
  );
};

export default AcademicsPage;
