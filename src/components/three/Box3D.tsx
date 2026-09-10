import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoxDef } from "@/lib/three/categories";
import { PAPER_COLORS } from "@/lib/three/categories";
import {
  makeIconButtonTexture,
  makeLabelTexture,
  rng,
  shellGeometry,
  slabGeometry,
} from "@/lib/three/geometry";
import type { Task } from "@/types";
import { Counter3D } from "./Counter3D";
import { PaperBall } from "./PaperBall";


const W = 1;
const H = 0.86;
const D = 1;
const T = 0.05;
const R = 0.1;
const MAX_VISIBLE = 16;

interface Props {
  def: BoxDef;
  position: [number, number, number];
  tasks: Task[];
  stacked: boolean;
  onRandom: () => void;
  onViewTasks: () => void;
  onAdd: () => void;
  onPaper: (task: Task) => void;
  fontsReady: boolean;
}


interface LabelButtonProps {
  stacked: boolean;
  textColor: string;
  onViewTasks: () => void;
  onAdd: () => void;
}

/** Две маленькие кнопки-наклейки: список и плюс */
function LabelButtons({ stacked, textColor, onViewTasks, onAdd }: LabelButtonProps) {
  const listTex = useMemo(() => makeIconButtonTexture("list", textColor), [textColor]);
  const plusTex = useMemo(() => makeIconButtonTexture("plus", textColor), [textColor]);
  const [hovered, setHovered] = useState<"list" | "plus" | null>(null);

  const size = 0.085;
  const gap = 0.12;

  const Button = ({
    kind,
    position,
    rotation,
    onClick,
  }: {
    kind: "list" | "plus";
    position: [number, number, number];
    rotation?: [number, number, number];
    onClick: () => void;
  }) => {
    const tex = kind === "list" ? listTex : plusTex;
    const isHovered = hovered === kind;
    return (
      <mesh
        position={position}
        rotation={rotation}
        renderOrder={5}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(kind); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <circleGeometry args={[size, 32]} />
        <meshBasicMaterial map={tex} transparent opacity={isHovered ? 1 : 0.9} />
      </mesh>
    );
  };

  if (stacked) {
    // В стопке — маленькие наклейки под этикеткой на передней грани
    return (
      <group position={[0, -0.38, D / 2 + 0.035]}>
        <Button kind="list" position={[-gap, 0, 0]} onClick={onViewTasks} />
        <Button kind="plus" position={[gap, 0, 0]} onClick={onAdd} />
      </group>
    );
  }

  // В ландшафте — отдельные наклейки на боковой (передней) стенке коробочки
  return (
    <group position={[0, 0, D / 2 + 0.018]}>
      <Button kind="list" position={[-gap, 0, 0]} onClick={onViewTasks} />
      <Button kind="plus" position={[gap, 0, 0]} onClick={onAdd} />
    </group>
  );
}

