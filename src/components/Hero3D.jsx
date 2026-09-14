import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';
import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { observeScrollScene, sceneStyleWriter } from './scrollScene';
import './Hero3D.css';

const clamp = (value) => MathUtils.clamp(value, 0, 1);
const smoothstep = (min, max, value) => {
  const progress = clamp((value - min) / (max - min));
  return progress * progress * (3 - 2 * progress);
};

function Tablet({ progressRef }) {
  const tabletRef = useRef();
  const screenRef = useRef();
  const glowRef = useRef();
  const timeRef = useRef(0);

  useFrame(({ pointer }, delta) => {
    // Preserve the idle pose while rendering is suspended offscreen.
    timeRef.current += Math.min(delta, 0.05);
    const elapsed = timeRef.current;
    const progress = progressRef.current;
    const entrance = smoothstep(0, 0.16, progress);
    const acknowledgement = smoothstep(0.58, 0.72, progress);
    const orbit = smoothstep(0.54, 0.9, progress);
    const outro = smoothstep(0.92, 1, progress);
    const idle = Math.sin(elapsed * 0.75);
    const sway = Math.sin(elapsed * 0.52 + 0.7);

    const baseScale = MathUtils.lerp(0.72, 1, entrance) + idle * 0.012;
    tabletRef.current.scale.setScalar(MathUtils.lerp(MathUtils.lerp(baseScale, 1.7, orbit), 0.43, outro));
    tabletRef.current.position.y = MathUtils.lerp(-0.38, -0.08, entrance) + idle * 0.075 + orbit * 0.08;
    tabletRef.current.rotation.x = -0.12 + Math.cos(elapsed * 0.64) * 0.085 + pointer.y * 0.05;
    tabletRef.current.rotation.y = 0.18 + idle * 0.24 + acknowledgement * 0.3 + pointer.x * 0.075 + orbit * Math.PI * 2;
    tabletRef.current.rotation.z = -0.045 + sway * 0.06 + orbit * 0.13;
    screenRef.current.emissiveIntensity = 0.08 + acknowledgement * 0.42;
    glowRef.current.intensity = 0.4 + acknowledgement * 1.3;
  });

  return (
    <group ref={tabletRef}>
      <RoundedBox args={[2.45, 3.38, 0.2]} radius={0.17} smoothness={8} castShadow>
        <meshPhysicalMaterial color="#c7d4df" metalness={0.85} roughness={0.14} clearcoat={1} />
      </RoundedBox>
      <RoundedBox position={[0, 0, 0.115]} args={[2.28, 3.18, 0.05]} radius={0.13} smoothness={7}>
        <meshPhysicalMaterial ref={screenRef} color="#e6f7ff" emissive="#54c7ff" emissiveIntensity={0.08} roughness={0.14} clearcoat={1} />
      </RoundedBox>
      <mesh position={[0, 1.49, 0.147]}><circleGeometry args={[0.038, 20]} /><meshStandardMaterial color="#0d3554" /></mesh>
      <group position={[-0.06, 0.12, 0.15]}>
        <mesh position={[-0.68, 0.9, 0]}><planeGeometry args={[0.44, 0.06]} /><meshBasicMaterial color="#f2545b" /></mesh>
        {[0.55, 0.24, -0.07, -0.38, -0.69].map((y, index) => (
          <mesh key={y} position={[-0.08 + (index % 2) * 0.09, y, 0]}><planeGeometry args={[1.42 - index * 0.1, index === 2 ? 0.07 : 0.04]} /><meshBasicMaterial color={index === 2 ? '#49bceb' : '#9fb9ca'} /></mesh>
        ))}
        <mesh position={[-0.65, -1.05, 0]}><planeGeometry args={[0.5, 0.16]} /><meshBasicMaterial color="#173b59" /></mesh>
        <mesh position={[0.04, -1.05, 0]}><planeGeometry args={[0.5, 0.16]} /><meshBasicMaterial color="#f2545b" /></mesh>
      </group>
      <pointLight ref={glowRef} position={[0, 0, 1.6]} color="#58c7ff" distance={4.5} intensity={0.4} />
    </group>
  );
}

