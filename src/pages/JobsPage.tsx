import { useRef, useLayoutEffect } from 'react';
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyber-blue/10 border border-cyber-blue/30 rounded-sm text-cyber-blue text-xs tracking-wider mb-6 stagger-item">
            <span className="w-2 h-2 rounded-full bg-cyber-blue animate-pulse-slow"></span>
            MODULE_STATUS: IN_DEVELOPMENT
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 uppercase tracking-tight">
            <SplitText delay={0.1}>OPPORTUNITY</SplitText> <br />
            <span className="text-cyber-blue">
              <SplitText delay={0.3}>EXCHANGE</SplitText>
            </span>
          </h1>
          
          <p className="text-xl text-cyber-gray-300 max-w-2xl stagger-item">
            The decentralized job board for the MCTR campus outcasts. Internships, freelance gigs, and project collaborations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-item">
          
          {/* Main Coming Soon Card */}
          <div className="bg-cyber-gray-900 border border-cyber-gray-800 p-8 flex flex-col items-center text-center justify-center min-h-[300px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyber-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Briefcase className="w-16 h-16 text-cyber-gray-600 mb-6 group-hover:text-cyber-blue transition-colors duration-500" />
            <h2 className="text-2xl text-white font-bold mb-4">Establishing Secure Uplink...</h2>
            <p className="text-cyber-gray-400 mb-8 max-w-sm">
              We are currently negotiating contracts with local entities and campus professors to bring you verified gigs.
            </p>
            <div className="flex items-center gap-2 text-cyber-blue text-sm uppercase tracking-widest font-bold">
              <Clock className="w-4 h-4" />
              <span>ETA: Q4 2026</span>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="space-y-6">
            <div className="bg-cyber-gray-900 border border-cyber-gray-800 p-6 flex flex-col justify-center h-[calc(50%-12px)]">
              <AlertCircle className="w-8 h-8 text-cyber-accent-blue mb-4" />
              <h3 className="text-lg text-white font-bold mb-2">Notice</h3>
              <p className="text-sm text-cyber-gray-400 leading-relaxed">
                Trust-centric exchange mechanics are being applied to the job module. Only verified @mctrgit.ac.in domains will have write-access.
              </p>
            </div>
            
            <div className="bg-cyber-gray-900 border border-cyber-gray-800 p-6 flex flex-col justify-center h-[calc(50%-12px)] hover:border-cyber-blue/50 transition-colors cursor-pointer group">
              <h3 className="text-lg text-white font-bold mb-2 flex items-center justify-between">
                Back to Dashboard
                <ArrowRight className="w-5 h-5 text-cyber-gray-500 group-hover:text-cyber-blue group-hover:-translate-x-1 transition-all" />
              </h3>
              <p className="text-sm text-cyber-gray-400 leading-relaxed">
                Return to the main terminal to access available modules.
              </p>
              <a href="/home" className="absolute inset-0 z-10"><span className="sr-only">Go Home</span></a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default JobsPage;
