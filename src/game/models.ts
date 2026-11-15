import * as THREE from 'three';
import { AresBotMood, ModuleConfig, ModuleId, ResourceType } from './types';

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(20, 6, 3, 0.72)');
  grad.addColorStop(0.55, 'rgba(20, 6, 3, 0.32)');
  grad.addColorStop(1, 'rgba(20, 6, 3, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLandingPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#333b48';
  ctx.fillRect(0, 0, size, size);

  // Outer hazard ring
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 18;
  ctx.setLineDash([28, 16]);
  ctx.beginPath();
  ctx.arc(256, 256, 224, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Inner cyan dock circle
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 154, 0, Math.PI * 2);
  ctx.stroke();

  // "H" Mars landing icon
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(184, 154, 28, 204);
  ctx.fillRect(300, 154, 28, 204);
  ctx.fillRect(184, 242, 144, 28);

  // Label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ARES ALPHA', 256, 404);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSolarPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c2d59';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
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

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRoverBadgeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 92, 256, 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROOKIE-1', 128, 60);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface RoverRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  wheels: THREE.Group[];
  frontWheelPivots: THREE.Group[];
  dish: THREE.Group;
  headPivot: THREE.Group;
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  headLightLeft: THREE.SpotLight;
  headLightRight: THREE.SpotLight;
  headLampMat: THREE.MeshStandardMaterial;
  contactShadow: THREE.Mesh;
  disposables: Array<{ dispose: () => void }>;
}

export function createRoverModel(isSoftwareGl: boolean, maxAnisotropy: number): RoverRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const disposables: Array<{ dispose: () => void }> = [];

  // Shared materials with strong roughness/metalness contrast
  const matWhiteHull = new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    roughness: 0.35,
    metalness: 0.18,
  });
  const matOrangeAccent = new THREE.MeshStandardMaterial({
    color: '#f97316',
    roughness: 0.3,
    metalness: 0.25,
  });
  const matDarkMetal = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.42,
    metalness: 0.82,
  });
  const matRubberTire = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.88,
    metalness: 0.05,
  });
  const matGoldFoil = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    roughness: 0.22,
    metalness: 0.92,
  });
  const matGlassLens = new THREE.MeshPhysicalMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.65,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.4,
    ior: 1.5,
  });
  const headLampMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#fde047',
    emissiveIntensity: 0.7,
    roughness: 0.2,
    metalness: 0.1,
  });
  const solarTex = createSolarPanelTexture(maxAnisotropy);
  const matSolar = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.22,
    metalness: 0.55,
  });
  const badgeTex = createRoverBadgeTexture(maxAnisotropy);
  const matBadge = new THREE.MeshStandardMaterial({
    map: badgeTex,
    roughness: 0.35,
    metalness: 0.15,
  });
  disposables.push(
    matWhiteHull,
    matOrangeAccent,
    matDarkMetal,
    matRubberTire,
    matGoldFoil,
    matGlassLens,
    headLampMat,
    solarTex,
    matSolar,
    badgeTex,
    matBadge,
  );

  // 1. Primary silhouette: Beveled Extruded Chassis Hull
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.05, -0.35);
  hullShape.lineTo(1.05, -0.35);
  hullShape.lineTo(1.25, 0.05);
  hullShape.lineTo(0.85, 0.42);
  hullShape.lineTo(-0.95, 0.42);
  hullShape.lineTo(-1.18, 0.08);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.35,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  hullGeo.center();
  // Rotate so length is along Z (-Z is forward!)
  hullGeo.rotateY(Math.PI / 2);
  const hullMesh = new THREE.Mesh(hullGeo, matWhiteHull);
  hullMesh.position.y = 0.92;
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyPivot.add(hullMesh);
  disposables.push(hullGeo);

  // 2. Side orange bumper trim & Rookie-1 nameplate
  const bumperGeo = new THREE.BoxGeometry(1.66, 0.22, 2.52);
  const bumperMesh = new THREE.Mesh(bumperGeo, matOrangeAccent);
  bumperMesh.position.set(0, 0.72, 0);
  bumperMesh.castShadow = true;
  bodyPivot.add(bumperMesh);

  const badgeGeo = new THREE.PlaneGeometry(0.95, 0.42);
  const badgeLeft = new THREE.Mesh(badgeGeo, matBadge);
  badgeLeft.position.set(-0.84, 0.98, 0.1);
  badgeLeft.rotation.y = -Math.PI / 2;
  bodyPivot.add(badgeLeft);
  const badgeRight = new THREE.Mesh(badgeGeo, matBadge);
  badgeRight.position.set(0.84, 0.98, 0.1);
  badgeRight.rotation.y = Math.PI / 2;
  bodyPivot.add(badgeRight);
  disposables.push(bumperGeo, badgeGeo);

  // 3. Rear Solar Deck & Gold Foil Power Core
  const deckGeo = new THREE.BoxGeometry(1.48, 0.06, 1.15);
  const deckMesh = new THREE.Mesh(deckGeo, matSolar);
  deckMesh.position.set(0, 1.36, 0.48);
  deckMesh.rotation.x = 0.08;
  deckMesh.castShadow = true;
  bodyPivot.add(deckMesh);

  const rtgGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.65, 10);
  rtgGeo.rotateX(Math.PI / 2);
  const rtgMesh = new THREE.Mesh(rtgGeo, matGoldFoil);
  rtgMesh.position.set(0, 1.1, 1.25);
  rtgMesh.castShadow = true;
  bodyPivot.add(rtgMesh);
  disposables.push(deckGeo, rtgGeo);

  // 4. Twin Rear Booster Nozzles & Flames
  const nozzleGeo = new THREE.CylinderGeometry(0.14, 0.21, 0.34, 12);
  nozzleGeo.rotateX(Math.PI / 2);
  const flameGeo = new THREE.ConeGeometry(0.16, 0.75, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.38);
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.9,
  });

  const nozzleL = new THREE.Mesh(nozzleGeo, matDarkMetal);
  nozzleL.position.set(-0.42, 0.85, 1.38);
  bodyPivot.add(nozzleL);

  const nozzleR = new THREE.Mesh(nozzleGeo, matDarkMetal);
  nozzleR.position.set(0.42, 0.85, 1.38);
  bodyPivot.add(nozzleR);

  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.position.set(-0.42, 0.85, 1.48);
  flameLeft.visible = false;
  bodyPivot.add(flameLeft);

  const flameRight = new THREE.Mesh(flameGeo, flameMat);
  flameRight.position.set(0.42, 0.85, 1.48);
  flameRight.visible = false;
  bodyPivot.add(flameRight);
  disposables.push(nozzleGeo, flameGeo, flameMat);

  // 5. Articulated Mast & Friendly Stereo Camera Head
  const mastGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.78, 10);
  const mastMesh = new THREE.Mesh(mastGeo, matDarkMetal);
  mastMesh.position.set(0.28, 1.68, -0.68);
  mastMesh.castShadow = true;
  bodyPivot.add(mastMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0.28, 2.08, -0.68);
  bodyPivot.add(headPivot);

  const headBoxGeo = new THREE.BoxGeometry(0.62, 0.32, 0.42);
  const headBox = new THREE.Mesh(headBoxGeo, matWhiteHull);
  headBox.castShadow = true;
  headPivot.add(headBox);

  const visorGeo = new THREE.BoxGeometry(0.54, 0.2, 0.08);
  const visor = new THREE.Mesh(visorGeo, matDarkMetal);
  visor.position.set(0, 0, -0.2);
  headPivot.add(visor);

  const eyeGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.09, 14);
  eyeGeo.rotateX(Math.PI / 2);
  const eyeL = new THREE.Mesh(eyeGeo, matGlassLens);
  eyeL.position.set(-0.14, 0, -0.23);
  headPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, matGlassLens);
  eyeR.position.set(0.14, 0, -0.23);
  headPivot.add(eyeR);
  disposables.push(mastGeo, headBoxGeo, visorGeo, eyeGeo);

  // 6. Spinning Comms Dish Antenna (LatheGeometry parabolic dish)
  const dish = new THREE.Group();
  dish.position.set(-0.42, 1.46, -0.35);
  bodyPivot.add(dish);

  const dishStemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.35, 8);
  const dishStem = new THREE.Mesh(dishStemGeo, matDarkMetal);
  dishStem.position.y = 0.16;
  dish.add(dishStem);

  const dishProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.14, 0.04),
    new THREE.Vector2(0.28, 0.13),
    new THREE.Vector2(0.32, 0.16),
  ];
  const dishCupGeo = new THREE.LatheGeometry(dishProfile, 16);
  const dishCup = new THREE.Mesh(dishCupGeo, matGoldFoil);
  dishCup.position.set(0, 0.34, 0);
  dishCup.rotation.x = -0.55;
  dishCup.castShadow = true;
  dish.add(dishCup);
  disposables.push(dishStemGeo, dishCupGeo);

  // 7. Twin Front LED Headlights (with real SpotLights for night exploration!)
  const lampGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.1, 12);
  lampGeo.rotateX(Math.PI / 2);
  const lampL = new THREE.Mesh(lampGeo, headLampMat);
  lampL.position.set(-0.48, 0.96, -1.24);
  bodyPivot.add(lampL);
  const lampR = new THREE.Mesh(lampGeo, headLampMat);
  lampR.position.set(0.48, 0.96, -1.24);
  bodyPivot.add(lampR);
  disposables.push(lampGeo);

  const headLightLeft = new THREE.SpotLight('#fff3c4', 0, 28, Math.PI / 4, 0.55, 1.4);
  headLightLeft.position.set(-0.48, 0.96, -1.3);
  headLightLeft.target.position.set(-0.6, 0.0, -9.5);
  bodyPivot.add(headLightLeft);
  bodyPivot.add(headLightLeft.target);

  const headLightRight = new THREE.SpotLight('#fff3c4', 0, 28, Math.PI / 4, 0.55, 1.4);
  headLightRight.position.set(0.48, 0.96, -1.3);
  headLightRight.target.position.set(0.6, 0.0, -9.5);
  bodyPivot.add(headLightRight);
  bodyPivot.add(headLightRight.target);

  // 8. 6 Rugged Articulated Wheels + Rocker-Bogie Suspension Struts
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.37, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const treadGeo = new THREE.BoxGeometry(0.36, 0.07, 0.09);
  const strutGeo = new THREE.BoxGeometry(0.1, 0.52, 0.12);
  disposables.push(tireGeo, hubGeo, treadGeo, strutGeo);

  const wheels: THREE.Group[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const wheelPositions: Array<[number, number, boolean]> = [
    [-0.98, -0.96, true],
    [0.98, -0.96, true],
    [-1.02, 0.0, false],
    [1.02, 0.0, false],
    [-0.98, 0.96, false],
    [0.98, 0.96, false],
  ];

  wheelPositions.forEach(([wx, wz, isFront]) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, 0.42, wz);
    bodyPivot.add(steerPivot);

    const strut = new THREE.Mesh(strutGeo, matDarkMetal);
    strut.position.set(wx > 0 ? -0.14 : 0.14, 0.24, 0);
    steerPivot.add(strut);

    const wheelSpinGroup = new THREE.Group();
    steerPivot.add(wheelSpinGroup);

    const tire = new THREE.Mesh(tireGeo, matRubberTire);
    tire.castShadow = true;
    tire.receiveShadow = true;
    wheelSpinGroup.add(tire);

    const hub = new THREE.Mesh(hubGeo, matOrangeAccent);
    wheelSpinGroup.add(hub);

    // Wheel lugs so spinning motion reads crisply
    for (let t = 0; t < 6; t++) {
      const ang = (t / 6) * Math.PI * 2;
      const lug = new THREE.Mesh(treadGeo, matDarkMetal);
      lug.position.set(0, Math.cos(ang) * 0.41, Math.sin(ang) * 0.41);
      lug.rotation.x = ang;
      wheelSpinGroup.add(lug);
    }

    wheels.push(wheelSpinGroup);
    if (isFront) frontWheelPivots.push(steerPivot);
  });

  // 9. Contact Shadow Plane directly under Rover
  const shadowTex = createRadialShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(3.2, 3.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.03;
  root.add(contactShadow);
  disposables.push(shadowTex, shadowGeo, shadowMat);

  return {
    root,
    bodyPivot,
    wheels,
    frontWheelPivots,
    dish,
    headPivot,
    flameLeft,
    flameRight,
    headLightLeft,
    headLightRight,
    headLampMat,
    contactShadow,
    disposables,
  };
}

