import React, { useRef, useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function FluidTextReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  // Smooth out the mouse movement (inertia)
  const springX = useSpring(mouseX, { stiffness: 100, damping: 20, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 100, damping: 20, mass: 0.5 });

  // Add a slight delay for trailing motion
  const trailX = useSpring(mouseX, { stiffness: 80, damping: 25, mass: 0.8 });
  const trailY = useSpring(mouseY, { stiffness: 80, damping: 25, mass: 0.8 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handleMouseLeave = () => {
    // Optionally return to center or stay at edge, let's keep it at the exact edge
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full min-h-[100dvh] bg-white overflow-hidden flex flex-col items-center justify-center cursor-default isolate"
    >
      {/* SVG Filter Definition for the liquid edge */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liquid-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="3"
              result="noise"
            />
            {/* Animate the noise for dynamic deformation */}
            <feColorMatrix type="hueRotate" values="0" result="animatedNoise">
              <animate
                attributeName="values"
                from="0"
                to="360"
                dur="4s"
                repeatCount="indefinite"
              />
            </feColorMatrix>
            <feDisplacementMap
              in="SourceGraphic"
              in2="animatedNoise"
              scale="40"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            {/* Soften the edges if needed */}
            <feGaussianBlur in="displaced" stdDeviation="4" result="blurred" />
            <feComposite in="blurred" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        <defs>
          <mask id="fluid-mask">
            {/* White covers what should be visible */}
            <rect width="100%" height="100%" fill="black" />
            <motion.circle
              cx={springX}
              cy={springY}
              r={250}
              fill="white"
              filter="url(#liquid-filter)"
            />
            <motion.circle
              cx={trailX}
              cy={trailY}
              r={150}
              fill="white"
              filter="url(#liquid-filter)"
              opacity={0.5}
            />
          </mask>
        </defs>
      </svg>

      {/* BOTTOM LAYER (Default Visible) */}
      <div className="absolute inset-0 flex flex-col items-start justify-center pointer-events-none select-none z-10 w-full bg-white px-6 md:px-16 lg:px-24">
        <div className="flex flex-col items-start leading-[0.85] tracking-[-0.05em] uppercase font-display font-black text-[13vw] md:text-[10vw] lg:text-[8vw] text-gray-900">
          <span className="block">TRUST</span>
          <span className="block ml-[8vw] md:ml-[6vw]">CENTRIC</span>
          <span className="block">EXCHANGE</span>
        </div>
      </div>

      {/* TOP LAYER (Hidden Underneath, Revealed via Mask) */}
      <div
        className="absolute inset-0 flex flex-col items-start justify-center pointer-events-none select-none z-20 w-full px-6 md:px-16 lg:px-24"
        style={{
          backgroundColor: '#000000',
          mask: 'url(#fluid-mask)',
          WebkitMask: 'url(#fluid-mask)',
        }}
      >
        <div className="flex flex-col items-start leading-[0.85] tracking-[-0.05em] uppercase font-display font-black text-[13vw] md:text-[10vw] lg:text-[8vw] text-[#a3ff12]">
          <span className="block">TRUST</span>
          <span className="block ml-[8vw] md:ml-[6vw]">CENTRIC</span>
          <span className="block">EXCHANGE</span>
        </div>
      </div>
    </div>
  );
}