/** Матовый полупрозрачный пластик: свет проходит сквозь стенку и рассеивается */
function Plastic({ opacity = 0.34 }: { opacity?: number }) {
  return (
    <meshPhysicalMaterial
      color="#eef4f6"
      transparent
      opacity={opacity}
      roughness={0.5}
      metalness={0}
      ior={1.46}
      clearcoat={1}
      clearcoatRoughness={0.22}
      specularIntensity={1}
      sheen={0.4}
      sheenColor="#ffffff"
      envMapIntensity={1.2}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
}

export function Box3D({
  def,
  position,
  tasks,
  stacked,
  onRandom,
  onViewTasks,
  onAdd,
  onPaper,
  fontsReady,
}: Props) {

  const lidRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);

  const labelTex = useMemo(
    () => makeLabelTexture(def.label, def.labelColor, def.labelTextColor),
    [def.label, def.labelColor, def.labelTextColor, fontsReady],
  );

  const wall = useMemo(() => shellGeometry(W, D, H, T, R), []);
  const rim = useMemo(() => shellGeometry(W + 0.03, D + 0.03, 0.055, T + 0.02, R), []);
  const bottom = useMemo(() => slabGeometry(W - 0.01, D - 0.01, T, R - 0.01), []);
  const lidTop = useMemo(() => slabGeometry(W + 0.08, D + 0.08, 0.05, R + 0.01), []);
  const lidSkirt = useMemo(() => shellGeometry(W + 0.08, D + 0.08, 0.11, 0.045, R + 0.01), []);

  const visible = tasks.slice(0, MAX_VISIBLE);
  const hidden = tasks.length - visible.length;

  const layout = useMemo(() => {
    const CELL = 0.28;
    return visible.map((t, i) => {
      const rand = rng(t.id * 7919 + def.id * 131);
      const level = Math.floor(i / 9);
      const inLevel = i % 9;
      const col = inLevel % 3;
      const row = Math.floor(inLevel / 3);
      return {
        task: t,
        position: [
          (col - 1) * CELL + (rand() - 0.5) * 0.06,
          -H / 2 + 0.11 + level * 0.24 + rand() * 0.02,
          (row - 1) * CELL + (rand() - 0.5) * 0.06,
        ] as [number, number, number],
        rotation: [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI] as [
          number,
          number,
          number,
        ],
        variant: t.id,
      };
    });
  }, [visible, def.id]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    if (lidRef.current) {
      const y = H / 2 + 0.06;
      lidRef.current.position.y += (y - lidRef.current.position.y) * k;
      lidRef.current.position.z += (0 - lidRef.current.position.z) * k;
      lidRef.current.rotation.x += (0 - lidRef.current.rotation.x) * k;
      lidRef.current.rotation.z += (0 - lidRef.current.rotation.z) * k;
    }
    if (groupRef.current) {
      groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), k);
    }
  });


  return (
    <group ref={groupRef} position={position}>
      {/* корпус: цельная обечайка + дно + верхний бортик */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onRandom();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <mesh geometry={wall} castShadow receiveShadow renderOrder={2}>
          <Plastic opacity={0.32} />
        </mesh>
        <mesh geometry={rim} position={[0, H / 2 - 0.02, 0]} castShadow renderOrder={2}>
          <Plastic opacity={0.46} />
        </mesh>
        <mesh geometry={bottom} position={[0, -H / 2 + T / 2, 0]} receiveShadow renderOrder={1}>
          <Plastic opacity={0.4} />
        </mesh>
      </group>

      {/* крышка: плита с юбкой, садится на бортик */}
      <group ref={lidRef} position={[0, H / 2 + 0.06, 0]}>
        <mesh geometry={lidTop} castShadow renderOrder={3}>
          <Plastic opacity={0.42} />
        </mesh>
        <mesh geometry={lidSkirt} position={[0, -0.08, 0]} castShadow renderOrder={3}>
          <Plastic opacity={0.42} />
        </mesh>
        {/* в ландшафте этикетка наклеена сверху на крышку */}
        {!stacked && (
          <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
            <circleGeometry args={[0.34, 48]} />
            <meshStandardMaterial map={labelTex} transparent roughness={0.85} />
          </mesh>
        )}
      </group>

      {/* В ландшафте кнопки — отдельные наклейки на передней стенке */}
      {!stacked && (
        <LabelButtons
          stacked={false}
          textColor={def.labelTextColor}
          onViewTasks={onViewTasks}
          onAdd={onAdd}
        />
      )}

      {/* в стопке этикетка видна спереди */}
      {stacked && (
        <mesh position={[0, 0.0, D / 2 + 0.032]} renderOrder={4}>
          <circleGeometry args={[0.31, 48]} />
          <meshStandardMaterial map={labelTex} transparent roughness={0.85} />
        </mesh>
      )}
      {stacked && (
        <LabelButtons
          stacked={true}
          textColor={def.labelTextColor}
          onViewTasks={onViewTasks}
          onAdd={onAdd}
        />
      )}


      {/* бумажки */}
      {layout.map((p) => {
        return (
          <PaperBall
            key={p.task.id}
            position={p.position}
            rotation={p.rotation}
            color={PAPER_COLORS[p.task.category]}
            variant={p.variant}
            dimmed={!p.task.active}
            onClick={() => onPaper(p.task)}
          />
        );
      })}

      {/* Счётчик — бледный тёплый барабан, в стопке справа внизу, в ряду тоже справа внизу. */}
      <Counter3D
        count={tasks.length}
        position={[
          W / 2 - 0.16,
          -H / 2 + 0.10,
          D / 2 + 0.032,
        ]}
      />

      {hidden > 0 && (
        <mesh position={[-W / 2 + 0.12, -H / 2 + 0.03, D / 2 + 0.035]}>
          <circleGeometry args={[0.05, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      )}

    </group>
  );
}