export interface BaseHubRig {
  group: THREE.Group;
  beaconLight: THREE.PointLight;
  beaconOrbMat: THREE.MeshStandardMaterial;
  interiorLight: THREE.PointLight;
  radarSpin: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
}

export function createBaseHub(isSoftwareGl: boolean, maxAnisotropy: number): BaseHubRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const matPlinth = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.65, metalness: 0.35 });
  const matHull = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.32, metalness: 0.2 });
  const matOrange = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.36, metalness: 0.25 });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: '#bae6fd',
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.36 : 0.48,
    depthWrite: false,
    ior: 1.48,
  });
  const beaconOrbMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.3,
    roughness: 0.2,
    metalness: 0.1,
  });
  const padTex = createLandingPadTexture(maxAnisotropy);
  const padMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.72,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  disposables.push(matPlinth, matHull, matOrange, matGlass, beaconOrbMat, padTex, padMat);

  // Octagonal Base Foundation Plinth
  const plinthGeo = new THREE.CylinderGeometry(7.2, 7.9, 0.75, 8);
  const plinth = new THREE.Mesh(plinthGeo, matPlinth);
  plinth.position.y = 0.375;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  // Landing Apron Circle next to Habitat (at z = 9.5)
  const padGeo = new THREE.CylinderGeometry(5.6, 5.8, 0.14, 32);
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.set(0, 0.07, 9.6);
  pad.receiveShadow = true;
  group.add(pad);

  // Inner Floor Deck
  const floorGeo = new THREE.CylinderGeometry(6.3, 6.3, 0.1, 24);
  const floor = new THREE.Mesh(floorGeo, matHull);
  floor.position.y = 0.8;
  floor.receiveShadow = true;
  group.add(floor);

  // Interior Warm Core & Console
  const coreGeo = new THREE.CylinderGeometry(1.3, 1.55, 2.2, 12);
  const core = new THREE.Mesh(coreGeo, matOrange);
  core.position.y = 1.9;
  core.castShadow = true;
  group.add(core);

  // Translucent Geodesic Habitat Dome
  const domeGeo = new THREE.SphereGeometry(5.9, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const dome = new THREE.Mesh(domeGeo, matGlass);
  dome.position.y = 0.82;
  dome.renderOrder = 2;
  group.add(dome);

  // Structural Dome Ribs
  const ribGeo = new THREE.TorusGeometry(5.94, 0.13, 8, 32, Math.PI);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(ribGeo, matHull);
    rib.position.y = 0.82;
    rib.rotation.y = (i / 3) * Math.PI;
    rib.castShadow = true;
    group.add(rib);
  }

  // Front Airlock Tunnel facing Landing Pad
  const tunnelGeo = new THREE.CylinderGeometry(1.55, 1.65, 3.1, 10);
  tunnelGeo.rotateX(Math.PI / 2);
  const tunnel = new THREE.Mesh(tunnelGeo, matHull);
  tunnel.position.set(0, 1.55, 6.1);
  tunnel.castShadow = true;
  group.add(tunnel);

  const doorTrimGeo = new THREE.TorusGeometry(1.35, 0.16, 8, 16);
  const doorTrim = new THREE.Mesh(doorTrimGeo, matOrange);
  doorTrim.position.set(0, 1.55, 7.65);
  group.add(doorTrim);

  // Rooftop Comms Mast + Rotating Radar
  const mastGeo = new THREE.CylinderGeometry(0.14, 0.22, 3.4, 10);
  const mast = new THREE.Mesh(mastGeo, matPlinth);
  mast.position.set(0, 8.2, 0);
  mast.castShadow = true;
  group.add(mast);

  const beaconOrbGeo = new THREE.SphereGeometry(0.45, 14, 12);
  const beaconOrb = new THREE.Mesh(beaconOrbGeo, beaconOrbMat);
  beaconOrb.position.set(0, 10.0, 0);
  group.add(beaconOrb);

  const radarSpin = new THREE.Group();
  radarSpin.position.set(0, 9.1, 0);
  group.add(radarSpin);
  const barGeo = new THREE.BoxGeometry(2.2, 0.22, 0.18);
  const bar = new THREE.Mesh(barGeo, matOrange);
  radarSpin.add(bar);

  const beaconLight = new THREE.PointLight('#38bdf8', 2.0, 32, 1.6);
  beaconLight.position.set(0, 10.2, 0);
  group.add(beaconLight);

  const interiorLight = new THREE.PointLight('#fbbf24', 1.8, 18, 1.5);
  interiorLight.position.set(0, 3.2, 0);
  group.add(interiorLight);

  disposables.push(plinthGeo, padGeo, floorGeo, coreGeo, domeGeo, ribGeo, tunnelGeo, doorTrimGeo, mastGeo, beaconOrbGeo, barGeo);

  return { group, beaconLight, beaconOrbMat, interiorLight, radarSpin, disposables };
}

