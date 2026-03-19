/* eslint-disable react/no-unknown-property */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Html, RoundedBox } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import * as THREE from 'three';

// -------------------------------------------------------------
// This is your breathtaking custom UI card design (replaces the missing card.glb file)
function PremiumIDCard() {
  const W = 1.4;
  const H = 2.2;
  const D = 0.04;
  const Z = D / 2 + 0.001;

  return (
    <group>
      {/* 1. Metal Clip Hook at the top */}
      <mesh position={[0, H / 2 + 0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 16]} />
        <meshStandardMaterial color="#8892b0" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, H / 2 + 0.25, 0]}>
        <torusGeometry args={[0.08, 0.02, 16, 32]} />
        <meshStandardMaterial color="#8892b0" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* 2. Glassmorphism Card Body */}
      <RoundedBox args={[W, H, D]} radius={0.05} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#060c14"
          metalness={0.5}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          transmission={0.4}
          ior={1.5}
          thickness={0.5}
          envMapIntensity={2}
        />
      </RoundedBox>

      {/* 3. Glowing Accent Line */}
      <mesh position={[0, H / 2 - 0.2, Z]}>
        <planeGeometry args={[W, 0.06]} />
        <meshBasicMaterial color="#00BCD4" />
      </mesh>

      {/* 4. Ultra-crisp HTML UI Overlay */}
      <Html
        transform
        position={[0, 0, Z]}
        distanceFactor={1.5}
        zIndexRange={[100, 0]}
        occlude="blending"
        className="pointer-events-none select-none"
      >
        <div 
          className="flex flex-col rounded-md overflow-hidden p-6"
          style={{ 
            width: '280px',
            height: '440px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            border: '2px solid rgba(0, 188, 212, 0.2)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Header */}
          <div className="w-full flex flex-col items-center justify-center mt-2">
            <h1 className="text-[#00BCD4] font-black tracking-[0.3em] text-[22px] drop-shadow-lg">MCTRGIT</h1>
            <span className="text-[9px] font-bold tracking-[0.4em] text-white/50 mt-1 uppercase">Trust Protocol Gateway</span>
          </div>

          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#00BCD4]/50 to-transparent mt-4" />

          {/* Profile Details */}
          <div className="mt-8 flex items-center gap-5 relative">
            <div className="w-[70px] h-[90px] bg-[#020617] border border-[#00BCD4]/50 rounded-md relative overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(0,188,212,0.2)]">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,188,212,0.1)_50%,transparent_75%)] bg-[length:200%_200%] animate-[shimmer_2s_infinite]" />
              <div className="w-8 h-8 rounded-full bg-white/10" />
              <div className="absolute bottom-0 w-12 h-8 rounded-t-xl bg-white/10" />
            </div>
            
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[7px] text-[#00BCD4] font-bold tracking-[0.2em] uppercase">Authorized Identity</p>
                <p className="text-[16px] font-bold text-white tracking-wide mt-0.5">ADMINISTRATOR</p>
              </div>
              <div>
                <p className="text-[7px] text-[#00BCD4] font-bold tracking-[0.2em] uppercase">Department / Sector</p>
                <p className="text-[12px] font-medium text-white/80 mt-0.5">System Operations</p>
              </div>
              <div>
                <p className="text-[7px] text-[#00BCD4] font-bold tracking-[0.2em] uppercase">Clearance Level</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
                  <p className="text-[11px] font-bold text-[#00ff88] tracking-widest">LEVEL 5 OMNI</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto mb-2 relative">
             <div className="flex gap-1 mb-4 opacity-30">
                {[...Array(8)].map((_,i) => <div key={i} className="w-2 h-2 rounded-sm bg-[#00BCD4]" />)}
             </div>
             
             <div className="w-full h-[24px] flex items-center opacity-60 mix-blend-screen">
               {[...Array(60)].map((_, i) => (
                 <div key={i} className="h-full bg-white" style={{ width: Math.random() > 0.5 ? '3px' : '1px', marginRight: Math.random() > 0.5 ? '2px' : '1px' }} />
               ))}
             </div>
             <p className="text-center text-[7px] text-[#00BCD4] tracking-[0.5em] mt-3 font-mono">
               TN-0992-XXXX-8831
             </p>
          </div>
        </div>
      </Html>
    </group>
  );
}

