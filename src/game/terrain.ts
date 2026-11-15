import * as THREE from 'three';
import { isInsideBunkerExcavation } from './baseLayout';

export const WORLD_PLAYABLE_RADIUS = 132;
export const TERRAIN_SIZE = 440;
export const TERRAIN_SEGMENTS = 184;

export interface CraterSpec {
  x: number;
  z: number;
  radius: number;
  depth: number;
  rimHeight: number;
}

export interface MesaSpec {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  height: number;
  rotation: number;
}

export interface BoulderSpec {
  x: number;
  y: number;
  z: number;
  radius: number;
}

// Deterministic hash & 2D value noise
function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm2(x: number, z: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    value += amp * (smoothNoise2(x * freq, z * freq) * 2 - 1);
    freq *= 2.05;
    amp *= 0.5;
  }
  return value;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Generate iconic craters scattered across the Martian plains (avoiding Base Hub plateau r < 30)
export const CRATERS: CraterSpec[] = (() => {
  const rand = seededRand(42077);
  const list: CraterSpec[] = [
    { x: -46, z: -38, radius: 13.5, depth: 3.1, rimHeight: 1.35 },
    { x: 54, z: -42, radius: 15.0, depth: 3.4, rimHeight: 1.45 },
    { x: -60, z: 48, radius: 16.5, depth: 3.8, rimHeight: 1.5 },
    { x: 48, z: 58, radius: 12.5, depth: 2.8, rimHeight: 1.2 },
    { x: 0, z: -72, radius: 18.0, depth: 4.1, rimHeight: 1.65 },
    { x: 88, z: 6, radius: 14.0, depth: 3.2, rimHeight: 1.4 },
    { x: -90, z: -8, radius: 14.5, depth: 3.3, rimHeight: 1.4 },
  ];

  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * Math.PI * 2 + rand() * 0.4;
    const dist = 42 + rand() * 76;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const radius = 6.5 + rand() * 7.5;
    const tooClose = list.some((c) => Math.hypot(c.x - x, c.z - z) < c.radius + radius + 5);
    if (!tooClose) {
      list.push({
        x,
        z,
        radius,
        depth: 1.5 + radius * 0.19,
        rimHeight: 0.65 + radius * 0.08,
      });
    }
  }
  return list;
})();

// Distant & landmark stratified Martian mesas
export const MESAS: MesaSpec[] = (() => {
  const rand = seededRand(90210);
  const list: MesaSpec[] = [
    // Landmark inner-rim mesas
    { x: -82, z: -76, radiusX: 16, radiusZ: 12, height: 15, rotation: 0.5 },
    { x: 92, z: -72, radiusX: 19, radiusZ: 14, height: 18, rotation: -0.4 },
    { x: 96, z: 78, radiusX: 17, radiusZ: 13, height: 16, rotation: 0.8 },
    { x: -92, z: 86, radiusX: 20, radiusZ: 15, height: 19, rotation: -0.7 },
  ];

  // Outer canyon rim mesas creating natural horizon barriers
  const rimCount = 16;
  for (let i = 0; i < rimCount; i++) {
    const angle = (i / rimCount) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    const dist = 148 + rand() * 34;
    list.push({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      radiusX: 22 + rand() * 20,
      radiusZ: 15 + rand() * 14,
      height: 18 + rand() * 22,
      rotation: rand() * Math.PI,
    });
  }
  return list;
})();

