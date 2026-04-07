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

const CLAMPED_DPR: [number, number] = [1, 3]; // Higher DPR for crisp high-DPI displays

/* ─── WebGL Guard ─── */
interface WebGLGuardState { hasError: boolean }
class WebGLErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, WebGLGuardState> {
  state: WebGLGuardState = { hasError: false };
  static getDerivedStateFromError(): WebGLGuardState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Portal3D] WebGL crashed — showing fallback', error, info);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const ShieldFallback = () => (
  <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
    <style>{`
      @keyframes shield-pulse {
        0% { transform: scale(0.95); opacity: 0.4; }
        50% { transform: scale(1.05); opacity: 0.8; }
        100% { transform: scale(0.95); opacity: 0.4; }
      }
      .shield-logo-fallback {
        animation: shield-pulse 4s ease-in-out infinite;
        filter: drop-shadow(0 0 20px rgba(212, 168, 67, 0.4));
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    `}</style>
    <img 
      src="/logo.png" 
      alt="Campus Trust Shield" 
      className="shield-logo-fallback"
    />
  </div>
);

const disposeObject = (obj: unknown) => {
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) obj.material.forEach((m: unknown) => m.dispose());
    else obj.material.dispose();
  }
};

const SceneCleanup = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    return () => {
      scene.traverse((o) => { if ((o as unknown).isMesh) disposeObject(o); });
      gl.dispose();
    };
  }, [gl, scene]);
  return null;
};

