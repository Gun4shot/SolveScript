import { Component, Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';
import { RotateCw } from 'lucide-react';
import { useStudio } from './StudioContext';

function Paper({ position, rotation, index }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    ref.current.position.y =
      position[1] + Math.sin(clock.elapsedTime * 0.8 + index) * 0.12;
    ref.current.rotation.z =
      rotation[2] + Math.sin(clock.elapsedTime * 0.5 + index) * 0.06;
  });
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <RoundedBox args={[1.2, 1.55, 0.035]} radius={0.035}>
        <meshStandardMaterial color="#fffef9" />
      </RoundedBox>
      {[0.45, 0.2, -0.05, -0.3].map((y, i) => (
        <mesh key={y} position={[0, y, 0.026]}>
          <planeGeometry args={[i === 0 ? 0.52 : 0.85, 0.035]} />
          <meshBasicMaterial color={i === 0 ? '#ed696c' : '#afcbd7'} />
        </mesh>
      ))}
    </group>
  );
}
function Stationery({ spin, onSpin }) {
  const group = useRef();
  useFrame(({ pointer }, delta) => {
    group.current.rotation.y = MathUtils.damp(
      group.current.rotation.y,
      spin + pointer.x * 0.15,
      3,
      delta,
    );
    group.current.rotation.x = MathUtils.damp(
      group.current.rotation.x,
      0.22 - pointer.y * 0.07,
      3,
      delta,
    );
  });
  return (
    <group ref={group} onClick={onSpin}>
      <group position={[0, -1.7, 0]} rotation={[0.12, -0.25, -0.04]}>
        {['#86bfae', '#ef7276', '#4799d4'].map((color, i) => (
          <group
            key={color}
            position={[i === 1 ? 0.15 : 0, i * 0.24, 0]}
            rotation={[0, i === 1 ? -0.15 : 0.04, 0]}
          >
            <RoundedBox args={[3.4 - i * 0.15, 0.22, 1.65]} radius={0.04}>
              <meshStandardMaterial color={color} roughness={0.65} />
            </RoundedBox>
            <RoundedBox
              args={[3.22 - i * 0.15, 0.13, 1.64]}
              position={[0.025, 0.005, 0.018]}
              radius={0.018}
            >
              <meshStandardMaterial color="#fffdf4" />
            </RoundedBox>
          </group>
        ))}
      </group>
      <Paper
        position={[-1.65, 0.65, -0.6]}
        rotation={[0.04, 0.3, 0.18]}
        index={0}
      />
      <Paper
        position={[1.7, 1.15, -0.9]}
        rotation={[0.06, -0.2, -0.2]}
        index={2}
      />
      <mesh position={[1.6, -1, 0.1]} rotation={[0.4, 0.2, -0.55]}>
        <cylinderGeometry args={[0.07, 0.07, 1.65, 6]} />
        <meshStandardMaterial color="#f5bf53" />
      </mesh>
    </group>
  );
}
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="desk-fallback" role="img" aria-label="Illustrated study desk" />
    ) : (
      this.props.children
    );
  }
}
export default function DeskScene() {
  const { companion, preferences } = useStudio();
  const [spin, setSpin] = useState(0);
  const turnDesk = () => setSpin((value) => value + Math.PI * 2);
  const [systemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return (
    <div
      className="desk-scene"
      aria-label={`${companion.name} at the study desk`}
    >
      {preferences.motion !== false && !systemReduced ? (
        <SceneBoundary>
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0.3, 8], fov: 39 }}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          >
            <ambientLight intensity={2} />
            <directionalLight position={[3, 6, 7]} intensity={3} />
            <Suspense fallback={null}>
              <Stationery spin={spin} onSpin={turnDesk} />
            </Suspense>
          </Canvas>
          <button
            className="studio-icon desk-turn"
            aria-label="Turn the 3D desk"
            title="Turn the 3D desk"
            onClick={turnDesk}
          >
            <RotateCw size={16} />
          </button>
        </SceneBoundary>
      ) : (
        <div className="desk-fallback" role="img" aria-label="Illustrated study desk" />
      )}
      <img
        key={companion.id}
        className="desk-character"
        src={companion.file}
        alt=""
      />
      <span className="desk-caption">
        A little company for your next big idea.
      </span>
    </div>
  );
}
