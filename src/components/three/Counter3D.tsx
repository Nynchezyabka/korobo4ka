import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Полоса цифр 0…9 для барабанчика (сверху вниз), с цилиндрическим затенением */
function digitStripTexture(): THREE.Texture {
  const w = 96;
  const cell = 96;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = cell * 10;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  for (let d = 0; d < 10; d++) {
    const y = d * cell;
    const grad = ctx.createLinearGradient(0, y, 0, y + cell);
    grad.addColorStop(0, "#cfd3d8");
    grad.addColorStop(0.35, "#fbfbfa");
    grad.addColorStop(0.65, "#f4f4f2");
    grad.addColorStop(1, "#b9bec4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, cell);

    ctx.fillStyle = "#22262b";
    ctx.font = "700 64px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(d), w / 2, y + cell / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 0.1);
  tex.anisotropy = 4;
  return tex;
}

function Drum({ digit, x }: { digit: number; x: number }) {
  const tex = useMemo(() => digitStripTexture(), []);
  const cur = useRef(0.9 - digit * 0.1);

  useFrame((_, delta) => {
    const target = 0.9 - digit * 0.1;
    const k = 1 - Math.exp(-9 * Math.min(delta, 0.05));
    cur.current += (target - cur.current) * k;
    tex.offset.y = cur.current;
  });

  return (
    <mesh position={[x, 0, 0.021]} renderOrder={6}>
      <planeGeometry args={[0.062, 0.078]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

interface Props {
  count: number;
  position: [number, number, number];
}

/** Механический счётчик-барабан на стенке коробочки (теплый бледный корпус) */
export function Counter3D({ count, position }: Props) {
  const n = Math.min(99, Math.max(0, count));
  const tens = Math.floor(n / 10);
  const units = n % 10;

  // тёплый, бледный пластик — не выбивается из уютной палитры
  const bodyColor = "#9e8674";
  const windowColor = "#5c4639";
  const wheelColor = "#bfa688";

  return (
    <group position={position} renderOrder={6}>
      {/* корпус счётчика */}
      <mesh renderOrder={5}>
        <boxGeometry args={[0.19, 0.125, 0.04]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.68}
          metalness={0.05}
        />
      </mesh>
      {/* окошко */}
      <mesh position={[0, 0, 0.0205]} renderOrder={5}>
        <planeGeometry args={[0.145, 0.09]} />
        <meshStandardMaterial color={windowColor} roughness={0.6} />
      </mesh>
      <Drum digit={tens} x={-0.035} />
      <Drum digit={units} x={0.035} />
      {/* рифлёные колёсики по бокам */}
      {[-0.088, 0.088].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} renderOrder={5}>
          <cylinderGeometry args={[0.04, 0.04, 0.025, 16]} />
          <meshStandardMaterial
            color={wheelColor}
            roughness={0.55}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}
