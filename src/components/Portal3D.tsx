import React, { useRef, useMemo, useEffect, useLayoutEffect, memo, Component, type ReactNode, type ErrorInfo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/*
  Fully geometric 3D shield — vivid colors, large icons, real depth.
  ExtrudeGeometry goes z: 0→depth. We offset mesh z by -depth/2
  so the shield is centered at z=0. Flat sections sit at z = depth/2 + ε.
*/

const BODY_DEPTH = 0.18;
const RIM_DEPTH = 0.22;

// Clamped DPR for resize stability (max 2)
const CLAMPED_DPR: [number, number] = [1, 2];

/* ─── Lightweight error boundary for WebGL Canvas ──────────────── */
interface WebGLGuardState { hasError: boolean }
class WebGLErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, WebGLGuardState> {
  state: WebGLGuardState = { hasError: false };
  static getDerivedStateFromError(): WebGLGuardState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.warn('[Portal3D] WebGL crashed — showing fallback', error, info);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Static CSS-only shield placeholder shown when WebGL context fails */
const ShieldFallback = () => (
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{
      width: 120, height: 140,
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      clipPath: 'polygon(50% 0%, 100% 25%, 100% 65%, 50% 100%, 0% 65%, 0% 25%)',
      opacity: 0.7,
    }} />
  </div>
);

// Dispose all Three.js resources in a scene
const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  });
};

// Component to handle cleanup on unmount — uses useLayoutEffect
// to dispose before the browser paints the next frame
const SceneCleanup = () => {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    return () => {
      // Dispose all scene objects
      disposeScene(scene);
      // Dispose the WebGL renderer
      gl.dispose();
      // Note: do NOT call gl.forceContextLoss() here —
      // it races with PageTransition overlapping canvases
    };
  }, [gl, scene]);

  return null;
};