export interface ModulePadRig {
  id: ModuleId;
  root: THREE.Group;
  holoGroup: THREE.Group;
  builtGroup: THREE.Group;
  ringMat: THREE.MeshBasicMaterial;
  beamMat: THREE.MeshBasicMaterial;
  animatedParts: THREE.Object3D[];
  disposables: Array<{ dispose: () => void }>;
}

export function createModulePad(cfg: ModuleConfig, isSoftwareGl: boolean, maxAnisotropy: number): ModulePadRig {
  const root = new THREE.Group();
  root.position.set(cfg.x, 0, cfg.z);
  const disposables: Array<{ dispose: () => void }> = [];
  const animatedParts: THREE.Object3D[] = [];

  const accent = new THREE.Color(cfg.accentColor);

  // Foundation Pad
  const baseMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7, metalness: 0.3 });
  const baseGeo = new THREE.CylinderGeometry(4.2, 4.6, 0.26, 8);
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = 0.13;
  baseMesh.receiveShadow = true;
  root.add(baseMesh);

  // Glowing Holographic Pad Ring + Skyward Marker Beam (shown before built)
  const holoGroup = new THREE.Group();
  root.add(holoGroup);

  const ringGeo = new THREE.RingGeometry(3.5, 4.1, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accent,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.28;
  holoGroup.add(ringMesh);

  const beamGeo = new THREE.CylinderGeometry(0.18, 0.55, 22, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.y = 11.2;
  holoGroup.add(beamMesh);

  const holoIconGeo = new THREE.OctahedronGeometry(0.85, 0);
  const holoIconMat = new THREE.MeshBasicMaterial({ color: accent, wireframe: true });
  const holoIcon = new THREE.Mesh(holoIconGeo, holoIconMat);
  holoIcon.position.y = 2.1;
  holoGroup.add(holoIcon);
  animatedParts.push(holoIcon);

  disposables.push(baseMat, baseGeo, ringGeo, ringMat, beamGeo, beamMat, holoIconGeo, holoIconMat);

  // Built Structure (hidden until constructed)
  const builtGroup = new THREE.Group();
  builtGroup.visible = false;
  root.add(builtGroup);

  const matSteel = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.36, metalness: 0.65 });
  const matOrange = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.32, metalness: 0.22 });
  const matDark = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.7 });
  disposables.push(matSteel, matOrange, matDark);

  if (cfg.id === 'solar') {
    const solarTex = createSolarPanelTexture(maxAnisotropy);
    const matPanel = new THREE.MeshStandardMaterial({ map: solarTex, roughness: 0.22, metalness: 0.55 });
    const pylonGeo = new THREE.CylinderGeometry(0.32, 0.48, 2.8, 10);
    const wingGeo = new THREE.BoxGeometry(5.6, 0.14, 2.8);
    const hubGeo = new THREE.BoxGeometry(1.1, 0.7, 1.1);
    disposables.push(solarTex, matPanel, pylonGeo, wingGeo, hubGeo);

    const pylon = new THREE.Mesh(pylonGeo, matSteel);
    pylon.position.y = 1.6;
    pylon.castShadow = true;
    builtGroup.add(pylon);

    const tracker = new THREE.Group();
    tracker.position.y = 3.0;
    builtGroup.add(tracker);

    const hub = new THREE.Mesh(hubGeo, matOrange);
    hub.castShadow = true;
    tracker.add(hub);

    const wing = new THREE.Mesh(wingGeo, matPanel);
    wing.rotation.x = 0.42;
    wing.castShadow = true;
    tracker.add(wing);
    animatedParts.push(tracker);
  } else if (cfg.id === 'biodome') {
    const matLeaf = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.68, metalness: 0.05 });
    const matTrunk = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.85, metalness: 0.02 });
    const matBioGlass = new THREE.MeshPhysicalMaterial({
      color: '#bbf7d0',
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 1.0,
      transmission: isSoftwareGl ? 0 : 0.7,
      transparent: true,
      opacity: isSoftwareGl ? 0.36 : 0.44,
      depthWrite: false,
    });
    const soilGeo = new THREE.CylinderGeometry(3.4, 3.4, 0.3, 20);
    const soilMat = new THREE.MeshStandardMaterial({ color: '#422006', roughness: 0.92, metalness: 0 });
    const domeGeo = new THREE.SphereGeometry(3.55, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.4, 8);
    const canopyGeo = new THREE.DodecahedronGeometry(0.85, 1);

    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.36;
    builtGroup.add(soil);

    const treeOffsets: Array<[number, number, number]> = [
      [0, 0, 1.15],
      [-1.3, 0.9, 0.82],
      [1.3, -0.8, 0.88],
      [-1.0, -1.2, 0.76],
    ];
    treeOffsets.forEach(([tx, tz, sc]) => {
      const trunk = new THREE.Mesh(trunkGeo, matTrunk);
      trunk.position.set(tx, 0.45 + 0.7 * sc, tz);
      trunk.scale.setScalar(sc);
      builtGroup.add(trunk);

      const canopy = new THREE.Mesh(canopyGeo, matLeaf);
      canopy.position.set(tx, 0.45 + 1.55 * sc, tz);
      canopy.scale.setScalar(sc);
      builtGroup.add(canopy);
    });

    const bioDome = new THREE.Mesh(domeGeo, matBioGlass);
    bioDome.position.y = 0.26;
    bioDome.renderOrder = 2;
    builtGroup.add(bioDome);

    const growLight = new THREE.PointLight('#4ade80', 1.6, 14, 1.5);
    growLight.position.y = 2.4;
    builtGroup.add(growLight);

    disposables.push(matLeaf, matTrunk, matBioGlass, soilGeo, soilMat, domeGeo, trunkGeo, canopyGeo);
  } else if (cfg.id === 'garage') {
    const pillarGeo = new THREE.BoxGeometry(0.65, 3.2, 0.65);
    const roofGeo = new THREE.BoxGeometry(5.6, 0.5, 4.4);
    const signGeo = new THREE.BoxGeometry(2.6, 0.6, 0.25);
    const radarGeo = new THREE.ConeGeometry(0.85, 0.5, 12, 1, true);
    disposables.push(pillarGeo, roofGeo, signGeo, radarGeo);

    [
      [-2.2, -1.6],
      [2.2, -1.6],
      [-2.2, 1.6],
      [2.2, 1.6],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(pillarGeo, matOrange);
      p.position.set(px, 1.8, pz);
      p.castShadow = true;
      builtGroup.add(p);
    });

    const roof = new THREE.Mesh(roofGeo, matSteel);
    roof.position.y = 3.55;
    roof.castShadow = true;
    builtGroup.add(roof);

    const sign = new THREE.Mesh(signGeo, matDark);
    sign.position.set(0, 4.05, 1.9);
    builtGroup.add(sign);

    const radarGroup = new THREE.Group();
    radarGroup.position.set(0, 4.3, 0);
    builtGroup.add(radarGroup);
    const dish = new THREE.Mesh(radarGeo, matOrange);
    dish.rotation.x = Math.PI * 0.65;
    radarGroup.add(dish);
    animatedParts.push(radarGroup);
  } else if (cfg.id === 'antenna') {
    const towerGeo = new THREE.CylinderGeometry(0.35, 1.25, 7.2, 8);
    const dishProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.8, 0.22),
      new THREE.Vector2(1.6, 0.72),
      new THREE.Vector2(2.0, 1.05),
    ];
    const dishGeo = new THREE.LatheGeometry(dishProfile, 20);
    const matGold = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.22, metalness: 0.88 });
    const skyBeamGeo = new THREE.CylinderGeometry(0.16, 0.36, 48, 12, 1, true);
    const skyBeamMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposables.push(towerGeo, dishGeo, matGold, skyBeamGeo, skyBeamMat);

    const tower = new THREE.Mesh(towerGeo, matSteel);
    tower.position.y = 3.85;
    tower.castShadow = true;
    builtGroup.add(tower);

    const dishPivot = new THREE.Group();
    dishPivot.position.y = 7.7;
    builtGroup.add(dishPivot);

    const dishMesh = new THREE.Mesh(dishGeo, matGold);
    dishMesh.rotation.x = 0.55;
    dishMesh.castShadow = true;
    dishPivot.add(dishMesh);
    animatedParts.push(dishPivot);

    const skyBeam = new THREE.Mesh(skyBeamGeo, skyBeamMat);
    skyBeam.position.y = 32;
    builtGroup.add(skyBeam);

    const beacon = new THREE.PointLight('#fde047', 2.4, 24, 1.4);
    beacon.position.y = 8.4;
    builtGroup.add(beacon);
  }

  return {
    id: cfg.id,
    root,
    holoGroup,
    builtGroup,
    ringMat,
    beamMat,
    animatedParts,
    disposables,
  };
}

