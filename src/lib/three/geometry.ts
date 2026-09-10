import * as THREE from "three";

/** Простой детерминированный псевдослучайный генератор */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const cache = new Map<number, THREE.BufferGeometry>();

/** Скруглённый прямоугольник в плоскости XY */
function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = d / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}

const shellCache = new Map<string, THREE.BufferGeometry>();

/**
 * Цельная стенка-обечайка коробочки: внешний скруглённый контур с вырезанной
 * внутренней полостью, выдавленный на высоту h. Углы получаются непрерывными.
 */
export function shellGeometry(
  w: number,
  d: number,
  h: number,
  t: number,
  r = 0.09,
): THREE.BufferGeometry {
  const key = [w, d, h, t, r].join("|");
  const hit = shellCache.get(key);
  if (hit) return hit;

  const shape = roundedRect(w, d, r);
  const hole = roundedRect(w - t * 2, d - t * 2, Math.max(0.02, r - t));
  shape.holes.push(new THREE.Path(hole.getPoints(24)));

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();
  shellCache.set(key, geo);
  return geo;
}

/** Плоская скруглённая плита (дно / крышка) */
export function slabGeometry(w: number, d: number, h: number, r = 0.09): THREE.BufferGeometry {
  const key = ["slab", w, d, h, r].join("|");
  const hit = shellCache.get(key);
  if (hit) return hit;
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();
  shellCache.set(key, geo);
  return geo;
}

/** Смятый бумажный комочек */
export function crumpledPaperGeometry(variant: number): THREE.BufferGeometry {
  const key = variant % 8;
  const cached = cache.get(key);
  if (cached) return cached;

  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes["position"] as THREE.BufferAttribute;
  const rand = rng(key * 977 + 13);
  const v = new THREE.Vector3();
  const folds: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    folds.push(
      new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
    );
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let d = 0;
    for (const f of folds) d += Math.abs(n.dot(f)) ** 3;
    const scale = 0.62 + 0.55 * (d / folds.length) * (0.7 + rand() * 0.8);
    v.copy(n).multiplyScalar(scale);
    v.y *= 0.9;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
}

/** Круглая этикетка с рукописной надписью */
export function makeLabelTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke();

  ctx.fillStyle = fg;
  const rawLines = text.split("\n");
  const allWords = rawLines.flatMap((l) => l.split(" ").filter(Boolean));
  const fontSize = allWords.length > 5 ? 62 : 78;
  ctx.font = `700 ${fontSize}px Caveat, cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxWidth = size * 0.78;

  const lines: string[] = [];
  for (const raw of rawLines) {
    const words = raw.split(" ").filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }

  const lh = fontSize * 1.12;
  const start = size / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, size / 2, start + i * lh));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