const ShieldLogo = memo(({ scrollProgressRef }: { scrollProgressRef?: { current: number } }) => {
  const groupRef = useRef<THREE.Group>(null);
  const autoAngle = useRef(0);
  const mouse = useRef({ x: 0, y: 0 });
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const { pointer } = useThree();
  const hovered = useRef(false);

  const geos = useMemo(() => {
    const W = 0.78, HT = 0.88, HB = 1.0;

    const makeShield = (w: number, ht: number, hb: number) => {
      const s = new THREE.Shape();
      s.moveTo(-w, ht * 0.78);
      s.quadraticCurveTo(-w * 0.5, ht, 0, ht * 1.06);
      s.quadraticCurveTo(w * 0.5, ht, w, ht * 0.78);
      s.lineTo(w, 0);
      s.quadraticCurveTo(w, -hb * 0.35, w * 0.55, -hb * 0.65);
      s.quadraticCurveTo(w * 0.28, -hb * 0.85, 0, -hb);
      s.quadraticCurveTo(-w * 0.28, -hb * 0.85, -w * 0.55, -hb * 0.65);
      s.quadraticCurveTo(-w, -hb * 0.35, -w, 0);
      s.closePath();
      return s;
    };

    const inner = makeShield(W, HT, HB);
    const rimOuter = makeShield(W * 1.12, HT * 1.07, HB * 1.06);
    rimOuter.holes.push(inner.clone());

    // Orange top-left
    const orange = new THREE.Shape();
    orange.moveTo(-W, HT * 0.78);
    orange.quadraticCurveTo(-W * 0.5, HT, 0, HT * 1.06);
    orange.lineTo(0, 0);
    orange.lineTo(-W, 0);
    orange.closePath();

    // Green top-right
    const green = new THREE.Shape();
    green.moveTo(0, HT * 1.06);
    green.quadraticCurveTo(W * 0.5, HT, W, HT * 0.78);
    green.lineTo(W, 0);
    green.lineTo(0, 0);
    green.closePath();

    // Blue bottom
    const blue = new THREE.Shape();
    blue.moveTo(-W, 0);
    blue.lineTo(W, 0);
    blue.quadraticCurveTo(W, -HB * 0.35, W * 0.55, -HB * 0.65);
    blue.quadraticCurveTo(W * 0.28, -HB * 0.85, 0, -HB);
    blue.quadraticCurveTo(-W * 0.28, -HB * 0.85, -W * 0.55, -HB * 0.65);
    blue.quadraticCurveTo(-W, -HB * 0.35, -W, 0);
    blue.closePath();

    // NO .center() — we position via mesh z-offset instead
    const bodyGeo = new THREE.ExtrudeGeometry(inner, {
      depth: BODY_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 4,
    });

    const rimGeo = new THREE.ExtrudeGeometry(rimOuter, {
      depth: RIM_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 3,
    });

    return {
      body: bodyGeo,
      rim: rimGeo,
      orange: new THREE.ShapeGeometry(orange),
      green: new THREE.ShapeGeometry(green),
      blue: new THREE.ShapeGeometry(blue),
    };
  }, []);

  // Dispose geometries on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geos.body.dispose();
      geos.rim.dispose();
      geos.orange.dispose();
      geos.green.dispose();
      geos.blue.dispose();
    };
  }, [geos]);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;

    // Frame-rate independent damping: normalize lerp factors to 60fps baseline.
    // At 60fps delta≈0.0167, so dt60≈1. At 144fps dt60≈0.42, at 30fps dt60≈2.
    const dt60 = delta * 60;
    // Clamp to avoid spiral on tab-switch (delta can spike)
    const dtClamped = Math.min(dt60, 3);

    // Frame-rate independent exponential decay: 1 - (1-factor)^dt
    const damp = (factor: number) => 1 - Math.pow(1 - factor, dtClamped);

    mouse.current.x += (pointer.x - mouse.current.x) * damp(0.03);
    mouse.current.y += (pointer.y - mouse.current.y) * damp(0.03);

    // Scroll-driven rotation — cappen.com style cinematic momentum
    // Base rotation accelerates as user scrolls, creating an immersive zoom feel
    const h = hovered.current;
    const scrollP = scrollProgressRef?.current ?? 0;
    const baseSpeed = h ? 0.08 : 0.25;
    // Scroll amplifies rotation: 1x at top → 4x at full scroll (exponential ramp)
    const scrollBoost = scrollP * scrollP * 3.5;
    autoAngle.current += delta * (baseSpeed + scrollBoost);

    const tY = autoAngle.current + (h ? mouse.current.x * 0.6 : 0);
    // Scroll adds progressive X-axis tilt for dramatic depth perspective
    const scrollTilt = scrollP * 0.15;
    const tX = h
      ? -mouse.current.y * 0.25
      : Math.sin(_state.clock.elapsedTime * 0.3) * 0.04 + scrollTilt;

    // Lerp factor increases with scroll for snappier response during zoom
    const lerpFactor = damp(0.035 + scrollP * 0.04);
    g.rotation.y += (tY - g.rotation.y) * lerpFactor;
    g.rotation.x += (tX - g.rotation.x) * lerpFactor;
    // Subtle floating bob — dampens as scroll progresses (shield stabilizes during zoom)
    g.position.y = Math.sin(_state.clock.elapsedTime * 0.35) * 0.015 * (1 - scrollP * 0.8);

    const s = h ? 1.05 : 1.0;
    targetScale.current.set(s, s, s);
    g.scale.lerp(targetScale.current, damp(0.04));
  });

  // Extrude goes z: 0→depth. Offset mesh by -depth/2 to center at z=0.
  // Then front face = depth/2, back face = -depth/2 (via bevel).
  // Flat sections sit just above the front face.
  const bodyZ = -BODY_DEPTH / 2;   // -0.09
  const rimZ = -RIM_DEPTH / 2;     // -0.11
  const FRONT = BODY_DEPTH / 2 + 0.01;  // 0.10 — just above front face
  const DIV = FRONT + 0.005;
  const ICON = FRONT + 0.015;
  const BACK = -(BODY_DEPTH / 2 + 0.01); // behind back face

  return (
    <group
      ref={groupRef}
      onPointerOver={() => { hovered.current = true; }}
      onPointerOut={() => { hovered.current = false; }}
    >
      {/* ─── Shield body (offset so centered at z=0) ─── */}
      <mesh geometry={geos.body} position={[0, 0, bodyZ]}>
        <meshStandardMaterial
          color="#1a2332"
          metalness={0.4}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ─── Gold rim ─── */}
      <mesh geometry={geos.rim} position={[0, 0, rimZ]}>
        <meshStandardMaterial
          color="#D4A843"
          metalness={0.9}
          roughness={0.1}
          emissive="#B8922E"
          emissiveIntensity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ─── VIVID front-face colored sections ─── */}
      <mesh geometry={geos.orange} position={[0, 0, FRONT]}>
        <meshBasicMaterial color="#FF9800" />
      </mesh>
      <mesh geometry={geos.green} position={[0, 0, FRONT]}>
        <meshBasicMaterial color="#4CAF50" />
      </mesh>
      <mesh geometry={geos.blue} position={[0, 0, FRONT]}>
        <meshBasicMaterial color="#2196F3" />
      </mesh>

      {/* ─── Gold dividers ─── */}
      <mesh position={[0, 0, DIV]}>
        <boxGeometry args={[1.58, 0.035, 0.01]} />
        <meshBasicMaterial color="#D4A843" />
      </mesh>
      <mesh position={[0, 0.47, DIV]}>
        <boxGeometry args={[0.035, 0.94, 0.01]} />
        <meshBasicMaterial color="#D4A843" />
      </mesh>

      {/* ═══════ LARGE ICONS ═══════ */}

      {/* Σ / Z (orange, top-left) */}
      <group position={[-0.39, 0.47, ICON]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.24, 0.04, 0.018]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh rotation={[0, 0, -0.82]}>
          <boxGeometry args={[0.34, 0.035, 0.018]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.24, 0.04, 0.018]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* Open Book (green, top-right) */}
      <group position={[0.39, 0.47, ICON]}>
        <mesh position={[-0.07, 0.02, 0]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[0.13, 0.22, 0.014]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0.07, 0.02, 0]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.13, 0.22, 0.014]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, -0.015, 0.008]}>
          <boxGeometry args={[0.018, 0.25, 0.016]} />
          <meshBasicMaterial color="#D4A843" />
        </mesh>
        {[-0.04, 0.0, 0.04, 0.08].map((ly) => (
          <mesh key={`ll${ly}`} position={[-0.07, ly, 0.01]}>
            <boxGeometry args={[0.08, 0.012, 0.004]} />
            <meshBasicMaterial color="#4CAF50" />
          </mesh>
        ))}
        {[-0.04, 0.0, 0.04, 0.08].map((ly) => (
          <mesh key={`rl${ly}`} position={[0.07, ly, 0.01]}>
            <boxGeometry args={[0.08, 0.012, 0.004]} />
            <meshBasicMaterial color="#4CAF50" />
          </mesh>
        ))}
      </group>

      {/* Calculator (blue, bottom) */}
      <group position={[0, -0.50, ICON]}>
        <mesh>
          <boxGeometry args={[0.22, 0.30, 0.014]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0.085, 0.01]}>
          <boxGeometry args={[0.16, 0.055, 0.006]} />
          <meshBasicMaterial color="#1565C0" />
        </mesh>
        {[-0.046, 0, 0.046].map((bx) =>
          [0.01, -0.035, -0.08].map((by) => (
            <mesh key={`b${bx}${by}`} position={[bx, by, 0.01]}>
              <boxGeometry args={[0.038, 0.03, 0.006]} />
              <meshBasicMaterial color="#1565C0" />
            </mesh>
          ))
        )}
        <mesh position={[0, -0.12, 0.01]}>
          <boxGeometry args={[0.12, 0.028, 0.006]} />
          <meshBasicMaterial color="#FF9800" />
        </mesh>
      </group>

      {/* ─── Back face (visible when rotated past 90°) ─── */}
      <mesh geometry={geos.orange} position={[0, 0, BACK]}>
        <meshBasicMaterial color="#FF9800" side={THREE.BackSide} />
      </mesh>
      <mesh geometry={geos.green} position={[0, 0, BACK]}>
        <meshBasicMaterial color="#4CAF50" side={THREE.BackSide} />
      </mesh>
      <mesh geometry={geos.blue} position={[0, 0, BACK]}>
        <meshBasicMaterial color="#2196F3" side={THREE.BackSide} />
      </mesh>
    </group>
  );
});