export interface CollectibleInstance {
  id: number;
  kind: ResourceType;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  respawnTimer: number;
  group: THREE.Group;
  crystalGroup: THREE.Group;
}

export function createCollectibleMesh(
  id: number,
  kind: ResourceType,
  x: number,
  y: number,
  z: number,
  disposables: Array<{ dispose: () => void }>,
): CollectibleInstance {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const rockBaseGeo = new THREE.DodecahedronGeometry(0.62, 0);
  const rockBaseMat = new THREE.MeshStandardMaterial({ color: '#5c2618', roughness: 0.9, metalness: 0.05 });
  const rockBase = new THREE.Mesh(rockBaseGeo, rockBaseMat);
  rockBase.scale.set(1.2, 0.45, 1.2);
  rockBase.position.y = 0.16;
  rockBase.receiveShadow = true;
  group.add(rockBase);

  const crystalGroup = new THREE.Group();
  crystalGroup.position.y = 0.72;
  group.add(crystalGroup);

  const colorHex = kind === 'iron' ? '#fb923c' : kind === 'ice' ? '#38bdf8' : '#facc15';
  const emissiveHex = kind === 'iron' ? '#c2410c' : kind === 'ice' ? '#0284c7' : '#ca8a04';

  const crystalMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: emissiveHex,
    emissiveIntensity: kind === 'stars' ? 1.15 : 0.72,
    roughness: 0.16,
    metalness: kind === 'stars' ? 0.78 : 0.25,
    flatShading: true,
  });

  if (kind === 'stars') {
    const coreGeo = new THREE.OctahedronGeometry(0.68, 0);
    const haloGeo = new THREE.TorusGeometry(0.95, 0.07, 8, 24);
    const core = new THREE.Mesh(coreGeo, crystalMat);
    core.castShadow = true;
    const halo = new THREE.Mesh(haloGeo, crystalMat);
    halo.rotation.x = Math.PI / 3;
    crystalGroup.add(core, halo);
    disposables.push(coreGeo, haloGeo);
  } else {
    const mainGeo = new THREE.ConeGeometry(0.38, 1.15, 6);
    const sideGeo = new THREE.ConeGeometry(0.24, 0.78, 5);
    const c1 = new THREE.Mesh(mainGeo, crystalMat);
    c1.position.y = 0.2;
    c1.castShadow = true;
    const c2 = new THREE.Mesh(sideGeo, crystalMat);
    c2.position.set(0.28, 0.02, 0.14);
    c2.rotation.z = -0.45;
    const c3 = new THREE.Mesh(sideGeo, crystalMat);
    c3.position.set(-0.24, 0.05, -0.18);
    c3.rotation.z = 0.38;
    c3.rotation.x = 0.25;
    crystalGroup.add(c1, c2, c3);
    disposables.push(mainGeo, sideGeo);
  }

  disposables.push(rockBaseGeo, rockBaseMat, crystalMat);

  return {
    id,
    kind,
    x,
    y,
    z,
    collected: false,
    respawnTimer: 0,
    group,
    crystalGroup,
  };
}

export interface DustDevilActor {
  group: THREE.Group;
  rings: THREE.Mesh[];
  anchorX: number;
  anchorZ: number;
  orbitRadius: number;
  phase: number;
  speed: number;
  x: number;
  z: number;
  radius: number;
}