function TabletScene({ progressRef }) {
  return <><ambientLight intensity={1.35} /><directionalLight position={[4, 6, 7]} intensity={3.1} color="#ffffff" castShadow /><directionalLight position={[-4, 1, 5]} intensity={1.45} color="#64c3ed" /><pointLight position={[3.4, -1.3, 3]} intensity={12} distance={8} color="#f2545b" /><Tablet progressRef={progressRef} /><ContactShadows position={[0, -2.12, -0.35]} opacity={0.2} scale={8.4} blur={2.8} far={5} resolution={256} smooth={false} /><Environment preset="studio" environmentIntensity={0.52} /></>;
}

const humanFrames = [[-72, -25, -16, 0], [-69, -31, -14, 1], [-65, -22, -15, -1], [-61, -35, -12, 1], [-57, -19, -14, 0], [-52, -29, -11, -1], [-47, -13, -12, 1], [-42, -24, -9, 0], [-36, -8, -10, -1], [-30, -18, -7, 1], [-24, -4, -8, 0], [-18, -13, -6, -1], [-13, -1, -7, 1], [-9, -8, -5.5, 0], [-6, -3, -6, -1], [-4, -2, -5, 0]];
const robotFrames = [[71, 29, 20, 0], [68, 20, 18, -1], [64, 30, 19, 1], [59, 17, 16, 0], [54, 25, 17, -1], [49, 13, 14, 1], [43, 21, 15, 0], [37, 9, 12, -1], [31, 16, 13, 1], [25, 5, 10, 0], [19, 12, 11, -1], [13, 3, 8, 1], [8, 8, 9, 0], [3, 0, 6.5, -1], [-1, 4, 6, 1], [-3, 1, 5, 0]];

function interpolateFrames(frames, progress) {
  const position = progress * (frames.length - 1);
  const index = Math.min(frames.length - 2, Math.floor(position));
  const amount = smoothstep(0, 1, position - index);
  return frames[index].map((value, valueIndex) => MathUtils.lerp(value, frames[index + 1][valueIndex], amount));
}