// Display name for debugging
ShieldLogo.displayName = 'ShieldLogo';

interface Portal3DProps {
  className?: string;
  scrollProgressRef?: { current: number };
}

const Portal3D = memo(({ className = '', scrollProgressRef }: Portal3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // R3F Canvas handles resize internally via its own ResizeObserver.
  // The old manual resize handler was a no-op wrapped in debounce that
  // leaked timer references. Removed entirely — R3F's `resize` prop handles it.

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full ${className}`} 
      style={{ cursor: 'grab' }}
    >
      <WebGLErrorBoundary fallback={<ShieldFallback />}>
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 40 }}
          gl={{ 
            antialias: true, 
            alpha: true, 
            toneMapping: THREE.NoToneMapping,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          }}
          dpr={CLAMPED_DPR}
          style={{ background: 'transparent' }}
          resize={{ debounce: 100, scroll: false }}
        >
          <SceneCleanup />
          <ambientLight intensity={4} />
          <directionalLight position={[3, 4, 5]} intensity={3} />
          <directionalLight position={[-3, -2, -5]} intensity={1.5} />
          <pointLight position={[0, 0, 4]} intensity={2} color="#fff5e0" />
          <ShieldLogo scrollProgressRef={scrollProgressRef} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
});

// Display name for debugging
Portal3D.displayName = 'Portal3D';

export default Portal3D;
