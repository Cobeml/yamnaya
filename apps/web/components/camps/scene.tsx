"use client";
import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows, Stars } from "@react-three/drei";
import { Group, Vector3, MathUtils } from "three";
import type { CampAgent } from "@yamnaya/core";
type Position = [number, number, number];
function Box({
  at = [0, 0, 0],
  size = [1, 1, 1],
  color = "#303435",
  rotation = 0,
}: {
  at?: Position;
  size?: Position;
  color?: string;
  rotation?: number;
}) {
  return (
    <mesh position={at} rotation-y={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
function Analyst({
  agent,
  index,
  selected,
  onSelect,
  reduced,
}: {
  agent: CampAgent;
  index: number;
  selected: boolean;
  onSelect: () => void;
  reduced: boolean;
}) {
  const root = useRef<Group>(null),
    left = useRef<Group>(null),
    right = useRef<Group>(null);
  const [walking, setWalking] = useState(false);
  const isCube = agent.activity === "cube";
  const social = ["talking", "playing"].includes(agent.activity);
  const angle = (index * Math.PI * 2) / 8 + 0.3;
  const target = new Vector3(
    isCube
      ? Math.sin(angle) * 2.8
      : social
        ? -4 + index * 0.6
        : Math.sin(angle) * 5,
    0,
    isCube ? Math.cos(angle) * 2.8 : social ? 3 : Math.cos(angle) * 4,
  );
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const distance = root.current.position.distanceTo(target);
    const moving = distance > 0.06;
    if (moving !== walking) setWalking(moving);
    root.current.position.lerp(target, reduced ? 1 : Math.min(delta * 1.4, 1));
    root.current.rotation.y = MathUtils.lerp(
      root.current.rotation.y,
      isCube ? angle + Math.PI : social ? 1.3 : angle,
      Math.min(delta * 2, 1),
    );
    const step = reduced
      ? 0
      : Math.sin(clock.elapsedTime * 6 + index) * Math.min(distance, 0.65);
    if (left.current) left.current.rotation.x = step;
    if (right.current) right.current.rotation.x = -step;
  });
  const suit = ["#28323d", "#696354", "#383944", "#48534b"][index % 4];
  const skin = ["#b98b69", "#966648", "#d5ae8b", "#a77b58"][index % 4];
  return (
    <group
      ref={root}
      position={[Math.sin(angle) * 5, 0, Math.cos(angle) * 4]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <group position={[0, 0.74, 0]}>
        <Box at={[0, 0.22, 0]} size={[0.42, 0.55, 0.25]} color={suit} />
        <Box at={[0, 0.35, 0.132]} size={[0.12, 0.26, 0.02]} color="#e2ded2" />
        <Box at={[0, 0.29, 0.15]} size={[0.045, 0.24, 0.025]} color="#71604c" />
        <Box at={[0, 0.58, 0]} size={[0.13, 0.12, 0.13]} color={skin} />
        <Box at={[0, 0.76, 0]} size={[0.25, 0.32, 0.25]} color={skin} />
        <Box at={[0, 0.9, -0.02]} size={[0.26, 0.1, 0.25]} color="#2e2827" />
        <Box
          at={[-0.13, 0.8, -0.04]}
          size={[0.03, 0.18, 0.2]}
          color="#2e2827"
        />
        {[-1, 1].map((n) => (
          <group key={n} position={[n * 0.28, 0.43, 0]} rotation-z={n * 0.08}>
            <Box at={[0, -0.2, 0]} size={[0.13, 0.44, 0.17]} color={suit} />
            <Box at={[0, -0.48, 0]} size={[0.1, 0.12, 0.12]} color={skin} />
          </group>
        ))}
        <Box at={[0.32, -0.15, 0]} size={[0.09, 0.29, 0.42]} color="#493b2e" />
      </group>
      {[-1, 1].map((n) => (
        <group
          key={n}
          ref={n === -1 ? left : right}
          position={[n * 0.115, 0.75, 0]}
        >
          <Box at={[0, -0.3, 0]} size={[0.15, 0.6, 0.19]} color={suit} />
          <Box
            at={[0, -0.69, 0.065]}
            size={[0.18, 0.13, 0.3]}
            color="#1c2021"
          />
        </group>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.4, 0.43, 40]} />
        <meshBasicMaterial
          color={selected ? "#e9ca80" : "#777d70"}
          transparent
          opacity={selected ? 1 : 0.4}
        />
      </mesh>
      <Html
        position={[0, 2, 0]}
        center
        distanceFactor={17}
        style={{ pointerEvents: "none" }}
      >
        <div className={"camp-person-label " + (selected ? "selected" : "")}>
          {agent.name}
          <small>{walking ? "Walking" : agent.activity}</small>
        </div>
      </Html>
    </group>
  );
}
function Horse({
  at,
  color,
  rotation,
}: {
  at: Position;
  color: string;
  rotation: number;
}) {
  const head = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (head.current)
      head.current.rotation.x =
        0.15 + Math.sin(clock.elapsedTime * 0.5 + at[0]) * 0.08;
  });
  return (
    <group position={at} rotation-y={rotation} scale={1.12}>
      <group rotation-z={Math.PI / 2}>
        <mesh position={[1.15, 0, 0]} castShadow>
          <capsuleGeometry args={[0.38, 0.8, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={String(x) + z} position={[x * 0.46, 0, z * 0.23]}>
            <Box at={[0, 0.58, 0]} size={[0.13, 1, 0.14]} color={color} />
            <Box
              at={[0.03, 0.09, 0]}
              size={[0.19, 0.16, 0.17]}
              color="#262724"
            />
          </group>
        )),
      )}
      <group ref={head} position={[0.61, 1.24, 0]} rotation-z={-0.45}>
        <Box at={[0.02, 0.34, 0]} size={[0.29, 0.84, 0.3]} color={color} />
        <Box at={[0.2, 0.78, 0]} size={[0.65, 0.3, 0.28]} color={color} />
        <Box at={[-0.08, 0.46, 0]} size={[0.13, 0.8, 0.34]} color="#2c2723" />
        {[-1, 1].map((n) => (
          <Box
            key={n}
            at={[0.04, 1, n * 0.12]}
            size={[0.09, 0.22, 0.07]}
            color={color}
          />
        ))}
        <Box
          at={[0.11, 0.82, 0.15]}
          size={[0.06, 0.05, 0.015]}
          color="#111919"
        />
        <Box
          at={[0.11, 0.82, -0.15]}
          size={[0.06, 0.05, 0.015]}
          color="#111919"
        />
        <Box at={[0.32, 0.76, 0]} size={[0.06, 0.33, 0.31]} color="#302c25" />
      </group>
      <Box at={[0, 1.54, 0]} size={[0.55, 0.12, 0.7]} color="#473727" />
      <Box at={[-0.74, 1.04, 0]} size={[0.12, 0.85, 0.17]} color="#302821" />
    </group>
  );
}
function Tent({ at, rotation }: { at: Position; rotation: number }) {
  return (
    <group position={at} rotation-y={rotation}>
      <mesh position={[0, 0.83, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.8, 1.65, 4]} />
        <meshStandardMaterial color="#9b9674" roughness={1} />
      </mesh>
      <Box at={[0, 0.43, 1.03]} size={[0.55, 0.86, 0.035]} color="#252e28" />
      <Box at={[0, 0.9, 1.06]} size={[0.055, 1.8, 0.05]} color="#504937" />
      <Box at={[1.25, 0.2, 0.15]} size={[0.5, 0.4, 0.55]} color="#5d6250" />
    </group>
  );
}
function Tree({ at, scale }: { at: Position; scale: number }) {
  return (
    <group position={at} scale={scale}>
      <Box at={[0, 0.8, 0]} size={[0.17, 1.6, 0.17]} color="#65503d" />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 1.45 + i * 0.65, 0]} castShadow>
          <coneGeometry args={[1.05 - i * 0.22, 1.6, 7]} />
          <meshStandardMaterial color={i % 2 ? "#465c4b" : "#354c3e"} />
        </mesh>
      ))}
    </group>
  );
}
function World({
  agents,
  selected,
  onAgent,
  onCube,
  reduced,
}: {
  agents: CampAgent[];
  selected: string;
  onAgent: (id: string) => void;
  onCube: () => void;
  reduced: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#202d30"]} />
      <fog attach="fog" args={["#202d30", 28, 65]} />
      <ambientLight intensity={0.85} color="#c0cbcf" />
      <hemisphereLight args={["#b8ced8", "#756345", 1.1]} />
      <directionalLight
        position={[-12, 18, 6]}
        intensity={3}
        color="#ffdfa9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.001}
      />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#3b4b40" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[10.6, 64]} />
        <meshStandardMaterial color="#857c60" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <ringGeometry args={[3.3, 3.7, 64]} />
        <meshStandardMaterial color="#a09471" />
      </mesh>
      {Array.from({ length: 40 }, (_, i) => {
        const a = i * 2.39996,
          r = 11 + (i % 5) * 2.4;
        return (
          <Tree
            key={i}
            at={[Math.sin(a) * r, 0, Math.cos(a) * r]}
            scale={0.8 + (i % 4) * 0.3}
          />
        );
      })}
      {Array.from({ length: 48 }, (_, i) => {
        const a = i * 2.39996,
          r = 8.8 + (i % 4) * 0.55;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * r, 0.1, Math.cos(a) * r]}
            scale={[0.25 + (i % 3) * 0.12, 0.16, 0.24]}
            rotation={[i, 0.4 * i, 0]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#737d6b" />
          </mesh>
        );
      })}
      <Tent at={[-5, 0, -5]} rotation={0.6} />
      <Tent at={[0, 0, -7]} rotation={0.1} />
      <Tent at={[5.8, 0, -4.5]} rotation={-0.6} />
      <Horse at={[7.1, 0, 2.7]} rotation={-0.5} color="#947252" />
      <Horse at={[7.5, 0, -0.1]} rotation={0.3} color="#5e4a3b" />
      <Horse at={[-8, 0, 0]} rotation={1.3} color="#b4ac95" />
      <Box at={[-4, 0.47, 3]} size={[1.4, 0.14, 1.1]} color="#5e4d36" />
      {[-1, 1].map((n) => (
        <Box
          key={n}
          at={[-4 + n * 0.75, 0.24, 3]}
          size={[0.3, 0.48, 1.4]}
          color="#62533e"
        />
      ))}
      <mesh position={[-4, 0.56, 3]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshStandardMaterial color="#c6bfa0" />
      </mesh>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onCube();
        }}
      >
        <Box at={[0, 0.15, 0]} size={[3.2, 0.3, 3.2]} color="#63675c" />
        <mesh position={[0, 1.58, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.35, 2.7, 2.35]} />
          <meshStandardMaterial
            color="#0b1014"
            roughness={0.38}
            metalness={0.35}
          />
        </mesh>
        <Box at={[0, 2.49, 0]} size={[2.38, 0.07, 2.38]} color="#b69c62" />
        <mesh position={[0, 0.32, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.9, 1.93, 64]} />
          <meshBasicMaterial color="#d1b475" />
        </mesh>
        <Html position={[0, 3.6, 0]} center distanceFactor={20}>
          <button className="camp-cube-label" onClick={onCube}>
            THE CUBE <span>Instruction · Authority</span>
          </button>
        </Html>
      </group>
      {agents.map((agent, index) => (
        <Analyst
          key={agent.id}
          agent={agent}
          index={index}
          selected={selected === agent.id}
          onSelect={() => onAgent(agent.id)}
          reduced={reduced}
        />
      ))}
      <ContactShadows
        position={[0, 0.005, 0]}
        opacity={0.35}
        scale={25}
        blur={2}
        far={8}
        resolution={256}
      />
      <Stars
        radius={75}
        depth={20}
        count={500}
        factor={2}
        fade
        speed={reduced ? 0 : 0.1}
      />
      <OrbitControls
        makeDefault
        minDistance={12}
        maxDistance={32}
        minPolarAngle={0.3}
        maxPolarAngle={1.35}
        target={[0, 0, 0]}
        enablePan={false}
      />
    </>
  );
}
export default function CampScene(props: {
  agents: CampAgent[];
  selected: string;
  onAgent: (id: string) => void;
  onCube: () => void;
}) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return (
    <Canvas
      shadows="percentage"
      camera={{ position: [16, 15, 21], fov: 43 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      aria-label="Interactive 3D camp: suited analysts, horses, tents and the instruction cube"
    >
      <World {...props} reduced={reduced} />
    </Canvas>
  );
}
