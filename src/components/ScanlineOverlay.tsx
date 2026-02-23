/**
 * ScanlineOverlay — Decorative CRT scanline effect overlay.
 * Shared across module pages. Purely visual, aria-hidden.
 */
import { memo } from 'react';

const ScanlineOverlay = memo(function ScanlineOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden="true">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
    </div>
  );
});

export default ScanlineOverlay;
