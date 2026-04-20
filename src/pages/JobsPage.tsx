import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { Briefcase, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import SplitText from '@/components/SplitText';

const JobsPage = () => {
  const mainRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Fade in the whole container
      gsap.from(mainRef.current, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
      });

      // Animate the cards/content sliding up
      gsap.from('.stagger-item', {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.4
      });
    }, mainRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={mainRef} className="min-h-[100dvh] bg-cyber-black text-cyber-gray-300 pt-32 pb-20 selection:bg-cyber-blue/30 overflow-hidden font-mono">
      {/* Background grid effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(24, 219, 166, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(24, 219, 166, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="container max-w-5xl mx-auto px-6 relative z-10" ref={contentRef}>
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 border border-primary/50 rounded-sm text-primary text-xs tracking-wider mb-6 stagger-item">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            COMING SOON
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 uppercase tracking-tight">
            <SplitText delay={0.1}>OPPORTUNITY</SplitText> <br />
            <span className="text-primary">
              <SplitText delay={0.3}>EXCHANGE</SplitText>
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 max-w-2xl stagger-item">
            The trust-centric job board for the campus community. Internships, freelance gigs, and verified collaborations—launching Q4 2026.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-item">
          
          {/* Main Info Card */}
          <div className="bg-black/40 border border-white/10 p-8 flex flex-col items-center text-center justify-center min-h-[300px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Briefcase className="w-16 h-16 text-white/20 mb-6 group-hover:text-primary transition-colors duration-500" />
            <h2 className="text-2xl text-white font-bold mb-4">Building Trust & Connections</h2>
            <p className="text-white/60 mb-8 max-w-sm">
              We are designing secure, trust-based collaboration mechanics to connect verified students with real opportunities on campus.
            </p>
            <div className="flex items-center gap-2 text-primary text-sm uppercase tracking-widest font-bold">
              <Clock className="w-4 h-4" />
              <span>Expected: Q4 2026</span>
            </div>
          </div>

          {/* Info Cards */}
          <div className="space-y-6">
            <div className="bg-black/40 border border-white/10 p-6 flex flex-col justify-center h-[calc(50%-12px)]">
              <AlertCircle className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg text-white font-bold mb-2">For Verified Students</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Only verified @mctrgit.ac.in email users will have access to browse and post verified opportunities.
              </p>
            </div>
            
            <div className="bg-black/40 border border-white/10 p-6 flex flex-col justify-center h-[calc(50%-12px)] hover:border-primary/50 transition-colors cursor-pointer group">
              <h3 className="text-lg text-white font-bold mb-2 flex items-center justify-between">
                Back Home
                <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Return to explore other campus modules and resources.
              </p>
              <Link to="/home" className="absolute inset-0 z-10"><span className="sr-only">Go Home</span></Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default JobsPage;
