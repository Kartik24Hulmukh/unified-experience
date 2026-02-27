/* eslint-disable react/no-unknown-property */
import { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Lightformer, Text } from '@react-three/drei';
import {
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  BallCollider,
  CuboidCollider,
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';

/* ──────────────────────────────────────────────────────────
   Lanyard — Physics-based 3D campus ID card on a rope strap.
   ────────────────────────────────────────────────────────── */

extend({ MeshLineGeometry, MeshLineMaterial });

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose());
      } else {
        (object.material as THREE.Material)?.dispose();
      }
    }
  });
};

const SceneCleanup = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    return () => {
      disposeScene(scene);
      gl.dispose();
    };
  }, [gl, scene]);
  return null;
};

interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
}

function CampusIDCard() {
  const W = 0.8;
  const H = 1.12;
  const D = 0.015;
  const Z = D / 2 + 0.001;
  const dotRef = useRef<THREE.Mesh>(null);
  const LEFT = -W / 2 + 0.06;

  useFrame((state) => {
    if (dotRef.current) {
      const mat = dotRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 4) * 1.0;
    }
  });

  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial
          color="#1a1a2e"
          emissive="#001122"
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={0.8}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transmission={0.1}
          thickness={0.1}
        />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[W + 0.01, H + 0.01, D - 0.002]} />
        <meshBasicMaterial color="#00BCD4" transparent opacity={0.2} />
      </mesh>

      <mesh position={[0, H / 2 - 0.06, Z]}>
        <planeGeometry args={[W, 0.12]} />
        <meshBasicMaterial color="#00BCD4" />
      </mesh>

      <Text
        position={[0, H / 2 - 0.045, Z + 0.002]}
        fontSize={0.038}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        letterSpacing={0.1}
      >
        MCTRGIT
      </Text>

      <mesh position={[0, H / 2 - 0.155, Z]}>
        <planeGeometry args={[W * 0.9, 0.035]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Text
        position={[0, H / 2 - 0.155, Z + 0.002]}
        fontSize={0.018}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        CAMPUS IDENTITY CARD
      </Text>

      <group position={[LEFT + 0.08, 0.12, Z]}>
        <mesh>
          <planeGeometry args={[0.22, 0.28]} />
          <meshBasicMaterial color="#ffffff" opacity={0.1} transparent />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[0.20, 0.26]} />
          <meshBasicMaterial color="#050510" />
        </mesh>
        <mesh position={[0, 0.04, 0.002]}>
          <circleGeometry args={[0.045, 16]} />
          <meshBasicMaterial color="#00BCD4" opacity={0.3} transparent />
        </mesh>
        <mesh position={[0, -0.04, 0.002]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshBasicMaterial color="#00BCD4" opacity={0.3} transparent />
        </mesh>
      </group>

      <Text position={[0.08, 0.22, Z + 0.002]} fontSize={0.012} color="#00BCD4" anchorX="left">NAME</Text>
      <Text position={[0.08, 0.19, Z + 0.002]} fontSize={0.02} color="#ffffff" anchorX="left" fontWeight="bold">MCTRGIT USER</Text>

      <Text position={[0.08, 0.14, Z + 0.002]} fontSize={0.012} color="#00BCD4" anchorX="left">DEPT</Text>
      <Text position={[0.08, 0.11, Z + 0.002]} fontSize={0.016} color="#ffffff" anchorX="left">Comp. Science</Text>

      <mesh ref={dotRef} position={[W / 2 - 0.08, H / 2 - 0.06, Z + 0.002]}>
        <circleGeometry args={[0.015, 12]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>

      <group position={[-0.25, -0.3, Z]}>
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh key={i} position={[i * 0.025, 0, 0]}>
            <planeGeometry args={[i % 3 === 0 ? 0.015 : 0.008, 0.08]} />
            <meshBasicMaterial color="#ffffff" opacity={0.4} transparent />
          </mesh>
        ))}
      </group>

      <Text position={[0, -H / 2 + 0.04, Z + 0.002]} fontSize={0.01} color="#00BCD4" anchorX="center" letterSpacing={0.5}>
        BEROZGAR TRUST EXCHANGE
      </Text>
    </group>
  );
}

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false }) {
  const band = useRef<any>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);

  const vec = useRef(new THREE.Vector3()).current;
  const ang = useRef(new THREE.Vector3()).current;
  const rot = useRef(new THREE.Vector3()).current;
  const dir = useRef(new THREE.Vector3()).current;

  const segmentProps = {
    type: 'dynamic' as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]));
  const [dragged, drag] = useState<THREE.Vector3 | false>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => { document.body.style.cursor = 'auto'; };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - (dragged as THREE.Vector3).x,
        y: vec.y - (dragged as THREE.Vector3).y,
        z: vec.z - (dragged as THREE.Vector3).z,
      });
    }

    if (fixed.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDist = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDist * (maxSpeed - minSpeed)));
      });

      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current?.geometry?.setPoints?.(curve.getPoints(isMobile ? 16 : 32));

      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = 'chordal';

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group scale={2.25} position={[0, -1.2, -0.05]} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)} onPointerUp={(e: any) => { e.target.releasePointerCapture(e.pointerId); drag(false); }} onPointerDown={(e: any) => { e.target.setPointerCapture(e.pointerId); drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation()))); }}>
            <CampusIDCard />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="#00BCD4" depthTest={false} resolution={isMobile ? [1000, 2000] : [1000, 1000]} lineWidth={1.2} />
      </mesh>
    </>
  );
}

const Lanyard = ({ position = [0, 0, 30], gravity = [0, -40, 0], fov = 20, transparent = true }) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position, fov }} dpr={[1, isMobile ? 1.5 : 2]} gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => { gl.setClearColor(new THREE.Color(0x000000), 0); }}>
        <SceneCleanup />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={2} color="#00BCD4" />
        <pointLight position={[-10, 5, 5]} intensity={1.5} color="#ffffff" />

        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} />
        </Physics>

        {/* Production-ready lighting fallback (replaces external HDR Environment) */}
        <group>
          <Lightformer intensity={0.5} color="white" position={[0, 5, 5]} scale={[10, 10, 1]} />
          <Lightformer intensity={2} color="#00BCD4" position={[-5, 2, -1]} scale={[10, 1, 1]} />
          <Lightformer intensity={2} color="white" position={[5, -2, -1]} scale={[10, 1, 1]} />
        </group>
      </Canvas>
    </div>
  );
};

export default Lanyard;