export function createDustDevil(
  anchorX: number,
  anchorZ: number,
  orbitRadius: number,
  phase: number,
  speed: number,
  disposables: Array<{ dispose: () => void }>,
): DustDevilActor {
  const group = new THREE.Group();

  // Warning ring on ground
  const warnGeo = new THREE.RingGeometry(2.6, 3.05, 28);
  warnGeo.rotateX(-Math.PI / 2);
  const warnMat = new THREE.MeshBasicMaterial({
    color: '#fb923c',
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const warnMesh = new THREE.Mesh(warnGeo, warnMat);
  warnMesh.position.y = 0.08;
  group.add(warnMesh);
  disposables.push(warnGeo, warnMat);

  const rings: THREE.Mesh[] = [];
  const funnelMat = new THREE.MeshStandardMaterial({
    color: '#e87d4f',
    emissive: '#9a3412',
    emissiveIntensity: 0.3,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.56,
  });
  disposables.push(funnelMat);

  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const r = 0.8 + t * 2.1;
    const ringGeo = new THREE.TorusGeometry(r, 0.22 + t * 0.14, 8, 16, Math.PI * 1.6);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, funnelMat);
    ring.position.y = 0.6 + i * 1.15;
    ring.rotation.y = i * 1.1;
    group.add(ring);
    rings.push(ring);
    disposables.push(ringGeo);
  }

  return {
    group,
    rings,
    anchorX,
    anchorZ,
    orbitRadius,
    phase,
    speed,
    x: anchorX,
    z: anchorZ,
    radius: 3.1,
  };
}

export interface GeyserActor {
  group: THREE.Group;
  plume: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  x: number;
  z: number;
  timer: number;
  cycleDuration: number;
  erupting: boolean;
}

