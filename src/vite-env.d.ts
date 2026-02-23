/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT_MS: string;
  readonly VITE_SESSION_EXPIRY_BUFFER_MS: string;
  readonly VITE_QUERY_STALE_TIME_MS: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_ENVIRONMENT: string;
  readonly VITE_LOGROCKET_APP_ID: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_DEFAULT_EMAIL_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
