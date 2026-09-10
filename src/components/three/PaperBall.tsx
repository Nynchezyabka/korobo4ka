import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import paperAsset from "@/assets/paper-ball-lite.glb.asset.json";
import { rng } from "@/lib/three/geometry";

interface Props {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  variant: number;
  dimmed: boolean;
  scale?: number;
  onClick: () => void;
}

/** Геометрия снята с фотоскана настоящего бумажного комка; 4 общих варианта */
const variants = new Map<number, THREE.BufferGeometry>();

function usePaperGeometry(variant: number) {
  const gltf = useGLTF(paperAsset.url);
  return useMemo(() => {
    const v = Math.abs(variant) % 4;
    const hit = variants.get(v);
    if (hit) return hit;

    let base: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!base && m.isMesh) base = m.geometry;
    });
    if (!base) return new THREE.IcosahedronGeometry(1, 1);

    const rand = rng(v * 613 + 29);
    const geo = (base as THREE.BufferGeometry).clone();
    geo.rotateX(rand() * Math.PI * 2);
    geo.rotateY(rand() * Math.PI * 2);
    geo.rotateZ(rand() * Math.PI * 2);
    geo.scale(0.94 + rand() * 0.12, 0.86 + rand() * 0.16, 0.94 + rand() * 0.12);
    geo.computeVertexNormals();
    variants.set(v, geo);
    return geo;
  }, [gltf, variant]);
}

export function PaperBall({
  position,
  rotation,
  color,
  variant,
  dimmed,
  scale = 0.16,
  onClick,
}: Props) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const geometry = usePaperGeometry(variant);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const k = 1 - Math.exp(-10 * Math.min(delta, 0.05));
    const t = hovered ? 1 : 0;
    const want = scale * (1 + t * 0.14);
    mesh.scale.lerp(new THREE.Vector3(want, want, want), k);
    mesh.position.y += (position[1] + t * 0.05 - mesh.position.y) * k;
  });

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <meshStandardMaterial
        color={color}
        roughness={1}
        metalness={0}
        transparent={dimmed}
        opacity={dimmed ? 0.45 : 1}
      />
    </mesh>
  );
}

useGLTF.preload(paperAsset.url);
