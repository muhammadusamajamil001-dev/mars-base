import * as THREE from 'three';
import {
  BASE_WALL_BOXES,
  BUNKER_FLOOR_Y,
  EXT_RAMP_END_Z,
  EXT_RAMP_START_Z,
  HUB_FLOOR_Y,
  RAMP_END_X,
  RAMP_START_X,
  WallBox,
} from './baseLayout';
import { PracticeTaskId, ROOM_ORIENTATION_CARDS, RoomId } from './types';

export interface SlidingDoorRig {
  id: string;
  room: RoomId;
  x: number;
  y: number;
  z: number;
  axis: 'x' | 'z';
  leftLeaf: THREE.Group;
  rightLeaf: THREE.Group;
  statusMat: THREE.MeshStandardMaterial;
  openAmount: number;
  targetOpen: boolean;
  soundCooldown: number;
  colliderBox: WallBox;
}

export interface SolarTrackerRig {
  yawGroup: THREE.Group;
  tiltGroup: THREE.Group;
  panelMesh: THREE.Mesh;
  dustMesh: THREE.Mesh;
  dustMat: THREE.MeshStandardMaterial;
  dustAmount: number;
}

export interface RoomLockRingRig {
  room: RoomId;
  x: number;
  y: number;
  z: number;
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  discMat: THREE.MeshBasicMaterial;
  holoCardMesh: THREE.Mesh;
  gateMesh: THREE.Mesh | null;
}

export interface HubShutterRig {
  lowerPanels: THREE.Mesh[];
  crownCap: THREE.Mesh;
}

export interface ModularBaseRig {
  group: THREE.Group;
  holoMars: THREE.Mesh;
  holoRing: THREE.Mesh;
  tableRadarSweep: THREE.Group;
  radiationWaveRings: THREE.Mesh[];
  bunkerLeverHandle: THREE.Group;
  bunkerLeverLightMat: THREE.MeshStandardMaterial;
  greenhouseCracksGroup: THREE.Group;
  resinKitProp: THREE.Group;
  heaterCoilsMat: THREE.MeshStandardMaterial;
  heaterLight: THREE.PointLight;
  beaconOrbMat: THREE.MeshStandardMaterial;
  beaconLight: THREE.PointLight;
  radarSpin: THREE.Group;
  interiorLights: THREE.PointLight[];
  yardLights: THREE.PointLight[];
  scrubberRings: THREE.Mesh[];
  turbineRotors: THREE.Group[];
  waterTankCores: THREE.Mesh[];
  uvLights: THREE.PointLight[];
  suitBoothRing: THREE.Mesh;
  solarTrackers: SolarTrackerRig[];
  exteriorDishYaw: THREE.Group;
  dishAssembly: THREE.Group;
  exteriorFanRotor: THREE.Group;
  doors: SlidingDoorRig[];
  ledMaterials: Record<RoomId, THREE.MeshStandardMaterial>;
  roomBeacons: Record<RoomId, THREE.Group>;
  roomLights: Record<RoomId, THREE.PointLight>;
  lockRings: Record<RoomId, RoomLockRingRig>;
  practiceArrows: Record<PracticeTaskId, THREE.Group>;
  hubShutters: HubShutterRig;
  coolingVentLeverHandle: THREE.Group;
  coolingVentLightMat: THREE.MeshStandardMaterial;
  fuseWallLightMat: THREE.MeshStandardMaterial;
  fuseLockerDoorPivot: THREE.Group;
  lockerSpareFuseProp: THREE.Group;
  doorLightningArcs: THREE.Group[];
  groundingSwitchLever: THREE.Group;
  groundingSwitchLightMat: THREE.MeshStandardMaterial;
  solarJamPebbles: THREE.Mesh[];
  roverDockLightMat: THREE.MeshStandardMaterial;
  roverDockSwitchHandle: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
}

function createBaseFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Matte cool slate sci-fi deck flooring (prevents blinding white sun glare!)
  ctx.fillStyle = '#4c586b';
  ctx.fillRect(0, 0, size, size);

  const tiles = 8;
  const step = size / tiles;
  for (let r = 0; r < tiles; r++) {
    for (let c = 0; c < tiles; c++) {
      const shade = (r + c) % 2 === 0 ? '#556378' : '#485467';
      ctx.fillStyle = shade;
      ctx.fillRect(c * step + 3, r * step + 3, step - 6, step - 6);
    }
  }

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  for (let i = 0; i <= tiles; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSolarDustTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b44825';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 900; i++) {
    const x = ((i * 73) % 256);
    const y = ((i * 137) % 256);
    const r = 4 + (i % 9);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(217, 102, 54, 0.55)' : 'rgba(130, 42, 20, 0.48)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createYardApronTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#363e4b';
  ctx.fillRect(0, 0, size, size);

  // Subtle concrete panel grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    const p = (i / 8) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Hazard border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 14;
  ctx.setLineDash([24, 16]);
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.setLineDash([]);

  // Center landing circle
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 260, 120, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(202, 188, 22, 144);
  ctx.fillRect(288, 188, 22, 144);
  ctx.fillRect(202, 249, 108, 22);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ARES ALPHA YARD', 256, 435);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadarTableTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#061a2b';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 3;
  [70, 130, 190, 238].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Crosshairs
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 240, cy + Math.sin(a) * 240);
    ctx.lineTo(cx - Math.cos(a) * 240, cy - Math.sin(a) * 240);
    ctx.stroke();
  }

  // Mars contour rings & radar blips
  ctx.fillStyle = '#f97316';
  [
    [175, 165],
    [340, 190],
    [290, 355],
    [155, 320],
  ].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#4ade80';
  [
    [256, 115],
    [115, 256],
    [395, 256],
    [256, 395],
  ].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHoloScreenTexture(title: string, accent: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(7, 25, 44, 0.92)';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle scanlines
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  for (let y = 0; y < 256; y += 8) {
    ctx.fillRect(0, y, 512, 2);
  }

  // Border
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 236);

  // Header bar
  ctx.fillStyle = accent;
  ctx.fillRect(22, 22, 468, 34);
  ctx.fillStyle = '#07192c';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(title, 34, 46);

  // Bar charts & waveform graphics for kids
  const bars = [0.78, 0.92, 0.64, 0.85, 0.96, 0.72, 0.88];
  bars.forEach((h, idx) => {
    const bx = 36 + idx * 34;
    const bh = h * 110;
    ctx.fillStyle = idx % 2 === 0 ? '#38bdf8' : accent;
    ctx.fillRect(bx, 200 - bh, 22, bh);
  });

  // Circular planet telemetry ring on right
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(390, 145, 52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.arc(390, 145, 26, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSolarArrayTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c2357';
  ctx.fillRect(0, 0, 512, 384);

  // Photovoltaic wafer grid (6x4 cells)
  const cols = 6;
  const rows = 4;
  const cw = 512 / cols;
  const ch = 384 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 4;
      const y = r * ch + 4;
      const grad = ctx.createLinearGradient(x, y, x + cw - 8, y + ch - 8);
      grad.addColorStop(0, '#133b8c');
      grad.addColorStop(0.5, '#1d4ed8');
      grad.addColorStop(1, '#102e6e');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cw - 8, ch - 8);

      // Subtle silver busbar stripes
      ctx.fillStyle = 'rgba(191, 219, 254, 0.35)';
      ctx.fillRect(x + (cw - 8) * 0.3, y, 2, ch - 8);
      ctx.fillRect(x + (cw - 8) * 0.7, y, 2, ch - 8);
    }
  }

  // Outer aluminum frame highlight
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 374);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createModularMarsBase(isSoftwareGl: boolean, maxAnisotropy: number): ModularBaseRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const interiorLights: THREE.PointLight[] = [];
  const yardLights: THREE.PointLight[] = [];
  const scrubberRings: THREE.Mesh[] = [];
  const turbineRotors: THREE.Group[] = [];
  const waterTankCores: THREE.Mesh[] = [];
  const uvLights: THREE.PointLight[] = [];

  // Shared PBR Materials
  const floorTex = createBaseFloorTexture(maxAnisotropy);
  const matWallWhite = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.36, metalness: 0.16 });
  const matOrange = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.3, metalness: 0.24 });
  const matFloor = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: '#cbd5e1',
    roughness: 0.74,
    metalness: 0.16,
  });
  const matDarkSteel = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.48, metalness: 0.72 });
  const matLeadBunker = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.68, metalness: 0.55 });
  disposables.push(floorTex);
  const matHazardYellow = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.4, metalness: 0.2 });
  const matCyanGlow = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const matGreenGlow = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#22c55e',
    emissiveIntensity: 1.35,
    roughness: 0.2,
  });
  const matAmberGlow = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#f59e0b',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const matGlassDome = new THREE.MeshPhysicalMaterial({
    color: '#bae6fd',
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.74,
    transparent: true,
    opacity: isSoftwareGl ? 0.32 : 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
    ior: 1.48,
  });

  // Color-coded embedded floor LED strip materials (one dedicated material per room)
  const makeLedMat = (color: string, emissive: string) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 1.2,
      roughness: 0.22,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

  const ledMaterials: Record<RoomId, THREE.MeshStandardMaterial> = {
    power: makeLedMat('#fde047', '#eab308'), // Yellow -> Power Bay
    greenhouse: makeLedMat('#86efac', '#22c55e'), // Green -> Greenhouse
    bunker: makeLedMat('#fdba74', '#f97316'), // Orange -> Storm Bunker
    airlock: makeLedMat('#7dd3fc', '#0ea5e9'), // Blue -> Airlock
  };

  const matDoorGlass = new THREE.MeshPhysicalMaterial({
    color: '#7dd3fc',
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });

  disposables.push(
    matWallWhite,
    matOrange,
    matFloor,
    matDarkSteel,
    matLeadBunker,
    matHazardYellow,
    matCyanGlow,
    matGreenGlow,
    matAmberGlow,
    matGlassDome,
    matDoorGlass,
    ledMaterials.power,
    ledMaterials.greenhouse,
    ledMaterials.bunker,
    ledMaterials.airlock,
  );

  // ============================================================================
  // 1) BUILD ALL CORRIDOR & BAY WALLS 1:1 WITH COLLIDER BOXES
  // ============================================================================
  const trimGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(trimGeo);

  BASE_WALL_BOXES.forEach((w) => {
    const sx = w.maxX - w.minX;
    const sz = w.maxZ - w.minZ;
    const sy = w.maxY - w.minY;
    const cx = (w.minX + w.maxX) * 0.5;
    const cz = (w.minZ + w.maxZ) * 0.5;
    const cy = (w.minY + w.maxY) * 0.5;

    const isBunker = w.minY < -1.0;
    const wallMesh = new THREE.Mesh(trimGeo, isBunker ? matLeadBunker : matWallWhite);
    wallMesh.position.set(cx, cy, cz);
    wallMesh.scale.set(sx, sy, sz);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);

    // Orange / Hazard base stripe
    const stripe = new THREE.Mesh(trimGeo, isBunker ? matHazardYellow : matOrange);
    stripe.position.set(cx, w.minY + 0.55, cz);
    stripe.scale.set(sx + 0.06, 0.32, sz + 0.06);
    group.add(stripe);
  });

  // ============================================================================
  // 2) COMPARTMENT 1: CENTRAL COMMAND HUB (center 0, 0)
  //    Notched cleanly on +X East side so the Bunker Ramp descends with ZERO overlap/Z-fighting!
  // ============================================================================
  const makeNotchedDiscGeo = (radius: number, thickness: number, notchStartX: number, notchHalfZ: number) => {
    const shape = new THREE.Shape();
    const startAngle = Math.asin(Math.min(0.95, notchHalfZ / radius));
    shape.absarc(0, 0, radius, startAngle, Math.PI * 2 - startAngle, false);
    shape.lineTo(notchStartX, -notchHalfZ);
    shape.lineTo(notchStartX, notchHalfZ);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 28 });
    g.rotateX(Math.PI / 2); // top face at y = 0, bottom face at y = -thickness
    return g;
  };

  const hubPlinthGeo = makeNotchedDiscGeo(9.1, 0.72, 7.75, 2.28);
  const hubPlinth = new THREE.Mesh(hubPlinthGeo, matDarkSteel);
  hubPlinth.position.y = HUB_FLOOR_Y - 0.16; // top face at y = 0.29 (strictly below hubFloor!)
  hubPlinth.receiveShadow = true;
  group.add(hubPlinth);

  const hubFloorGeo = makeNotchedDiscGeo(8.45, 0.14, 7.78, 2.2);
  const hubFloor = new THREE.Mesh(hubFloorGeo, matFloor);
  hubFloor.position.y = HUB_FLOOR_Y; // top face cleanly at HUB_FLOOR_Y (0.45), bottom at 0.31
  hubFloor.receiveShadow = true;
  group.add(hubFloor);

  // Color-coded LED guide strips embedded into corridor floors leading from Command Hub to each room:
  // Yellow -> Power Bay (West), Green -> Greenhouse (North), Orange -> Storm Bunker (East), Blue -> Airlock (South)
  const addEmbeddedFloorStrip = (
    cx: number,
    cy: number,
    cz: number,
    length: number,
    horizontalX: boolean,
    mat: THREE.MeshStandardMaterial,
    rotZ = 0,
  ) => {
    const channelGeo = new THREE.BoxGeometry(horizontalX ? length : 0.54, 0.018, horizontalX ? 0.54 : length);
    const channel = new THREE.Mesh(channelGeo, matDarkSteel);
    channel.position.set(cx, cy + 0.008, cz);
    channel.rotation.z = rotZ;
    group.add(channel);

    const stripGeo = new THREE.BoxGeometry(horizontalX ? length : 0.28, 0.024, horizontalX ? 0.28 : length);
    const strip = new THREE.Mesh(stripGeo, mat);
    strip.position.set(cx, cy + 0.022, cz);
    strip.rotation.z = rotZ;
    group.add(strip);

    disposables.push(channelGeo, stripGeo);
  };

  // Yellow LED Strip -> Power & Life Support Bay (x = -1.35 .. -15.4)
  addEmbeddedFloorStrip(-8.375, HUB_FLOOR_Y, 0, 14.05, true, ledMaterials.power);
  // Green LED Strip -> Greenhouse Dome (z = -1.35 .. -15.6)
  addEmbeddedFloorStrip(0, HUB_FLOOR_Y, -8.475, 14.25, false, ledMaterials.greenhouse);
  // Orange LED Strip -> Storm Bunker Hub Approach (x = +1.35 .. +7.85)
  addEmbeddedFloorStrip(4.6, HUB_FLOOR_Y, 0, 6.5, true, ledMaterials.bunker);
  // Blue LED Strip -> Airlock & Suit Bay (z = +1.35 .. +15.8)
  addEmbeddedFloorStrip(0, HUB_FLOOR_Y, 8.575, 14.45, false, ledMaterials.airlock);

  // Curved lower hub walls with 4 wide open corridor portals (N/S/E/W)
  const wallArcGeo = new THREE.CylinderGeometry(8.6, 8.6, 2.3, 12, 1, true, 0, Math.PI * 0.34);
  const wallArcMat = matWallWhite.clone();
  wallArcMat.side = THREE.DoubleSide;
  disposables.push(wallArcMat);
  const arcAngles = [Math.PI * 0.08, Math.PI * 0.58, Math.PI * 1.08, Math.PI * 1.58];
  arcAngles.forEach((a) => {
    const seg = new THREE.Mesh(wallArcGeo, wallArcMat);
    seg.position.y = HUB_FLOOR_Y + 1.15;
    seg.rotation.y = a;
    seg.castShadow = true;
    seg.receiveShadow = true;
    group.add(seg);
  });

  // Huge Transparent Geodesic Glass Dome over Command Hub
  const hubDomeGeo = new THREE.SphereGeometry(8.55, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const hubDome = new THREE.Mesh(hubDomeGeo, matGlassDome);
  hubDome.position.y = HUB_FLOOR_Y + 0.2;
  hubDome.renderOrder = 2;
  group.add(hubDome);

  // Structural Dome Ribs & Rooftop Mast
  const hubRibGeo = new THREE.TorusGeometry(8.6, 0.16, 8, 36, Math.PI);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(hubRibGeo, i % 2 === 0 ? matWallWhite : matOrange);
    rib.position.y = HUB_FLOOR_Y + 0.2;
    rib.rotation.y = (i / 4) * Math.PI + Math.PI * 0.125;
    rib.castShadow = true;
    group.add(rib);
  }

  const mastGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.6, 10);
  const mast = new THREE.Mesh(mastGeo, matDarkSteel);
  mast.position.set(0, 10.4, 0);
  group.add(mast);

  const beaconOrbMat = matCyanGlow.clone();
  const beaconOrbGeo = new THREE.SphereGeometry(0.45, 14, 12);
  const beaconOrb = new THREE.Mesh(beaconOrbGeo, beaconOrbMat);
  beaconOrb.position.set(0, 12.3, 0);
  group.add(beaconOrb);

  const radarSpin = new THREE.Group();
  radarSpin.position.set(0, 11.4, 0);
  group.add(radarSpin);
  const radarBarGeo = new THREE.BoxGeometry(2.8, 0.22, 0.18);
  radarSpin.add(new THREE.Mesh(radarBarGeo, matOrange));

  const beaconLight = new THREE.PointLight('#38bdf8', 2.2, 42, 1.5);
  beaconLight.position.set(0, 12.5, 0);
  group.add(beaconLight);

  // ============================================================================
  // CENTRAL RADAR TABLE & CURVED HOLOGRAPHIC WALL SCREENS (Command Hub)
  // ============================================================================
  const tablePedestalGeo = new THREE.CylinderGeometry(1.18, 1.42, 0.94, 20);
  const tablePedestal = new THREE.Mesh(tablePedestalGeo, matDarkSteel);
  tablePedestal.position.set(0, HUB_FLOOR_Y + 0.47, 0);
  tablePedestal.castShadow = true;
  group.add(tablePedestal);

  const tableRimGeo = new THREE.TorusGeometry(1.24, 0.1, 8, 28);
  tableRimGeo.rotateX(Math.PI / 2);
  const tableRim = new THREE.Mesh(tableRimGeo, matOrange);
  tableRim.position.set(0, HUB_FLOOR_Y + 0.95, 0);
  group.add(tableRim);

  // Glowing Circular Mars Radar Screen on Table Surface
  const radarTex = createRadarTableTexture(maxAnisotropy);
  const radarDiskGeo = new THREE.CylinderGeometry(1.14, 1.14, 0.04, 28);
  const radarDiskMat = new THREE.MeshStandardMaterial({
    map: radarTex,
    emissive: '#38bdf8',
    emissiveMap: radarTex,
    emissiveIntensity: 0.95,
    roughness: 0.18,
  });
  const radarDisk = new THREE.Mesh(radarDiskGeo, radarDiskMat);
  radarDisk.position.set(0, HUB_FLOOR_Y + 0.96, 0);
  group.add(radarDisk);

  // Rotating Radar Sweep Arm
  const tableRadarSweep = new THREE.Group();
  tableRadarSweep.position.set(0, HUB_FLOOR_Y + 1.0, 0);
  const sweepArmGeo = new THREE.BoxGeometry(1.06, 0.03, 0.07);
  const sweepArm = new THREE.Mesh(sweepArmGeo, matGreenGlow);
  sweepArm.position.x = 0.52;
  tableRadarSweep.add(sweepArm);
  group.add(tableRadarSweep);

  const holoMarsGeo = new THREE.SphereGeometry(0.56, 18, 14);
  const holoMarsMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#ea580c',
    emissiveIntensity: 0.95,
    wireframe: true,
  });
  const holoMars = new THREE.Mesh(holoMarsGeo, holoMarsMat);
  holoMars.position.set(0, HUB_FLOOR_Y + 1.92, 0);
  group.add(holoMars);

  const holoRingGeo = new THREE.TorusGeometry(0.88, 0.03, 6, 28);
  const holoRing = new THREE.Mesh(holoRingGeo, matCyanGlow);
  holoRing.position.set(0, HUB_FLOOR_Y + 1.92, 0);
  holoRing.rotation.x = Math.PI / 3;
  group.add(holoRing);

  // Pulsing Neon-Purple Radiation Wave Rings (shown over Radar Table during Solar Radiation Storm)
  const radWaveGeo = new THREE.TorusGeometry(1.0, 0.045, 8, 32);
  radWaveGeo.rotateX(Math.PI / 2);
  const radWaveMat = new THREE.MeshBasicMaterial({
    color: '#e879f9',
    transparent: true,
    opacity: 0.78,
  });
  const radiationWaveRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const rw = new THREE.Mesh(radWaveGeo, radWaveMat);
    rw.position.set(0, HUB_FLOOR_Y + 1.05 + i * 0.28, 0);
    rw.visible = false;
    group.add(rw);
    radiationWaveRings.push(rw);
  }
  disposables.push(radWaveGeo, radWaveMat);

  // 4 Curved Holographic Wall Screens along the 4 Curved Hub Walls
  const holoTitles: Array<[string, string]> = [
    ['MARS WEATHER RADAR', '#38bdf8'],
    ['SOLAR POWER GRID', '#facc15'],
    ['BIO-DOME OXYGEN', '#4ade80'],
    ['ROVER TELEMETRY', '#fb923c'],
  ];
  const holoScreenGeo = new THREE.CylinderGeometry(7.28, 7.28, 1.72, 16, 1, true, 0, Math.PI * 0.28);
  const holoRailGeo = new THREE.TorusGeometry(7.3, 0.07, 6, 18, Math.PI * 0.28);
  holoRailGeo.rotateX(Math.PI / 2);

  arcAngles.forEach((a, idx) => {
    const [title, accent] = holoTitles[idx];
    const scrTex = createHoloScreenTexture(title, accent, maxAnisotropy);
    const scrMat = new THREE.MeshStandardMaterial({
      map: scrTex,
      emissive: '#ffffff',
      emissiveMap: scrTex,
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      roughness: 0.2,
    });
    const curvedScr = new THREE.Mesh(holoScreenGeo, scrMat);
    curvedScr.position.y = HUB_FLOOR_Y + 2.35;
    curvedScr.rotation.y = a + Math.PI * 0.03;
    group.add(curvedScr);

    const topRail = new THREE.Mesh(holoRailGeo, matDarkSteel);
    topRail.position.y = HUB_FLOOR_Y + 3.24;
    topRail.rotation.y = -(a + Math.PI * 0.03) + Math.PI * 0.5;
    group.add(topRail);

    disposables.push(scrTex, scrMat);
  });

  // 4 Command Desks with Glowing Monitors & Dual Joysticks around the perimeter
  const deskGeo = new THREE.BoxGeometry(2.15, 0.88, 0.78);
  const screenGeo = new THREE.BoxGeometry(1.5, 0.72, 0.08);
  const joyGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.24, 8);
  [
    [-4.6, -4.6, Math.PI * 0.25],
    [4.6, -4.6, -Math.PI * 0.25],
    [-4.6, 4.6, Math.PI * 0.75],
    [4.6, 4.6, -Math.PI * 0.75],
  ].forEach(([dx, dz, rot]) => {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(dx, HUB_FLOOR_Y, dz);
    deskGroup.rotation.y = rot;
    const desk = new THREE.Mesh(deskGeo, matWallWhite);
    desk.position.y = 0.44;
    desk.castShadow = true;
    deskGroup.add(desk);
    const scr = new THREE.Mesh(screenGeo, matCyanGlow);
    scr.position.set(0, 1.24, -0.15);
    scr.rotation.x = 0.15;
    deskGroup.add(scr);
    const j1 = new THREE.Mesh(joyGeo, matOrange);
    j1.position.set(-0.55, 0.98, 0.18);
    deskGroup.add(j1);
    const j2 = new THREE.Mesh(joyGeo, matOrange);
    j2.position.set(0.55, 0.98, 0.18);
    deskGroup.add(j2);
    group.add(deskGroup);
  });

  const hubLight = new THREE.PointLight('#fde68a', 2.2, 22, 1.4);
  hubLight.position.set(0, 4.8, 0);
  group.add(hubLight);
  interiorLights.push(hubLight);

  disposables.push(
    hubPlinthGeo,
    hubFloorGeo,
    wallArcGeo,
    hubDomeGeo,
    hubRibGeo,
    mastGeo,
    beaconOrbMat,
    beaconOrbGeo,
    radarBarGeo,
    tablePedestalGeo,
    tableRimGeo,
    radarTex,
    radarDiskGeo,
    radarDiskMat,
    sweepArmGeo,
    holoMarsGeo,
    holoMarsMat,
    holoRingGeo,
    holoScreenGeo,
    holoRailGeo,
    deskGeo,
    screenGeo,
    joyGeo,
  );

  // ============================================================================
  // 3) SCI-FI CORRIDORS (N, W, S) WITH ARCHED RIBS & GLASS SKYLIGHTS
  // ============================================================================
  const buildCorridorShell = (
    cx: number,
    cz: number,
    length: number,
    horizontal: boolean,
  ) => {
    const floorGeo = new THREE.BoxGeometry(horizontal ? length : 4.5, 0.5, horizontal ? 4.5 : length);
    const floor = new THREE.Mesh(floorGeo, matFloor);
    // Offset corridor floor top by -0.005m so seams against circular dome floors never Z-fight
    floor.position.set(cx, HUB_FLOOR_Y - 0.255, cz);
    floor.receiveShadow = true;
    group.add(floor);

    const roofGeo = new THREE.BoxGeometry(horizontal ? length : 5.0, 0.22, horizontal ? 5.0 : length);
    const roof = new THREE.Mesh(roofGeo, matGlassDome);
    roof.position.set(cx, 3.85, cz);
    roof.renderOrder = 2;
    group.add(roof);

    const archGeo = new THREE.TorusGeometry(2.45, 0.14, 8, 18, Math.PI);
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const offset = ((i / (steps - 1)) - 0.5) * (length * 0.72);
      const arch = new THREE.Mesh(archGeo, matOrange);
      arch.position.set(horizontal ? cx + offset : cx, 1.5, horizontal ? cz : cz + offset);
      if (horizontal) arch.rotation.y = Math.PI / 2;
      arch.castShadow = true;
      group.add(arch);
    }
    disposables.push(floorGeo, roofGeo, archGeo);
  };

  buildCorridorShell(0, -10.0, 3.8, false); // North -> Greenhouse (clean span without overlap)
  buildCorridorShell(-10.55, 0, 5.1, true); // West -> Power & Life Support
  buildCorridorShell(0, 10.0, 4.0, false); // South -> Airlock & Suit Bay

  // ============================================================================
  // 4) COMPARTMENT 2: POWER & LIFE SUPPORT BAY (x = -23..-13, z = -5.2..5.2)
  //    Spinning Oxygen Turbines, Glowing Blue Water Tanks, and Battery Racks
  // ============================================================================
  const powerFloorGeo = new THREE.BoxGeometry(10.4, 0.55, 10.8);
  const powerFloor = new THREE.Mesh(powerFloorGeo, matFloor);
  powerFloor.position.set(-18.1, HUB_FLOOR_Y - 0.275, 0);
  powerFloor.receiveShadow = true;
  group.add(powerFloor);

  const powerRoofGeo = new THREE.CylinderGeometry(5.3, 5.3, 10.6, 16, 1, true, 0, Math.PI);
  powerRoofGeo.rotateZ(Math.PI / 2);
  powerRoofGeo.rotateY(Math.PI / 2);
  const powerRoof = new THREE.Mesh(powerRoofGeo, matGlassDome);
  powerRoof.position.set(-18.1, 4.2, 0);
  powerRoof.renderOrder = 2;
  group.add(powerRoof);

  // 4a. Twin Spinning Oxygen Turbines (West corners: x = -21.1, z = ±3.05)
  const turbineHousingGeo = new THREE.CylinderGeometry(1.05, 1.15, 2.9, 16);
  const intakeRingGeo = new THREE.TorusGeometry(0.85, 0.14, 10, 24);
  const bladeGeo = new THREE.BoxGeometry(0.16, 1.45, 0.06);
  const rotorHubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.26, 12);
  rotorHubGeo.rotateX(Math.PI / 2);
  const scrubberRingGeo = new THREE.TorusGeometry(1.16, 0.07, 8, 24);
  scrubberRingGeo.rotateX(Math.PI / 2);

  // 4b. Glowing Blue Water Reclamation Tanks (x = -18.25, z = ±3.65)
  const tankBaseGeo = new THREE.CylinderGeometry(0.82, 0.9, 0.36, 16);
  const waterShellGeo = new THREE.CylinderGeometry(0.76, 0.76, 2.55, 16);
  const waterCoreGeo = new THREE.CylinderGeometry(0.62, 0.62, 2.35, 14);
  const matWaterGlow = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 1.65,
    roughness: 0.15,
  });
  const pipeGeo = new THREE.CylinderGeometry(0.11, 0.11, 3.0, 10);
  pipeGeo.rotateZ(Math.PI / 2);

  // 4c. Multi-Tier Battery Racks (x = -15.45, z = ±3.7)
  const rackFrameGeo = new THREE.BoxGeometry(1.65, 2.7, 1.45);
  const rackShelfGeo = new THREE.BoxGeometry(1.58, 0.1, 1.38);
  const batCellGeo = new THREE.BoxGeometry(0.38, 0.52, 0.9);
  const batLedGeo = new THREE.BoxGeometry(0.08, 2.3, 0.12);

  [-1, 1].forEach((side) => {
    // Oxygen Turbine + Spinning 6-Blade Impeller facing center aisle
    const turbZ = side * 3.05;
    const housing = new THREE.Mesh(turbineHousingGeo, matWallWhite);
    housing.position.set(-21.1, HUB_FLOOR_Y + 1.45, turbZ);
    housing.castShadow = true;
    group.add(housing);

    const glowRing = new THREE.Mesh(scrubberRingGeo, matCyanGlow);
    glowRing.position.set(-21.1, HUB_FLOOR_Y + 1.5, turbZ);
    group.add(glowRing);
    scrubberRings.push(glowRing);

    const shroud = new THREE.Mesh(intakeRingGeo, matDarkSteel);
    shroud.position.set(-21.1, HUB_FLOOR_Y + 1.55, turbZ - side * 0.98);
    group.add(shroud);

    const rotor = new THREE.Group();
    rotor.position.set(-21.1, HUB_FLOOR_Y + 1.55, turbZ - side * 1.02);
    rotor.add(new THREE.Mesh(rotorHubGeo, matOrange));
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, matCyanGlow);
      blade.rotation.z = (b / 3) * Math.PI;
      rotor.add(blade);
    }
    group.add(rotor);
    turbineRotors.push(rotor);

    // Glowing Blue Water Tank + Overhead Pipe linking to Turbine
    const wtZ = side * 3.65;
    const wtBot = new THREE.Mesh(tankBaseGeo, matDarkSteel);
    wtBot.position.set(-18.25, HUB_FLOOR_Y + 0.18, wtZ);
    group.add(wtBot);

    const wtTop = new THREE.Mesh(tankBaseGeo, matDarkSteel);
    wtTop.position.set(-18.25, HUB_FLOOR_Y + 2.95, wtZ);
    group.add(wtTop);

    const waterCore = new THREE.Mesh(waterCoreGeo, matWaterGlow);
    waterCore.position.set(-18.25, HUB_FLOOR_Y + 1.56, wtZ);
    group.add(waterCore);
    waterTankCores.push(waterCore);

    const waterGlass = new THREE.Mesh(waterShellGeo, matGlassDome);
    waterGlass.position.set(-18.25, HUB_FLOOR_Y + 1.56, wtZ);
    waterGlass.renderOrder = 2;
    group.add(waterGlass);

    const linkPipe = new THREE.Mesh(pipeGeo, matDarkSteel);
    linkPipe.position.set(-19.7, HUB_FLOOR_Y + 2.8, (turbZ + wtZ) * 0.5);
    group.add(linkPipe);

    // Multi-Tier Steel Battery Rack with Stacked Glowing Power Cells
    const brZ = side * 3.7;
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-15.45, HUB_FLOOR_Y, brZ);

    const backPlate = new THREE.Mesh(rackFrameGeo, matDarkSteel);
    backPlate.position.y = 1.35;
    backPlate.scale.set(1, 1, 0.25);
    backPlate.position.z = side * 0.55;
    rackGroup.add(backPlate);

    [0.2, 1.05, 1.9, 2.65].forEach((sy) => {
      const shelf = new THREE.Mesh(rackShelfGeo, matDarkSteel);
      shelf.position.y = sy;
      rackGroup.add(shelf);
    });

    [0.52, 1.37, 2.22].forEach((cy, row) => {
      [-0.48, 0, 0.48].forEach((cx, col) => {
        const cell = new THREE.Mesh(batCellGeo, (row + col) % 2 === 0 ? matGreenGlow : matOrange);
        cell.position.set(cx, cy, 0);
        rackGroup.add(cell);
      });
    });

    const chargeBar = new THREE.Mesh(batLedGeo, matGreenGlow);
    chargeBar.position.set(0.76, 1.35, -side * 0.58);
    rackGroup.add(chargeBar);
    group.add(rackGroup);
  });

  const powerLight = new THREE.PointLight('#38bdf8', 2.0, 18, 1.4);
  powerLight.position.set(-18.1, 4.2, 0);
  group.add(powerLight);
  interiorLights.push(powerLight);

  // Power Bay Emergency Heater Core (West Wall center between Turbines: x = -22.2, z = 0)
  const heaterCoilsMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#ea580c',
    emissiveIntensity: 0.9,
    roughness: 0.22,
  });
  const heaterPadGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.3, 14);
  const heaterBodyGeo = new THREE.CylinderGeometry(0.56, 0.56, 2.1, 14);
  const heaterCoilGeo = new THREE.TorusGeometry(0.62, 0.085, 8, 22);
  heaterCoilGeo.rotateX(Math.PI / 2);

  const heaterGroup = new THREE.Group();
  heaterGroup.position.set(-22.2, HUB_FLOOR_Y, 0);
  const heaterBase = new THREE.Mesh(heaterPadGeo, matDarkSteel);
  heaterBase.position.y = 0.15;
  heaterGroup.add(heaterBase);
  const heaterBody = new THREE.Mesh(heaterBodyGeo, matDarkSteel);
  heaterBody.position.y = 1.25;
  heaterGroup.add(heaterBody);
  [0.65, 1.1, 1.55, 2.0].forEach((hy) => {
    const coil = new THREE.Mesh(heaterCoilGeo, heaterCoilsMat);
    coil.position.y = hy;
    heaterGroup.add(coil);
  });
  const heaterCap = new THREE.Mesh(heaterPadGeo, matOrange);
  heaterCap.position.y = 2.4;
  heaterCap.scale.set(0.85, 0.8, 0.85);
  heaterGroup.add(heaterCap);
  const heaterLight = new THREE.PointLight('#fb923c', 1.2, 11, 1.4);
  heaterLight.position.y = 1.5;
  heaterGroup.add(heaterLight);
  group.add(heaterGroup);

  // Emergency Resin Kit Case in Power Bay (x = -14.3, z = -3.0) for Micro-Meteorite Shower
  const resinKitProp = new THREE.Group();
  resinKitProp.position.set(-14.3, HUB_FLOOR_Y + 0.55, -2.1);
  resinKitProp.visible = false;
  const rkPedestalGeo = new THREE.CylinderGeometry(0.45, 0.52, 0.55, 12);
  const rkPedestal = new THREE.Mesh(rkPedestalGeo, matDarkSteel);
  rkPedestal.position.y = -0.28;
  resinKitProp.add(rkPedestal);
  const rkCaseGeo = new THREE.BoxGeometry(0.62, 0.42, 0.42);
  const rkCase = new THREE.Mesh(rkCaseGeo, matGreenGlow);
  rkCase.position.y = 0.25;
  resinKitProp.add(rkCase);
  const rkCrossGeo = new THREE.BoxGeometry(0.16, 0.3, 0.46);
  const rkCross = new THREE.Mesh(rkCrossGeo, matOrange);
  rkCross.position.y = 0.25;
  resinKitProp.add(rkCross);
  group.add(resinKitProp);

  // Hazard 7: Battery Cooling Vent Lever mounted on North face of South Battery Rack (x = -15.45, z = 2.76)
  const coolingVentLightMat = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#22c55e',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const ventPanelGeo = new THREE.BoxGeometry(0.68, 0.85, 0.26);
  const ventHandleShaftGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.62, 10);
  const ventHandleGripGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.26, 10);
  ventHandleGripGeo.rotateX(Math.PI / 2);

  const coolingVentConsole = new THREE.Group();
  coolingVentConsole.position.set(-15.45, HUB_FLOOR_Y + 1.35, 2.76);
  coolingVentConsole.rotation.y = Math.PI; // face -Z toward center aisle
  coolingVentConsole.add(new THREE.Mesh(ventPanelGeo, matDarkSteel));
  const coolingLamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.3), coolingVentLightMat);
  coolingLamp.position.set(0, 0.48, 0);
  coolingVentConsole.add(coolingLamp);

  const coolingVentLeverHandle = new THREE.Group();
  coolingVentLeverHandle.position.set(0, 0.02, 0.16);
  coolingVentLeverHandle.rotation.x = -0.55;
  const cvShaft = new THREE.Mesh(ventHandleShaftGeo, matWallWhite);
  cvShaft.position.y = 0.28;
  const cvGrip = new THREE.Mesh(ventHandleGripGeo, matCyanGlow);
  cvGrip.position.y = 0.58;
  coolingVentLeverHandle.add(cvShaft, cvGrip);
  coolingVentConsole.add(coolingVentLeverHandle);
  group.add(coolingVentConsole);

  // Hazard 9a: Power Bay Wall Fuse Box on West Wall (x = -22.88, z = -1.35)
  const fuseWallLightMat = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#22c55e',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const fuseBoxGeo = new THREE.BoxGeometry(0.28, 0.96, 0.72);
  const fuseSlotGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.26, 12);
  fuseSlotGeo.rotateX(Math.PI / 2);

  const fuseWallBoxGroup = new THREE.Group();
  fuseWallBoxGroup.position.set(-22.88, HUB_FLOOR_Y + 1.45, -1.35);
  fuseWallBoxGroup.add(new THREE.Mesh(fuseBoxGeo, matDarkSteel));
  const fuseWallBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.42), fuseWallLightMat);
  fuseWallBeacon.position.set(0.02, 0.54, 0);
  fuseWallBoxGroup.add(fuseWallBeacon);
  const fuseWallCartridge = new THREE.Mesh(fuseSlotGeo, fuseWallLightMat);
  fuseWallCartridge.position.set(0.14, 0.0, 0);
  fuseWallBoxGroup.add(fuseWallCartridge);
  group.add(fuseWallBoxGroup);

  // Hazard 9b: Spare Fuse Locker in Power Bay East-South Corner (x = -13.65, z = 3.15)
  const lockerShellGeo = new THREE.BoxGeometry(0.75, 1.85, 0.85);
  const lockerDoorGeo = new THREE.BoxGeometry(0.08, 1.65, 0.76);
  const lockerFuseCoreGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.34, 12);
  lockerFuseCoreGeo.rotateX(Math.PI / 2);

  const spareFuseLocker = new THREE.Group();
  spareFuseLocker.position.set(-13.65, HUB_FLOOR_Y, 3.15);
  const fuseLockBody = new THREE.Mesh(lockerShellGeo, matDarkSteel);
  fuseLockBody.position.y = 0.92;
  fuseLockBody.castShadow = true;
  spareFuseLocker.add(fuseLockBody);
  const fuseLockStripe = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.88), matCyanGlow);
  fuseLockStripe.position.y = 1.72;
  spareFuseLocker.add(fuseLockStripe);

  const fuseLockerDoorPivot = new THREE.Group();
  fuseLockerDoorPivot.position.set(-0.38, 0.92, -0.38);
  const fuseLockDoor = new THREE.Mesh(lockerDoorGeo, matWallWhite);
  fuseLockDoor.position.set(0, 0, 0.38);
  fuseLockerDoorPivot.add(fuseLockDoor);
  spareFuseLocker.add(fuseLockerDoorPivot);

  const lockerSpareFuseProp = new THREE.Group();
  lockerSpareFuseProp.position.set(-0.24, 1.05, 0);
  lockerSpareFuseProp.add(new THREE.Mesh(lockerFuseCoreGeo, matCyanGlow));
  spareFuseLocker.add(lockerSpareFuseProp);
  group.add(spareFuseLocker);

  disposables.push(
    coolingVentLightMat,
    ventPanelGeo,
    ventHandleShaftGeo,
    ventHandleGripGeo,
    coolingLamp.geometry,
    fuseWallLightMat,
    fuseBoxGeo,
    fuseSlotGeo,
    fuseWallBeacon.geometry,
    lockerShellGeo,
    lockerDoorGeo,
    lockerFuseCoreGeo,
    fuseLockStripe.geometry,
  );

  disposables.push(
    powerFloorGeo,
    powerRoofGeo,
    turbineHousingGeo,
    intakeRingGeo,
    bladeGeo,
    rotorHubGeo,
    scrubberRingGeo,
    tankBaseGeo,
    waterShellGeo,
    waterCoreGeo,
    matWaterGlow,
    pipeGeo,
    rackFrameGeo,
    rackShelfGeo,
    batCellGeo,
    batLedGeo,
    heaterCoilsMat,
    heaterPadGeo,
    heaterBodyGeo,
    heaterCoilGeo,
    rkPedestalGeo,
    rkCaseGeo,
    rkCrossGeo,
  );

  // ============================================================================
  // 5) COMPARTMENT 3: GREENHOUSE DOME (center 0, -18)
  //    Raised Planter Beds, 3D Martian Potato Plants, & Purple UV Grow-Lights
  // ============================================================================
  const greenPlinthGeo = new THREE.CylinderGeometry(6.8, 7.2, 0.72, 24);
  const greenPlinth = new THREE.Mesh(greenPlinthGeo, matDarkSteel);
  greenPlinth.position.set(0, -0.07, -18.0); // top at +0.29, strictly below greenFloor
  greenPlinth.receiveShadow = true;
  group.add(greenPlinth);

  const greenFloorGeo = new THREE.CylinderGeometry(6.5, 6.5, 0.14, 24);
  const greenFloor = new THREE.Mesh(greenFloorGeo, matFloor);
  greenFloor.position.set(0, HUB_FLOOR_Y - 0.07, -18.0); // top at HUB_FLOOR_Y
  greenFloor.receiveShadow = true;
  group.add(greenFloor);

  const greenArcGeo = new THREE.CylinderGeometry(6.65, 6.65, 1.8, 16, 1, true, Math.PI * 0.16, Math.PI * 1.68);
  const greenArc = new THREE.Mesh(greenArcGeo, wallArcMat);
  greenArc.position.set(0, HUB_FLOOR_Y + 0.9, -18.0);
  greenArc.castShadow = true;
  group.add(greenArc);

  const greenDomeGeo = new THREE.SphereGeometry(6.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const greenDome = new THREE.Mesh(greenDomeGeo, matGlassDome);
  greenDome.position.set(0, HUB_FLOOR_Y + 0.2, -18.0);
  greenDome.renderOrder = 2;
  group.add(greenDome);

  // Micro-Meteorite Glass Crack Clusters & Air Leak Visual on Greenhouse Dome
  const greenhouseCracksGroup = new THREE.Group();
  greenhouseCracksGroup.position.set(0, HUB_FLOOR_Y + 0.2, -18.0);
  greenhouseCracksGroup.visible = false;
  const crackMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe', side: THREE.DoubleSide });
  const crackRayGeo = new THREE.BoxGeometry(0.1, 2.35, 0.08);
  const leakRingGeo = new THREE.TorusGeometry(0.75, 0.07, 8, 20);
  [
    [0, 5.2, 4.0, 0.65, 0],
    [-2.8, 4.9, 2.9, 0.55, -0.55],
    [2.7, 5.0, 3.1, 0.58, 0.52],
  ].forEach(([cx, cy, cz, rx, ry]) => {
    const cluster = new THREE.Group();
    cluster.position.set(cx, cy, cz);
    cluster.rotation.set(rx, ry, 0);
    for (let k = 0; k < 5; k++) {
      const ray = new THREE.Mesh(crackRayGeo, crackMat);
      ray.rotation.z = (k / 5) * Math.PI + 0.2;
      cluster.add(ray);
    }
    const leakHalo = new THREE.Mesh(leakRingGeo, matCyanGlow);
    cluster.add(leakHalo);
    greenhouseCracksGroup.add(cluster);
  });
  group.add(greenhouseCracksGroup);
  disposables.push(crackMat, crackRayGeo, leakRingGeo);

  const greenRibGeo = new THREE.TorusGeometry(6.65, 0.13, 8, 32, Math.PI);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(greenRibGeo, i === 1 ? matOrange : matWallWhite);
    rib.position.set(0, HUB_FLOOR_Y + 0.2, -18.0);
    rib.rotation.y = (i / 3) * Math.PI + 0.25;
    group.add(rib);
  }

  // Raised Hydroponic Planter Beds, 3D Martian Potato Plants, & Purple UV Grow-Lights
  const bedFrameGeo = new THREE.BoxGeometry(2.2, 0.62, 5.4);
  const bedSoilGeo = new THREE.BoxGeometry(1.96, 0.18, 5.16);
  const soilMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.94 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.65 });
  const potatoMat = new THREE.MeshStandardMaterial({ color: '#d4a359', roughness: 0.8 });
  const blossomMat = new THREE.MeshStandardMaterial({
    color: '#f3e8ff',
    emissive: '#c084fc',
    emissiveIntensity: 0.5,
  });
  const matUvGlow = new THREE.MeshStandardMaterial({
    color: '#e879f9',
    emissive: '#a855f7',
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  const soilMoundGeo = new THREE.CylinderGeometry(0.42, 0.62, 0.22, 10);
  const potatoGeo = new THREE.SphereGeometry(0.15, 8, 8);
  potatoGeo.scale(1.35, 0.85, 1.0);
  const stalkGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.72, 6);
  const leafClusterGeo = new THREE.DodecahedronGeometry(0.28, 0);
  const blossomGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const lampPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8);
  const lampHoodGeo = new THREE.BoxGeometry(1.1, 0.16, 4.6);
  const uvTubeGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.3, 8);
  uvTubeGeo.rotateX(Math.PI / 2);

  [-3.8, 3.8].forEach((bx) => {
    // Raised Planter Frame & Compost Soil
    const bedFrame = new THREE.Mesh(bedFrameGeo, matWallWhite);
    bedFrame.position.set(bx, HUB_FLOOR_Y + 0.31, -18.4);
    bedFrame.castShadow = true;
    bedFrame.receiveShadow = true;
    group.add(bedFrame);

    const soil = new THREE.Mesh(bedSoilGeo, soilMat);
    soil.position.set(bx, HUB_FLOOR_Y + 0.62, -18.4);
    soil.receiveShadow = true;
    group.add(soil);

    // 3 Detailed 3D Martian Potato Plants per Raised Bed
    [-16.6, -18.4, -20.2].forEach((pz, pIdx) => {
      const plant = new THREE.Group();
      plant.position.set(bx, HUB_FLOOR_Y + 0.7, pz);
      plant.rotation.y = pIdx * 1.1;

      const mound = new THREE.Mesh(soilMoundGeo, soilMat);
      mound.position.y = 0.08;
      plant.add(mound);

      // Visible Golden Martian Potatoes nestled in the mound!
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2 + 0.3;
        const tater = new THREE.Mesh(potatoGeo, potatoMat);
        tater.position.set(Math.cos(ang) * 0.34, 0.1, Math.sin(ang) * 0.34);
        tater.rotation.y = ang;
        plant.add(tater);
      }

      // Branching Green Potato Stalks, Foliage & Purple Blossoms
      for (let s = 0; s < 3; s++) {
        const ang = (s / 3) * Math.PI * 2;
        const stalk = new THREE.Mesh(stalkGeo, leafMat);
        stalk.position.set(Math.cos(ang) * 0.14, 0.45, Math.sin(ang) * 0.14);
        stalk.rotation.z = Math.cos(ang) * -0.22;
        stalk.rotation.x = Math.sin(ang) * 0.22;
        plant.add(stalk);

        const leaves = new THREE.Mesh(leafClusterGeo, leafMat);
        leaves.position.set(Math.cos(ang) * 0.25, 0.78, Math.sin(ang) * 0.25);
        leaves.scale.set(1.2, 0.85, 1.2);
        plant.add(leaves);

        const flower = new THREE.Mesh(blossomGeo, blossomMat);
        flower.position.set(Math.cos(ang) * 0.25, 1.0, Math.sin(ang) * 0.25);
        plant.add(flower);
      }
      group.add(plant);
    });

    // Overhead Purple UV Grow-Light Frame & Glowing UV Tubes
    [-16.2, -20.6].forEach((lz) => {
      const post = new THREE.Mesh(lampPostGeo, matDarkSteel);
      post.position.set(bx, HUB_FLOOR_Y + 1.65, lz);
      group.add(post);
    });

    const hood = new THREE.Mesh(lampHoodGeo, matDarkSteel);
    hood.position.set(bx, HUB_FLOOR_Y + 2.82, -18.4);
    group.add(hood);

    [-0.26, 0.26].forEach((tx) => {
      const uvTube = new THREE.Mesh(uvTubeGeo, matUvGlow);
      uvTube.position.set(bx + tx, HUB_FLOOR_Y + 2.72, -18.4);
      group.add(uvTube);
    });

    const uvPoint = new THREE.PointLight('#c084fc', 1.8, 10, 1.5);
    uvPoint.position.set(bx, HUB_FLOOR_Y + 2.55, -18.4);
    group.add(uvPoint);
    uvLights.push(uvPoint);
  });

  const greenLight = new THREE.PointLight('#4ade80', 1.9, 18, 1.4);
  greenLight.position.set(0, 4.4, -18.0);
  group.add(greenLight);
  interiorLights.push(greenLight);

  disposables.push(
    greenPlinthGeo,
    greenFloorGeo,
    greenArcGeo,
    greenDomeGeo,
    greenRibGeo,
    bedFrameGeo,
    bedSoilGeo,
    soilMat,
    leafMat,
    potatoMat,
    blossomMat,
    matUvGlow,
    soilMoundGeo,
    potatoGeo,
    stalkGeo,
    leafClusterGeo,
    blossomGeo,
    lampPostGeo,
    lampHoodGeo,
    uvTubeGeo,
  );

  // ============================================================================
  // 6) COMPARTMENT 4: LEAD-LINED UNDERGROUND STORM BUNKER + RAMP (x = 7.8..25.4)
  // ============================================================================
  const rampLength = RAMP_END_X - RAMP_START_X; // 7.4
  const rampDrop = HUB_FLOOR_Y - BUNKER_FLOOR_Y; // 3.65
  const rampHyp = Math.hypot(rampLength, rampDrop);
  const rampAngle = Math.atan2(rampDrop, rampLength);

  const rampFloorGeo = new THREE.BoxGeometry(rampHyp + 0.4, 0.45, 4.6);
  const rampFloor = new THREE.Mesh(rampFloorGeo, matDarkSteel);
  rampFloor.position.set(
    (RAMP_START_X + RAMP_END_X) * 0.5,
    (HUB_FLOOR_Y + BUNKER_FLOOR_Y) * 0.5 - 0.22,
    0,
  );
  rampFloor.rotation.z = -rampAngle;
  rampFloor.receiveShadow = true;
  group.add(rampFloor);

  // Sloped Armored Ramp Ceiling Cover
  const rampRoof = new THREE.Mesh(rampFloorGeo, matLeadBunker);
  rampRoof.position.set(
    (RAMP_START_X + RAMP_END_X) * 0.5,
    (HUB_FLOOR_Y + BUNKER_FLOOR_Y) * 0.5 + 3.45,
    0,
  );
  rampRoof.rotation.z = -rampAngle;
  rampRoof.castShadow = true;
  group.add(rampRoof);

  // Glowing Orange LED Guide Strip & Step Strips down the Bunker Ramp
  const rampStripDist = Math.hypot(rampLength, rampDrop);
  addEmbeddedFloorStrip(
    (RAMP_START_X + RAMP_END_X) * 0.5,
    (HUB_FLOOR_Y + BUNKER_FLOOR_Y) * 0.5,
    0,
    rampStripDist,
    true,
    ledMaterials.bunker,
    -rampAngle,
  );

  const stepGeo = new THREE.BoxGeometry(0.16, 0.04, 4.0);
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const sx = RAMP_START_X + rampLength * t;
    const sy = HUB_FLOOR_Y - rampDrop * t + 0.03;
    const strip = new THREE.Mesh(stepGeo, matAmberGlow);
    strip.position.set(sx, sy, 0);
    strip.rotation.z = -rampAngle;
    group.add(strip);
  }

  // Underground Bunker Floor & Armored Surface-Level Ceiling
  const bunkerFloorGeo = new THREE.BoxGeometry(10.6, 0.5, 10.6);
  const bunkerFloor = new THREE.Mesh(bunkerFloorGeo, matDarkSteel);
  bunkerFloor.position.set(20.3, BUNKER_FLOOR_Y - 0.25, 0);
  bunkerFloor.receiveShadow = true;
  group.add(bunkerFloor);

  // Orange LED Guide Strip continuing into the Storm Bunker floor
  addEmbeddedFloorStrip(17.7, BUNKER_FLOOR_Y, 0, 5.2, true, ledMaterials.bunker);

  const bunkerRoofGeo = new THREE.BoxGeometry(11.0, 0.75, 11.2);
  const bunkerRoof = new THREE.Mesh(bunkerRoofGeo, matLeadBunker);
  bunkerRoof.position.set(20.3, 0.5, 0);
  bunkerRoof.castShadow = true;
  bunkerRoof.receiveShadow = true;
  group.add(bunkerRoof);

  // Exterior Roof Hatch & Hazard Beacon on top of the Storm Bunker
  const hatchGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.45, 8);
  const hatch = new THREE.Mesh(hatchGeo, matHazardYellow);
  hatch.position.set(20.3, 1.05, 0);
  group.add(hatch);

  // Bunker Interior Props: Two-Tier Cozy Bunk Beds, Storm Monitor Console & Supply Crates
  const bunkPostGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.35, 8);
  const bunkDeckGeo = new THREE.BoxGeometry(3.2, 0.14, 1.45);
  const mattressGeo = new THREE.BoxGeometry(2.95, 0.24, 1.3);
  const pillowGeo = new THREE.BoxGeometry(0.55, 0.16, 0.95);
  const ladderRailGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6);
  const matSkyBedding = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.78 });
  const matWarmBlanket = new THREE.MeshStandardMaterial({ color: '#fb923c', roughness: 0.78 });

  [-3.8, 3.8].forEach((bz, bIdx) => {
    const bunkGroup = new THREE.Group();
    bunkGroup.position.set(20.6, BUNKER_FLOOR_Y, bz);

    // 4 Steel Corner Posts
    [-1.5, 1.5].forEach((px) => {
      [-0.65, 0.65].forEach((pz) => {
        const post = new THREE.Mesh(bunkPostGeo, matDarkSteel);
        post.position.set(px, 1.18, pz);
        bunkGroup.add(post);
      });
    });

    // Lower & Upper Bunk Decks, Mattresses & Pillows
    [0.45, 1.65].forEach((by, tier) => {
      const deck = new THREE.Mesh(bunkDeckGeo, matDarkSteel);
      deck.position.y = by;
      bunkGroup.add(deck);

      const mattress = new THREE.Mesh(mattressGeo, (tier + bIdx) % 2 === 0 ? matWarmBlanket : matSkyBedding);
      mattress.position.y = by + 0.18;
      bunkGroup.add(mattress);

      const pillow = new THREE.Mesh(pillowGeo, matWallWhite);
      pillow.position.set(1.1, by + 0.34, 0);
      bunkGroup.add(pillow);
    });

    // Climbing Ladder on aisle side
    const sideSign = bz < 0 ? 1 : -1;
    [-0.95, -0.45].forEach((lx) => {
      const rail = new THREE.Mesh(ladderRailGeo, matHazardYellow);
      rail.position.set(lx, 1.1, sideSign * 0.74);
      bunkGroup.add(rail);
    });
    group.add(bunkGroup);
  });

  // Reinforced Corner Supply Crates + Heavy Vault Bulkhead Panel on East Wall
  const crateGeo = new THREE.BoxGeometry(1.3, 1.1, 1.3);
  [
    [17.3, -3.85],
    [17.3, 3.85],
  ].forEach(([cx, cz]) => {
    const crate = new THREE.Mesh(crateGeo, matOrange);
    crate.position.set(cx, BUNKER_FLOOR_Y + 0.55, cz);
    crate.castShadow = true;
    group.add(crate);
  });

  const stormConsoleBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 2.6), matDarkSteel);
  stormConsoleBase.position.set(24.4, BUNKER_FLOOR_Y + 0.55, 0);
  group.add(stormConsoleBase);

  const stormScreen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 2.3), matAmberGlow);
  stormScreen.position.set(24.8, BUNKER_FLOOR_Y + 1.68, 0);
  group.add(stormScreen);

  // Interactive Blast Door Pull Lever on Bunker West Wall (x = 16.3, z = -1.85)
  const leverBoxGeo = new THREE.BoxGeometry(0.45, 0.85, 0.55);
  const leverShaftGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10);
  const leverGripGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10);
  leverGripGeo.rotateX(Math.PI / 2);
  const bunkerLeverLightMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#eab308',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const leverConsole = new THREE.Group();
  leverConsole.position.set(16.25, BUNKER_FLOOR_Y + 1.35, -2.05);
  const leverBox = new THREE.Mesh(leverBoxGeo, matDarkSteel);
  leverConsole.add(leverBox);
  const leverLamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.32), bunkerLeverLightMat);
  leverLamp.position.set(0, 0.52, 0);
  leverConsole.add(leverLamp);

  const bunkerLeverHandle = new THREE.Group();
  bunkerLeverHandle.position.set(0, 0.05, 0.26);
  bunkerLeverHandle.rotation.x = -0.55; // up position (pull down to +0.75)
  const leverShaft = new THREE.Mesh(leverShaftGeo, matWallWhite);
  leverShaft.position.y = 0.34;
  bunkerLeverHandle.add(leverShaft);
  const leverGrip = new THREE.Mesh(leverGripGeo, matOrange);
  leverGrip.position.y = 0.7;
  bunkerLeverHandle.add(leverGrip);
  leverConsole.add(bunkerLeverHandle);
  group.add(leverConsole);
  disposables.push(leverBoxGeo, leverShaftGeo, leverGripGeo, bunkerLeverLightMat, leverLamp.geometry);

  const bunkerLight = new THREE.PointLight('#fbbf24', 2.4, 18, 1.3);
  bunkerLight.position.set(20.3, -0.4, 0);
  group.add(bunkerLight);
  interiorLights.push(bunkerLight);

  disposables.push(
    rampFloorGeo,
    stepGeo,
    bunkerFloorGeo,
    bunkerRoofGeo,
    hatchGeo,
    bunkPostGeo,
    bunkDeckGeo,
    mattressGeo,
    pillowGeo,
    ladderRailGeo,
    matSkyBedding,
    matWarmBlanket,
    crateGeo,
    stormConsoleBase.geometry,
    stormScreen.geometry,
  );

  // ============================================================================
  // 7) COMPARTMENT 5: AIRLOCK & SUIT BAY -> EXTERIOR YARD (z = 12..36)
  //    Glowing Suit-Up Booth on West Side + Spare Suit Racks on East Side
  // ============================================================================
  const airlockFloorGeo = new THREE.BoxGeometry(10.2, 0.55, 7.8);
  const airlockFloor = new THREE.Mesh(airlockFloorGeo, matFloor);
  airlockFloor.position.set(0, HUB_FLOOR_Y - 0.275, 15.8);
  airlockFloor.receiveShadow = true;
  group.add(airlockFloor);

  const airlockRoofGeo = new THREE.BoxGeometry(10.4, 0.35, 8.0);
  const airlockRoof = new THREE.Mesh(airlockRoofGeo, matWallWhite);
  airlockRoof.position.set(0, 4.4, 15.8);
  airlockRoof.castShadow = true;
  group.add(airlockRoof);

  // Decontamination Arch & Airlock Blast Door Frame
  const gateArchGeo = new THREE.TorusGeometry(2.35, 0.22, 8, 18, Math.PI);
  const gateArchInner = new THREE.Mesh(gateArchGeo, matCyanGlow);
  gateArchInner.position.set(0, HUB_FLOOR_Y + 1.4, 12.2);
  group.add(gateArchInner);

  const gateArchOuter = new THREE.Mesh(gateArchGeo, matOrange);
  gateArchOuter.position.set(0, HUB_FLOOR_Y + 1.4, 19.5);
  group.add(gateArchOuter);

  // Glowing Suit-Up Booth (West Wall: x = -3.7, z = 15.8)
  const boothPadGeo = new THREE.CylinderGeometry(1.45, 1.55, 0.14, 24);
  const boothRingGeo = new THREE.TorusGeometry(1.38, 0.08, 8, 28);
  boothRingGeo.rotateX(Math.PI / 2);
  const boothShellGeo = new THREE.CylinderGeometry(1.25, 1.25, 2.75, 18, 1, true, -Math.PI * 0.65, Math.PI * 1.3);
  const boothPillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.85, 8);
  const boothArmGeo = new THREE.BoxGeometry(0.55, 0.1, 0.1);

  const suitBooth = new THREE.Group();
  suitBooth.position.set(-3.75, HUB_FLOOR_Y, 15.8);

  const boothBase = new THREE.Mesh(boothPadGeo, matDarkSteel);
  boothBase.position.y = 0.07;
  suitBooth.add(boothBase);

  const suitBoothRing = new THREE.Mesh(boothRingGeo, matCyanGlow);
  suitBoothRing.position.y = 0.16;
  suitBooth.add(suitBoothRing);

  const boothCanopy = new THREE.Mesh(boothPadGeo, matDarkSteel);
  boothCanopy.position.y = 2.95;
  suitBooth.add(boothCanopy);

  const boothTopGlow = new THREE.Mesh(boothRingGeo, matCyanGlow);
  boothTopGlow.position.y = 2.86;
  suitBooth.add(boothTopGlow);

  const boothGlass = new THREE.Mesh(boothShellGeo, matGlassDome);
  boothGlass.position.y = 1.52;
  boothGlass.rotation.y = Math.PI;
  boothGlass.renderOrder = 2;
  suitBooth.add(boothGlass);

  [-0.95, 0.95].forEach((pz) => {
    const pillar = new THREE.Mesh(boothPillarGeo, matCyanGlow);
    pillar.position.set(0.35, 1.5, pz);
    suitBooth.add(pillar);

    const arm = new THREE.Mesh(boothArmGeo, matOrange);
    arm.position.set(0.05, 1.45, pz * 0.58);
    suitBooth.add(arm);
  });

  // Hero Display Spacesuit inside the Suit-Up Booth
  const suitDummyGeo = new THREE.CapsuleGeometry(0.24, 0.7, 6, 10);
  const suitHelmetGeo = new THREE.SphereGeometry(0.25, 12, 10);
  const heroSuit = new THREE.Mesh(suitDummyGeo, matWallWhite);
  heroSuit.position.set(-0.25, 1.25, 0);
  suitBooth.add(heroSuit);
  const heroVisor = new THREE.Mesh(suitHelmetGeo, matAmberGlow);
  heroVisor.position.set(-0.25, 2.02, 0);
  suitBooth.add(heroVisor);
  group.add(suitBooth);

  // Spare Spacesuit Lockers along East wall of Suit Bay (x = 4.1)
  const lockerGeo = new THREE.BoxGeometry(0.95, 2.3, 1.3);
  [14.2, 17.2].forEach((lz) => {
    const locker = new THREE.Mesh(lockerGeo, matDarkSteel);
    locker.position.set(4.1, HUB_FLOOR_Y + 1.15, lz);
    group.add(locker);

    const suit = new THREE.Mesh(suitDummyGeo, matOrange);
    suit.position.set(3.55, HUB_FLOOR_Y + 0.95, lz);
    group.add(suit);

    const helm = new THREE.Mesh(suitHelmetGeo, matWallWhite);
    helm.position.set(3.55, HUB_FLOOR_Y + 1.75, lz);
    group.add(helm);
  });

  const airlockLight = new THREE.PointLight('#7dd3fc', 2.0, 16, 1.4);
  airlockLight.position.set(0, 3.8, 15.8);
  group.add(airlockLight);
  interiorLights.push(airlockLight);

  disposables.push(boothPadGeo, boothRingGeo, boothShellGeo, boothPillarGeo, boothArmGeo);

  // Exterior Entry Ramp (z = 19.6 .. 22.8, sloped HUB_FLOOR_Y -> 0)
  const extLen = EXT_RAMP_END_Z - EXT_RAMP_START_Z;
  const extHyp = Math.hypot(extLen, HUB_FLOOR_Y);
  const extAngle = Math.atan2(HUB_FLOOR_Y, extLen);
  const extRampGeo = new THREE.BoxGeometry(4.8, 0.35, extHyp + 0.3);
  const extRamp = new THREE.Mesh(extRampGeo, matDarkSteel);
  extRamp.position.set(0, HUB_FLOOR_Y * 0.5 - 0.16, (EXT_RAMP_START_Z + EXT_RAMP_END_Z) * 0.5);
  extRamp.rotation.x = extAngle;
  extRamp.receiveShadow = true;
  group.add(extRamp);

  // Paved Exterior Yard Apron (z = 22.8 .. 35.8)
  const yardTex = createYardApronTexture(maxAnisotropy);
  const yardMat = new THREE.MeshStandardMaterial({
    map: yardTex,
    roughness: 0.76,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const yardGeo = new THREE.BoxGeometry(28, 0.14, 13.5);
  const yard = new THREE.Mesh(yardGeo, yardMat);
  yard.position.set(0, 0.02, 29.4);
  yard.receiveShadow = true;
  group.add(yard);

  // Exterior Yard Floodlight Poles
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 4.8, 8);
  const lampHeadGeo = new THREE.BoxGeometry(0.7, 0.3, 0.45);
  [
    [-12.5, 24.0],
    [12.5, 24.0],
    [-12.5, 34.5],
    [12.5, 34.5],
  ].forEach(([px, pz]) => {
    const pole = new THREE.Mesh(poleGeo, matDarkSteel);
    pole.position.set(px, 2.4, pz);
    pole.castShadow = true;
    group.add(pole);

    const head = new THREE.Mesh(lampHeadGeo, matAmberGlow);
    head.position.set(px, 4.85, pz);
    group.add(head);

    const pLight = new THREE.PointLight('#fde68a', 1.2, 22, 1.5);
    pLight.position.set(px, 4.5, pz);
    group.add(pLight);
    yardLights.push(pLight);
  });

  // ============================================================================
  // 7B) EXTERIOR MARS YARD EQUIPMENT (Solar Array, Comms Dish, Air Fan, Water Tank)
  // ============================================================================

  // 1. Field of 6 Tilting Sun-Tracking Solar Panels (West Yard 2x3 Grid) + Martian Dust Overlays
  const solarTrackers: SolarTrackerRig[] = [];
  const solarTex = createSolarArrayTexture(maxAnisotropy);
  const solarDustTex = createSolarDustTexture(maxAnisotropy);
  const matSolarCells = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.2,
    metalness: 0.45,
  });
  const solarPlinthGeo = new THREE.BoxGeometry(1.15, 0.18, 1.15);
  const solarMastGeo = new THREE.CylinderGeometry(0.13, 0.19, 1.55, 10);
  const solarCollarGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12);
  const solarYokeGeo = new THREE.BoxGeometry(0.7, 0.24, 0.28);
  const solarWingGeo = new THREE.BoxGeometry(2.45, 0.09, 1.75);
  const solarDustGeo = new THREE.PlaneGeometry(2.44, 1.74);
  solarDustGeo.rotateX(-Math.PI / 2);
  const solarFrameGeo = new THREE.BoxGeometry(2.58, 0.06, 1.88);
  const solarConduitGeo = new THREE.BoxGeometry(0.16, 0.05, 9.2);

  [-10.8, -7.6, -4.4].forEach((sx) => {
    const conduit = new THREE.Mesh(solarConduitGeo, matDarkSteel);
    conduit.position.set(sx, 0.115, 27.9);
    group.add(conduit);
  });

  const solarCoords: Array<[number, number]> = [
    [-10.8, 25.6],
    [-7.6, 25.6],
    [-4.4, 25.6],
    [-10.8, 30.2],
    [-7.6, 30.2],
    [-4.4, 30.2],
  ];

  solarCoords.forEach(([sx, sz], panelIndex) => {
    const trackerRoot = new THREE.Group();
    trackerRoot.position.set(sx, 0.08, sz);

    const plinth = new THREE.Mesh(solarPlinthGeo, matDarkSteel);
    plinth.position.y = 0.09;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    trackerRoot.add(plinth);

    const mast = new THREE.Mesh(solarMastGeo, matWallWhite);
    mast.position.y = 0.92;
    mast.castShadow = true;
    trackerRoot.add(mast);

    const collar = new THREE.Mesh(solarCollarGeo, matOrange);
    collar.position.y = 1.65;
    trackerRoot.add(collar);

    const yawGroup = new THREE.Group();
    yawGroup.position.y = 1.82;
    trackerRoot.add(yawGroup);

    const yoke = new THREE.Mesh(solarYokeGeo, matDarkSteel);
    yawGroup.add(yoke);

    const tiltGroup = new THREE.Group();
    tiltGroup.position.y = 0.12;
    yawGroup.add(tiltGroup);

    const frame = new THREE.Mesh(solarFrameGeo, matDarkSteel);
    frame.castShadow = true;
    tiltGroup.add(frame);

    const panel = new THREE.Mesh(solarWingGeo, matSolarCells);
    panel.position.y = 0.03;
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData.panelIndex = panelIndex;
    tiltGroup.add(panel);

    const dustMat = new THREE.MeshStandardMaterial({
      map: solarDustTex,
      roughness: 0.96,
      metalness: 0.02,
      transparent: true,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const dustMesh = new THREE.Mesh(solarDustGeo, dustMat);
    dustMesh.position.y = 0.082;
    dustMesh.visible = false;
    dustMesh.userData.panelIndex = panelIndex;
    tiltGroup.add(dustMesh);
    disposables.push(dustMat);

    group.add(trackerRoot);
    solarTrackers.push({ yawGroup, tiltGroup, panelMesh: panel, dustMesh, dustMat, dustAmount: 0 });
  });
  disposables.push(solarDustTex, solarDustGeo);

  // Hazard 11: Jammed Martian Pebbles around Solar Tracker #2 at (-4.4, 25.6)
  const pebbleGeo = new THREE.DodecahedronGeometry(0.28, 0);
  const matPebble = new THREE.MeshStandardMaterial({ color: '#9a3412', roughness: 0.92 });
  const solarJamPebbles: THREE.Mesh[] = [];
  const pebbleOffsets: Array<[number, number, number]> = [
    [-0.45, 0.24, 0.38],
    [0.48, 0.22, 0.32],
    [0.05, 0.26, -0.48],
  ];
  pebbleOffsets.forEach(([ox, oy, oz], idx) => {
    const pebble = new THREE.Mesh(pebbleGeo, matPebble);
    pebble.position.set(-4.4 + ox, 0.08 + oy, 25.6 + oz);
    pebble.rotation.set(idx * 0.7, idx * 1.1, idx * 0.4);
    pebble.scale.set(1.15, 0.78, 1.05);
    pebble.castShadow = true;
    pebble.visible = false;
    group.add(pebble);
    solarJamPebbles.push(pebble);
  });
  disposables.push(pebbleGeo, matPebble);

  // Hazard 10: Outdoor Yellow Grounding Switch Station (-5.6, 0.08, 23.0)
  const groundingSwitchLightMat = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#22c55e',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const gndPedestalGeo = new THREE.BoxGeometry(0.95, 1.55, 0.65);
  const gndRodGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.1, 10);
  const groundingStation = new THREE.Group();
  groundingStation.position.set(-5.6, 0.08, 23.0);
  const gndPedestal = new THREE.Mesh(gndPedestalGeo, matHazardYellow);
  gndPedestal.position.y = 0.78;
  gndPedestal.castShadow = true;
  groundingStation.add(gndPedestal);
  const gndRod = new THREE.Mesh(gndRodGeo, matDarkSteel);
  gndRod.position.set(-0.62, 0.55, 0);
  groundingStation.add(gndRod);
  const gndLamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.45), groundingSwitchLightMat);
  gndLamp.position.set(0, 1.66, 0);
  groundingStation.add(gndLamp);

  const groundingSwitchLever = new THREE.Group();
  groundingSwitchLever.position.set(0, 1.05, 0.36);
  groundingSwitchLever.rotation.x = -0.55;
  const gndShaft = new THREE.Mesh(ventHandleShaftGeo, matDarkSteel);
  gndShaft.position.y = 0.3;
  const gndGrip = new THREE.Mesh(ventHandleGripGeo, matOrange);
  gndGrip.position.y = 0.6;
  groundingSwitchLever.add(gndShaft, gndGrip);
  groundingStation.add(groundingSwitchLever);
  group.add(groundingStation);
  disposables.push(groundingSwitchLightMat, gndPedestalGeo, gndRodGeo, gndLamp.geometry);

  // Hazard 12: Exterior Rover Charging Dock Station beside Rookie-1 Rover (6.8, 0.08, 28.4)
  const roverDockLightMat = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#22c55e',
    emissiveIntensity: 1.45,
    roughness: 0.2,
  });
  const dockTowerGeo = new THREE.BoxGeometry(1.15, 2.1, 0.95);
  const dockPadGeo = new THREE.BoxGeometry(1.75, 0.16, 1.65);
  const dockCoilGeo = new THREE.TorusGeometry(0.32, 0.06, 8, 18);
  const roverDockGroup = new THREE.Group();
  roverDockGroup.position.set(6.8, 0.08, 28.4);
  const dockPad = new THREE.Mesh(dockPadGeo, matDarkSteel);
  dockPad.position.y = 0.08;
  roverDockGroup.add(dockPad);
  const dockTower = new THREE.Mesh(dockTowerGeo, matWallWhite);
  dockTower.position.y = 1.1;
  dockTower.castShadow = true;
  roverDockGroup.add(dockTower);
  const dockTrim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 1.0), matOrange);
  dockTrim.position.y = 0.45;
  roverDockGroup.add(dockTrim);
  const dockBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 0.98), roverDockLightMat);
  dockBeacon.position.y = 1.92;
  roverDockGroup.add(dockBeacon);
  const dockCable = new THREE.Mesh(dockCoilGeo, matDarkSteel);
  dockCable.position.set(-0.62, 1.1, 0.15);
  dockCable.rotation.y = Math.PI / 2;
  roverDockGroup.add(dockCable);

  const roverDockSwitchHandle = new THREE.Group();
  roverDockSwitchHandle.position.set(-0.6, 1.25, -0.25);
  roverDockSwitchHandle.rotation.y = -Math.PI / 2;
  roverDockSwitchHandle.rotation.x = -0.5;
  const rdShaft = new THREE.Mesh(ventHandleShaftGeo, matDarkSteel);
  rdShaft.position.y = 0.26;
  const rdGrip = new THREE.Mesh(ventHandleGripGeo, matCyanGlow);
  rdGrip.position.y = 0.54;
  roverDockSwitchHandle.add(rdShaft, rdGrip);
  roverDockGroup.add(roverDockSwitchHandle);
  group.add(roverDockGroup);
  disposables.push(roverDockLightMat, dockTowerGeo, dockPadGeo, dockCoilGeo, dockTrim.geometry, dockBeacon.geometry);

  // 2. Rotating Satellite Comms Dish (East-North Yard at x = 9.85, z = 25.45)
  const dishBasePadGeo = new THREE.CylinderGeometry(1.35, 1.55, 0.24, 8);
  const dishTowerGeo = new THREE.CylinderGeometry(0.32, 0.56, 2.75, 8);
  const dishRingGeo = new THREE.TorusGeometry(0.45, 0.08, 8, 16);
  dishRingGeo.rotateX(Math.PI / 2);
  const dishProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.55, 0.12),
    new THREE.Vector2(1.18, 0.38),
    new THREE.Vector2(1.75, 0.8),
    new THREE.Vector2(1.85, 0.88),
  ];
  const bigDishGeo = new THREE.LatheGeometry(dishProfile, 24);
  const dishFeedStrutGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.48, 8);
  const dishFeedHeadGeo = new THREE.CylinderGeometry(0.14, 0.22, 0.34, 12);
  const dishTurretGeo = new THREE.BoxGeometry(0.95, 0.55, 0.85);

  const commsTower = new THREE.Group();
  commsTower.position.set(9.85, 0.08, 25.45);

  const dishPad = new THREE.Mesh(dishBasePadGeo, matDarkSteel);
  dishPad.position.y = 0.12;
  dishPad.receiveShadow = true;
  commsTower.add(dishPad);

  const dishTower = new THREE.Mesh(dishTowerGeo, matWallWhite);
  dishTower.position.y = 1.6;
  dishTower.castShadow = true;
  commsTower.add(dishTower);

  const dishBand = new THREE.Mesh(dishRingGeo, matOrange);
  dishBand.position.y = 2.45;
  commsTower.add(dishBand);

  const exteriorDishYaw = new THREE.Group();
  exteriorDishYaw.position.y = 3.12;
  commsTower.add(exteriorDishYaw);

  const turretBox = new THREE.Mesh(dishTurretGeo, matDarkSteel);
  turretBox.castShadow = true;
  exteriorDishYaw.add(turretBox);

  const dishAssembly = new THREE.Group();
  dishAssembly.position.set(0, 0.42, 0.25);
  dishAssembly.rotation.x = 0.72;

  const bigDish = new THREE.Mesh(bigDishGeo, matWallWhite);
  bigDish.castShadow = true;
  bigDish.receiveShadow = true;
  dishAssembly.add(bigDish);

  const dishRim = new THREE.Mesh(new THREE.TorusGeometry(1.84, 0.06, 8, 24), matOrange);
  dishRim.rotation.x = Math.PI / 2;
  dishRim.position.y = 0.88;
  dishAssembly.add(dishRim);
  disposables.push(dishRim.geometry);

  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2;
    const strut = new THREE.Mesh(dishFeedStrutGeo, matDarkSteel);
    strut.position.set(Math.cos(a) * 0.62, 0.85, Math.sin(a) * 0.62);
    strut.rotation.z = Math.cos(a) * 0.46;
    strut.rotation.x = -Math.sin(a) * 0.46;
    dishAssembly.add(strut);
  }

  const feedHead = new THREE.Mesh(dishFeedHeadGeo, matCyanGlow);
  feedHead.position.y = 1.52;
  dishAssembly.add(feedHead);

  exteriorDishYaw.add(dishAssembly);
  group.add(commsTower);

  // 3. Exterior Air Intake Fan Unit (Coupled to West Airlock Exterior Wall: x = -6.85, z = 20.55)
  const fanPadGeo = new THREE.BoxGeometry(3.3, 0.2, 2.35);
  const fanHousingGeo = new THREE.BoxGeometry(2.45, 2.25, 1.85);
  const fanDuctGeo = new THREE.BoxGeometry(1.45, 1.25, 1.2);
  const fanShroudGeo = new THREE.TorusGeometry(0.95, 0.16, 12, 24);
  const fanGrilleGeo = new THREE.BoxGeometry(1.75, 0.06, 0.08);
  const fanHubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.26, 12);
  fanHubGeo.rotateX(Math.PI / 2);
  const fanBladeGeo = new THREE.BoxGeometry(0.26, 0.84, 0.05);
  const fanLedStripGeo = new THREE.BoxGeometry(1.6, 0.12, 0.12);

  const airIntakeUnit = new THREE.Group();
  airIntakeUnit.position.set(-6.85, 0.08, 20.55);

  const fanPad = new THREE.Mesh(fanPadGeo, matDarkSteel);
  fanPad.position.y = 0.1;
  fanPad.receiveShadow = true;
  airIntakeUnit.add(fanPad);

  const fanBox = new THREE.Mesh(fanHousingGeo, matWallWhite);
  fanBox.position.y = 1.25;
  fanBox.castShadow = true;
  fanBox.receiveShadow = true;
  airIntakeUnit.add(fanBox);

  const fanDuct = new THREE.Mesh(fanDuctGeo, matDarkSteel);
  fanDuct.position.set(1.45, 1.3, -0.1);
  airIntakeUnit.add(fanDuct);

  const fanLed = new THREE.Mesh(fanLedStripGeo, matGreenGlow);
  fanLed.position.set(0, 2.22, 0.94);
  airIntakeUnit.add(fanLed);

  const fanShroud = new THREE.Mesh(fanShroudGeo, matOrange);
  fanShroud.position.set(0, 1.22, 0.94);
  airIntakeUnit.add(fanShroud);

  [-0.52, -0.18, 0.18, 0.52].forEach((gy) => {
    const bar = new THREE.Mesh(fanGrilleGeo, matDarkSteel);
    bar.position.set(0, 1.22 + gy, 1.06);
    airIntakeUnit.add(bar);
  });

  const exteriorFanRotor = new THREE.Group();
  exteriorFanRotor.position.set(0, 1.22, 0.96);
  exteriorFanRotor.add(new THREE.Mesh(fanHubGeo, matDarkSteel));
  for (let b = 0; b < 5; b++) {
    const bladeWrap = new THREE.Group();
    bladeWrap.rotation.z = (b / 5) * Math.PI * 2;
    const blade = new THREE.Mesh(fanBladeGeo, matCyanGlow);
    blade.position.y = 0.44;
    blade.rotation.y = 0.35;
    bladeWrap.add(blade);
    exteriorFanRotor.add(bladeWrap);
  }
  airIntakeUnit.add(exteriorFanRotor);
  group.add(airIntakeUnit);

  // 4. Exterior Water Storage Tank (East-South Yard at x = 9.85, z = 31.6)
  const wTankPadGeo = new THREE.BoxGeometry(4.2, 0.2, 2.9);
  const wTankSaddleGeo = new THREE.BoxGeometry(0.45, 0.85, 2.1);
  const wTankBodyGeo = new THREE.CylinderGeometry(1.08, 1.08, 2.65, 22);
  wTankBodyGeo.rotateZ(Math.PI / 2);
  const wTankCapGeo = new THREE.SphereGeometry(1.08, 18, 14);
  const wTankBandGeo = new THREE.TorusGeometry(1.11, 0.07, 8, 24);
  wTankBandGeo.rotateY(Math.PI / 2);
  const wTankSightGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.55, 12);
  const wTankGlassGeo = new THREE.CylinderGeometry(0.19, 0.19, 1.62, 12);
  const wTankPipeGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.6, 10);

  const extWaterUnit = new THREE.Group();
  extWaterUnit.position.set(9.85, 0.08, 31.6);

  const wTankPad = new THREE.Mesh(wTankPadGeo, matDarkSteel);
  wTankPad.position.y = 0.1;
  wTankPad.receiveShadow = true;
  extWaterUnit.add(wTankPad);

  [-1.05, 1.05].forEach((sx) => {
    const saddle = new THREE.Mesh(wTankSaddleGeo, matDarkSteel);
    saddle.position.set(sx, 0.6, 0);
    saddle.castShadow = true;
    extWaterUnit.add(saddle);

    const band = new THREE.Mesh(wTankBandGeo, matOrange);
    band.position.set(sx, 1.55, 0);
    extWaterUnit.add(band);
  });

  const wTankBody = new THREE.Mesh(wTankBodyGeo, matWallWhite);
  wTankBody.position.y = 1.55;
  wTankBody.castShadow = true;
  wTankBody.receiveShadow = true;
  extWaterUnit.add(wTankBody);

  [-1.32, 1.32].forEach((ex) => {
    const cap = new THREE.Mesh(wTankCapGeo, matWallWhite);
    cap.position.set(ex, 1.55, 0);
    cap.scale.set(0.55, 1, 1);
    cap.castShadow = true;
    extWaterUnit.add(cap);
  });

  // Glowing Blue Water Level Sight-Glass on the West-facing front side
  const sightCore = new THREE.Mesh(wTankSightGeo, matWaterGlow);
  sightCore.position.set(-1.95, 1.45, 0.45);
  extWaterUnit.add(sightCore);
  waterTankCores.push(sightCore);

  const sightGlass = new THREE.Mesh(wTankGlassGeo, matGlassDome);
  sightGlass.position.set(-1.95, 1.45, 0.45);
  sightGlass.renderOrder = 2;
  extWaterUnit.add(sightGlass);

  const feedPipe = new THREE.Mesh(wTankPipeGeo, matDarkSteel);
  feedPipe.position.set(-1.55, 0.9, -0.7);
  extWaterUnit.add(feedPipe);

  const topHatch = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.24, 12), matOrange);
  topHatch.position.set(0, 2.7, 0);
  extWaterUnit.add(topHatch);
  disposables.push(topHatch.geometry);

  group.add(extWaterUnit);

  disposables.push(
    solarTex,
    matSolarCells,
    solarPlinthGeo,
    solarMastGeo,
    solarCollarGeo,
    solarYokeGeo,
    solarWingGeo,
    solarFrameGeo,
    solarConduitGeo,
    dishBasePadGeo,
    dishTowerGeo,
    dishRingGeo,
    bigDishGeo,
    dishFeedStrutGeo,
    dishFeedHeadGeo,
    dishTurretGeo,
    fanPadGeo,
    fanHousingGeo,
    fanDuctGeo,
    fanShroudGeo,
    fanGrilleGeo,
    fanHubGeo,
    fanBladeGeo,
    fanLedStripGeo,
    wTankPadGeo,
    wTankSaddleGeo,
    wTankBodyGeo,
    wTankCapGeo,
    wTankBandGeo,
    wTankSightGeo,
    wTankGlassGeo,
    wTankPipeGeo,
  );

  // ============================================================================
  // 8) AUTOMATIC BI-PARTING SLIDING SCI-FI DOORS BETWEEN ALL COMPARTMENTS
  // ============================================================================
  const doors: SlidingDoorRig[] = [];
  const doorLightningArcs: THREE.Group[] = [];
  const frameJambGeo = new THREE.BoxGeometry(0.42, 3.25, 0.44);
  const frameHeaderGeo = new THREE.BoxGeometry(4.5, 0.44, 0.48);
  const leafPanelGeo = new THREE.BoxGeometry(1.62, 2.8, 0.14);
  const leafTrimGeo = new THREE.BoxGeometry(1.5, 0.26, 0.17);
  const leafGlassGeo = new THREE.BoxGeometry(0.86, 0.96, 0.16);
  const leafSeamGeo = new THREE.BoxGeometry(0.08, 2.7, 0.18);
  const statusBarGeo = new THREE.BoxGeometry(1.1, 0.12, 0.52);
  const arcSegGeo = new THREE.BoxGeometry(0.95, 0.085, 0.085);
  const arcMat = new THREE.MeshBasicMaterial({ color: '#7dd3fc' });

  disposables.push(
    frameJambGeo,
    frameHeaderGeo,
    leafPanelGeo,
    leafTrimGeo,
    leafGlassGeo,
    leafSeamGeo,
    statusBarGeo,
    arcSegGeo,
    arcMat,
  );

  const buildSlidingDoor = (
    id: string,
    room: RoomId,
    x: number,
    y: number,
    z: number,
    axis: 'x' | 'z',
    accentMat: THREE.MeshStandardMaterial,
    isHeavyBlastDoor = false,
  ) => {
    const doorRoot = new THREE.Group();
    doorRoot.position.set(x, y, z);
    if (axis === 'x') {
      doorRoot.rotation.y = Math.PI / 2;
    }

    // Heavy Dark Steel Frame (left jamb, right jamb, top header)
    const leftJamb = new THREE.Mesh(frameJambGeo, isHeavyBlastDoor ? matLeadBunker : matDarkSteel);
    leftJamb.position.set(-2.02, 1.625, 0);
    leftJamb.scale.set(isHeavyBlastDoor ? 1.3 : 1, 1, isHeavyBlastDoor ? 1.45 : 1);
    leftJamb.castShadow = true;
    doorRoot.add(leftJamb);

    const rightJamb = new THREE.Mesh(frameJambGeo, isHeavyBlastDoor ? matLeadBunker : matDarkSteel);
    rightJamb.position.set(2.02, 1.625, 0);
    rightJamb.scale.set(isHeavyBlastDoor ? 1.3 : 1, 1, isHeavyBlastDoor ? 1.45 : 1);
    rightJamb.castShadow = true;
    doorRoot.add(rightJamb);

    const header = new THREE.Mesh(frameHeaderGeo, isHeavyBlastDoor ? matLeadBunker : matDarkSteel);
    header.position.set(0, 3.04, 0);
    header.scale.set(1, 1, isHeavyBlastDoor ? 1.45 : 1);
    header.castShadow = true;
    doorRoot.add(header);

    const statusMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0ea5e9',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    disposables.push(statusMat);

    const headerStatus = new THREE.Mesh(statusBarGeo, statusMat);
    headerStatus.position.set(0, 3.05, 0);
    if (isHeavyBlastDoor) headerStatus.scale.set(1.2, 1.2, 1.45);
    doorRoot.add(headerStatus);

    // Bi-Parting Left & Right Leaves (thick reinforced armor for Storm Bunker Blast Door)
    const createLeaf = (side: -1 | 1) => {
      const leaf = new THREE.Group();
      leaf.position.set(side * 0.81, 1.4, 0);

      const panel = new THREE.Mesh(leafPanelGeo, isHeavyBlastDoor ? matLeadBunker : matWallWhite);
      if (isHeavyBlastDoor) panel.scale.set(1, 1, 2.75);
      panel.castShadow = true;
      panel.receiveShadow = true;
      leaf.add(panel);

      const stripe = new THREE.Mesh(leafTrimGeo, isHeavyBlastDoor ? matHazardYellow : accentMat);
      stripe.position.y = -0.78;
      if (isHeavyBlastDoor) stripe.scale.set(1, 1.2, 2.55);
      leaf.add(stripe);

      if (isHeavyBlastDoor) {
        const upperBoltBar = new THREE.Mesh(leafTrimGeo, matOrange);
        upperBoltBar.position.y = 0.72;
        upperBoltBar.scale.set(0.95, 0.8, 2.55);
        leaf.add(upperBoltBar);
      } else {
        const win = new THREE.Mesh(leafGlassGeo, matDoorGlass);
        win.position.set(side * -0.1, 0.42, 0);
        win.renderOrder = 2;
        leaf.add(win);
      }

      const seam = new THREE.Mesh(leafSeamGeo, statusMat);
      seam.position.x = side * -0.78;
      if (isHeavyBlastDoor) seam.scale.set(1.3, 1, 2.55);
      leaf.add(seam);

      doorRoot.add(leaf);
      return leaf;
    };

    const leftLeaf = createLeaf(-1);
    const rightLeaf = createLeaf(1);

    // Blue Static Lightning Arcs crackling across doorway (Hazard 10)
    const doorArcGroup = new THREE.Group();
    doorArcGroup.visible = false;
    [
      [-1.05, 1.9, 0.26, 0.35],
      [0.0, 2.15, 0.28, -0.28],
      [1.05, 1.75, 0.26, 0.4],
      [-0.45, 1.1, -0.26, -0.35],
      [0.65, 1.3, -0.26, 0.3],
    ].forEach(([ax, ay, az, rotZ]) => {
      const seg = new THREE.Mesh(arcSegGeo, arcMat);
      seg.position.set(ax, ay, az);
      seg.rotation.z = rotZ;
      doorArcGroup.add(seg);
    });
    doorRoot.add(doorArcGroup);
    doorLightningArcs.push(doorArcGroup);

    group.add(doorRoot);

    const colliderBox: WallBox =
      axis === 'z'
        ? { minX: x - 2.15, maxX: x + 2.15, minZ: z - 0.34, maxZ: z + 0.34, minY: y, maxY: y + 3.25 }
        : { minX: x - 0.34, maxX: x + 0.34, minZ: z - 2.15, maxZ: z + 2.15, minY: y, maxY: y + 3.25 };

    doors.push({
      id,
      room,
      x,
      y,
      z,
      axis,
      leftLeaf,
      rightLeaf,
      statusMat,
      openAmount: 0,
      targetOpen: false,
      soundCooldown: 0,
      colliderBox,
    });
  };

  buildSlidingDoor('power_door', 'power', -13.1, HUB_FLOOR_Y, 0, 'x', ledMaterials.power);
  buildSlidingDoor('greenhouse_door', 'greenhouse', 0, HUB_FLOOR_Y, -12.1, 'z', ledMaterials.greenhouse);
  buildSlidingDoor('bunker_door', 'bunker', 15.3, BUNKER_FLOOR_Y, 0, 'x', ledMaterials.bunker, true);
  buildSlidingDoor('airlock_inner_door', 'airlock', 0, HUB_FLOOR_Y, 12.1, 'z', ledMaterials.airlock);
  buildSlidingDoor('airlock_outer_door', 'airlock', 0, HUB_FLOOR_Y, 19.5, 'z', matOrange);

  // ============================================================================
  // 9) PER-ROOM EMERGENCY STABILIZATION TERMINALS & HOVERING ALERT BEACONS
  // ============================================================================
  const padRingGeo = new THREE.TorusGeometry(1.15, 0.08, 8, 28);
  padRingGeo.rotateX(Math.PI / 2);
  const beaconCrystalGeo = new THREE.OctahedronGeometry(0.55, 0);
  const beaconHaloGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
  beaconHaloGeo.rotateX(Math.PI / 2);
  disposables.push(padRingGeo, beaconCrystalGeo, beaconHaloGeo);

  const createRoomEmergencyBeacon = (room: RoomId, x: number, y: number, z: number) => {
    const padRing = new THREE.Mesh(padRingGeo, ledMaterials[room]);
    padRing.position.set(x, y + 0.04, z);
    group.add(padRing);

    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(x, y + 1.85, z);
    beaconGroup.visible = false;

    const crystal = new THREE.Mesh(beaconCrystalGeo, ledMaterials[room]);
    beaconGroup.add(crystal);

    const halo = new THREE.Mesh(beaconHaloGeo, ledMaterials[room]);
    beaconGroup.add(halo);

    group.add(beaconGroup);
    return beaconGroup;
  };

  const roomBeacons: Record<RoomId, THREE.Group> = {
    power: createRoomEmergencyBeacon('power', -18.5, HUB_FLOOR_Y, 0),
    greenhouse: createRoomEmergencyBeacon('greenhouse', 0, HUB_FLOOR_Y, -18.0),
    bunker: createRoomEmergencyBeacon('bunker', 20.3, BUNKER_FLOOR_Y, 0),
    airlock: createRoomEmergencyBeacon('airlock', 0, HUB_FLOOR_Y, 15.8),
  };

  const roomLights: Record<RoomId, THREE.PointLight> = {
    power: powerLight,
    greenhouse: greenLight,
    bunker: bunkerLight,
    airlock: airlockLight,
  };

  // ============================================================================
  // 10) CADET ORIENTATION: GLOWING BLUE LOCK RINGS, 3D HOLOGRAM CARDS, ARROWS & SHUTTERS
  // ============================================================================
  const createRoomHoloTexture = (room: RoomId): THREE.CanvasTexture => {
    const card = ROOM_ORIENTATION_CARDS[room];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(8, 28, 52, 0.94)';
    ctx.fillRect(0, 0, 512, 300);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    for (let y = 0; y < 300; y += 8) {
      ctx.fillRect(0, y, 512, 2);
    }

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 284);

    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(22, 20, 468, 46);
    ctx.fillStyle = '#041224';
    ctx.font = 'bold 23px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED · STEP ON RING', 256, 51);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 31px sans-serif';
    ctx.fillText(card.title.toUpperCase(), 256, 122);

    ctx.fillStyle = card.accentHex;
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(card.stripLabel, 256, 168);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '600 20px sans-serif';
    ctx.fillText('Inspect 3D Hologram Card to Unlock', 256, 224);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const lockTorusGeo = new THREE.TorusGeometry(1.32, 0.085, 10, 32);
  lockTorusGeo.rotateX(Math.PI / 2);
  const lockDiscGeo = new THREE.CircleGeometry(1.26, 28);
  lockDiscGeo.rotateX(-Math.PI / 2);
  const lockHoloGeo = new THREE.PlaneGeometry(2.3, 1.35);
  const lockGateGeo = new THREE.PlaneGeometry(4.1, 2.9);
  const lockRingMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.9,
    roughness: 0.15,
  });
  const lockGateMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  disposables.push(lockTorusGeo, lockDiscGeo, lockHoloGeo, lockGateGeo, lockRingMat, lockGateMat);

  const lockCoords: Record<RoomId, { x: number; y: number; z: number; rotY: number }> = {
    power: { x: -10.4, y: HUB_FLOOR_Y, z: 0, rotY: Math.PI / 2 },
    greenhouse: { x: 0, y: HUB_FLOOR_Y, z: -9.9, rotY: 0 },
    bunker: { x: 7.1, y: HUB_FLOOR_Y, z: 0, rotY: -Math.PI / 2 },
    airlock: { x: 0, y: HUB_FLOOR_Y, z: 9.9, rotY: Math.PI },
  };

  const lockRings = {} as Record<RoomId, RoomLockRingRig>;
  (['power', 'greenhouse', 'bunker', 'airlock'] as RoomId[]).forEach((room) => {
    const pos = lockCoords[room];
    const rGroup = new THREE.Group();
    rGroup.position.set(pos.x, pos.y, pos.z);

    const ringMesh = new THREE.Mesh(lockTorusGeo, lockRingMat);
    ringMesh.position.y = 0.05;
    rGroup.add(ringMesh);

    const discMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const discMesh = new THREE.Mesh(lockDiscGeo, discMat);
    discMesh.position.y = 0.04;
    rGroup.add(discMesh);

    const holoTex = createRoomHoloTexture(room);
    const holoMat = new THREE.MeshBasicMaterial({
      map: holoTex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const holoCardMesh = new THREE.Mesh(lockHoloGeo, holoMat);
    holoCardMesh.position.y = 1.95;
    holoCardMesh.rotation.y = pos.rotY;
    rGroup.add(holoCardMesh);

    let gateMesh: THREE.Mesh | null = null;
    if (room === 'bunker') {
      gateMesh = new THREE.Mesh(lockGateGeo, lockGateMat);
      gateMesh.position.set(1.35, 1.5, 0);
      gateMesh.rotation.y = Math.PI / 2;
      rGroup.add(gateMesh);
    }

    group.add(rGroup);
    disposables.push(discMat, holoTex, holoMat);

    lockRings[room] = {
      room,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      group: rGroup,
      ringMesh,
      discMat,
      holoCardMesh,
      gateMesh,
    };
  });

  // Bouncing Yellow 3D Task Arrows
  const arrowShaftGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.72, 12);
  const arrowTipGeo = new THREE.ConeGeometry(0.36, 0.56, 12);
  arrowTipGeo.rotateX(Math.PI);
  const arrowHaloGeo = new THREE.TorusGeometry(0.45, 0.045, 8, 24);
  arrowHaloGeo.rotateX(Math.PI / 2);
  const arrowMat = new THREE.MeshStandardMaterial({
    color: '#fde047',
    emissive: '#facc15',
    emissiveIntensity: 1.85,
    roughness: 0.18,
  });
  disposables.push(arrowShaftGeo, arrowTipGeo, arrowHaloGeo, arrowMat);

  const buildPracticeArrow = (x: number, y: number, z: number) => {
    const aGroup = new THREE.Group();
    aGroup.position.set(x, y, z);
    aGroup.visible = false;

    const shaft = new THREE.Mesh(arrowShaftGeo, arrowMat);
    shaft.position.y = 0.56;
    aGroup.add(shaft);

    const tip = new THREE.Mesh(arrowTipGeo, arrowMat);
    tip.position.y = 0.08;
    aGroup.add(tip);

    const halo = new THREE.Mesh(arrowHaloGeo, arrowMat);
    halo.position.y = 0.96;
    aGroup.add(halo);

    group.add(aGroup);
    return aGroup;
  };

  const practiceArrows: Record<PracticeTaskId, THREE.Group> = {
    scan: buildPracticeArrow(0, HUB_FLOOR_Y + 3.05, 0),
    fan: buildPracticeArrow(-20.4, HUB_FLOOR_Y + 2.85, 0),
    plants: buildPracticeArrow(0, HUB_FLOOR_Y + 2.6, -18.0),
    blast: buildPracticeArrow(17.5, BUNKER_FLOOR_Y + 2.6, 0),
    suit: buildPracticeArrow(-2.4, HUB_FLOOR_Y + 2.6, 15.8),
  };

  // Animated 3D Armored Storm Window Shutters on Central Command Hub Dome
  const shutterPanelGeo = new THREE.CylinderGeometry(8.32, 8.66, 2.95, 14, 1, false, 0, Math.PI * 0.36);
  const shutterStripeGeo = new THREE.CylinderGeometry(8.38, 8.5, 0.32, 14, 1, false, 0, Math.PI * 0.36);
  const shutterCrownGeo = new THREE.CylinderGeometry(2.1, 7.65, 2.65, 24);
  const matShutterArmor = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.48,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  disposables.push(shutterPanelGeo, shutterStripeGeo, shutterCrownGeo, matShutterArmor);

  const lowerPanels: THREE.Mesh[] = [];
  arcAngles.forEach((a) => {
    const panel = new THREE.Mesh(shutterPanelGeo, matShutterArmor);
    panel.position.y = HUB_FLOOR_Y + 3.7;
    panel.rotation.y = a - 0.02;
    panel.visible = false;
    panel.castShadow = true;

    const hazardBand = new THREE.Mesh(shutterStripeGeo, matOrange);
    hazardBand.position.y = -0.95;
    panel.add(hazardBand);

    group.add(panel);
    lowerPanels.push(panel);
  });

  const crownCap = new THREE.Mesh(shutterCrownGeo, matShutterArmor);
  crownCap.position.y = HUB_FLOOR_Y + 6.45;
  crownCap.visible = false;
  crownCap.castShadow = true;
  group.add(crownCap);

  const hubShutters: HubShutterRig = {
    lowerPanels,
    crownCap,
  };

  disposables.push(
    airlockFloorGeo,
    airlockRoofGeo,
    gateArchGeo,
    lockerGeo,
    suitDummyGeo,
    suitHelmetGeo,
    extRampGeo,
    yardTex,
    yardMat,
    yardGeo,
    poleGeo,
    lampHeadGeo,
  );

  return {
    group,
    holoMars,
    holoRing,
    tableRadarSweep,
    radiationWaveRings,
    bunkerLeverHandle,
    bunkerLeverLightMat,
    greenhouseCracksGroup,
    resinKitProp,
    heaterCoilsMat,
    heaterLight,
    beaconOrbMat,
    beaconLight,
    radarSpin,
    interiorLights,
    yardLights,
    scrubberRings,
    turbineRotors,
    waterTankCores,
    uvLights,
    suitBoothRing,
    solarTrackers,
    exteriorDishYaw,
    dishAssembly,
    exteriorFanRotor,
    doors,
    ledMaterials,
    roomBeacons,
    roomLights,
    lockRings,
    practiceArrows,
    hubShutters,
    coolingVentLeverHandle,
    coolingVentLightMat,
    fuseWallLightMat,
    fuseLockerDoorPivot,
    lockerSpareFuseProp,
    doorLightningArcs,
    groundingSwitchLever,
    groundingSwitchLightMat,
    solarJamPebbles,
    roverDockLightMat,
    roverDockSwitchHandle,
    disposables,
  };
}
