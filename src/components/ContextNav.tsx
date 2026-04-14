import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isNavigationLocked, lockNavigation, safeNavigate, unlockNavigation } from '@/lib/utils';
import { useScrollTriggerCleanup } from '@/hooks/useScrollTriggerCleanup';
import { toast } from '@/components/ui/use-toast';
import NotificationCenter from './NotificationCenter';

// ScrollTrigger registered in lib/gsap-init.ts

interface NavItem {
  label: string;
  path: string;
  number: string;
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/home', number: '00' },
  { label: 'Academics', path: '/academics', number: '01' },
  { label: 'Accommodation', path: '/accommodation', number: '02' },
  { label: 'Essentials', path: '/essentials', number: '03' },
  { label: 'Resale', path: '/resale', number: '04' },
];

const ContextNav = memo(function ContextNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { theme, setTheme } = useTheme();
  // Use ref for scroll progress to avoid re-rendering entire nav tree on scroll
  const scrollProgressRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const sectionLabelRef = useRef<HTMLSpanElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  // UX-02: invalidate all cached queries on logout to prevent stale data leakage
  const queryClient = useQueryClient();

  // Admin-aware nav items — adds Admin Panel entry for admin users
  const displayNavItems = useMemo(() => {
    const base: NavItem[] = [
      { label: 'Home', path: '/home', number: '00' },
      { label: 'Academics', path: '/academics', number: '01' },
      { label: 'Accommodation', path: '/accommodation', number: '02' },
      { label: 'Essentials', path: '/essentials', number: '03' },
      { label: 'Resale', path: '/resale', number: '04' },
    ];
    if (user?.role === 'admin') {
      base.push({ label: 'Agency', path: '/agency', number: '05' });
      base.push({ label: 'Admin', path: '/admin', number: '06' });
    }
    return base;
  }, [user?.role]);

  // Kill ScrollTriggers when leaving animated pages (runs on all routes)
  useScrollTriggerCleanup();

  const isAuthPage = ['/login', '/signup', '/verify'].includes(location.pathname);
  const isLandingPage = location.pathname === '/';
  const isHomepage = location.pathname === '/home';

    const darkBgPages = ['/resale', '/accommodation', '/essentials', '/academics', '/admin', '/profile', '/mess', '/hospital', '/jobs'];
    const isDarkBgPage = darkBgPages.includes(location.pathname);

  // Track scroll position and update nav style
  useEffect(() => {
    let rafId: number | null = null;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? scrollTop / docHeight : 0;
        scrollProgressRef.current = progress;

        // Direct DOM writes — no React re-render needed
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${progress * 100}%`;
        }
        if (sectionLabelRef.current) {
          sectionLabelRef.current.textContent =
            progress < 0.06 ? 'Welcome' : progress < 0.5 ? 'Explore' : 'Discover';
        }
        // Nav remains fully visible on homepage
        if (isHomepage && navRef.current) {
          navRef.current.style.opacity = '1';
        }

        // Only trigger React re-render for dark mode threshold crossing
        const shouldBeDark = isDarkBgPage ? true : progress > 0.06;
        setIsDark(prev => prev === shouldBeDark ? prev : shouldBeDark);
        ticking = false;
      });
    };

    // Set initial state for dark-bg pages
    if (isDarkBgPage) setIsDark(true);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isDarkBgPage, isHomepage]);

  // Animate menu open/close with automatic lifecycle management
  useLayoutEffect(() => {
    if (!menuRef.current) return;

    const ctx = gsap.context(() => {
      // Skip clip-path animation when the user prefers reduced motion —
      // use an instant visibility toggle instead so the menu is still usable.
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (isMenuOpen) {
        if (prefersReduced) {
          gsap.set(menuRef.current!, { autoAlpha: 1, clipPath: 'circle(150% at calc(100vw - 40px) 40px)' });
          gsap.set(menuRef.current!.querySelectorAll('.nav-item'), { opacity: 1, x: 0, clearProps: 'all' });
        } else {
          gsap.fromTo(
            menuRef.current!,
            { autoAlpha: 0, clipPath: 'circle(0% at calc(100vw - 40px) 40px)' },
            { autoAlpha: 1, clipPath: 'circle(150% at calc(100vw - 40px) 40px)', duration: 0.8, ease: 'power3.inOut' }
          );

          const menuNavItems = menuRef.current!.querySelectorAll('.nav-item');
          gsap.fromTo(
            menuNavItems,
            { opacity: 0, x: 100 },
            { opacity: 1, x: 0, stagger: 0.1, delay: 0.3, duration: 0.6, ease: 'power3.out' }
          );
        }
      } else {
        if (prefersReduced) {
          gsap.set(menuRef.current!, { autoAlpha: 0, clipPath: 'circle(0% at calc(100vw - 40px) 40px)' });
        } else {
          gsap.to(menuRef.current!, {
            clipPath: 'circle(0% at calc(100vw - 40px) 40px)',
            autoAlpha: 0,
            duration: 0.6,
            ease: 'power3.inOut',
          });
        }
      }
    });

    return () => ctx.revert();
  }, [isMenuOpen]);

  // Guard against rapid navigation clicks during page transitions
  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    // Block if already transitioning
    if (isNavigationLocked()) {
      e.preventDefault();
      return;
    }
    // Skip if navigating to current page
    if (location.pathname === targetPath) {
      e.preventDefault();
      return;
    }
    // Lock immediately to prevent race condition before PageTransition starts
    lockNavigation(2000);
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Safe logout with navigation guard
  // UX-01: redirect to /login (not /) — users expect the login screen after logout,
  // not the animated landing splash which looks like a crash.
  // UX-02: clear React Query cache to prevent stale private data on shared devices.
  const handleLogout = useCallback(() => {
    // Logout is terminal session teardown and must not be blocked by a stale
    // route-transition lock from an earlier navigation.
    unlockNavigation();
    setIsMenuOpen(false);
    queryClient.clear(); // UX-02: wipe all cached queries
    logout();
    toast({ title: 'Signed Out', description: 'You have been logged out successfully.' });
    navigate('/login', { replace: true });
  }, [logout, navigate, queryClient]);

  // ── Early return AFTER all hooks ──
  if (isAuthPage || isLandingPage || location.pathname === '/admin') return null;

  const isNavDark = isDark || isMenuOpen;

  // During the hero phase on homepage, the splash effect handles masking
  // The REAL nav stays fully interactive and visible.

  return (
    <>
      {/* Fixed Navigation Bar */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isNavDark ? 'text-portal-foreground bg-portal/80 backdrop-blur-md' : 'text-foreground bg-background/80 backdrop-blur-md'
          }`}
        style={{
          pointerEvents: 'auto',  // ★ Always clickable
          transition: 'opacity 0.4s ease, color 0.4s ease',
        }}
      >
        <div className="safe-area-top flex min-w-0 items-center justify-between gap-2 px-4 py-4 sm:px-6 md:px-12 md:py-6">
          {/* Logo */}
          <Link
            to="/home"
            onClick={(e) => handleNavClick(e, '/home')}
            className="relative z-50 tap-target font-display font-bold text-xl tracking-tight hover:opacity-70 transition-opacity shrink-0"
          >
            <span className="sr-only">BErozgar</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 bg-white rounded-md md:rounded-lg overflow-hidden border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                <img 
                  src="/logo.png" 
                  alt="BErozgar Logo" 
                  className={`w-full h-full object-contain transition-opacity scale-90 ${isNavDark ? 'opacity-90' : 'opacity-100'}`} 
                />
              </div>
              <span className="hidden md:block uppercase tracking-widest font-bold text-sm md:text-base">BErozgar</span>
            </div>
          </Link>

          {/* Center - Current section indicator */}
          <div className="hidden md:flex items-center">
            <span ref={sectionLabelRef} className={`text-[10px] md:text-xs uppercase tracking-[0.3em] font-body transition-colors ${isNavDark ? 'text-portal-foreground/60' : 'text-foreground/60'}`}>
              Welcome
            </span>
          </div>

          {/* Nav Actions */}
          <div className="flex min-w-0 shrink-0 items-center gap-2 md:gap-6">
            {/* Create Listing Hub Access */}
            {isAuthenticated && user?.role === 'student_verified' && (
              <Link
                to="/create-listing"
                onClick={(e) => handleNavClick(e, '/create-listing')}
                className={`tap-target flex items-center justify-center bg-[#a3ff12] text-black hover:bg-[#8ade0e] transition-colors rounded-sm px-3 py-1.5 md:px-4 md:py-2 border border-transparent shadow-[0_0_15px_rgba(163,255,18,0.2)] hover:shadow-[0_0_20px_rgba(163,255,18,0.4)]`}
                aria-label="Create Listing"
              >
                <span className="hidden sm:block text-[10px] md:text-xs uppercase tracking-widest font-bold">Sell / List</span>
                <span className="sm:hidden text-[14px] font-bold">+</span>
              </Link>
            )}

            {/* Auth Action */}
            {isAuthenticated ? (
              <Link
                to="/profile"
                onClick={(e) => handleNavClick(e, '/profile')}
                className="group relative tap-target flex items-center gap-3 cursor-pointer"
              >
                <div className="hidden lg:flex flex-col items-end">
                  <span className={`text-[8px] uppercase tracking-[0.2em] font-mono transition-colors ${isNavDark ? 'text-portal-foreground/40' : 'text-foreground/40'}`}>
                    Active
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isNavDark ? 'text-portal-foreground' : 'text-foreground'}`}>
                    {user?.fullName?.split(' ')[0] || 'Profile'}
                  </span>
                </div>
                <div className={`relative w-8 h-8 rounded-full border border-current flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:border-[#a3ff12] ${isNavDark ? 'border-portal-foreground' : 'border-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${isNavDark ? 'bg-portal-foreground text-portal' : 'bg-black text-white'}`}>
                    {user?.fullName?.[0] || 'U'}
                  </div>
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={(e) => handleNavClick(e, '/login')}
                className={`tap-target text-xs uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity font-body px-3 ${isNavDark ? 'text-portal-foreground bg-portal/80 backdrop-blur-md' : 'text-foreground'}`}
              >
                Login
              </Link>
            )}

            {/* tap-target ensures minimum 48×48 px touch area (WCAG 2.5.5) */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`hidden sm:flex tap-target items-center justify-center transition-all duration-300 opacity-60 hover:opacity-100 ${isNavDark ? 'text-portal-foreground bg-portal/80 backdrop-blur-md' : 'text-foreground'}`}
              style={{ minWidth: 48, minHeight: 48 }}
              aria-label="Toggle structural mode"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className={`hidden sm:flex tap-target items-center justify-center transition-all duration-300 opacity-60 hover:opacity-100 ${isNavDark ? 'text-portal-foreground bg-portal/80 backdrop-blur-md' : 'text-foreground'}`}
                style={{ minWidth: 48, minHeight: 48 }}
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}

            <div className="hidden sm:block">
              <NotificationCenter isDark={isNavDark} />
            </div>

            {/* Menu Button — tap-target gives ≥48px touch area (WCAG 2.5.5) */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative z-50 tap-target flex items-center gap-3 group"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <span className={`hidden sm:block text-xs uppercase tracking-widest transition-opacity ${isMenuOpen ? 'opacity-0' : 'opacity-60'} font-body`}>
                Menu
              </span>
              <div className="relative w-8 h-8 flex items-center justify-center">
                <span
                  className={`absolute block w-6 h-0.5 transition-all duration-300 ${isDark || isMenuOpen ? 'bg-portal-foreground' : 'bg-foreground'
                    } ${isMenuOpen ? 'rotate-45' : '-translate-y-1.5'}`}
                />
                <span
                  className={`absolute block w-6 h-0.5 transition-all duration-300 ${isDark || isMenuOpen ? 'bg-portal-foreground' : 'bg-foreground'
                    } ${isMenuOpen ? '-rotate-45' : 'translate-y-1.5'}`}
                />
              </div>
            </button>
          </div>

          {/* Progress bar */}
          <div className={`absolute bottom-0 left-0 h-px ${isNavDark ? 'bg-portal-foreground/20' : 'bg-foreground/20'} w-full`}>
            <div
              ref={progressBarRef}
              className={`h-full ${isNavDark ? 'bg-portal-foreground' : 'bg-foreground'} transition-all duration-100`}
              style={{ width: '0%' }}
            />
          </div>
        </div>
      </nav>

      {/* Fullscreen Menu Overlay */}
      <div
        ref={menuRef}
        className="fixed inset-0 z-40 flex overflow-y-auto bg-portal opacity-0"
        style={{ willChange: isMenuOpen ? 'clip-path' : 'auto', pointerEvents: isMenuOpen ? 'auto' : 'none' }}
        role={isMenuOpen ? 'dialog' : undefined}
        aria-modal={isMenuOpen ? true : undefined}
        aria-hidden={!isMenuOpen}
        tabIndex={-1}
        aria-label="Navigation menu"
      >
        <div className="mx-auto min-h-full w-full max-w-4xl px-4 pt-[calc(env(safe-area-inset-top)_+_5rem)] pb-[calc(env(safe-area-inset-bottom)_+_2rem)] sm:px-8 md:px-16 md:pt-28">
          <nav className="space-y-4 md:space-y-6">
            {displayNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => handleNavClick(e, item.path)}
                aria-current={location.pathname === item.path ? 'page' : undefined}
                className={`nav-item block group ${location.pathname === item.path ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
              >
                <div className="flex items-baseline gap-4 md:gap-8">
                  <span className="text-portal-foreground/40 text-sm font-body">{item.number}</span>
                  <span className="text-portal-foreground font-display text-[clamp(1.5rem,8vw,4.5rem)] font-bold uppercase tracking-tight group-hover:tracking-wide transition-[color,letter-spacing] duration-300">
                    {item.label}
                  </span>
                </div>
                <div className="ml-8 md:ml-16 mt-1 h-px bg-portal-foreground/20 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </Link>
            ))}
          </nav>

          {/* Menu footer */}
          <div className="mt-16 md:mt-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="flex flex-col gap-4">
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest">Controls</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="tap-target px-3 flex items-center gap-2 border border-portal-foreground/20 text-portal-foreground hover:bg-portal-foreground/10 transition-colors sm:hidden"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="text-[10px] uppercase font-mono tracking-widest">Mode</span>
                </button>
                {isAuthenticated && (
                  <button
                    onClick={handleLogout}
                    className="tap-target px-3 flex items-center gap-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors sm:hidden"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-[10px] uppercase font-mono tracking-widest">Logout</span>
                  </button>
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">Institution</p>
                <p className="text-portal-foreground font-display text-lg">MCTRGIT</p>
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">Platform</p>
              <p className="text-portal-foreground font-display text-lg">Trust-Centric Exchange</p>
            </div>
            <div>
              <p className="text-portal-foreground/40 text-xs uppercase tracking-widest mb-2">Access</p>
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <p className="text-portal-foreground font-display text-lg capitalize">{
                    user?.role === 'student_verified' ? 'Verified Student' :
                    user?.role === 'public_user' ? 'Public User' :
                    user?.role === 'admin' ? 'Admin' : 'User'
                  }</p>
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={(e) => handleNavClick(e, '/admin')}
                      className="text-[#a3ff12] text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
                    >
                      Admin Panel →
                    </Link>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={(e) => handleNavClick(e, '/login')}
                  className="tap-target text-portal-foreground font-display text-lg hover:text-[#a3ff12] transition-colors"
                >
                  Sign In →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default ContextNav;