export default function Hero3D({ primaryPath }) {
  const rootRef = useRef();
  const progressRef = useRef(0);
  const [sceneActive, setSceneActive] = useState(false);
  const [useFallback] = useState(() => {
    if (typeof window === 'undefined') return false;
    const testCanvas = document.createElement('canvas');
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || !(testCanvas.getContext('webgl2') || testCanvas.getContext('webgl'));
  });

  useEffect(() => {
    const root = rootRef.current;
    const write = sceneStyleWriter(root.querySelector('.collage-stage'));
    return observeScrollScene(root, { onActiveChange: setSceneActive, onProgress: (progress, viewportWidth) => {
      const handProgress = clamp((progress - 0.1) / 0.54);
      const [humanX, humanY, humanRotation, humanJitter] = interpolateFrames(humanFrames, handProgress);
      const [robotX, robotY, robotRotation, robotJitter] = interpolateFrames(robotFrames, handProgress);
      const exit = smoothstep(0.8, 0.92, progress);
      const outro = smoothstep(0.92, 1, progress);
      const captionOne = smoothstep(0.15, 0.2, progress) * (1 - smoothstep(0.35, 0.4, progress));
      const captionTwo = smoothstep(0.37, 0.42, progress) * (1 - smoothstep(0.55, 0.6, progress));
      const captionThree = smoothstep(0.57, 0.62, progress) * (1 - smoothstep(0.74, 0.79, progress));
      const captionFour = smoothstep(0.76, 0.81, progress) * (1 - smoothstep(0.92, 0.96, progress));
      const captionFive = smoothstep(0.93, 0.97, progress);

      progressRef.current = progress;
      write('--scene-progress', progress);
      write('--copy-opacity', Math.max(0, 1 - progress * 3.1));
      write('--tablet-opacity', `${0.88 + smoothstep(0, 0.12, progress) * 0.12}`);
      const tabletStart = viewportWidth <= 900 ? 58 : 30;
      write('--tablet-x', `${MathUtils.lerp(tabletStart, 0, smoothstep(0.1, 0.42, progress))}vw`);
      write('--human-x', `${humanX - exit * 14 - outro * 8}vw`);
      write('--human-y', `${humanY - exit * 18 - outro * 8}px`);
      write('--human-rotation', `${humanRotation - exit * 16 - outro * 8}deg`);
      write('--human-scale', `${1 + outro * 0.62}`);
      write('--human-jitter', `${humanJitter}px`);
      write('--robot-x', `${robotX + exit * 14 + outro * 8}vw`);
      write('--robot-y', `${robotY + exit * 18 + outro * 8}px`);
      write('--robot-rotation', `${robotRotation + exit * 16 + outro * 8}deg`);
      write('--robot-scale', `${1 + outro * 0.62}`);
      write('--robot-jitter', `${robotJitter}px`);
      write('--hand-opacity', smoothstep(0.08, 0.15, progress));
      write('--hand-arrival', smoothstep(0.42, 0.58, progress));
      write('--caption-one', captionOne);
      write('--caption-two', captionTwo);
      write('--caption-three', captionThree);
      write('--caption-four', captionFour);
      write('--caption-five', captionFive);
      write('--backdrop-y', `${Math.round(progress * -34)}px`);
      write('--scrap-shift', `${Math.round(progress * -54)}px`);
    } });
  }, []);

  return (
    <section id="top" className="hero-3d collage-hero" ref={rootRef} aria-label="SolveScript interactive introduction">
      <div className="hero-3d-sticky collage-stage">
        <div className="collage-backdrop" aria-hidden="true" /><div className="collage-paper-grain" aria-hidden="true" /><div className="collage-scrap collage-scrap-a" aria-hidden="true" /><div className="collage-scrap collage-scrap-b" aria-hidden="true" /><div className="collage-barcode" aria-hidden="true" />
        <div className="collage-hand collage-human" aria-hidden="true"><img src="/media/papersolve-collage-human-v3.png" alt="" /></div>
        <div className="collage-hand collage-robot" aria-hidden="true"><img src="/media/papersolve-collage-robot-v1.png" alt="" /></div>
        <div className="collage-tablet" aria-hidden="true">{useFallback ? <img src="/media/papersolve-hero-loop-keyframe-v1.png" alt="" /> : <Canvas frameloop={sceneActive ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, 0.05, 8.8], fov: 32 }} gl={{ antialias: true, alpha: true }}><Suspense fallback={null}><TabletScene progressRef={progressRef} /></Suspense></Canvas>}</div>
        <div className="hero-3d-copy collage-copy"><span className="hero-kicker"><Sparkles size={15} /> A-levels, upgraded</span><h1>Past papers,<br /><em>in motion.</em></h1><p>One paper. Two ways of thinking. A study system that makes the work visible.</p><div className="scroll-hero-actions"><Link className="home-primary" to={primaryPath}><span>Start your session</span><span className="home-button-arrow" aria-hidden="true"><ArrowUpRight size={20} /></span></Link></div></div>
        <div className="collage-caption collage-caption-one" aria-hidden="true"><span>01 / PAPER + SCHEME</span><strong>Bring the evidence.</strong><p>The question and the marking logic, side by side.</p></div>
        <div className="collage-caption collage-caption-two" aria-hidden="true"><span>02 / THE CONVERGENCE</span><strong>Make each decision visible.</strong><p>Human instinct meets a system that can explain the mark.</p></div>
        <div className="collage-caption collage-caption-three" aria-hidden="true"><span>03 / THE SIGNAL</span><strong>Find your next mark.</strong><p>Keep the paper. Keep the pattern. Move with purpose.</p></div>
        <div className="collage-caption collage-caption-four" aria-hidden="true"><span>04 / IN FOCUS</span><strong>Your paper, amplified.</strong></div>
        <div className="collage-caption collage-caption-five" aria-hidden="true"><span>05 / READY</span><strong>Now make it count.</strong></div>
        <div className="hero-3d-timeline collage-timeline" aria-hidden="true"><span>01</span><i><b /></i><span>04</span></div><div className="collage-scroll-cue" aria-hidden="true"><span>Scroll through the story</span><ArrowDown size={15} /></div>
      </div>
    </section>
  );
}
