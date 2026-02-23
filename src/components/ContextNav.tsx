import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isNavigationLocked, lockNavigation, safeNavigate } from '@/lib/utils';
import { useScrollTriggerCleanup } from '@/hooks/useScrollTriggerCleanup';
import NotificationCenter from './NotificationCenter';

// ScrollTrigger registered in lib/gsap-init.ts

interface NavItem {
  label: string;
  path: string;
  number: string;
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/home', number: '00' },
  { label: 'Resale', path: '/resale', number: '01' },
  { label: 'Accommodation', path: '/accommodation', number: '02' },
  { label: 'Essentials', path: '/essentials', number: '03' },
  { label: 'Academics', path: '/academics', number: '04' },
  { label: 'Mess', path: '/mess', number: '05' },
  { label: 'Hospital', path: '/hospital', number: '06' },
  { label: 'Profile', path: '/profile', number: '07' },
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

  // Kill ScrollTriggers when leaving animated pages (runs on all routes)
  useScrollTriggerCleanup();

  const isAuthPage = ['/login', '/signup', '/verify'].includes(location.pathname);
  const isLandingPage = location.pathname === '/';
  const isHomepage = location.pathname === '/home';

  // Pages with dark backgrounds need light nav text immediately
  const darkBgPages = ['/resale', '/accommodation', '/essentials', '/academics', '/mess', '/hospital'];
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
        // Nav visibility on homepage hero
        if (isHomepage && navRef.current) {
          navRef.current.style.opacity = progress < 0.06 ? '0' : '1';
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

  // gsap.context for menu animation lifecycle
  const gsapCtxRef = useRef<gsap.Context | null>(null);
  useEffect(() => {
    gsapCtxRef.current = gsap.context(() => {});
    return () => { gsapCtxRef.current?.revert(); };
  }, []);

  // Animate menu open/close
  const menuTweenRef = useRef<gsap.core.Tween | null>(null);
  useEffect(() => {
    if (!menuRef.current) return;

    // Kill any in-flight menu animation to prevent state overlap
    if (menuTweenRef.current) {
      menuTweenRef.current.kill();
      menuTweenRef.current = null;
    }

    gsapCtxRef.current?.add(() => {
      if (isMenuOpen) {
        menuTweenRef.current = gsap.fromTo(
          menuRef.current!,
          { clipPath: 'circle(0% at calc(100% - 40px) 40px)' },
          { clipPath: 'circle(150% at calc(100% - 40px) 40px)', duration: 0.8, ease: 'power3.inOut' }
        );

        // Stagger nav items — scoped to menu overlay only
        const menuNavItems = menuRef.current!.querySelectorAll('.nav-item');
        gsap.fromTo(
          menuNavItems,
          { opacity: 0, x: 100 },
          { opacity: 1, x: 0, stagger: 0.1, delay: 0.3, duration: 0.6, ease: 'power3.out' }
        );
      } else {
        menuTweenRef.current = gsap.to(menuRef.current!, {
          clipPath: 'circle(0% at calc(100% - 40px) 40px)',
          duration: 0.6,
          ease: 'power3.inOut',
        });
      }
    });
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
  const handleLogout = useCallback(() => {
    if (isNavigationLocked()) return;
    logout();
    safeNavigate(navigate, location.pathname, '/', { replace: true });
  }, [logout, navigate, location.pathname]);

  // ── Early return AFTER all hooks ──
  if (isAuthPage || isLandingPage) return null;

  // During the hero phase on homepage the duplicated nav elements
  // inside the splash layers provide the visual. The REAL nav stays
  // fully interactive (pointer-events: auto) but with transparent
  // background/text so clicks on Menu, Logo etc. still work.
  const initialHide = isHomepage;

  return (
    <>
      {/* Fixed Navigation Bar */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isDark ? 'text-portal-foreground' : 'text-foreground'
          }`}
        style={{
          opacity: initialHide ? 0 : 1,
          pointerEvents: 'auto',  // ★ Always clickable — even when visually hidden during splash
          transition: 'opacity 0.4s ease',
        }}
      >
        <div className="flex items-center justify-between px-6 md:px-12 py-6">
          {/* Logo */}
          <Link
            to="/home"
            onClick={(e) => handleNavClick(e, '/home')}
            className="relative z-50 font-display font-bold text-xl tracking-tight hover:opacity-70 transition-opacity"
          >
            <span className="sr-only">BErozgar</span>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 border-2 ${isDark ? 'border-portal-foreground' : 'border-foreground'} rotate-45 flex items-center justify-center`}>
                <div className={`w-3 h-3 ${isDark ? 'bg-portal-foreground' : 'bg-foreground'}`} />
              </div>
              <span className="hidden md:block uppercase">BErozgar</span>
            </div>
          </Link>

          {/* Center - Current section indicator */}
          <div className="hidden md:flex items-center gap-4">
            <div className={`h-px w-12 ${isDark ? 'bg-portal-foreground/30' : 'bg-foreground/30'}`} />
            <span ref={sectionLabelRef} className="text-xs uppercase tracking-widest opacity-60 font-body">
              Welcome
            </span>
            <div className={`h-px w-12 ${isDark ? 'bg-portal-foreground/30' : 'bg-foreground/30'}`} />
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* Auth Action */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className={`hidden md:inline text-[10px] uppercase tracking-widest opacity-60 font-body ${isDark ? 'text-portal-foreground' : 'text-foreground'}`}>
                  {user?.fullName?.split(' ')[0] || 'User'}
                </span>
                <button
                  onClick={handleLogout}
                  className={`p-2 transition-all duration-300 opacity-60 hover:opacity-100 ${isDark ? 'text-portal-foreground' : 'text-foreground'}`}
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={(e) => handleNavClick(e, '/login')}
                className={`text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity font-body ${isDark ? 'text-portal-foreground' : 'text-foreground'}`}
              >
                Login
              </Link>
            )}

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 transition-all duration-300 opacity-60 hover:opacity-100 ${isDark ? 'text-portal-foreground' : 'text-foreground'}`}
              aria-label="Toggle structural mode"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <NotificationCenter isDark={isDark} />

            {/* Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative z-50 flex items-center gap-3 group"
              aria-label="Toggle menu"
            >
              <span className={`text-xs uppercase tracking-widest transition-opacity ${isMenuOpen ? 'opacity-0' : 'opacity-60'} font-body`}>
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
          <div className={`absolute bottom-0 left-0 h-px ${isDark ? 'bg-portal-foreground/20' : 'bg-foreground/20'} w-full`}>
            <div
              ref={progressBarRef}
              className={`h-full ${isDark ? 'bg-portal-foreground' : 'bg-foreground'} transition-all duration-100`}
              style={{ width: '0%' }}
            />
          </div>
        </div>
      </nav>

      {/* Fullscreen Menu Overlay */}
      <div
        ref={menuRef}
        className="fixed inset-0 z-40 bg-portal flex items-center justify-center"
        style={{ clipPath: 'circle(0% at calc(100% - 40px) 40px)', willChange: 'clip-path' }}
        role="dialog"
        aria-modal={isMenuOpen}
        aria-label="Navigation menu"
      >
        <div className="max-w-4xl w-full px-8 md:px-16">
          <nav className="space-y-4 md:space-y-6">
            {navItems.map((item) => (
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
                  <span className="text-portal-foreground font-display text-4xl md:text-7xl font-bold uppercase tracking-tight group-hover:tracking-wide transition-[color,letter-spacing] duration-300">
                    {item.label}
                  </span>
                </div>
                <div className="ml-8 md:ml-16 mt-1 h-px bg-portal-foreground/20 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
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
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <p className="text-portal-foreground font-display text-lg capitalize">{user?.role || 'Student'}</p>
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
                  className="text-portal-foreground font-display text-lg hover:text-[#a3ff12] transition-colors"
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
