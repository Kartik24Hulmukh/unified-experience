import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Environment, useScroll, ScrollControls, Float } from '@react-three/drei';
import * as THREE from 'three';

// Liquid Metal Blob geometry - procedural abstract shape
const LiquidBlob = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const scroll = useScroll();
  
  // Create distorted icosahedron geometry for organic blob look
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.5, 4);
    const positions = geo.attributes.position;
    const vertex = new THREE.Vector3();
    
    // Distort vertices for organic shape
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const noise = Math.sin(vertex.x * 3) * 0.15 + 
                   Math.cos(vertex.y * 2.5) * 0.12 + 
                   Math.sin(vertex.z * 4) * 0.1;
      vertex.normalize().multiplyScalar(1.5 + noise);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.elapsedTime;
    const scrollOffset = scroll.offset;
    
    // Scroll-synced rotation
    meshRef.current.rotation.x = scrollOffset * Math.PI * 2 + time * 0.1;
    meshRef.current.rotation.y = scrollOffset * Math.PI * 1.5 + time * 0.15;
    meshRef.current.rotation.z = Math.sin(time * 0.3) * 0.1;
    
    // Subtle breathing scale
    const breathe = 1 + Math.sin(time * 0.5) * 0.05;
    meshRef.current.scale.setScalar(breathe);
  });

  return (
    <Float
      speed={1.5}
      rotationIntensity={0.2}
      floatIntensity={0.3}
    >
      <mesh ref={meshRef} geometry={geometry}>
        <MeshTransmissionMaterial
          backside
          samples={16}
          thickness={0.5}
          chromaticAberration={0.5}
          anisotropy={0.3}
          distortion={0.8}
          distortionScale={0.5}
          temporalDistortion={0.2}
          iridescence={1}
          iridescenceIOR={1.5}
          iridescenceThicknessRange={[100, 400]}
          transmission={1}
          roughness={0}
          ior={1.5}
          color="#ffffff"
        />
      </mesh>
    </Float>
  );
};

// Secondary floating particles for depth
const FloatingParticles = () => {
  const particlesRef = useRef<THREE.Points>(null);
  const scroll = useScroll();
  
  const { positions, count } = useMemo(() => {
    const count = 50;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 3 + Math.random() * 2;
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    
    return { positions, count };
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const time = state.clock.elapsedTime;
    const scrollOffset = scroll.offset;
    
    particlesRef.current.rotation.y = time * 0.05 + scrollOffset * Math.PI;
    particlesRef.current.rotation.x = scrollOffset * Math.PI * 0.5;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#888888"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
};

// Inner scene with scroll controls
const Scene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#8888ff" />
      
      <LiquidBlob />
      <FloatingParticles />
      
      <Environment preset="city" />
    </>
  );
};

// Main component that wraps everything
interface LiquidSceneProps {
  scrollPages?: number;
}

const LiquidScene = ({ scrollPages = 5 }: LiquidSceneProps) => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        }}
        style={{ background: 'transparent' }}
      >
        <ScrollControls pages={scrollPages} damping={0.25}>
          <Scene />
        </ScrollControls>
      </Canvas>
    </div>
  );
};

export default LiquidScene;
