import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface NavItem {
  label: string;
  path: string;
  number: string;
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/', number: '00' },
  { label: 'Resale', path: '/resale', number: '01' },
  { label: 'Accommodation', path: '/accommodation', number: '02' },
  { label: 'Essentials', path: '/essentials', number: '03' },
  { label: 'Academics', path: '/academics', number: '04' },
];

const ContextNav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Track scroll position and update nav style
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      setScrollProgress(progress);
      
      // Switch to dark mode when portal has expanded (around 25% scroll)
      setIsDark(progress > 0.06);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animate menu open/close
  useEffect(() => {
    if (!menuRef.current) return;

    if (isMenuOpen) {
      gsap.fromTo(
        menuRef.current,
        { clipPath: 'circle(0% at calc(100% - 40px) 40px)' },
        { clipPath: 'circle(150% at calc(100% - 40px) 40px)', duration: 0.8, ease: 'power3.inOut' }
      );

      // Stagger nav items
      gsap.fromTo(
        '.nav-item',
        { opacity: 0, x: 100 },
        { opacity: 1, x: 0, stagger: 0.1, delay: 0.3, duration: 0.6, ease: 'power3.out' }
      );
    } else {
      gsap.to(menuRef.current, {
        clipPath: 'circle(0% at calc(100% - 40px) 40px)',
        duration: 0.6,
        ease: 'power3.inOut',
      });
    }
  }, [isMenuOpen]);

  const handleNavClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Fixed Navigation Bar */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isDark ? 'text-portal-foreground' : 'text-foreground'
        }`}
      >
        <div className="flex items-center justify-between px-6 md:px-12 py-6">
          {/* Logo */}
          <Link
            to="/"
            className="relative z-50 font-display font-bold text-xl tracking-tight hover:opacity-70 transition-opacity"
          >
            <span className="sr-only">BErozgar</span>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 border-2 ${isDark ? 'border-portal-foreground' : 'border-foreground'} rotate-45 flex items-center justify-center`}>
                <div className={`w-3 h-3 ${isDark ? 'bg-portal-foreground' : 'bg-foreground'}`} />
              </div>
              <span className="hidden md:block">BErozgar</span>
            </div>
          </Link>

          {/* Center - Current section indicator */}
          <div className="hidden md:flex items-center gap-4">
            <div className={`h-px w-12 ${isDark ? 'bg-portal-foreground/30' : 'bg-foreground/30'}`} />
            <span className="text-xs uppercase tracking-widest opacity-60">
              {scrollProgress < 0.06 ? 'Welcome' : scrollProgress < 0.5 ? 'Explore' : 'Discover'}
            </span>
            <div className={`h-px w-12 ${isDark ? 'bg-portal-foreground/30' : 'bg-foreground/30'}`} />
          </div>

          {/* Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="relative z-50 flex items-center gap-3 group"
            aria-label="Toggle menu"
          >
            <span className={`text-xs uppercase tracking-widest transition-opacity ${isMenuOpen ? 'opacity-0' : 'opacity-60'}`}>
              Menu
            </span>
            <div className="relative w-8 h-8 flex items-center justify-center">
              <span
                className={`absolute block w-6 h-0.5 transition-all duration-300 ${
                  isDark || isMenuOpen ? 'bg-portal-foreground' : 'bg-foreground'
                } ${isMenuOpen ? 'rotate-45' : '-translate-y-1.5'}`}
              />
              <span
                className={`absolute block w-6 h-0.5 transition-all duration-300 ${
                  isDark || isMenuOpen ? 'bg-portal-foreground' : 'bg-foreground'
                } ${isMenuOpen ? '-rotate-45' : 'translate-y-1.5'}`}
              />
            </div>
          </button>
        </div>

        {/* Progress bar */}
        <div className={`absolute bottom-0 left-0 h-px ${isDark ? 'bg-portal-foreground/20' : 'bg-foreground/20'} w-full`}>
          <div
            className={`h-full ${isDark ? 'bg-portal-foreground' : 'bg-foreground'} transition-all duration-100`}
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
      </nav>

      {/* Fullscreen Menu Overlay */}
      <div
        ref={menuRef}
        className="fixed inset-0 z-40 bg-portal flex items-center justify-center"
        style={{ clipPath: 'circle(0% at calc(100% - 40px) 40px)' }}
      >
        <div className="max-w-4xl w-full px-8 md:px-16">
          <nav className="space-y-4 md:space-y-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`nav-item block group ${
                  location.pathname === item.path ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-baseline gap-4 md:gap-8">
                  <span className="text-portal-foreground/40 text-sm font-body">{item.number}</span>
                  <span className="text-portal-foreground font-display text-4xl md:text-7xl font-bold uppercase tracking-tight group-hover:tracking-wide transition-all duration-300">
                    {item.label}
                  </span>
                </div>
                <div className="ml-8 md:ml-16 mt-1 h-px bg-portal-foreground/20 w-0 group-hover:w-full transition-all duration-500" />
              </Link>
            ))}
          </nav>

          {/* Menu footer */}
          <div className="mt-16 md:mt-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div>
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">Institution</p>
              <p className="text-portal-foreground font-display text-lg">MCTRGIT</p>
            </div>
            <div>
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">Platform</p>
              <p className="text-portal-foreground font-display text-lg">Trust-Centric Exchange</p>
            </div>
            <div>
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">Access</p>
              <p className="text-portal-foreground font-display text-lg">Students Only</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContextNav;
