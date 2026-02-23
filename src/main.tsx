import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize GSAP plugins globally (must be first)
import "./lib/gsap-init";

// Initialize session manager (multi-tab sync, token scheduling)
import { sessionManager } from "./lib/session";
sessionManager.init();

// Initialize monitoring (Sentry + LogRocket)
import { initMonitoring } from "./lib/monitoring";
initMonitoring();

/* ─── Global safety net: catch ALL unhandled errors/rejections ──── */
window.addEventListener('error', (event) => {
  // eslint-disable-next-line no-console
  console.error('[GLOBAL] Uncaught error:', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  // eslint-disable-next-line no-console
  console.error('[GLOBAL] Unhandled promise rejection:', event.reason);
});

/**
 * Render a visible crash message into the DOM so the user never sees
 * a blank white screen. Called only when bootstrap() itself fails.
 */
function renderCrashScreen(err: unknown) {
  const root = document.getElementById('root') ?? document.body;
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                font-family:system-ui,sans-serif;text-align:center;padding:2rem;background:#fff;color:#222">
      <div>
        <h1 style="font-size:1.5rem;margin-bottom:0.5rem">Something went wrong</h1>
        <p style="color:#666;margin-bottom:1rem">The application failed to start. Please refresh the page.</p>
        <button onclick="location.reload()"
          style="padding:0.5rem 1.5rem;border-radius:6px;border:1px solid #ccc;
                 background:#111;color:#fff;cursor:pointer;font-size:0.875rem">
          Refresh
        </button>
        ${import.meta.env.DEV ? `<pre style="margin-top:1rem;text-align:left;font-size:0.75rem;
          color:#c00;max-width:600px;overflow:auto">${String(err)}</pre>` : ''}
      </div>
    </div>`;
}

/**
 * Bootstrap app — renders the root React component.
 * Mock API has been removed; all data flows through the real backend.
 */
async function bootstrap() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error('Root element #root not found in DOM');
  }

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap().catch(renderCrashScreen);