export function createGeyserVent(
  x: number,
  y: number,
  z: number,
  initialPhase: number,
  disposables: Array<{ dispose: () => void }>,
): GeyserActor {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const moundGeo = new THREE.CylinderGeometry(1.3, 2.3, 0.65, 14, 1, false);
  const moundMat = new THREE.MeshStandardMaterial({ color: '#6c291b', roughness: 0.92, metalness: 0.06 });
  const mound = new THREE.Mesh(moundGeo, moundMat);
  mound.position.y = 0.25;
  mound.receiveShadow = true;
  mound.castShadow = true;
  group.add(mound);

  const coreGeo = new THREE.CircleGeometry(1.05, 16);
  coreGeo.rotateX(-Math.PI / 2);
  const coreMat = new THREE.MeshStandardMaterial({
    color: '#67e8f9',
    emissive: '#06b6d4',
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.59;
  group.add(core);

  const plumeGeo = new THREE.CylinderGeometry(1.4, 0.55, 8.5, 14, 1, true);
  plumeGeo.translate(0, 4.25, 0);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: '#bae6fd',
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  plume.position.y = 0.55;
  plume.scale.set(1, 0.05, 1);
  plume.visible = false;
  group.add(plume);

  disposables.push(moundGeo, moundMat, coreGeo, coreMat, plumeGeo, plumeMat);

  return {
    group,
    plume,
    coreMat,
    x,
    z,
    timer: initialPhase,
    cycleDuration: 6.5,
    erupting: false,
  };
}

export interface AstronautRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  oxygenBar: THREE.Mesh;
  oxygenBarMat: THREE.MeshStandardMaterial;
  batteryBar: THREE.Mesh;
  batteryBarMat: THREE.MeshStandardMaterial;
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  headLamp: THREE.SpotLight;
  headLampMat: THREE.MeshStandardMaterial;
  airBlowerTool: THREE.Group;
  wrenchTool: THREE.Group;
  heldResinKit: THREE.Group;
  heldSpareFuse: THREE.Group;
  contactShadow: THREE.Mesh;
  disposables: Array<{ dispose: () => void }>;
}

export function createAstronautModel(): AstronautRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const disposables: Array<{ dispose: () => void }> = [];

  // PBR Materials with strong roughness/metalness contrast
  const matSuitWhite = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.46,
    metalness: 0.06,
  });
  const matSuitOrange = new THREE.MeshStandardMaterial({
    color: '#f97316',
    roughness: 0.28,
    metalness: 0.25,
  });
  const matDarkTrim = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.52,
    metalness: 0.72,
  });
  const matGoldVisor = new THREE.MeshPhysicalMaterial({
    color: '#fbbf24',
    emissive: '#78350f',
    emissiveIntensity: 0.18,
    metalness: 0.94,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const oxygenBarMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.7,
    roughness: 0.18,
    metalness: 0.1,
  });
  const batteryBarMat = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#22c55e',
    emissiveIntensity: 1.7,
    roughness: 0.18,
    metalness: 0.1,
  });
  const headLampMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#fde047',
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.92,
  });

  disposables.push(
    matSuitWhite,
    matSuitOrange,
    matDarkTrim,
    matGoldVisor,
    oxygenBarMat,
    batteryBarMat,
    headLampMat,
    flameMat,
  );

  // 1. Torso & Orange Space Harness (bottom-center grounded around y = 0.85..1.55)
  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.36, 8, 16);
  const torso = new THREE.Mesh(torsoGeo, matSuitWhite);
  torso.position.y = 1.12;
  torso.scale.set(1.06, 1.0, 0.88);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  const beltGeo = new THREE.CylinderGeometry(0.36, 0.37, 0.14, 16);
  const belt = new THREE.Mesh(beltGeo, matSuitOrange);
  belt.position.y = 0.88;
  belt.scale.set(1.06, 1, 0.9);
  belt.castShadow = true;
  bodyPivot.add(belt);

  const chestPackGeo = new THREE.BoxGeometry(0.36, 0.26, 0.12);
  const chestPack = new THREE.Mesh(chestPackGeo, matSuitOrange);
  chestPack.position.set(0, 1.2, -0.31);
  chestPack.castShadow = true;
  bodyPivot.add(chestPack);

  const chestDialGeo = new THREE.CircleGeometry(0.06, 12);
  const chestDial = new THREE.Mesh(chestDialGeo, oxygenBarMat);
  chestDial.position.set(-0.08, 1.2, -0.375);
  chestDial.rotation.y = Math.PI;
  bodyPivot.add(chestDial);

  const collarGeo = new THREE.TorusGeometry(0.26, 0.065, 10, 20);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, matSuitOrange);
  collar.position.y = 1.5;
  bodyPivot.add(collar);
  disposables.push(torsoGeo, beltGeo, chestPackGeo, chestDialGeo, collarGeo);

  // 2. Stylized Oversized Helmet & Reflective Gold Visor
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.78;
  bodyPivot.add(headPivot);

  const helmetGeo = new THREE.SphereGeometry(0.41, 22, 18);
  const helmet = new THREE.Mesh(helmetGeo, matSuitWhite);
  helmet.castShadow = true;
  helmet.receiveShadow = true;
  headPivot.add(helmet);

  // Curved reflective gold visor facing -Z
  const visorGeo = new THREE.SphereGeometry(
    0.422,
    22,
    16,
    -Math.PI * 0.5 - Math.PI * 0.36,
    Math.PI * 0.72,
    Math.PI * 0.22,
    Math.PI * 0.52,
  );
  const visor = new THREE.Mesh(visorGeo, matGoldVisor);
  headPivot.add(visor);

  // Helmet Ear Pods & Antenna
  const earPodGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.09, 12);
  earPodGeo.rotateZ(Math.PI / 2);
  const earL = new THREE.Mesh(earPodGeo, matSuitOrange);
  earL.position.set(-0.4, 0, 0);
  headPivot.add(earL);
  const earR = new THREE.Mesh(earPodGeo, matSuitOrange);
  earR.position.set(0.4, 0, 0);
  headPivot.add(earR);

  const antGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.26, 8);
  const ant = new THREE.Mesh(antGeo, matDarkTrim);
  ant.position.set(0.38, 0.22, 0.04);
  headPivot.add(ant);

  const antTipGeo = new THREE.SphereGeometry(0.045, 10, 8);
  const antTip = new THREE.Mesh(antTipGeo, matSuitOrange);
  antTip.position.set(0.38, 0.36, 0.04);
  headPivot.add(antTip);

  // Helmet Top Headlamp
  const lampMountGeo = new THREE.BoxGeometry(0.16, 0.1, 0.14);
  const lampMount = new THREE.Mesh(lampMountGeo, matDarkTrim);
  lampMount.position.set(0, 0.38, -0.18);
  headPivot.add(lampMount);

  const lampLensGeo = new THREE.CircleGeometry(0.055, 12);
  const lampLens = new THREE.Mesh(lampLensGeo, headLampMat);
  lampLens.position.set(0, 0.38, -0.255);
  lampLens.rotation.y = Math.PI;
  headPivot.add(lampLens);

  const headLamp = new THREE.SpotLight('#fff3c4', 0, 26, Math.PI / 4, 0.55, 1.4);
  headLamp.position.set(0, 0.38, -0.28);
  headLamp.target.position.set(0, -0.35, -8.5);
  headPivot.add(headLamp);
  headPivot.add(headLamp.target);

  disposables.push(helmetGeo, visorGeo, earPodGeo, antGeo, antTipGeo, lampMountGeo, lampLensGeo);

  // 3. Life-Support Jetpack Backpack with Diegetic Oxygen (Blue) & Battery (Green) Bars
  const packGroup = new THREE.Group();
  packGroup.position.set(0, 1.14, 0.36);
  bodyPivot.add(packGroup);

  const packGeo = new THREE.BoxGeometry(0.56, 0.68, 0.32);
  const packMesh = new THREE.Mesh(packGeo, matSuitWhite);
  packMesh.castShadow = true;
  packMesh.receiveShadow = true;
  packGroup.add(packMesh);

  const packTopGeo = new THREE.BoxGeometry(0.58, 0.1, 0.34);
  const packTop = new THREE.Mesh(packTopGeo, matSuitOrange);
  packTop.position.y = 0.34;
  packGroup.add(packTop);

  // Recessed dark bay on the back face (+Z) for diegetic bars
  const bayGeo = new THREE.BoxGeometry(0.42, 0.5, 0.05);
  const bayMesh = new THREE.Mesh(bayGeo, matDarkTrim);
  bayMesh.position.set(0, -0.02, 0.16);
  packGroup.add(bayMesh);

  // Diegetic Bar Geometries (bottom-anchored so scale.y grows/shrinks from bottom!)
  const barHeight = 0.38;
  const barGeo = new THREE.BoxGeometry(0.11, barHeight, 0.05);
  barGeo.translate(0, barHeight / 2, 0);

  const oxygenBar = new THREE.Mesh(barGeo, oxygenBarMat);
  oxygenBar.position.set(-0.095, -0.22, 0.18);
  packGroup.add(oxygenBar);

  const batteryBar = new THREE.Mesh(barGeo, batteryBarMat);
  batteryBar.position.set(0.095, -0.22, 0.18);
  packGroup.add(batteryBar);

  // Top static indicator dots above Oxygen (blue) and Battery (green) bars
  const pipGeo = new THREE.BoxGeometry(0.11, 0.04, 0.055);
  const o2Pip = new THREE.Mesh(pipGeo, oxygenBarMat);
  o2Pip.position.set(-0.095, 0.2, 0.18);
  packGroup.add(o2Pip);
  const batPip = new THREE.Mesh(pipGeo, batteryBarMat);
  batPip.position.set(0.095, 0.2, 0.18);
  packGroup.add(batPip);

  // Twin Jetpack Thruster Nozzles & Flames
  const nozzleGeo = new THREE.CylinderGeometry(0.075, 0.115, 0.22, 12);
  const flameGeo = new THREE.ConeGeometry(0.1, 0.56, 10);
  flameGeo.rotateX(Math.PI);
  flameGeo.translate(0, -0.28, 0);

  const nozzleL = new THREE.Mesh(nozzleGeo, matDarkTrim);
  nozzleL.position.set(-0.2, -0.36, 0.04);
  nozzleL.rotation.z = -0.14;
  packGroup.add(nozzleL);

  const nozzleR = new THREE.Mesh(nozzleGeo, matDarkTrim);
  nozzleR.position.set(0.2, -0.36, 0.04);
  nozzleR.rotation.z = 0.14;
  packGroup.add(nozzleR);

  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.position.set(-0.22, -0.46, 0.04);
  flameLeft.visible = false;
  packGroup.add(flameLeft);

  const flameRight = new THREE.Mesh(flameGeo, flameMat);
  flameRight.position.set(0.22, -0.46, 0.04);
  flameRight.visible = false;
  packGroup.add(flameRight);

  disposables.push(packGeo, packTopGeo, bayGeo, barGeo, pipGeo, nozzleGeo, flameGeo);

  // 4. Articulated Arms & Gloves
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.28, 6, 12);
  const cuffGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12);
  const gloveGeo = new THREE.SphereGeometry(0.115, 12, 10);

  const buildArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.44, 1.38, 0);
    bodyPivot.add(pivot);

    const upper = new THREE.Mesh(armGeo, matSuitWhite);
    upper.position.set(side * 0.04, -0.22, 0);
    upper.rotation.z = side * 0.12;
    upper.castShadow = true;
    pivot.add(upper);

    const cuff = new THREE.Mesh(cuffGeo, matSuitOrange);
    cuff.position.set(side * 0.07, -0.4, 0);
    cuff.rotation.z = side * 0.12;
    pivot.add(cuff);

    const glove = new THREE.Mesh(gloveGeo, matSuitOrange);
    glove.position.set(side * 0.09, -0.5, 0);
    glove.castShadow = true;
    pivot.add(glove);

    return pivot;
  };

  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  disposables.push(armGeo, cuffGeo, gloveGeo);

  // Handheld Tools attached to Right Glove (pointing forward along -Y -> -Z when arm is raised)
  const blowerMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.25, metalness: 0.4 });
  const blowerBodyGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.36, 12);
  const blowerNozzleGeo = new THREE.CylinderGeometry(0.11, 0.06, 0.24, 12);
  const airBlowerTool = new THREE.Group();
  airBlowerTool.position.set(0.09, -0.52, -0.14);
  airBlowerTool.rotation.x = Math.PI / 2;
  airBlowerTool.visible = false;
  const blowerBody = new THREE.Mesh(blowerBodyGeo, blowerMat);
  const blowerTip = new THREE.Mesh(blowerNozzleGeo, matSuitOrange);
  blowerTip.position.y = -0.28;
  airBlowerTool.add(blowerBody, blowerTip);
  rightArmPivot.add(airBlowerTool);

  const wrenchShaftGeo = new THREE.BoxGeometry(0.07, 0.56, 0.04);
  const wrenchHeadGeo = new THREE.TorusGeometry(0.11, 0.035, 8, 14, Math.PI * 1.45);
  const wrenchMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.26, metalness: 0.85 });
  const wrenchTool = new THREE.Group();
  wrenchTool.position.set(0.09, -0.52, -0.18);
  wrenchTool.rotation.x = Math.PI / 2;
  wrenchTool.visible = false;
  const wrenchShaft = new THREE.Mesh(wrenchShaftGeo, wrenchMat);
  wrenchShaft.position.y = -0.14;
  const wrenchHead = new THREE.Mesh(wrenchHeadGeo, matSuitOrange);
  wrenchHead.position.y = -0.44;
  wrenchHead.rotation.z = 0.6;
  wrenchTool.add(wrenchShaft, wrenchHead);
  rightArmPivot.add(wrenchTool);

  const resinGeo = new THREE.BoxGeometry(0.28, 0.22, 0.2);
  const resinMat = new THREE.MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#16a34a',
    emissiveIntensity: 0.85,
    roughness: 0.28,
  });
  const heldResinKit = new THREE.Group();
  heldResinKit.position.set(-0.09, -0.52, -0.12);
  heldResinKit.visible = false;
  const resinBox = new THREE.Mesh(resinGeo, resinMat);
  heldResinKit.add(resinBox);
  leftArmPivot.add(heldResinKit);

  const fuseCoreGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.28, 12);
  fuseCoreGeo.rotateZ(Math.PI / 2);
  const fuseCapGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.07, 12);
  fuseCapGeo.rotateZ(Math.PI / 2);
  const fuseCoreMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const heldSpareFuse = new THREE.Group();
  heldSpareFuse.position.set(-0.09, -0.52, -0.14);
  heldSpareFuse.visible = false;
  const fuseCore = new THREE.Mesh(fuseCoreGeo, fuseCoreMat);
  const fuseCapL = new THREE.Mesh(fuseCapGeo, matGoldVisor);
  fuseCapL.position.x = -0.14;
  const fuseCapR = new THREE.Mesh(fuseCapGeo, matGoldVisor);
  fuseCapR.position.x = 0.14;
  heldSpareFuse.add(fuseCore, fuseCapL, fuseCapR);
  leftArmPivot.add(heldSpareFuse);

  disposables.push(
    blowerMat,
    blowerBodyGeo,
    blowerNozzleGeo,
    wrenchShaftGeo,
    wrenchHeadGeo,
    wrenchMat,
    resinGeo,
    resinMat,
    fuseCoreGeo,
    fuseCapGeo,
    fuseCoreMat,
  );

  // 5. Articulated Legs & Chunky Orange Moon Boots
  const legGeo = new THREE.CapsuleGeometry(0.115, 0.28, 6, 12);
  const kneeGeo = new THREE.SphereGeometry(0.125, 10, 10);
  const bootGeo = new THREE.BoxGeometry(0.24, 0.18, 0.34);

  const buildLeg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.17, 0.78, 0);
    bodyPivot.add(pivot);

    const leg = new THREE.Mesh(legGeo, matSuitWhite);
    leg.position.y = -0.3;
    leg.castShadow = true;
    pivot.add(leg);

    const knee = new THREE.Mesh(kneeGeo, matSuitOrange);
    knee.position.set(0, -0.32, -0.05);
    pivot.add(knee);

    const boot = new THREE.Mesh(bootGeo, matSuitOrange);
    boot.position.set(0, -0.68, -0.05);
    boot.castShadow = true;
    pivot.add(boot);

    const sole = new THREE.Mesh(bootGeo, matDarkTrim);
    sole.position.set(0, -0.75, -0.05);
    sole.scale.set(1.04, 0.35, 1.04);
    pivot.add(sole);

    return pivot;
  };

  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  disposables.push(legGeo, kneeGeo, bootGeo);

  // 6. Soft Contact Shadow Plane beneath Moon Boots
  const shadowTex = createRadialShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(1.35, 1.35);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.025;
  root.add(contactShadow);
  disposables.push(shadowTex, shadowGeo, shadowMat);

  return {
    root,
    bodyPivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    oxygenBar,
    oxygenBarMat,
    batteryBar,
    batteryBarMat,
    flameLeft,
    flameRight,
    headLamp,
    headLampMat,
    airBlowerTool,
    wrenchTool,
    heldResinKit,
    heldSpareFuse,
    contactShadow,
    disposables,
  };
}

