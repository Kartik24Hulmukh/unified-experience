/**
 * BErozgar — Global API Error Handler
 *
 * Centralized error handler that maps API errors to user-visible feedback.
 * Works with sonner (toast) for non-blocking notifications.
 * Handles: 401→logout, 403→restricted UI, 500→retry, timeout, network errors.
 *
 * Used by React Query's onError callbacks and the api-client layer.
 */

import { toast } from 'sonner';
import { ApiError, type ApiErrorCode } from '@/lib/api-client';
import { sessionManager } from '@/lib/session';
import logger from '@/lib/logger';
import { captureException } from '@/lib/monitoring';

/* ═══════════════════════════════════════════════════
   Error Messages (user-facing)
   ═══════════════════════════════════════════════════ */

const ERROR_MESSAGES: Record<ApiErrorCode, { title: string; description: string }> = {
  NETWORK_ERROR: {
    title: 'Connection Lost',
    description: 'Check your internet connection and try again.',
  },
  TIMEOUT: {
    title: 'Request Timed Out',
    description: 'The server took too long to respond. Please try again.',
  },
  UNAUTHORIZED: {
    title: 'Session Expired',
    description: 'Please log in again to continue.',
  },
  FORBIDDEN: {
    title: 'Access Denied',
    description: 'You don\'t have permission to perform this action.',
  },
  NOT_FOUND: {
    title: 'Not Found',
    description: 'The requested resource could not be found.',
  },
  VALIDATION_ERROR: {
    title: 'Invalid Input',
    description: 'Please check your input and try again.',
  },
  CONFLICT: {
    title: 'Status Outdated',
    description: 'The request status has changed since you opened this page. Please refresh.',
  },
  RATE_LIMITED: {
    title: 'Too Many Requests',
    description: 'Please wait a moment and try again.',
  },
  SERVER_ERROR: {
    title: 'Server Error',
    description: 'Something went wrong on our end. Please try again.',
  },
  UNKNOWN: {
    title: 'Unexpected Error',
    description: 'Something went wrong. Please try again later.',
  },
};

/* ═══════════════════════════════════════════════════
   Core Handler
   ═══════════════════════════════════════════════════ */

interface HandleErrorOptions {
  /** Override the default toast message */
  customMessage?: string;
  /** If true, don't show a toast (caller handles UI) */
  silent?: boolean;
  /** Context for logging */
  context?: string;
}

/**
 * Centralized error handler. Call this from React Query's onError,
 * mutation error callbacks, or any catch block.
 */
export function handleApiError(error: unknown, options: HandleErrorOptions = {}): void {
  const { customMessage, silent = false, context = 'API' } = options;

  // Normalize to ApiError
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN',
        0,
      );

  // Log for debugging
  logger.error(context, `${apiError.code}: ${apiError.message}`, {
    status: apiError.status,
    details: apiError.details,
  });

  // Report to Sentry (skip 401/403 — these are expected auth flows)
  if (apiError.code !== 'UNAUTHORIZED' && apiError.code !== 'FORBIDDEN') {
    captureException(apiError, {
      code: apiError.code,
      status: apiError.status,
      context,
      details: apiError.details,
    });
  }

  // 401 — Auto-logout (session expired)
  // AUTH-SESSION-04: idempotent guard — the api-client's handleTokenRefresh
  // already calls clearSession() when refresh fails. Without this guard,
  // both layers clear the session, causing double BroadcastChannel 'logout'
  // events and duplicate "Session Expired" toasts.
  if (apiError.code === 'UNAUTHORIZED') {
    if (sessionManager.isAuthenticated()) {
      sessionManager.clearSession();
    }
    if (!silent) {
      toast.error(ERROR_MESSAGES.UNAUTHORIZED.title, {
        description: ERROR_MESSAGES.UNAUTHORIZED.description,
      });
    }
    return;
  }

  // 403 — Show forbidden message
  if (apiError.code === 'FORBIDDEN') {
    if (!silent) {
      toast.error(ERROR_MESSAGES.FORBIDDEN.title, {
        description: customMessage || ERROR_MESSAGES.FORBIDDEN.description,
      });
    }
    return;
  }

  // 500+ — Show retry toast
  if (apiError.code === 'SERVER_ERROR') {
    if (!silent) {
      toast.error(ERROR_MESSAGES.SERVER_ERROR.title, {
        description: customMessage || ERROR_MESSAGES.SERVER_ERROR.description,
        action: {
          label: 'Retry',
          onClick: () => {
            // emit a custom event that calling code can listen for
            window.dispatchEvent(new CustomEvent('api-retry'));
          },
        },
      });
    }
    return;
  }

  // Network / Timeout
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') {
    if (!silent) {
      toast.error(ERROR_MESSAGES[apiError.code].title, {
        description: ERROR_MESSAGES[apiError.code].description,
      });
    }
    return;
  }

  // Validation error — use server message if available
  if (apiError.code === 'VALIDATION_ERROR') {
    if (!silent) {
      toast.error(ERROR_MESSAGES.VALIDATION_ERROR.title, {
        description: customMessage || apiError.message || ERROR_MESSAGES.VALIDATION_ERROR.description,
      });
    }
    return;
  }

  // Default — show generic error
  if (!silent) {
    const errorInfo = ERROR_MESSAGES[apiError.code] || ERROR_MESSAGES.UNKNOWN;
    toast.error(errorInfo.title, {
      description: customMessage || apiError.message || errorInfo.description,
    });
  }
}

/**
 * React Query global error handler.
 * Attach to QueryClient defaultOptions for automatic toast on any query/mutation error.
 */
export function createQueryErrorHandler(context?: string) {
  return (error: Error) => {
    handleApiError(error, { context: context || 'ReactQuery' });
  };
}
