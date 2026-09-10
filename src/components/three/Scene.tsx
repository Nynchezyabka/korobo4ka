import { useMemo } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOXES, PAPER_COLORS } from "@/lib/three/categories";
import { rng } from "@/lib/three/geometry";
import type { Task } from "@/types";
import { Box3D } from "./Box3D";
import { PaperBall } from "./PaperBall";

interface Props {
  tasks: Task[];
  stacked: boolean;
  openBox: number | null;
  onSelectBox: (id: number | null) => void;
  onPaper: (task: Task) => void;
  fontsReady: boolean;
}

/** В портрете коробочки стоят стопкой (жёлтая сверху), в ландшафте — в ряд на столе */
export function boxPosition(i: number, stacked: boolean): [number, number, number] {
  // В стопке дно верхней коробки опирается прямо на крышку нижней.
  // Стопка поднята, чтобы внизу кадра осталось место для неопознанных бумажек.
  return stacked ? [0, 0.30 + (2 - i) * 0.95, 0] : [(i - 1) * 1.25, 0, 0];
}

function CameraRig({ stacked, openBox }: { stacked: boolean; openBox: number | null }) {
  const { camera } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const cur = useMemo(() => new THREE.Vector3(0, 0.1, 0), []);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-3.5 * Math.min(delta, 0.05));
    const p = openBox ? boxPosition(openBox - 1, stacked) : null;

    if (stacked) {
      // Более фронтальный ракурс: стопка помещается в размеченную зону,
      // при этом остаётся видна правая грань и хорошо читаются этикетки.
      // Камера намеренно ближе: стопка занимает одинаково крупную долю
      // вертикального кадра и в узком браузере, и во встроенном превью.
      // Стопка поднята, чтобы внизу осталось место для неопознанных бумажек.
      pos.set(0.50, 1.85, 5.7);
      look.set(-0.18, 1.38, 0);
    } else if (p) {
      pos.set(p[0], 1.9, 2.6);
      look.set(p[0], 0.15, 0);
    } else {
      pos.set(0, 2.2, 4.0);
      look.set(0, 0.1, 0);
    }


    camera.position.lerp(pos, k);
    cur.lerp(look, k);
    camera.lookAt(cur);
  });
  return null;
}

export function Scene({ tasks, stacked, openBox, onSelectBox, onPaper, fontsReady }: Props) {
  const visibleTasks = tasks.filter((t) => !t.completed);

  const loose = visibleTasks.filter((t) => t.category === 0);

  const loosePositions = useMemo(
    () =>
      loose.slice(0, 8).map((t, i) => {
        const rand = rng(t.id * 131 + 7);
        return {
          task: t,
          position: [
            (stacked ? 1.05 : 2.1) + (i % 3) * 0.22 - 0.2,
            stacked ? -0.48 : -0.36,
            (stacked ? 0.45 : 0.1) + Math.floor(i / 3) * 0.24 + rand() * 0.05,
          ] as [number, number, number],
          rotation: [rand() * 3, rand() * 3, rand() * 3] as [number, number, number],
        };
      }),
    [loose, stacked],
  );

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={1.7}
        color="#fff3e0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#dbe9ff" />

      <Environment resolution={128}>
        <Lightformer intensity={2.2} position={[0, 5, 2]} scale={[12, 12, 1]} color="#fff6e8" />
        <Lightformer
          intensity={1}
          color="#cfe3ff"
          position={[-6, 2, -2]}
          rotation-y={Math.PI / 2}
          scale={[16, 4, 1]}
        />
      </Environment>

      {/* мягкая тень на поверхности */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.46, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <shadowMaterial opacity={0.22} />
      </mesh>

      {/* фон-кликер: закрывает коробочку */}
      <mesh position={[0, 0, -6]} onClick={() => onSelectBox(null)}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {BOXES.map((def, i) => {
        const boxTasks = visibleTasks.filter((t) => def.categories.includes(t.category));
        const position = boxPosition(i, stacked);
        return (
          <Box3D
            key={def.id}
            def={def}
            position={position}
            tasks={boxTasks}
            stacked={stacked}
            open={!stacked && openBox === def.id}

            onSelect={() => {
              if (stacked) {
                onSelectBox(openBox === def.id ? null : def.id);
              } else {
                onSelectBox(openBox === def.id ? null : def.id);
              }
            }}
            onPaper={onPaper}
            fontsReady={fontsReady}
          />
        );
      })}

      {/* задачи без категории лежат рядом */}
      {loosePositions.map((p) => (
        <PaperBall
          key={p.task.id}
          position={p.position}
          rotation={p.rotation}
          color={PAPER_COLORS[0]}
          variant={p.task.id}
          dimmed={!p.task.active}
          scale={0.14}
          onClick={() => onPaper(p.task)}
        />
      ))}

      <CameraRig stacked={stacked} openBox={openBox} />
    </>
  );
}
