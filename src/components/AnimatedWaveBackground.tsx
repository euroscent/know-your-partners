import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SolanaRibbon = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  // Create a tube/ribbon geometry
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 200;
    
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const x = (i / segments) * 16 - 8;
      const y = Math.sin(t * 1.5) * 2;
      const z = Math.cos(t * 0.8) * 0.5;
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 256, 0.18, 32, false);
    
    return tubeGeometry;
  }, []);

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      vec3 pos = position;
      
      // Add wave animation
      float wave = sin(pos.x * 0.5 + uTime * 0.8) * 0.3;
      wave += sin(pos.x * 0.3 - uTime * 0.5) * 0.2;
      pos.y += wave;
      pos.z += cos(pos.x * 0.4 + uTime * 0.6) * 0.15;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    
    void main() {
      // EuroScent colors: purple/violet shades
      vec3 purple1 = vec3(0.545, 0.361, 0.965);  // #8B5CF6 - primary
      vec3 purple2 = vec3(0.659, 0.525, 0.988);  // #A886FC - lighter
      vec3 purple3 = vec3(0.475, 0.306, 0.910);  // #794EE8 - darker
      vec3 violet = vec3(0.541, 0.318, 0.937);   // #8A51EF
      vec3 lavender = vec3(0.769, 0.675, 0.996); // #C4ACFE - very light
      
      // Create gradient along the ribbon
      float gradientPos = (vPosition.x + 8.0) / 16.0;
      gradientPos += sin(uTime * 0.3) * 0.1;
      
      vec3 color;
      if (gradientPos < 0.25) {
        color = mix(purple3, purple1, gradientPos * 4.0);
      } else if (gradientPos < 0.5) {
        color = mix(purple1, lavender, (gradientPos - 0.25) * 4.0);
      } else if (gradientPos < 0.75) {
        color = mix(lavender, purple2, (gradientPos - 0.5) * 4.0);
      } else {
        color = mix(purple2, violet, (gradientPos - 0.75) * 4.0);
      }
      
      // Add fresnel effect for glossy look
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);
      
      // Add specular highlight
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float specular = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 48.0);
      
      // Combine effects
      color += fresnel * 0.3 * lavender;
      color += specular * 0.8;
      
      // Add edge glow
      float edgeGlow = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
      color *= 0.85 + edgeGlow * 0.3;
      
      gl_FragColor = vec4(color, 0.95);
    }
  `;

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 0, 0]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  );
};

const FloatingOrbs = () => {
  const orb1Ref = useRef<THREE.Mesh>(null);
  const orb2Ref = useRef<THREE.Mesh>(null);
  const orb3Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (orb1Ref.current) {
      orb1Ref.current.position.x = Math.sin(t * 0.3) * 2 - 4;
      orb1Ref.current.position.y = Math.cos(t * 0.2) * 1 + 1;
    }
    if (orb2Ref.current) {
      orb2Ref.current.position.x = Math.cos(t * 0.25) * 2 + 4;
      orb2Ref.current.position.y = Math.sin(t * 0.3) * 1.5 - 0.5;
    }
    if (orb3Ref.current) {
      orb3Ref.current.position.x = Math.sin(t * 0.35) * 1.5;
      orb3Ref.current.position.y = Math.cos(t * 0.28) * 1 - 1.5;
    }
  });

  return (
    <>
      <mesh ref={orb1Ref} position={[-4, 1, -3]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.08} />
      </mesh>
      <mesh ref={orb2Ref} position={[4, -0.5, -3]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#A78BFA" transparent opacity={0.06} />
      </mesh>
      <mesh ref={orb3Ref} position={[0, -1.5, -2]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#C4B5FD" transparent opacity={0.1} />
      </mesh>
    </>
  );
};

const AnimatedWaveBackground = () => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-background via-background to-muted/30">
      {/* Soft purple glow effects */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-20"
        style={{
          background: 'radial-gradient(circle, hsl(250 70% 60%) 0%, transparent 70%)',
          top: '10%',
          left: '-5%',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-15"
        style={{
          background: 'radial-gradient(circle, hsl(270 70% 70%) 0%, transparent 70%)',
          top: '20%',
          right: '-5%',
          animation: 'pulse 6s ease-in-out infinite reverse',
        }}
      />
      <div 
        className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
        style={{
          background: 'radial-gradient(circle, hsl(250 80% 75%) 0%, transparent 70%)',
          bottom: '20%',
          left: '30%',
          animation: 'pulse 10s ease-in-out infinite',
        }}
      />
      
      {/* Subtle light streaks */}
      <div 
        className="absolute h-px w-full opacity-30"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(250 70% 60% / 0.4), transparent)',
          top: '40%',
          filter: 'blur(2px)',
        }}
      />
      <div 
        className="absolute h-px w-full opacity-20"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(250 70% 70% / 0.3), transparent)',
          top: '60%',
          filter: 'blur(3px)',
        }}
      />
      
      {/* 3D Canvas with Ribbon */}
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        className="!absolute inset-0"
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, -5, 5]} intensity={0.5} color="#A78BFA" />
        <pointLight position={[5, -10, 5]} intensity={0.5} color="#8B5CF6" />
        <SolanaRibbon />
        <FloatingOrbs />
      </Canvas>
      
      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/40 pointer-events-none" />
    </div>
  );
};

export default AnimatedWaveBackground;
