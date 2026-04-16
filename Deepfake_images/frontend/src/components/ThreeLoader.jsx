import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Line, Wireframe } from '@react-three/drei';

const AnimatedCore = () => {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.5;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.8;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5, 1]} />
      <meshBasicMaterial color="#00f5ff" wireframe />
      {/* Inner glowing sphere */}
      <mesh scale={0.7}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <MeshDistortMaterial
          color="#9d00ff"
          extrude={0.1}
          seed={1}
          distort={0.4}
          speed={5}
          emissive="#ff007f"
          emissiveIntensity={2}
          wireframe={false}
          transparent
          opacity={0.8}
        />
      </mesh>
    </mesh>
  );
};

const ThreeLoader = () => {
  return (
    <div className="w-full h-full min-h-[150px] relative pointer-events-none">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <AnimatedCore />
      </Canvas>
    </div>
  );
};

export default ThreeLoader;