// -------------------------------------------------------------
// The Exact Physics Band Config provided
function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false }) {
  const band = useRef<any>();
  const fixed = useRef<any>();
  const j1 = useRef<any>();
  const j2 = useRef<any>();
  const j3 = useRef<any>();
  const card = useRef<any>();
  
  const vec = new THREE.Vector3(),
    ang = new THREE.Vector3(),
    rot = new THREE.Vector3(),
    dir = new THREE.Vector3();
    
  const segmentProps = { type: 'dynamic' as const, canSleep: true, colliders: false as const, angularDamping: 4, linearDamping: 4 };
  
  const [dragged, drag] = useState<any>(false);
  const [hovered, hover] = useState(false);

  // Layout alignment left side anchor
  const anchorX = isMobile ? 0 : -3.5;
  const anchorY = 4.35; // Perfect drop placement to Y=0 as per UI design

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.35, 0]]); // Offset 1.35 connects exactly to the top clip!

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && card.current) {
      // Dynamic pointer conversion
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      
      card.current.setNextKinematicTranslation({ 
        x: vec.x - dragged.x, 
        y: vec.y - dragged.y, 
        z: vec.z - dragged.z 
      });
    }
    
    if (fixed.current && card.current && band.current) {
      // The secret to eliminating string jitter! Deliberately lerping rendering positions under the physics positions!
      [j1, j2].forEach(ref => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });
      
      const pTop = (fixed.current as any).translation();
      const p1 = j1.current.lerped;
      const p2 = j2.current.lerped;
      const p3 = (j3.current as any).translation();
      const cardPos = (card.current as any).translation();
      const cRot = (card.current as any).rotation();
      const offset = new THREE.Vector3(0, 1.35, 0).applyQuaternion(cRot);
      const attachPos = new THREE.Vector3(cardPos.x, cardPos.y, cardPos.z).add(offset);

      // Extend the curve way past the screen ceiling (pTop.y + 10) to completely fix the annoying UI gap!
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(pTop.x, pTop.y + 10, pTop.z), 
        new THREE.Vector3(pTop.x, pTop.y, pTop.z),
        new THREE.Vector3(p1.x, p1.y, p1.z),
        new THREE.Vector3(p2.x, p2.y, p2.z),
        new THREE.Vector3(p3.x, p3.y, p3.z),
        attachPos
      ]);
      
      const geom = new THREE.TubeGeometry(path, 64, 0.035, 8, false);
      (band.current as any).geometry.dispose();
      (band.current as any).geometry = geom;
      
      // Smart angular velocity dampening that prevents spinning identically without locking rotations entirely!
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  return (
    <>
      <group position={[anchorX, anchorY, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0, -1, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.05]} />
        </RigidBody>
        <RigidBody position={[0, -2, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.05]} />
        </RigidBody>
        <RigidBody position={[0, -3, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.05]} />
        </RigidBody>
        
        <RigidBody 
            position={[0, -4, 0]} 
            ref={card} 
            {...segmentProps} 
            type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.7, 1.125, 0.05]} />
          
          <group
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={e => {
                e.target.releasePointerCapture(e.pointerId);
                drag(false);
            }}
            onPointerDown={e => {
              e.target.setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <PremiumIDCard />
          </group>
        </RigidBody>
      </group>
      
      <mesh ref={band}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0,1,0)]), 64, 0.035, 8, false]} />
        <meshPhysicalMaterial color="#00BCD4" roughness={0.7} metalness={0.1} clearcoat={0.2} />
      </mesh>
    </>
  );
}

// -------------------------------------------------------------
export default function Lanyard({ position = [0, 0, 12] as [number, number, number], gravity = [0, -30, 0] as [number, number, number], fov = 35, transparent = true }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto">
      <Canvas
        camera={{ position: position, fov: fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent, antialias: true, preserveDrawingBuffer: true }}
      >
        {/* Superior Studio Lighting for PremiumIDCard reflections */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={2.5} color="#ffffff" />
        <directionalLight position={[-10, 5, -5]} intensity={1.5} color="#00BCD4" />

        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} />
        </Physics>

        <Environment resolution={256}>
          <group rotation={[-Math.PI / 3, 0, 0]}>
            <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 4, -8]} scale={[20, 10, 1]} />
            <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 0, 0]} scale={[20, 2, 1]} color="#00BCD4" />
            <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[5, 0, 0]} scale={[20, 2, 1]} color="#ffffff" />
            <Lightformer type="ring" intensity={2} position={[0, 0, 5]} scale={[10, 10, 1]} />
          </group>
        </Environment>
      </Canvas>
    </div>
  );
}