const ShieldLogo = memo(({ scrollProgressRef }: { scrollProgressRef?: { current: number } }) => {
  const groupRef = useRef<THREE.Group>(null);
  const autoAngle = useRef(0);

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

    const oS = new THREE.Shape(); oS.moveTo(-W, HT * 0.78); oS.quadraticCurveTo(-W * 0.5, HT, 0, HT * 1.06); oS.lineTo(0, 0); oS.lineTo(-W, 0); oS.closePath();
    const gS = new THREE.Shape(); gS.moveTo(0, HT * 1.06); gS.quadraticCurveTo(W * 0.5, HT, W, HT * 0.78); gS.lineTo(W, 0); gS.lineTo(0, 0); gS.closePath();
    const bS = new THREE.Shape(); bS.moveTo(-W, 0); bS.lineTo(W, 0); bS.quadraticCurveTo(W, -HB * 0.35, W * 0.55, -HB * 0.65); bS.quadraticCurveTo(W * 0.28, -HB * 0.85, 0, -HB); bS.quadraticCurveTo(-W * 0.28, -HB * 0.85, -W * 0.55, -HB * 0.65); bS.quadraticCurveTo(-W, -HB * 0.35, -W, 0); bS.closePath();

    return {
      body: new THREE.ExtrudeGeometry(inner, { depth: BODY_DEPTH, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 4 }),
      rim: new THREE.ExtrudeGeometry(rimOuter, { depth: RIM_DEPTH, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3 }),
      orange: new THREE.ShapeGeometry(oS),
      green: new THREE.ShapeGeometry(gS),
      blue: new THREE.ShapeGeometry(bS),
    };
  }, []);

  useEffect(() => {
    return () => Object.values(geos).forEach(g => g.dispose());
  }, [geos]);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    
    // Smooth frame-rate independent rotation
    const dtClamped = Math.min(delta * 60, 3);
    const damp = (factor: number) => 1 - Math.pow(1 - factor, dtClamped);

    const scrollP = scrollProgressRef?.current ?? 0;
    // Automatic rotation speed — slightly boosted by scroll for dynamic feel
    autoAngle.current += delta * (0.28 + scrollP * scrollP * 3.5);

    // Target rotation based on autoAngle
    const tY = autoAngle.current;
    const tX = Math.sin(_state.clock.elapsedTime * 0.4) * 0.06 + scrollP * 0.15;

    // Apply smooth damping
    const lerpFactor = damp(0.04 + scrollP * 0.04);
    g.rotation.y += (tY - g.rotation.y) * lerpFactor;
    g.rotation.x += (tX - g.rotation.x) * lerpFactor;
    
    // Gentle floating bob
    g.position.y = Math.sin(_state.clock.elapsedTime * 0.35) * 0.08 * (1 - scrollP * 0.8);
  });

  const bodyZ = -BODY_DEPTH / 2;
  const rimZ = -RIM_DEPTH / 2;
  const FRONT = BODY_DEPTH / 2 + 0.01;
  const DIV = FRONT + 0.005;
  const ICON = FRONT + 0.015;

  return (
    <group ref={groupRef}>
      <mesh geometry={geos.body} position={[0, 0, bodyZ]}>
        <meshStandardMaterial color="#1a2332" metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.rim} position={[0, 0, rimZ]}>
        <meshStandardMaterial color="#D4A843" metalness={0.9} roughness={0.1} emissive="#B8922E" emissiveIntensity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.orange} position={[0, 0, FRONT]}><meshBasicMaterial color="#FF9800" /></mesh>
      <mesh geometry={geos.green} position={[0, 0, FRONT]}><meshBasicMaterial color="#4CAF50" /></mesh>
      <mesh geometry={geos.blue} position={[0, 0, FRONT]}><meshBasicMaterial color="#2196F3" /></mesh>
      <mesh position={[0, 0, DIV]}><boxGeometry args={[1.58, 0.035, 0.01]} /><meshBasicMaterial color="#D4A843" /></mesh>
      <mesh position={[0, 0.47, DIV]}><boxGeometry args={[0.035, 0.94, 0.01]} /><meshBasicMaterial color="#D4A843" /></mesh>
      
      {/* Sigma / Z */}
      <group position={[-0.39, 0.47, ICON]}>
        <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.24, 0.04, 0.018]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
        <mesh rotation={[0, 0, -0.82]}><boxGeometry args={[0.34, 0.035, 0.018]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
        <mesh position={[0, -0.14, 0]}><boxGeometry args={[0.24, 0.04, 0.018]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
      </group>

      {/* Book */}
      <group position={[0.39, 0.47, ICON]}>
        <mesh position={[-0.07, 0.02, 0]} rotation={[0, 0, 0.08]}><boxGeometry args={[0.13, 0.22, 0.014]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
        <mesh position={[0.07, 0.02, 0]} rotation={[0, 0, -0.08]}><boxGeometry args={[0.13, 0.22, 0.014]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
        <mesh position={[0, -0.015, 0.008]}><boxGeometry args={[0.018, 0.25, 0.016]} /><meshBasicMaterial color="#D4A843" /></mesh>
        {[-0.04, 0, 0.04, 0.08].map(ly => (
          <mesh key={ly} position={[-0.07, ly, 0.01]}><boxGeometry args={[0.08, 0.012, 0.004]} /><meshBasicMaterial color="#4CAF50" /></mesh>
        ))}
        {[-0.04, 0, 0.04, 0.08].map(ly => (
          <mesh key={ly} position={[0.07, ly, 0.01]}><boxGeometry args={[0.08, 0.012, 0.004]} /><meshBasicMaterial color="#4CAF50" /></mesh>
        ))}
      </group>

      {/* Calc */}
      <group position={[0, -0.5, ICON]}>
        <mesh><boxGeometry args={[0.22, 0.3, 0.014]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
        <mesh position={[0, 0.085, 0.01]}><boxGeometry args={[0.16, 0.055, 0.006]} /><meshBasicMaterial color="#1565C0" /></mesh>
        {[-0.046, 0, 0.046].map(bx => [0.01, -0.035, -0.08].map(by => (
          <mesh key={`${bx}-${by}`} position={[bx, by, 0.01]}><boxGeometry args={[0.038, 0.03, 0.006]} /><meshBasicMaterial color="#1565C0" /></mesh>
        )))}
        <mesh position={[0, -0.12, 0.01]}><boxGeometry args={[0.12, 0.028, 0.006]} /><meshBasicMaterial color="#FF9800" /></mesh>
      </group>
    </group>
  );
});

ShieldLogo.displayName = 'ShieldLogo';

const Portal3D = memo(({ className = '', scrollProgressRef }: { className?: string; scrollProgressRef?: { current: number } }) => {
  return (
    <div className={`w-full h-full ${className}`}>
      <WebGLErrorBoundary fallback={<ShieldFallback />}>
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 40 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }}
          dpr={CLAMPED_DPR}
          style={{ background: 'transparent', pointerEvents: 'none' }}
          resize={{ debounce: 100, scroll: false }}
        >
          <SceneCleanup />
          <ambientLight intensity={3} /> {/* Balanced ambient lighting */}
          <directionalLight position={[3, 4, 5]} intensity={2.5} /> {/* Main key light */}
          <directionalLight position={[-3, -2, -5]} intensity={1.2} /> {/* Fill light */}
          <pointLight position={[0, 0, 4]} intensity={2.2} color="#fff5e0" /> {/* Rim light for glow */}
          <ShieldLogo scrollProgressRef={scrollProgressRef} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
});

Portal3D.displayName = 'Portal3D';
export default Portal3D;
