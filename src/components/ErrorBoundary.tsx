import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { ApiError } from "@/lib/api-client";
import logger from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Custom fallback render function — receives error for conditional rendering */
  renderFallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Identifier for logging — e.g. "AdminPage", "ResalePage" */
  boundary?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary — catches render-time exceptions so the app
 * never white-screens.
 *
 * Usage:
 * 1. Wrap the entire app tree (catches everything)
 * 2. Wrap individual routes for granular recovery
 * 3. Use renderFallback prop for custom error UIs
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const tag = this.props.boundary || 'ErrorBoundary';

    // Log with structured logger
    logger.error(tag, error.message, {
      componentStack: errorInfo.componentStack,
      isApiError: error instanceof ApiError,
      ...(error instanceof ApiError
        ? { code: error.code, status: error.status }
        : {}),
    });

    // Forward to optional callback (e.g. Sentry, telemetry)
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom render function
      if (this.props.renderFallback && this.state.error) {
        return this.props.renderFallback(this.state.error, this.handleRetry);
      }

      // Custom fallback element
      if (this.props.fallback) return this.props.fallback;

      // Determine if this is an API-related error
      const isApiError = this.state.error instanceof ApiError;
      const apiCode = isApiError ? (this.state.error as ApiError).code : null;

      return (
        <div
          role="alert"
          className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center"
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
          <h2 className="text-xl font-semibold text-foreground">
            {apiCode === 'NETWORK_ERROR'
              ? 'Connection Lost'
              : apiCode === 'UNAUTHORIZED'
                ? 'Session Expired'
                : 'Something went wrong'}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {apiCode === 'NETWORK_ERROR'
              ? 'Check your internet connection and try again.'
              : apiCode === 'UNAUTHORIZED'
                ? 'Your session has expired. Please refresh and log in again.'
                : 'An unexpected error occurred. Please try again or refresh the page.'}
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-2 max-w-lg overflow-auto rounded bg-muted p-3 text-left text-xs">
              {this.state.error.message}
              {isApiError && `\n[${apiCode}] Status: ${(this.state.error as ApiError).status}`}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