export interface AresBotRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  antennaOrbMat: THREE.MeshStandardMaterial;
  thrusterFlame: THREE.Mesh;
  sideRings: THREE.Mesh[];
  hintSpotLight: THREE.SpotLight;
  hintBeamMesh: THREE.Mesh;
  setExpression: (mood: AresBotMood) => void;
  disposables: Array<{ dispose: () => void }>;
}

export function createAresBotModel(maxAnisotropy: number): AresBotRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const disposables: Array<{ dispose: () => void }> = [];

  const matShellWhite = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.25,
    metalness: 0.18,
  });
  const matAccentOrange = new THREE.MeshStandardMaterial({
    color: '#f97316',
    roughness: 0.28,
    metalness: 0.25,
  });
  const matDarkBezel = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.35,
    metalness: 0.65,
  });
  const matCyanGlow = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.45,
    roughness: 0.2,
  });
  const antennaOrbMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#38bdf8',
    emissiveIntensity: 1.6,
    roughness: 0.18,
  });
  disposables.push(matShellWhite, matAccentOrange, matDarkBezel, matCyanGlow, antennaOrbMat);

  // 1. Main Friendly Spherical Chassis
  const sphereGeo = new THREE.SphereGeometry(0.32, 24, 18);
  const sphere = new THREE.Mesh(sphereGeo, matShellWhite);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  bodyPivot.add(sphere);

  // Equatorial orange trim ring
  const beltGeo = new THREE.TorusGeometry(0.318, 0.026, 10, 28);
  beltGeo.rotateX(Math.PI / 2);
  const belt = new THREE.Mesh(beltGeo, matAccentOrange);
  bodyPivot.add(belt);

  // Back backpack mini-core
  const backPackGeo = new THREE.BoxGeometry(0.24, 0.24, 0.1);
  const backPack = new THREE.Mesh(backPackGeo, matDarkBezel);
  backPack.position.set(0, 0.02, 0.29);
  bodyPivot.add(backPack);

  // 2. Side Gyro Ear Pods with Glowing Rings
  const earGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.1, 14);
  earGeo.rotateZ(Math.PI / 2);
  const earRingGeo = new THREE.TorusGeometry(0.088, 0.016, 8, 18);
  earRingGeo.rotateY(Math.PI / 2);
  const sideRings: THREE.Mesh[] = [];

  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(earGeo, matAccentOrange);
    ear.position.set(side * 0.33, 0.03, 0);
    ear.castShadow = true;
    bodyPivot.add(ear);

    const earRing = new THREE.Mesh(earRingGeo, matCyanGlow);
    earRing.position.set(side * 0.37, 0.03, 0);
    bodyPivot.add(earRing);
    sideRings.push(earRing);
  });

  // 3. Top Spring Antenna & Status Orb
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.2, 8);
  const stem = new THREE.Mesh(stemGeo, matDarkBezel);
  stem.position.set(0, 0.39, 0.02);
  bodyPivot.add(stem);

  const orbGeo = new THREE.SphereGeometry(0.052, 12, 10);
  const orb = new THREE.Mesh(orbGeo, antennaOrbMat);
  orb.position.set(0, 0.51, 0.02);
  bodyPivot.add(orb);

  // 4. Recessed Front LED Face Screen & Bezel (Facing -Z Forward!)
  const bezelGeo = new THREE.TorusGeometry(0.205, 0.028, 10, 26);
  const bezel = new THREE.Mesh(bezelGeo, matDarkBezel);
  bezel.scale.set(1.18, 0.82, 1);
  bezel.position.set(0, 0.02, -0.285);
  bodyPivot.add(bezel);

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 128;
  const fCtx = faceCanvas.getContext('2d')!;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAnisotropy;

  let currentMood: AresBotMood | null = null;
  const drawFace = (mood: AresBotMood) => {
    if (currentMood === mood) return;
    currentMood = mood;

    // Deep OLED screen background
    fCtx.fillStyle = '#071324';
    fCtx.fillRect(0, 0, 256, 128);

    // Subtle LED pixel scanlines
    fCtx.fillStyle = 'rgba(56, 189, 248, 0.07)';
    for (let y = 0; y < 128; y += 6) {
      fCtx.fillRect(0, y, 256, 2);
    }

    if (mood === 'happy') {
      // Bright glowing happy eyes + cheerful smile
      fCtx.fillStyle = '#38bdf8';
      fCtx.strokeStyle = '#7dd3fc';
      fCtx.lineWidth = 5;

      // Left & Right rounded pill eyes
      [78, 178].forEach((ex) => {
        fCtx.beginPath();
        fCtx.roundRect(ex - 16, 30, 32, 42, 14);
        fCtx.fill();
        fCtx.fillStyle = '#e0f2fe';
        fCtx.beginPath();
        fCtx.arc(ex - 5, 42, 6, 0, Math.PI * 2);
        fCtx.fill();
        fCtx.fillStyle = '#38bdf8';
      });

      // Rosy orange cheek pixels
      fCtx.fillStyle = 'rgba(251, 146, 60, 0.55)';
      fCtx.beginPath();
      fCtx.arc(46, 78, 10, 0, Math.PI * 2);
      fCtx.arc(210, 78, 10, 0, Math.PI * 2);
      fCtx.fill();

      // Happy smile arc
      fCtx.strokeStyle = '#4ade80';
      fCtx.lineWidth = 7;
      fCtx.lineCap = 'round';
      fCtx.beginPath();
      fCtx.arc(128, 78, 22, 0.2, Math.PI - 0.2);
      fCtx.stroke();
    } else if (mood === 'worried') {
      // Expressive worried amber/coral LED eyes during storms/alerts
      fCtx.strokeStyle = '#fb923c';
      fCtx.fillStyle = '#fde047';
      fCtx.lineWidth = 7;
      fCtx.lineCap = 'round';

      // Slanted worried eyebrows
      fCtx.beginPath();
      fCtx.moveTo(56, 36);
      fCtx.lineTo(94, 24);
      fCtx.moveTo(200, 36);
      fCtx.lineTo(162, 24);
      fCtx.stroke();

      // Wide worried eyes
      [78, 178].forEach((ex) => {
        fCtx.fillStyle = '#facc15';
        fCtx.beginPath();
        fCtx.arc(ex, 56, 16, 0, Math.PI * 2);
        fCtx.fill();
        fCtx.fillStyle = '#071324';
        fCtx.beginPath();
        fCtx.arc(ex, 58, 6, 0, Math.PI * 2);
        fCtx.fill();
      });

      // Wavy worried mouth
      fCtx.strokeStyle = '#fb923c';
      fCtx.lineWidth = 6;
      fCtx.beginPath();
      fCtx.moveTo(100, 96);
      fCtx.quadraticCurveTo(114, 86, 128, 96);
      fCtx.quadraticCurveTo(142, 106, 156, 96);
      fCtx.stroke();
    } else {
      // Playful Winking Expression!
      // Left open sparkling eye
      fCtx.fillStyle = '#38bdf8';
      fCtx.beginPath();
      fCtx.roundRect(62, 30, 32, 42, 14);
      fCtx.fill();
      fCtx.fillStyle = '#e0f2fe';
      fCtx.beginPath();
      fCtx.arc(73, 42, 6, 0, Math.PI * 2);
      fCtx.fill();

      // Right winking '>' chevron eye
      fCtx.strokeStyle = '#facc15';
      fCtx.lineWidth = 8;
      fCtx.lineCap = 'round';
      fCtx.lineJoin = 'round';
      fCtx.beginPath();
      fCtx.moveTo(194, 38);
      fCtx.lineTo(166, 51);
      fCtx.lineTo(194, 64);
      fCtx.stroke();

      // Rosy cheeks
      fCtx.fillStyle = 'rgba(251, 146, 60, 0.6)';
      fCtx.beginPath();
      fCtx.arc(46, 78, 10, 0, Math.PI * 2);
      fCtx.arc(210, 78, 10, 0, Math.PI * 2);
      fCtx.fill();

      // Cheeky grin
      fCtx.strokeStyle = '#4ade80';
      fCtx.lineWidth = 7;
      fCtx.beginPath();
      fCtx.arc(128, 76, 24, 0.15, Math.PI - 0.15);
      fCtx.stroke();
    }

    faceTex.needsUpdate = true;
  };

  drawFace('happy');

  const faceGeo = new THREE.PlaneGeometry(0.42, 0.25);
  faceGeo.rotateY(Math.PI); // face toward -Z forward
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    emissiveMap: faceTex,
    emissive: '#ffffff',
    emissiveIntensity: 1.15,
    roughness: 0.12,
    metalness: 0.1,
  });
  const faceScreen = new THREE.Mesh(faceGeo, faceMat);
  faceScreen.position.set(0, 0.02, -0.304);
  bodyPivot.add(faceScreen);

  // 5. Bottom Hover Thruster Nozzle & Soft Cyan Flame
  const nozzleGeo = new THREE.CylinderGeometry(0.085, 0.125, 0.12, 14);
  const nozzle = new THREE.Mesh(nozzleGeo, matDarkBezel);
  nozzle.position.set(0, -0.33, 0);
  bodyPivot.add(nozzle);

  const flameGeo = new THREE.ConeGeometry(0.11, 0.34, 12);
  flameGeo.rotateX(Math.PI);
  flameGeo.translate(0, -0.17, 0);
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.82,
  });
  const thrusterFlame = new THREE.Mesh(flameGeo, flameMat);
  thrusterFlame.position.set(0, -0.37, 0);
  bodyPivot.add(thrusterFlame);

  // 6. Hint Spotlight & Volumetric Cone for spotlighting broken machines
  const hintSpotLight = new THREE.SpotLight('#fde047', 0, 14, Math.PI / 4.2, 0.45, 1.1);
  hintSpotLight.position.set(0, -0.25, 0);
  hintSpotLight.target.position.set(0, -4.0, 0);
  root.add(hintSpotLight);
  root.add(hintSpotLight.target);

  const hintBeamGeo = new THREE.ConeGeometry(1.18, 3.2, 18, 1, true);
  hintBeamGeo.translate(0, -1.6, 0);
  const hintBeamMat = new THREE.MeshBasicMaterial({
    color: '#fde047',
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const hintBeamMesh = new THREE.Mesh(hintBeamGeo, hintBeamMat);
  hintBeamMesh.position.set(0, -0.3, 0);
  hintBeamMesh.visible = false;
  root.add(hintBeamMesh);

  disposables.push(
    sphereGeo,
    beltGeo,
    backPackGeo,
    earGeo,
    earRingGeo,
    stemGeo,
    orbGeo,
    bezelGeo,
    faceTex,
    faceGeo,
    faceMat,
    nozzleGeo,
    flameGeo,
    flameMat,
    hintBeamGeo,
    hintBeamMat,
  );

  return {
    root,
    bodyPivot,
    antennaOrbMat,
    thrusterFlame,
    sideRings,
    hintSpotLight,
    hintBeamMesh,
    setExpression: drawFace,
    disposables,
  };
}

