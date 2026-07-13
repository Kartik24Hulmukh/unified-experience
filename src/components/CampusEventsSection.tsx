
import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// ScrollTrigger registered in lib/gsap-init.ts

const events = [
  {
    id: '01',
    date: 'AUG 15',
    fullDate: '2026-08-15',
    type: 'TECHNICAL',
    title: 'TECHFEST 2026',
    desc: 'Annual technical festival — hackathons, competitive coding, robotics and IoT exhibitions open to all branches.',
    tag: 'Tech Fest',
  },
  {
    id: '02',
    date: 'SEP 06',
    fullDate: '2026-09-06',
    type: 'CULTURAL',
    title: 'RANGMANCH',
    desc: 'Grand cultural night featuring dance performances, drama, live music and student art installations.',
    tag: 'Cultural Night',
  },
  {
    id: '03',
    date: 'SEP 20',
    fullDate: '2026-09-20',
    type: 'SPORTS',
    title: 'SPORTANZA',
    desc: 'Inter-branch championship spanning cricket, basketball, chess, athletics and 8 more disciplines.',
    tag: 'Sports Meet',
  },
  {
    id: '04',
    date: 'OCT 10',
    fullDate: '2026-10-10',
    type: 'ACADEMIC',
    title: 'RESEARCH EXPO',
    desc: 'Annual research paper presentation and poster symposium — showcase your innovations to faculty and peers.',
    tag: 'Symposium',
  },
  {
    id: '05',
    date: 'NOV 08',
    fullDate: '2026-11-08',
    type: 'WORKSHOP',
    title: 'AI / ML SUMMIT',
    desc: 'Intensive workshop series covering machine learning, computer vision and real-world AI deployment pipelines.',
    tag: 'Workshop Series',
  },
];

/** Returns 'UPCOMING', 'TODAY', or 'COMPLETED' based on the event's date under Asia/Kolkata timezone */
function getEventStatus(fullDate: string): 'UPCOMING' | 'TODAY' | 'COMPLETED' {
  const [year, month, day] = fullDate.split('-').map(Number);
  
  // Current time in Asia/Kolkata
  const now = new Date();
  const kolkataDateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const todayIST = new Date(kolkataDateStr);
  todayIST.setHours(0, 0, 0, 0);

  // Target event date
  const eventDate = new Date(year, month - 1, day);
  eventDate.setHours(0, 0, 0, 0);

  if (eventDate.getTime() === todayIST.getTime()) return 'TODAY';
  return eventDate > todayIST ? 'UPCOMING' : 'COMPLETED';
}

const TYPE_COLORS: Record<string, string> = {
  TECHNICAL: '#a3ff12',
  CULTURAL: '#ff6b35',
  SPORTS:   '#00d4ff',
  ACADEMIC: '#c084fc',
  WORKSHOP: '#fbbf24',
};

/**
 * CampusEventsSection
 *
 * Uses the same CSS-sticky + tall-container pattern as MasterExperience
 * (avoids ScrollTrigger pin:true which conflicts with Lenis smooth scroll).
 *
 * Scroll flow:
 *   1. Section scrolls into view → cards + header fade/slide in.
 *   2. Sticky inner element locks at viewport top.
 *   3. User scrolls further → horizontal track translates left (scrubbed).
 *   4. Sticky releases → footer enters from below.
 */
