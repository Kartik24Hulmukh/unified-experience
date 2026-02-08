import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/*
  Fully geometric 3D shield — vivid colors, large icons, real depth.
  ExtrudeGeometry goes z: 0→depth. We offset mesh z by -depth/2
  so the shield is centered at z=0. Flat sections sit at z = depth/2 + ε.
*/

const BODY_DEPTH = 0.18;
const RIM_DEPTH = 0.22;

const ShieldLogo = () => {
  const groupRef = useRef<THREE.Group>(null);
  const autoAngle = useRef(0);
  const mouse = useRef({ x: 0, y: 0 });
  const { pointer } = useThree();
  const [hovered, setHovered] = useState(false);

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

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;

    mouse.current.x += (pointer.x - mouse.current.x) * 0.03;
    mouse.current.y += (pointer.y - mouse.current.y) * 0.03;

    // Gentle continuous rotation
    autoAngle.current += delta * (hovered ? 0.08 : 0.25);

    const tY = autoAngle.current + (hovered ? mouse.current.x * 0.6 : 0);
    const tX = hovered
      ? -mouse.current.y * 0.25
      : Math.sin(_state.clock.elapsedTime * 0.3) * 0.04;

    g.rotation.y += (tY - g.rotation.y) * 0.035;
    g.rotation.x += (tX - g.rotation.x) * 0.035;
    g.position.y = Math.sin(_state.clock.elapsedTime * 0.35) * 0.015;

    const s = hovered ? 1.05 : 1.0;
    g.scale.lerp(new THREE.Vector3(s, s, s), 0.04);
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
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
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
};

interface Portal3DProps {
  className?: string;
}

const Portal3D = ({ className = '' }: Portal3DProps) => (
  <div className={`w-full h-full ${className}`} style={{ cursor: 'grab' }}>
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 40 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={4} />
      <directionalLight position={[3, 4, 5]} intensity={3} />
      <directionalLight position={[-3, -2, -5]} intensity={1.5} />
      <pointLight position={[0, 0, 4]} intensity={2} color="#fff5e0" />
      <ShieldLogo />
    </Canvas>
  </div>
);

export default Portal3D;