export function groundHeightAt(x: number, z: number): number {
  const distFromBase = Math.hypot(x, z);

  // Rolling dunes & rocky ridges
  let h = fbm2(x * 0.015, z * 0.015) * 3.4 + fbm2(x * 0.055 + 11.3, z * 0.055 - 7.1) * 0.65;

  // Gentle outer basin rise beyond playable zone
  if (distFromBase > 118) {
    const t = Math.min((distFromBase - 118) / 70, 1.5);
    h += t * t * 14.0;
  }

  // Sculpt craters
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const dSq = dx * dx + dz * dz;
    const outerR = c.radius * 1.45;
    if (dSq < outerR * outerR) {
      const rNorm = Math.sqrt(dSq) / c.radius;
      if (rNorm < 1.0) {
        // Bowl depression + edge rise toward rim
        const bowl = (rNorm * rNorm - 1.0) * c.depth;
        const rimBlend = Math.exp(-Math.pow((rNorm - 0.98) / 0.18, 2)) * c.rimHeight;
        h += bowl + rimBlend;
      } else {
        // Smooth outer rim slope
        const rimFalloff = Math.exp(-Math.pow((rNorm - 0.98) / 0.22, 2)) * c.rimHeight;
        h += rimFalloff;
      }
    }
  }

  // Sculpt stepped mesas
  for (let i = 0; i < MESAS.length; i++) {
    const m = MESAS[i];
    const dx = x - m.x;
    const dz = z - m.z;
    const maxR = Math.max(m.radiusX, m.radiusZ) * 1.6;
    if (Math.abs(dx) < maxR && Math.abs(dz) < maxR) {
      const cosR = Math.cos(m.rotation);
      const sinR = Math.sin(m.rotation);
      const lx = (dx * cosR + dz * sinR) / m.radiusX;
      const lz = (-dx * sinR + dz * cosR) / m.radiusZ;
      const eDist = Math.sqrt(lx * lx + lz * lz);
      if (eDist < 1.35) {
        // Flat-topped terraced mesa profile
        const raw = THREE.MathUtils.clamp((1.22 - eDist) / 0.52, 0, 1);
        const smooth = raw * raw * (3 - 2 * raw);
        // Subtle 3-tier geological strata shelf
        const terrace = smooth * 0.72 + Math.floor(smooth * 3.2) * (0.28 / 3.2);
        h += terrace * m.height;
      }
    }
  }

  // Smooth flat plateau for the Modular Mars Base & Exterior Yard (radius 0..38, blend out to 50)
  if (distFromBase < 50) {
    const blend = THREE.MathUtils.smoothstep(distFromBase, 38, 50);
    h = h * blend;
  }

  // Excavate terrain underneath the East Ramp & Underground Storm Bunker
  if (isInsideBunkerExcavation(x, z)) {
    h = -3.95;
  }

  return h;
}

export function groundNormalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const eps = 0.6;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);
  out.set(hL - hR, 2 * eps, hD - hU).normalize();
  return out;
}

export function createMarsRegolithTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base warm terracotta dust
  ctx.fillStyle = '#cf653e';
  ctx.fillRect(0, 0, size, size);

  const rand = seededRand(8811);

  // Subtle wind-carved sand ripples
  for (let y = 0; y < size; y += 4) {
    const wave = Math.sin((y / size) * Math.PI * 16) * 0.5 + 0.5;
    ctx.fillStyle = wave > 0.5 ? 'rgba(244, 152, 102, 0.08)' : 'rgba(122, 42, 22, 0.08)';
    ctx.fillRect(0, y, size, 3);
  }

  // Fine mineral grain & pebbles
  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 2.2;
    const pick = rand();
    if (pick < 0.38) {
      ctx.fillStyle = 'rgba(110, 36, 20, 0.22)';
    } else if (pick < 0.76) {
      ctx.fillStyle = 'rgba(235, 134, 86, 0.2)';
    } else {
      ctx.fillStyle = 'rgba(182, 74, 40, 0.25)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface TerrainBuildResult {
  terrainGroup: THREE.Group;
  boulders: BoulderSpec[];
  disposables: Array<{ dispose: () => void }>;
}

