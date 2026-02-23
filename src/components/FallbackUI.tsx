/**
 * BErozgar — Fallback UI Components
 *
 * Shared loading, error, empty, and offline states.
 * Used by ErrorBoundary, React Query, Suspense, and pages.
 * "No blank screen ever."
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiErrorCode } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════
   Loading Spinner
   ═══════════════════════════════════════════════════ */

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════ */

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  description = 'Content will appear here once available.',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-4xl" role="img" aria-hidden>{icon}</span>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Error Fallback (inline — for query error states)
   ═══════════════════════════════════════════════════ */

interface ErrorFallbackProps {
  error?: Error | null;
  errorCode?: ApiErrorCode;
  onRetry?: () => void;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function ErrorFallback({
  error,
  errorCode,
  onRetry,
  title,
  description,
  compact = false,
}: ErrorFallbackProps) {
  const navigate = useNavigate();

  // Determine appropriate fallback based on error code
  const resolvedTitle = title || getErrorTitle(errorCode);
  const resolvedDescription = description || error?.message || getErrorDescription(errorCode);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
        <span className="text-sm text-destructive">{resolvedTitle}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto text-xs font-medium text-destructive underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex min-h-[30vh] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <svg
          className="h-6 w-6 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground">{resolvedTitle}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{resolvedDescription}</p>
      {import.meta.env.DEV && error && (
        <pre className="mt-1 max-w-lg overflow-auto rounded bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try Again
          </button>
        )}
        <button
          onClick={handleGoBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Offline Banner
   ═══════════════════════════════════════════════════ */

export function OfflineBanner() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-yellow-500 text-yellow-950 px-4 py-2 text-center text-sm font-medium">
      You're offline. Some features may be unavailable.
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   403 Forbidden Page
   ═══════════════════════════════════════════════════ */

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-6xl" role="img" aria-hidden>🔒</span>
      <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
      <p className="max-w-md text-muted-foreground">
        You don't have the necessary permissions to view this page.
        If you believe this is a mistake, contact an administrator.
      </p>
      <button
        onClick={() => navigate('/home')}
        className="mt-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to Home
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function getErrorTitle(code?: ApiErrorCode): string {
  switch (code) {
    case 'NETWORK_ERROR': return 'Connection Lost';
    case 'TIMEOUT': return 'Request Timed Out';
    case 'UNAUTHORIZED': return 'Session Expired';
    case 'FORBIDDEN': return 'Access Denied';
    case 'NOT_FOUND': return 'Not Found';
    case 'SERVER_ERROR': return 'Server Error';
    default: return 'Something went wrong';
  }
}

function getErrorDescription(code?: ApiErrorCode): string {
  switch (code) {
    case 'NETWORK_ERROR': return 'Check your internet connection and try again.';
    case 'TIMEOUT': return 'The server took too long to respond.';
    case 'UNAUTHORIZED': return 'Your session has expired. Please log in again.';
    case 'FORBIDDEN': return 'You don\'t have permission to access this resource.';
    case 'NOT_FOUND': return 'The requested content could not be found.';
    case 'SERVER_ERROR': return 'Something went wrong on our end. Please try again.';
    default: return 'An unexpected error occurred. Please try again.';
  }
}
