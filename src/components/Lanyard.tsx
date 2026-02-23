/* eslint-disable react/no-unknown-property */
import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Environment, Lightformer, Text } from '@react-three/drei';
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

   Uses @react-three/rapier for rope-joint physics,
   meshline for the curved band, and procedural geometry
   for the MCTRGIT Campus ID card. Fully draggable.

   Closely follows the reference code's proven physics patterns
   (lerped band rendering, pointer capture drag, chordal curve,
   Y-rotation correction) with BErozgar-branded procedural card.
   ────────────────────────────────────────────────────────── */

extend({ MeshLineGeometry, MeshLineMaterial });

// Dispose all Three.js resources in the scene
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

// GPU cleanup before browser paints next frame
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

/* ── Props ── */
interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
}

/* ──────────────────────────────────────────────
   CampusIDCard — Procedural MCTRGIT College ID
   Designed to look like a real university ID card
   with proper fields, labels, photo area, etc.
   Dimensions are in "card-local" units,
   the parent group applies scale=2.25.
   ────────────────────────────────────────────── */
function CampusIDCard() {
  const W = 0.8;   // credit-card ratio
  const H = 1.12;
  const D = 0.015;
  const Z = D / 2 + 0.001;
  const dotRef = useRef<THREE.Mesh>(null);
  const LEFT = -W / 2 + 0.04; // left margin
  const RIGHT = W / 2 - 0.04; // right margin

  useFrame((state) => {
    if (dotRef.current) {
      const mat = dotRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 3) * 0.8;
    }
  });

  return (
    <group>
      {/* ── Card body ── */}
      <mesh castShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial
          color="#0d0d20"
          roughness={0.3}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.12}
        />
      </mesh>

      {/* ═══════════ FRONT FACE ═══════════ */}

      {/* ── Top header band (cyan gradient bar) ── */}
      <mesh position={[0, H / 2 - 0.06, Z]}>
        <planeGeometry args={[W, 0.12]} />
        <meshBasicMaterial color="#00838F" />
      </mesh>
      {/* Top accent line */}
      <mesh position={[0, H / 2 - 0.003, Z + 0.001]}>
        <planeGeometry args={[W, 0.006]} />
        <meshBasicMaterial color="#00BCD4" />
      </mesh>

      {/* College name in header */}
      <Text
        position={[0, H / 2 - 0.04, Z + 0.002]}
        fontSize={0.032}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.14}
        fontWeight="bold"
      >
        M.C.T.R.G.I.T
      </Text>
      <Text
        position={[0, H / 2 - 0.075, Z + 0.002]}
        fontSize={0.014}
        color="#B2EBF2"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        Autonomous
      </Text>

      {/* ── "CAMPUS IDENTITY CARD" title bar ── */}
      <mesh position={[0, H / 2 - 0.145, Z]}>
        <planeGeometry args={[W * 0.85, 0.035]} />
        <meshBasicMaterial color="#00BCD4" opacity={0.9} transparent />
      </mesh>
      <Text
        position={[0, H / 2 - 0.145, Z + 0.002]}
        fontSize={0.016}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.25}
        fontWeight="bold"
      >
        CAMPUS IDENTITY CARD
      </Text>

      {/* ── Photo area (left side) ── */}
      {/* Border */}
      <mesh position={[LEFT + 0.10, 0.12, Z]}>
        <planeGeometry args={[0.22, 0.26]} />
        <meshBasicMaterial color="#00BCD4" opacity={0.25} transparent />
      </mesh>
      {/* Photo bg */}
      <mesh position={[LEFT + 0.10, 0.12, Z + 0.001]}>
        <planeGeometry args={[0.20, 0.24]} />
        <meshBasicMaterial color="#111128" />
      </mesh>
      {/* Silhouette head */}
      <mesh position={[LEFT + 0.10, 0.17, Z + 0.002]}>
        <circleGeometry args={[0.045, 20]} />
        <meshBasicMaterial color="#1e1e40" />
      </mesh>
      {/* Silhouette shoulders */}
      <mesh position={[LEFT + 0.10, 0.08, Z + 0.002]}>
        <planeGeometry args={[0.12, 0.08]} />
        <meshBasicMaterial color="#1e1e40" />
      </mesh>

      {/* ── Student details (right side of photo) ── */}
      {/* Name label */}
      <Text
        position={[0.10, 0.22, Z + 0.002]}
        fontSize={0.011}
        color="#00BCD4"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.15}
      >
        NAME
      </Text>
      {/* Name value */}
      <mesh position={[0.21, 0.195, Z]}>
        <planeGeometry args={[0.28, 0.002]} />
        <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
      </mesh>
      <Text
        position={[0.10, 0.195, Z + 0.002]}
        fontSize={0.016}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.85}
      >
        MCTRGIT User
      </Text>

      {/* Department label */}
      <Text
        position={[0.10, 0.155, Z + 0.002]}
        fontSize={0.011}
        color="#00BCD4"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.15}
      >
        DEPARTMENT
      </Text>
      <Text
        position={[0.10, 0.13, Z + 0.002]}
        fontSize={0.014}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.7}
      >
        Computer Science
      </Text>

      {/* Email / User ID */}
      <Text
        position={[0.10, 0.09, Z + 0.002]}
        fontSize={0.011}
        color="#00BCD4"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.15}
      >
        EMAIL ID
      </Text>
      <Text
        position={[0.10, 0.065, Z + 0.002]}
        fontSize={0.012}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.65}
      >
        user@mctrgit.ac.in
      </Text>

      {/* ── Full-width fields below photo ── */}
      {/* Enrollment No */}
      <Text
        position={[LEFT, -0.02, Z + 0.002]}
        fontSize={0.011}
        color="#00BCD4"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.15}
      >
        ENROLLMENT NO.
      </Text>
      <Text
        position={[LEFT, -0.045, Z + 0.002]}
        fontSize={0.018}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.9}
        letterSpacing={0.12}
      >
        B23CS001
      </Text>

      {/* Year + Validity on same row */}
      <Text
        position={[LEFT, -0.08, Z + 0.002]}
        fontSize={0.011}
        color="#00BCD4"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.15}
      >
        YEAR
      </Text>
      <Text
        position={[LEFT, -0.10, Z + 0.002]}
        fontSize={0.014}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.7}
      >
        2023-2027
      </Text>

      <Text
        position={[0.12, -0.08, Z + 0.002]}
        fontSize={0.011}
        color="#00BCD4"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.15}
      >
        VALID TILL
      </Text>
      <Text
        position={[0.12, -0.10, Z + 0.002]}
        fontSize={0.014}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.7}
      >
        2027
      </Text>

      {/* ── Divider ── */}
      <mesh position={[0, -0.13, Z]}>
        <planeGeometry args={[W * 0.9, 0.002]} />
        <meshBasicMaterial color="#00BCD4" opacity={0.3} transparent />
      </mesh>

      {/* ── Barcode area ── */}
      <group position={[-0.22, -0.17, Z]}>
        {Array.from({ length: 28 }).map((_, i) => (
          <mesh key={i} position={[i * 0.016, 0, 0]}>
            <planeGeometry args={[i % 3 === 0 ? 0.01 : 0.005, 0.05]} />
            <meshBasicMaterial
              color="#ffffff"
              opacity={i % 2 === 0 ? 0.5 : 0.2}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* ── Bottom branding bar ── */}
      <mesh position={[0, -H / 2 + 0.025, Z]}>
        <planeGeometry args={[W, 0.05]} />
        <meshBasicMaterial color="#00838F" opacity={0.5} transparent />
      </mesh>
      <Text
        position={[0, -H / 2 + 0.025, Z + 0.002]}
        fontSize={0.011}
        color="#B2EBF2"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.30}
      >
        BEROZGAR TRUST EXCHANGE
      </Text>

      {/* ── Status dot — pulsing green (ACTIVE) ── */}
      <mesh ref={dotRef} position={[RIGHT, H / 2 - 0.06, Z + 0.002]}>
        <circleGeometry args={[0.012, 10]} />
        <meshStandardMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={1.5} />
      </mesh>
      <Text
        position={[RIGHT - 0.005, H / 2 - 0.085, Z + 0.002]}
        fontSize={0.008}
        color="#4CAF50"
        anchorX="right"
        anchorY="middle"
        letterSpacing={0.2}
      >
        ACTIVE
      </Text>

      {/* ═══════════ BACK FACE ═══════════ */}
      <mesh position={[0, 0, -Z]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#08081a" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ──────────────────────────────────────────────
   Band — Rapier rope-joint chain + meshline strap
   Following the reference code's proven approach:
   - lerped positions for smooth band rendering
   - pointer capture for reliable drag
   - chordal curve type
   - Y-rotation self-correction
   ────────────────────────────────────────────── */
function Band({
  maxSpeed = 50,
  minSpeed = 0,
  isMobile = false,
}: {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
}) {
  const band = useRef<any>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);

  /* Reusable math objects — allocated once via useRef to avoid GC pressure */
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

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ])
  );

  const [dragged, drag] = useState<THREE.Vector3 | false>(false);
  const [hovered, hover] = useState(false);

  /* ── Joints ── */
  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0],
  ]);

  /* ── Cursor feedback ── */
  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => {
        document.body.style.cursor = 'auto';
      };
    }
  }, [hovered, dragged]);

  /* ── Per-frame: drag, band render, rotation correction ── */
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
      /* Lerped positions for j1 and j2 — smooth band rendering */
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) {
          ref.current.lerped = new THREE.Vector3().copy(
            ref.current.translation()
          );
        }
        const clampedDist = Math.max(
          0.1,
          Math.min(
            1,
            ref.current.lerped.distanceTo(ref.current.translation())
          )
        );
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDist * (maxSpeed - minSpeed))
        );
      });

      /* Update the chordal curve through the 4 key points */
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current?.geometry?.setPoints?.(
        curve.getPoints(isMobile ? 16 : 32)
      );

      /* Y-rotation self-correction — keeps card facing camera */
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({
        x: ang.x,
        y: ang.y - rot.y * 0.25,
        z: ang.z,
      });
    }
  });

  /* Set curve type once */
  curve.curveType = 'chordal';

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />

        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>

        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e: any) => {
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e: any) => {
              e.target.setPointerCapture(e.pointerId);
              drag(
                new THREE.Vector3()
                  .copy(e.point)
                  .sub(vec.copy(card.current.translation()))
              );
            }}
          >
            <CampusIDCard />
          </group>
        </RigidBody>
      </group>

      {/* Lanyard band — meshline curve */}
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="#3a3a7a"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}

/* ──────────────────────────────────────────────
   Lanyard — Main export  (Canvas + Physics + Env)
   ────────────────────────────────────────────── */
const Lanyard = ({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
}: LanyardProps) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)
        }
      >
        <SceneCleanup />
        <ambientLight intensity={Math.PI} />

        <Physics
          gravity={gravity}
          timeStep={isMobile ? 1 / 30 : 1 / 60}
        >
          <Band isMobile={isMobile} />
        </Physics>

        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
};

export default Lanyard;
