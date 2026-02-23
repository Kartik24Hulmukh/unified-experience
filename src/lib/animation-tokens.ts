/**
 * Animation Tokens — Centralized GSAP constants
 *
 * FROZEN. Do not change without design review.
 * All GSAP animations should reference these constants
 * instead of using inline magic numbers.
 */

/* ─── Durations (seconds) ─── */
export const DURATION = {
  /** Instant feedback (hovers, toggles) */
  instant: 0.2,
  /** Quick transitions (modals, dropdowns) */
  fast: 0.4,
  /** Standard content transitions */
  normal: 0.8,
  /** Hero/entrance animations */
  slow: 1.2,
  /** Cinematic scroll sequences */
  cinematic: 2.0,
} as const;

/* ─── Easing curves ─── */
export const EASE = {
  /** Default content entrance */
  out: 'power3.out',
  /** Strong entrance (hero elements) */
  strongOut: 'power4.out',
  /** Symmetric S-curve (portal expansion) */
  inOut: 'expo.inOut',
  /** Linear (scroll parallax, progress) */
  none: 'none',
  /** Standard in (exit animations) */
  in: 'power2.in',
} as const;

/* ─── Stagger (seconds) ─── */
export const STAGGER = {
  /** Tight stagger for list items */
  tight: 0.08,
  /** Normal stagger for cards */
  normal: 0.12,
  /** Wide stagger for hero elements */
  wide: 0.18,
} as const;

/* ─── Scroll scrub values ─── */
export const SCRUB = {
  /** Instant (reduced motion) */
  instant: true as const,
  /** Smooth scrub (1s lag) */
  smooth: 1,
} as const;

/* ─── Common Y-axis travel distances (px) ─── */
export const TRAVEL = {
  /** Subtle shift */
  small: 20,
  /** Standard entrance */
  normal: 60,
  /** Hero-level entrance */
  large: 120,
} as const;