const CampusEventsSection = () => {
  const containerRef = useRef<HTMLDivElement>(null); // outer ΓÇö height set dynamically
  const trackRef     = useRef<HTMLDivElement>(null); // horizontal flex track

  useLayoutEffect(() => {
    const container = containerRef.current;
    const track     = trackRef.current;
    if (!container || !track) return;

    // ΓöÇΓöÇ Height calculation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // Container height = 100vh + travelDistance so that scrolling through the
    // full container maps to the horizontal travel. Multiplying by 0.7 
    // makes the scroll slightly faster and smoother without fatigue.
    const updateHeight = () => {
      const travel = Math.max(0, track.scrollWidth - window.innerWidth);
      container.style.height = `${window.innerHeight + (travel * 0.7)}px`;
    };

    // Must fire BEFORE each ScrollTrigger.refresh() recalculates positions
    ScrollTrigger.addEventListener('refreshInit', updateHeight);
    updateHeight();

    // UX-E FIX: ScrollTrigger.addEventListener('refreshInit') only fires when
    // ScrollTrigger itself refreshes. A window resize that doesn't trigger a
    // ScrollTrigger refresh (e.g. DevTools panel open/close, mobile keyboard)
    // leaves the container height and travel distance stale. A ResizeObserver
    // on the document element catches ALL layout size changes.
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
      ScrollTrigger.refresh();
    });
    resizeObserver.observe(document.documentElement);

    // ΓöÇΓöÇ GSAP animations (scoped to containerRef) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const ctx = gsap.context(() => {

      // 1. Header ΓÇö fade + slide up as section enters viewport
      gsap.fromTo(
        '.evt-header',
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: container, start: 'top 82%' },
        },
      );

      // 2. Cards ΓÇö staggered reveal just behind the header
      gsap.fromTo(
        '.evt-card',
        { opacity: 0, y: 70 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.09,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: { trigger: container, start: 'top 72%' },
        },
      );

      // 3. Horizontal scroll ΓÇö scrubbed, no pin (CSS sticky handles pinning)
      gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth),
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.3,
          invalidateOnRefresh: true,
        },
      });

    }, containerRef);

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', updateHeight);
      resizeObserver.disconnect();
      ctx.revert();
      container.style.height = '';
    };
  }, []);

  return (
    <div ref={containerRef} className="relative bg-portal">

      {/* Subtle grid overlay ΓÇö matches homepage portal aesthetic */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(163,255,18,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(163,255,18,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* ΓöÇΓöÇ Sticky viewport ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="sticky top-0 h-[100dvh] overflow-hidden">

        {/* Horizontal flex track */}
        <div
          ref={trackRef}
          className="flex items-center h-full will-change-transform"
          style={{ width: 'max-content' }}
        >

          {/* ΓöÇΓöÇ Section header column ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
          <div
            className="evt-header shrink-0 h-full flex flex-col justify-center px-8 sm:px-12 lg:px-20"
            style={{ width: 'clamp(280px, 38vw, 460px)' }}
          >
            <p className="text-[#a3ff12] font-mono text-[9px] uppercase tracking-[0.45em] mb-5">
              CAMPUS_SYS // EVT_MODULE_V01
            </p>

            <h2 className="text-portal-foreground font-display font-bold uppercase leading-[0.84] tracking-[-0.05em] mb-6"
                style={{ fontSize: 'clamp(3.5rem, 5.5vw, 5.5rem)' }}>
              CAMPUS
              <br />
              EVENTS
            </h2>

            <div className="h-px w-10 bg-[#a3ff12]/50 mb-6" />

            <p className="text-portal-foreground/40 font-body text-sm leading-relaxed"
               style={{ maxWidth: '240px' }}>
              Upcoming fests, workshops &amp; institutional events at MCTRGIT —
              stay connected, never miss out.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a3ff12] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#a3ff12]" />
              </span>
              <span className="text-[#a3ff12] font-mono text-[9px] uppercase tracking-[0.35em]">
                {events.length} Events This Semester
              </span>
            </div>

            <div className="mt-10 flex items-center gap-2 text-portal-foreground/15">
              <span className="text-sm">→</span>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="shrink-0 w-px bg-white/10 mx-8" style={{ height: '38vh' }} />

          {/* ΓöÇΓöÇ Event cards ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
          {events.map((event) => {
            const color = TYPE_COLORS[event.type] ?? '#a3ff12';
            return (
              <div
                key={event.id}
                className="evt-card shrink-0 mx-4 flex flex-col justify-between relative overflow-hidden group"
                style={{
                  width: 'clamp(280px, 32vw, 370px)',
                  height: 'clamp(380px, 62vh, 600px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{ height: '2px', backgroundColor: color }}
                />

                {/* Hover radial glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 50% 110%, ${color}14 0%, transparent 65%)`,
                  }}
                />

                {/* Card content */}
                <div className="relative z-10 p-5 sm:p-8 lg:p-10 flex flex-col h-full">

                  {/* Top row: index + type badge */}
                  <div className="flex items-start justify-between mb-8">
                    <span className="font-mono text-portal-foreground/15 text-xs">
                      {event.id}
                    </span>
                    <span
                      className="font-mono text-[8px] uppercase tracking-[0.3em] px-2 py-1"
                      style={{ color, border: `1px solid ${color}28` }}
                    >
                      {event.type}
                    </span>
                  </div>

                  {/* Date */}
                  <p
                    className="font-mono text-[9px] uppercase tracking-[0.45em] mb-3"
                    style={{ color: `${color}70` }}
                  >
                    {event.date} · 2026
                  </p>

                  {/* Title */}
                  <h3
                    className="font-display font-bold uppercase leading-[0.88] tracking-[-0.03em] mb-3 text-portal-foreground transition-colors duration-500 group-hover:text-white"
                    style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2.1rem)' }}
                  >
                    {event.title}
                  </h3>

                  {/* Tag label */}
                  <p className="font-mono text-[8px] uppercase tracking-[0.4em] mb-5 text-portal-foreground/25">
                    {event.tag}
                  </p>

                  {/* Description */}
                  <p className="font-body text-sm text-portal-foreground/45 leading-relaxed flex-1">
                    {event.desc}
                  </p>

                  {/* Status bar */}
                  <div
                    className="flex items-center justify-between mt-8 pt-5"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const status = getEventStatus(event.fullDate);
                        const isPast = status === 'COMPLETED';
                        const isToday = status === 'TODAY';
                        return (
                          <>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isPast ? '' : 'animate-pulse'}`}
                              style={{ backgroundColor: isPast ? 'rgba(255,255,255,0.3)' : color }}
                            />
                            <span
                              className="font-mono text-[8px] uppercase tracking-[0.35em]"
                              style={{ color: isPast ? 'rgba(255,255,255,0.3)' : isToday ? '#fbbf24' : color }}
                            >
                              {status}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    <span className="text-portal-foreground/20 font-mono text-[8px] uppercase tracking-widest group-hover:text-portal-foreground/40 transition-colors duration-300">
                      EXPLORE &rarr;
                    </span>
                  </div>

                </div>
              </div>
            );
          })}

          {/* End spacer */}
          <div className="shrink-0 w-[200px]" />

        </div>
      </div>
    </div>
  );
};

export default CampusEventsSection;
