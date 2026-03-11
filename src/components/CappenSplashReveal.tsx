/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CappenSplashReveal
 *
 * TRUST / CENTRIC / EXCHANGE hero — cappen.com-style staggered layout.
 *
 * Hover reveal: a WebGL Navier-Stokes fluid simulation acts as an eraser
 * for a white cover layer via mix-blend-mode: destination-out.
 * Beneath the cover sits neon-green (#a3ff12) text that becomes visible
 * wherever the user's cursor drags fluid.
 *
 * Architecture (bottom → top):
 *   z-0 — Neon green text (hidden by cover)
 *   z-10 — Cover group (isolation: isolate):
 *          ├── White bg + black text (what you see by default)
 *          └── FluidCanvas (destination-out erases cover where fluid flows)
 */

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import FluidCanvas from "./FluidCanvas";

interface CappenSplashRevealProps {
  texts: string[];
}

export const CappenSplashReveal: React.FC<CappenSplashRevealProps> = ({ texts }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  /* Black text line refs (cover layer — GSAP entrance) */
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const line3Ref = useRef<HTMLDivElement>(null);

  /* Green text line refs (reveal layer — animated in sync) */
  const greenLine1Ref = useRef<HTMLSpanElement>(null);
  const greenLine2Ref = useRef<HTMLSpanElement>(null);
  const greenLine3Ref = useRef<HTMLDivElement>(null);

  /* -- GSAP entrance: animate both layers' lines in perfect sync ------- */
  useEffect(() => {
    const ctx = gsap.context(() => {
      const pairs = [
        [line1Ref.current, greenLine1Ref.current],
        [line2Ref.current, greenLine2Ref.current],
        [line3Ref.current, greenLine3Ref.current],
      ];
      pairs.forEach((pair, i) => {
        gsap.fromTo(
          pair,
          { y: 100, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.4, ease: "power4.out", delay: 0.2 + i * 0.18 }
        );
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  /* -- Shared text classes --------------------------------------------- */
  const sz =
    "font-display font-black uppercase leading-[0.82] tracking-[-0.03em] whitespace-nowrap select-none";
  const textSize = "text-[16.5vw] md:text-[14vw] lg:text-[12.5vw]";

  const [t0, t1, t2] = [texts[0] ?? "TRUST", texts[1] ?? "CENTRIC", texts[2] ?? "EXCHANGE"];

  /* Split EXCHANGE into EX + CHANGE for the decorative box */
  const ex = t2.slice(0, 2);  /* "EX" */
  const change = t2.slice(2);     /* "CHANGE" */

  /* -- Layout renderer (identical for both layers for pixel-perfect alignment) -- */
  const renderLayout = (
    color: string,
    layer: "base" | "reveal",
    refs?: { l1: React.RefObject<HTMLSpanElement | null>; l2: React.RefObject<HTMLSpanElement | null>; l3: React.RefObject<HTMLDivElement | null> }
  ) => (
    <div
      className="w-full h-full flex flex-col justify-center px-[4vw] md:px-[5vw] lg:px-[6vw]"
      aria-hidden={layer === "reveal" ? "true" : undefined}
    >
      {/* Line 1: TRUST — left-aligned */}
      <span
        ref={refs?.l1 ?? undefined}
        className={`${sz} ${textSize} block`}
        style={{ color, alignSelf: "flex-start" }}
      >
        {t0}
      </span>

      {/* Line 2: CENTRIC — right-aligned (offset) */}
      <span
        ref={refs?.l2 ?? undefined}
        className={`${sz} ${textSize} block -mt-[1.5vw]`}
        style={{ color, alignSelf: "flex-end", marginRight: "2vw" }}
      >
        {t1}
      </span>

      {/* Line 3: EX [box] CHANGE — left-aligned */}
      <div
        ref={refs?.l3 ?? undefined}
        className="flex items-center gap-[2.5vw] -mt-[1.5vw]"
        style={{ alignSelf: "flex-start" }}
      >
        <span className={`${sz} ${textSize}`} style={{ color }}>{ex}</span>

        {/* Decorative spinning box — only in base (cover) layer */}
        {layer === "base" && (
          <div
            className="flex-shrink-0 rounded-xl overflow-hidden"
            style={{
              width: "clamp(60px, 9.5vw, 140px)",
              height: "clamp(40px, 6.5vw,  96px)",
              background: "#0a0a0a",
              boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "72%",
                height: "72%",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.18)",
                animation: "spin 10s linear infinite",
                position: "relative",
                opacity: 0.7,
              }}
            >
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "8px solid rgba(255,255,255,0.06)" }} />
              <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.18)", transform: "translateY(-50%)" }} />
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.18)", transform: "translateX(-50%)" }} />
            </div>
          </div>
        )}

        {/* Reveal-layer placeholder box (keeps spacing identical to base) */}
        {layer === "reveal" && (
          <div
            className="flex-shrink-0"
            style={{
              width: "clamp(60px, 9.5vw, 140px)",
              height: "clamp(40px, 6.5vw,  96px)",
            }}
          />
        )}

        <span className={`${sz} ${textSize}`} style={{ color }}>{change}</span>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white overflow-hidden"
      style={{ cursor: "none" }}
    >
      {/* ── Layer 0: Neon green text — hidden under the cover ──────── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {renderLayout("#a3ff12", "reveal", { l1: greenLine1Ref, l2: greenLine2Ref, l3: greenLine3Ref })}
      </div>

      {/* ── Layer 1: Cover group — white bg + black text + fluid eraser ─ */}
      <div
        className="absolute inset-0 z-10"
        style={{ isolation: "isolate" }}
      >
        {/* Default visible content: white background + black text */}
        <div className="absolute inset-0 bg-white">
          {renderLayout("#0a0a0a", "base", { l1: line1Ref, l2: line2Ref, l3: line3Ref })}
        </div>

        {/* WebGL fluid canvas — destination-out erases the cover where fluid flows */}
        <FluidCanvas
          containerRef={containerRef}
          className="absolute inset-0 pointer-events-none"
          style={{ mixBlendMode: "destination-out" as any }}
        />
      </div>
    </div>
  );
};
