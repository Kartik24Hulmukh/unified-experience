/**
 * useGoogleIdentity - Google Identity Services (GIS) integration hook.
 *
 * Uses the real Google One Tap / Account Picker popup when a
 * `VITE_GOOGLE_CLIENT_ID` is configured.
 *
 * The returned `credential` string is a Google JWT (ID token) that
 * our backend verifies via Google's public keys.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/lib/env';

interface CredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

interface GoogleAccounts {
  id: {
    initialize: (config: {
      client_id: string;
      callback: (response: CredentialResponse) => void;
      auto_select?: boolean;
      cancel_on_tap_outside?: boolean;
      context?: string;
      ux_mode?: string;
      itp_support?: boolean;
    }) => void;
    prompt: (notification?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
    renderButton: (
      parent: HTMLElement,
      options: {
        type?: string;
        theme?: string;
        size?: string;
        text?: string;
        width?: number;
        logo_alignment?: string;
      },
    ) => void;
    disableAutoSelect: () => void;
    revoke: (email: string, done: () => void) => void;
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let scriptLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load GIS script')));
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GIS script'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface GoogleIdentityResult {
  credential: string;
  email?: string;
}

export function useGoogleIdentity() {
  const clientId = (env as Record<string, unknown>).VITE_GOOGLE_CLIENT_ID as string | undefined;
  const hasRealGIS = !!clientId;

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);
  const resolveRef = useRef<((result: GoogleIdentityResult) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  useEffect(() => {
    if (!hasRealGIS) setIsReady(false);
  }, [hasRealGIS, clientId]);

  const ensureInitialized = useCallback(async () => {
    if (!hasRealGIS) {
      throw new Error(
        'Google Sign-In is unavailable. Configure VITE_GOOGLE_CLIENT_ID and ensure GIS script access.',
      );
    }

    await loadGisScript();

    if (!window.google?.accounts?.id) {
      setIsReady(false);
      throw new Error('Google Sign-In failed to initialize.');
    }

    if (!initializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: (response: CredentialResponse) => {
          if (resolveRef.current) {
            let email: string | undefined;
            try {
              const parts = response.credential.split('.');
              if (parts.length >= 2) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                email = payload.email;
              }
            } catch {
              // Ignore decode errors; backend verification is source of truth.
            }

            resolveRef.current({ credential: response.credential, email });
            resolveRef.current = null;
            rejectRef.current = null;
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
      });
      initializedRef.current = true;
    }

    setIsReady(true);
  }, [clientId, hasRealGIS]);

  const promptSignIn = useCallback((): Promise<GoogleIdentityResult> => {
    setIsLoading(true);

    return ensureInitialized()
      .then(
        () =>
          new Promise<GoogleIdentityResult>((resolve, reject) => {
            if (window.google?.accounts?.id) {
              resolveRef.current = (result) => {
                setIsLoading(false);
                resolve(result);
              };
              rejectRef.current = (err) => {
                setIsLoading(false);
                reject(err);
              };

              window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                  if (resolveRef.current) {
                    setIsLoading(false);
                    rejectRef.current?.(
                      new Error(
                        'Google Sign-In was cancelled or unavailable. Ensure you are signed into a Google account in this browser.',
                      ),
                    );
                    resolveRef.current = null;
                    rejectRef.current = null;
                  }
                }
              });
            } else {
              setIsLoading(false);
              reject(new Error('Google Sign-In is unavailable.'));
            }
          }),
      )
      .catch((err) => {
        setIsLoading(false);
        throw err instanceof Error ? err : new Error('Google Sign-In is unavailable.');
      });
  }, [ensureInitialized]);

  const renderButton = useCallback(
    async (container: HTMLElement | null) => {
      if (!container) return;

      try {
        await ensureInitialized();
      } catch {
        return;
      }

      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: container.offsetWidth || 380,
        logo_alignment: 'left',
      });
    },
    [ensureInitialized],
  );

  return {
    isReady,
    isLoading,
    hasRealGIS,
    promptSignIn,
    renderButton,
  };
}