export function createMartianTerrain(maxAnisotropy: number): TerrainBuildResult {
  const terrainGroup = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  const cPlain = new THREE.Color('#d25832');
  const cHigh = new THREE.Color('#e68755');
  const cCrater = new THREE.Color('#7f2c1b');
  const cMesa = new THREE.Color('#a63c22');
  const cBasePad = new THREE.Color('#b74b2b');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = groundHeightAt(x, z);
    posAttr.setY(i, y);

    const dist = Math.hypot(x, z);
    tmpColor.copy(cPlain);

    if (y < -0.7) {
      const t = THREE.MathUtils.clamp((-y - 0.7) / 2.8, 0, 1);
      tmpColor.lerp(cCrater, t);
    } else if (y > 4.5) {
      // Stratified mesa bands
      const band = Math.sin(y * 1.45) * 0.5 + 0.5;
      tmpColor.lerp(cMesa, 0.65).lerp(cHigh, band * 0.35);
    } else if (y > 0.8) {
      const t = THREE.MathUtils.clamp((y - 0.8) / 3.2, 0, 1);
      tmpColor.lerp(cHigh, t * 0.65);
    }

    if (dist < 24) {
      const padBlend = 1 - THREE.MathUtils.smoothstep(dist, 16, 24);
      tmpColor.lerp(cBasePad, padBlend * 0.6);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const regolithTex = createMarsRegolithTexture(maxAnisotropy);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: regolithTex,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainGroup.add(terrainMesh);
  disposables.push(geo, terrainMat, regolithTex);

  // Instanced Martian Boulders (multi-faceted displaced icosahedron)
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  const rockPos = rockGeo.attributes.position as THREE.BufferAttribute;
  const randRock = seededRand(3312);
  for (let i = 0; i < rockPos.count; i++) {
    const vx = rockPos.getX(i);
    const vy = rockPos.getY(i);
    const vz = rockPos.getZ(i);
    // Quantize hash by direction so shared vertices displace identically
    const h = Math.sin(vx * 7.3 + vy * 13.1 + vz * 5.7) * 0.5 + 0.5;
    const scale = 0.78 + h * 0.36;
    rockPos.setXYZ(i, vx * scale, vy * scale * 0.72, vz * scale);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.86,
    metalness: 0.08,
    flatShading: true,
  });

  const boulderCount = 240;
  const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, boulderCount);
  rockInstanced.castShadow = true;
  rockInstanced.receiveShadow = true;

  const boulders: BoulderSpec[] = [];
  const dummy = new THREE.Object3D();
  const rockTints = [
    new THREE.Color('#8e3622'),
    new THREE.Color('#6f2b1e'),
    new THREE.Color('#a64528'),
    new THREE.Color('#5a261d'),
    new THREE.Color('#b65a37'),
  ];

  let placed = 0;
  let attempts = 0;
  while (placed < boulderCount && attempts < 1400) {
    attempts++;
    const angle = randRock() * Math.PI * 2;
    const dist = 42 + Math.pow(randRock(), 0.72) * 98;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Avoid blocking crater centers directly (rims & plains look great!)
    const inCraterBottom = CRATERS.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius * 0.65);
    if (inCraterBottom) continue;

    const baseScale = 0.65 + Math.pow(randRock(), 1.8) * 2.5;
    const sx = baseScale * (0.85 + randRock() * 0.3);
    const sy = baseScale * (0.7 + randRock() * 0.35);
    const sz = baseScale * (0.85 + randRock() * 0.3);

    const gy = groundHeightAt(x, z);
    // Embed slightly into regolith so nothing ever floats on slopes
    dummy.position.set(x, gy + sy * 0.32, z);
    dummy.rotation.set((randRock() - 0.5) * 0.35, randRock() * Math.PI * 2, (randRock() - 0.5) * 0.35);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();

    rockInstanced.setMatrixAt(placed, dummy.matrix);
    rockInstanced.setColorAt(placed, rockTints[Math.floor(randRock() * rockTints.length)]);

    if (baseScale > 1.05) {
      boulders.push({ x, y: gy, z, radius: Math.max(sx, sz) * 0.78 });
    }
    placed++;
  }

  rockInstanced.count = placed;
  rockInstanced.instanceMatrix.needsUpdate = true;
  if (rockInstanced.instanceColor) rockInstanced.instanceColor.needsUpdate = true;
  rockInstanced.computeBoundingSphere();

  terrainGroup.add(rockInstanced);
  disposables.push(rockGeo, rockMat);

  return { terrainGroup, boulders, disposables };
}
