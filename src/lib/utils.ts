import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NavigateFunction, NavigateOptions } from "react-router-dom";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Navigation lock state - prevents overlapping navigations and rapid clicks
 */
let navigationLock = false;
let navigationLockTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Minimum time between navigations (ms) - prevents spam clicking
 */
const NAVIGATION_COOLDOWN = 300;

/**
 * Maximum lock duration (ms) - failsafe to prevent permanent lock
 */
const NAVIGATION_LOCK_TIMEOUT = 2000;

/**
 * Check if navigation is currently locked
 */
export function isNavigationLocked(): boolean {
  return navigationLock;
}

/**
 * Lock navigation to prevent overlapping transitions
 * @param duration - How long to lock (defaults to NAVIGATION_COOLDOWN)
 */
export function lockNavigation(duration = NAVIGATION_COOLDOWN): void {
  navigationLock = true;
  
  // Clear any existing timer
  if (navigationLockTimer) {
    clearTimeout(navigationLockTimer);
  }
  
  // Auto-unlock after duration (failsafe)
  navigationLockTimer = setTimeout(() => {
    navigationLock = false;
    navigationLockTimer = null;
  }, Math.min(duration, NAVIGATION_LOCK_TIMEOUT));
}

/**
 * Unlock navigation (called when transition completes)
 */
export function unlockNavigation(): void {
  navigationLock = false;
  if (navigationLockTimer) {
    clearTimeout(navigationLockTimer);
    navigationLockTimer = null;
  }
}

/**
 * Safe navigation helper to prevent duplicate route pushes and race conditions.
 * 
 * Features:
 * - Prevents navigation to the same route
 * - Locks navigation during transitions to prevent overlap
 * - Debounces rapid clicks (300ms cooldown)
 * - Uses replace by default to prevent back button issues
 * - Auto-unlocks after 2s failsafe
 * 
 * @param navigate - React Router's navigate function
 * @param currentPath - Current location pathname
 * @param targetPath - Path to navigate to
 * @param options - Navigation options (defaults to { replace: true })
 * @param delay - Optional delay in ms to wait for animations (default: 0)
 * @returns true if navigation occurred, false if blocked
 */
export async function safeNavigate(
  navigate: NavigateFunction,
  currentPath: string,
  targetPath: string,
  options: NavigateOptions = { replace: true },
  delay = 0
): Promise<boolean> {
  // Prevent navigation to the same route
  if (currentPath === targetPath) {
    return false;
  }

  // Block if navigation is locked (transition in progress or cooldown)
  if (navigationLock) {
    return false;
  }

  // Lock navigation to prevent overlapping transitions
  lockNavigation(NAVIGATION_LOCK_TIMEOUT);

  // Wait for animations to complete if delay specified
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Perform navigation
  navigate(targetPath, options);
  return true;
}
