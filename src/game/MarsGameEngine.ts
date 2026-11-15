import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { marsAudio } from './audio';
import { createModularMarsBase, ModularBaseRig } from './baseBuilder';
import { BUNKER_FLOOR_Y, getBaseWalkableSurface, HUB_FLOOR_Y, resolveBaseWallCollisions, WallBox } from './baseLayout';
import {
  AresBotRig,
  AstronautRig,
  CollectibleInstance,
  createAresBotModel,
  createAstronautModel,
  createCollectibleMesh,
  createDustDevil,
  createGeyserVent,
  createModulePad,
  createRoverModel,
  DustDevilActor,
  GeyserActor,
  ModulePadRig,
  RoverRig,
} from './models';
import { createMartianSky, MartianSkySystem, WeatherAtmosphere } from './sky';
import {
  BoulderSpec,
  CRATERS,
  createMartianTerrain,
  groundHeightAt,
  groundNormalAt,
  WORLD_PLAYABLE_RADIUS,
} from './terrain';
import {
  AresBotMood,
  GameHudState,
  GamePhase,
  HAZARD_SHORT_LABELS,
  HazardId,
  MODULE_CONFIGS,
  ModuleId,
  OrientationPhase,
  PRACTICE_TASK_CONFIGS,
  PracticeTaskId,
  RadarBlip,
  ResourceType,
  ROOM_EMERGENCY_INFO,
  ROOM_ORIENTATION_CARDS,
  RoomId,
  ToolId,
  ViewMode,
} from './types';

// Pre-allocated math helpers (Zero GC in render loop)
const _camDesiredPos = new THREE.Vector3();
const _camDesiredLook = new THREE.Vector3();
const _camLookCurrent = new THREE.Vector3();
const _groundNormal = new THREE.Vector3();
const _particleDummy = new THREE.Object3D();
const _particleColor = new THREE.Color();
const _weatherState: WeatherAtmosphere = { purpleFactor: 0, dustFactor: 0, frostFactor: 0 };
const _panelWorldPos = new THREE.Vector3();

function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

interface MeteorStreak {
  active: boolean;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

export class MarsGameEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: GameHudState) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;

  private clock = new THREE.Clock();
  private elapsedTime = 0;
  private hudSyncTimer = 0;

  // World & Actors
  private sky!: MartianSkySystem;
  private astronaut!: AstronautRig;
  private aresBot!: AresBotRig;
  private parkedRover!: RoverRig;
  private modularBase!: ModularBaseRig;
  private modulePads: ModulePadRig[] = [];
  private boulders: BoulderSpec[] = [];
  private collectibles: CollectibleInstance[] = [];
  private dustDevils: DustDevilActor[] = [];
  private geysers: GeyserActor[] = [];
  private disposables: Array<{ dispose: () => void }> = [];

  // Pooled particles
  private particleMesh!: THREE.InstancedMesh;
  private particles: PooledParticle[] = [];
  private particleCursor = 0;
  private dustEmitTimer = 0;

  // Astronaut & Rover State
  private phase: GamePhase = 'title';
  private viewMode: ViewMode = 'third';
  private vehicleMode: 'foot' | 'rover' = 'foot';
  private playerPos = new THREE.Vector3(0, HUB_FLOOR_Y, 4.4);
  private playerVelX = 0;
  private playerVelZ = 0;
  private playerVelY = 0;
  private playerHeading = 0; // 0 = facing -Z (toward Central Command Table & Greenhouse)
  private stridePhase = 0;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private squashX = 1;
  private squashY = 1;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private devilCooldown = 0;
  private geyserCooldown = 0;

  // A.R.E.S. Bot Companion State
  private aresPos = new THREE.Vector3(0.92, HUB_FLOOR_Y + 1.88, 4.6);
  private aresHeading = 0;
  private aresMood: AresBotMood = 'happy';
  private aresWinkTimer = 0;
  private aresNextWinkCountdown = 6.5;
  private aresParticleTimer = 0;
  private aresSpeech: string | null = null;
  private aresSpeechTimer = 0;
  private aresTipTimer = 11.5;
  private aresTipIndex = 0;
  private lastSpokenLocation = 'Central Command Hub';

  // Drivable Rookie-1 Rover State
  private roverPos = new THREE.Vector3(3.8, 0.09, 28.4);
  private roverHeading = Math.PI * 0.88;
  private roverSpeed = 0;
  private roverSteer = 0;
  private roverWheelSpin = 0;
  private roverVelY = 0;
  private roverGrounded = true;
  private roverPitch = 0;
  private roverRoll = 0;

  // Mouse-Look Orbit State
  private camYaw = 0;
  private camPitch = 0.24;
  private camDistance = 7.2;
  private currentEffectiveDist = 7.2;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerDownPos = { x: 0, y: 0, button: 0 };
  private raycaster = new THREE.Raycaster();
  private ndcPointer = new THREE.Vector2();

  // Progression & Suit Vitals
  private iron = 0;
  private ice = 0;
  private stars = 0;
  private totalCollected = 0;
  private oxygen = 100;
  private battery = 100;
  private water = 100;
  private food = 100;
  private radiation = 6;
  private locationName = 'Central Command Hub';
  private activeEmergency: RoomId | null = null;
  private emergencyTimer = 9.0;
  private emergencyCursor = 0;
  private emergenciesFixed = 0;
  private closedDoorColliders: WallBox[] = [];

  // 6 Interactive Weather & Space Hazards State
  private activeHazard: HazardId | null = null;
  private hazardTimer = 24.0;
  private hazardCursor = 0;
  private solarOutputPct = 100;
  private frostLevel = 0;
  private activeTool: ToolId = 'none';
  private hasResinKit = false;
  private hasSpareFuse = false;
  private nightModeActive = false;
  private slowChargeActive = false;
  private pebblesRemaining = 0;
  private dishRepairPct = 100;
  private dishTilt = 0;
  private leverPullAnim = 0;
  private coolingLeverPull = 0;
  private groundingSwitchPull = 0;
  private fuseLockerOpen = 0;
  private fuseSparkTimer = 0;
  private smokeEmitTimer = 0;
  private roverDockSparkTimer = 0;
  private lightFlickerLevel = 1;
  private heaterBoostTimer = 0;
  private toolSwingTimer = 0;
  private weatherPurple = 0;
  private weatherDust = 0;
  private weatherFrost = 0;
  private hazardGaleTimer = 0;
  private leakMistTimer = 0;
  private meteorSpawnTimer = 0;
  private meteorStreaks: MeteorStreak[] = [];
  private strikeVortex!: DustDevilActor;
  private strikeVortexTimer = 0;

  // Cadet Orientation & Practice Dust Drill State
  private orientationPhase: OrientationPhase = 'orientation';
  private unlockedRooms: Record<RoomId, boolean> = {
    power: false,
    greenhouse: false,
    bunker: false,
    airlock: false,
  };
  private completedTasks: Record<PracticeTaskId, boolean> = {
    scan: false,
    fan: false,
    plants: false,
    blast: false,
    suit: false,
  };
  private activeHologramRoom: RoomId | null = null;
  private dismissedHoloRoom: RoomId | null = null;
  private shuttersClosed = false;
  private shutterAnimProgress = 0;
  private shutterAutoReopenTimer = 0;
  private scanBurstTimer = 0;
  private fanBoostTimer = 0;
  private blastTestTimer = 0;
  private hintTarget: { x: number; y: number; z: number; timer: number } | null = null;

  private builtModules: Record<ModuleId, boolean> = {
    solar: false,
    biodome: false,
    garage: false,
    antenna: false,
  };
  private solProgress = 0.18;
  private solNumber = 1;
  private timeScale = 1;
  private timeOfDayLabel = 'High Noon';
  private toastMessage: string | null = null;
  private toastTimer = 0;

  // Input state
  private heldKeys = new Set<string>();
  private virtualInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  constructor(container: HTMLElement, onHudUpdate: (hud: GameHudState) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    // 1. Software WebGL Guard
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const pixelRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.12, 420);
    this.camera.position.set(16, 10, 24);
    _camLookCurrent.set(0, 2, 0);

    // 2. Studio Environment Reflection (RoomEnvironment) for reflective gold visor & metals
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.disposables.push(envTex);
    pmremGenerator.dispose();

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // 3. Build Martian World
    this.sky = createMartianSky(this.scene, this.isSoftwareGl, pixelRatio);

    const terrainRes = createMartianTerrain(maxAnisotropy);
    this.scene.add(terrainRes.terrainGroup);
    this.boulders = terrainRes.boulders;
    this.disposables.push(...terrainRes.disposables);

    this.modularBase = createModularMarsBase(this.isSoftwareGl, maxAnisotropy);
    this.scene.add(this.modularBase.group);
    this.disposables.push(...this.modularBase.disposables);

    MODULE_CONFIGS.forEach((cfg) => {
      const pad = createModulePad(cfg, this.isSoftwareGl, maxAnisotropy);
      pad.root.position.set(cfg.x, groundHeightAt(cfg.x, cfg.z), cfg.z);
      this.scene.add(pad.root);
      this.modulePads.push(pad);
      this.disposables.push(...pad.disposables);
    });

    // Drivable Rookie-1 6-Wheeled Rover parked in Ares Alpha Exterior Yard
    this.parkedRover = createRoverModel(this.isSoftwareGl, maxAnisotropy);
    const rX = 3.8;
    const rZ = 28.4;
    this.roverPos.set(rX, Math.max(0.09, groundHeightAt(rX, rZ)), rZ);
    this.roverHeading = Math.PI * 0.88;
    this.parkedRover.root.position.copy(this.roverPos);
    this.parkedRover.root.rotation.y = this.roverHeading;
    this.scene.add(this.parkedRover.root);
    this.disposables.push(...this.parkedRover.disposables);

    // Hero Junior Astronaut Protagonist (inside Central Command Hub)
    this.astronaut = createAstronautModel();
    this.playerPos.set(0, HUB_FLOOR_Y, 4.4);
    this.astronaut.root.position.copy(this.playerPos);
    this.scene.add(this.astronaut.root);
    this.disposables.push(...this.astronaut.disposables);

    // Friendly Floating Spherical Companion: A.R.E.S. Bot
    this.aresBot = createAresBotModel(maxAnisotropy);
    this.aresPos.set(0.92, HUB_FLOOR_Y + 1.88, 4.6);
    this.aresBot.root.position.copy(this.aresPos);
    this.scene.add(this.aresBot.root);
    this.disposables.push(...this.aresBot.disposables);

    this.spawnCollectibles();
    this.spawnHazards();
    this.initWeatherProps();
    this.initParticlePool();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.pushHudState();
    this.clock.start();
    this.tick();
  }

  private initWeatherProps() {
    // 5 reusable glowing Meteorite Streak projectiles for Micro-Meteorite Shower
    const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const tailGeo = new THREE.ConeGeometry(0.22, 2.8, 7);
    const headMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.85 });
    this.disposables.push(headGeo, tailGeo, headMat, tailMat);

    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Group();
      const head = new THREE.Mesh(headGeo, headMat);
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(0.65, 1.15, -0.4);
      tail.rotation.set(0.32, 0, -0.45);
      mesh.add(head, tail);
      mesh.visible = false;
      this.scene.add(mesh);
      this.meteorStreaks.push({ active: false, mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
    }

    // Rogue Exterior Dust Devil Strike Vortex that hits Comms Dish at (9.85, 25.45)
    this.strikeVortex = createDustDevil(9.85, 25.45, 0.01, 0, 1.0, this.disposables);
    this.strikeVortex.group.visible = false;
    this.scene.add(this.strikeVortex.group);
  }

  private spawnCollectibles() {
    let id = 1;
    const addItem = (kind: ResourceType, x: number, z: number) => {
      const y = groundHeightAt(x, z);
      const item = createCollectibleMesh(id++, kind, x, y, z, this.disposables);
      this.scene.add(item.group);
      this.collectibles.push(item);
    };

    const starterAngles = [0.4, 1.3, 2.2, 3.1, 4.0, 4.9, 5.7];
    starterAngles.forEach((ang, idx) => {
      const r = 40 + (idx % 2) * 5;
      addItem(idx % 2 === 0 ? 'iron' : 'ice', Math.cos(ang) * r, Math.sin(ang) * r);
    });

    CRATERS.forEach((c, idx) => {
      addItem('ice', c.x, c.z);
      if (c.radius > 11) {
        addItem('ice', c.x + c.radius * 0.32, c.z - c.radius * 0.28);
      }
      const rimAng = idx * 1.37;
      addItem('iron', c.x + Math.cos(rimAng) * c.radius * 1.04, c.z + Math.sin(rimAng) * c.radius * 1.04);
      addItem(
        'iron',
        c.x + Math.cos(rimAng + 2.2) * c.radius * 1.1,
        c.z + Math.sin(rimAng + 2.2) * c.radius * 1.1,
      );
    });

    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2 + 0.2;
      const dist = 46 + ((i * 19) % 66);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      addItem(i % 3 === 0 ? 'ice' : 'iron', x, z);
    }

    const starSpots: Array<[number, number]> = [
      [-46, -38],
      [54, -42],
      [-60, 48],
      [0, -72],
      [88, 6],
      [-90, -8],
      [68, 64],
      [-68, -62],
    ];
    starSpots.forEach(([sx, sz]) => {
      addItem('stars', sx + 2.2, sz - 1.8);
    });
  }

  private spawnHazards() {
    const devilConfigs: Array<[number, number, number, number, number]> = [
      [-42, 16, 15, 0.0, 0.55],
      [48, -18, 17, 1.4, 0.48],
      [-18, -58, 18, 2.7, 0.52],
      [24, 62, 16, 4.1, 0.58],
      [76, 36, 19, 5.2, 0.44],
    ];
    devilConfigs.forEach(([ax, az, rad, ph, sp]) => {
      const d = createDustDevil(ax, az, rad, ph, sp, this.disposables);
      this.scene.add(d.group);
      this.dustDevils.push(d);
    });

    const geyserCoords: Array<[number, number, number]> = [
      [34, 18, 0.5],
      [-35, -18, 2.2],
      [14, -44, 4.0],
      [-48, 34, 1.1],
      [58, -56, 3.3],
    ];
    geyserCoords.forEach(([gx, gz, ph]) => {
      const gy = groundHeightAt(gx, gz);
      const g = createGeyserVent(gx, gy, gz, ph, this.disposables);
      this.scene.add(g.group);
      this.geysers.push(g);
    });
  }

  private initParticlePool() {
    const maxParticles = 150;
    const geo = new THREE.SphereGeometry(0.22, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.85,
    });
    this.particleMesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.01,
        r: 1,
        g: 1,
        b: 1,
      });
      _particleDummy.position.set(0, -100, 0);
      _particleDummy.scale.setScalar(0.001);
      _particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _particleDummy.matrix);
      this.particleMesh.setColorAt(i, _particleColor.setHex(0xffffff));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);
    this.disposables.push(geo, mat);
  }

  private emitParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    size: number,
    hexColor: string,
  ) {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.size = size;
    _particleColor.set(hexColor);
    p.r = _particleColor.r;
    p.g = _particleColor.g;
    p.b = _particleColor.b;
  }

  private emitBurst(x: number, y: number, z: number, count: number, color: string, speed = 7) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      this.emitParticle(
        x,
        y,
        z,
        Math.cos(a) * spd,
        2.0 + Math.random() * speed * 0.75,
        Math.sin(a) * spd,
        0.5 + Math.random() * 0.45,
        0.65 + Math.random() * 0.8,
        color,
      );
    }
  }

  private emitConfettiBurst(x: number, y: number, z: number, count = 75) {
    const colors = ['#facc15', '#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#a78bfa'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 7.5;
      const col = colors[i % colors.length];
      this.emitParticle(
        x + (Math.random() - 0.5) * 3.5,
        y + Math.random() * 1.4,
        z + (Math.random() - 0.5) * 3.5,
        Math.cos(a) * spd,
        4.2 + Math.random() * 6.5,
        Math.sin(a) * spd,
        1.45 + Math.random() * 0.85,
        0.55 + Math.random() * 0.55,
        col,
      );
    }
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: true });
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleWindowBlur = () => {
    this.heldKeys.clear();
    this.isDraggingLook = false;
    this.virtualInput.forward = false;
    this.virtualInput.backward = false;
    this.virtualInput.left = false;
    this.virtualInput.right = false;
    this.virtualInput.sprint = false;
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    this.isDraggingLook = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.pointerDownPos = { x: e.clientX, y: e.clientY, button: e.button };
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    const isLocked = document.pointerLockElement === this.renderer.domElement;
    if (!isLocked && !this.isDraggingLook) return;

    const dx = isLocked ? e.movementX : e.clientX - this.lastPointerX;
    const dy = isLocked ? e.movementY : e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const sensitivity = 0.0042;
    this.camYaw -= dx * sensitivity;
    const minPitch = this.viewMode === 'first' ? -1.1 : -0.32;
    const maxPitch = this.viewMode === 'first' ? 1.1 : 1.05;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sensitivity, minPitch, maxPitch);
  };

  private handlePointerUp = (e: PointerEvent) => {
    this.isDraggingLook = false;
    if (this.phase !== 'playing') return;
    const distMoved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (this.pointerDownPos.button === 0 && distMoved < 10) {
      this.triggerPrimaryToolAction(e);
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.viewMode !== 'third') return;
    this.camDistance = THREE.MathUtils.clamp(this.camDistance + e.deltaY * 0.005, 4.5, 14.0);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    const wasHeld = this.heldKeys.has(e.code);
    this.heldKeys.add(e.code);

    if (e.code === 'Escape' && !wasHeld) {
      if (this.phase === 'playing') {
        this.pauseMission();
      } else if (this.phase === 'paused') {
        this.resumeMission();
      }
      return;
    }

    if ((e.code === 'Enter' || e.code === 'Space') && !wasHeld && this.phase === 'title') {
      this.startMission();
      return;
    }

    if (this.phase === 'playing' && !wasHeld) {
      if (e.code === 'Space') {
        this.jumpBufferTimer = 0.15;
      }
      if (e.code === 'KeyE') {
        this.handleInteractKey();
      }
      if (e.code === 'KeyF') {
        this.triggerBuild();
      }
      if (e.code === 'KeyV') {
        this.toggleViewMode();
      }
      if (e.code === 'KeyB') {
        this.triggerEmergencyDrill();
      }
      if (e.code === 'Digit1') this.triggerHazard('solar_storm');
      if (e.code === 'Digit2') this.triggerHazard('dust_storm');
      if (e.code === 'Digit3') this.triggerHazard('dusty_panels');
      if (e.code === 'Digit4') this.triggerHazard('meteor_shower');
      if (e.code === 'Digit5') this.triggerHazard('cold_snap');
      if (e.code === 'Digit6') this.triggerHazard('dish_strike');
      if (e.code === 'Digit7') this.triggerHazard('battery_overheat');
      if (e.code === 'Digit8') this.triggerHazard('night_drain');
      if (e.code === 'Digit9') this.triggerHazard('blown_fuse');
      if (e.code === 'Digit0') this.triggerHazard('static_surge');
      if (e.code === 'Minus') this.triggerHazard('solar_jam');
      if (e.code === 'Equal') this.triggerHazard('rover_overload');
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  // Public UI actions
  public startMission() {
    marsAudio.playClick();
    this.phase = 'playing';
    this.pushHudState();
  }

  public pauseMission() {
    if (this.phase !== 'playing') return;
    marsAudio.playClick();
    marsAudio.setWindLoop(false);
    this.heldKeys.clear();
    this.isDraggingLook = false;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.phase = 'paused';
    this.pushHudState();
  }

  public resumeMission() {
    if (this.phase !== 'paused') return;
    marsAudio.playClick();
    if (this.activeHazard === 'dust_storm') {
      marsAudio.setWindLoop(true);
    }
    this.phase = 'playing';
    this.pushHudState();
  }

  public toggleViewMode() {
    marsAudio.playClick();
    this.viewMode = this.viewMode === 'third' ? 'first' : 'third';
    if (this.viewMode === 'first') {
      this.camPitch = THREE.MathUtils.clamp(this.camPitch, -0.9, 0.9);
      this.astronaut.root.visible = false;
    } else {
      this.camPitch = THREE.MathUtils.clamp(this.camPitch, 0.05, 0.95);
      this.astronaut.root.visible = this.vehicleMode === 'foot';
    }
    this.pushHudState();
  }

  private isNearRover(): boolean {
    if (this.vehicleMode === 'rover') return true;
    const dx = this.playerPos.x - this.roverPos.x;
    const dz = this.playerPos.z - this.roverPos.z;
    const dy = Math.abs(this.playerPos.y - this.roverPos.y);
    return dx * dx + dz * dz < 4.6 * 4.6 && dy < 2.8;
  }

  private isNearBunkerLever(): boolean {
    return (
      Math.hypot(this.playerPos.x - 16.25, this.playerPos.z + 2.05) < 3.6 &&
      Math.abs(this.playerPos.y - BUNKER_FLOOR_Y) < 2.5
    );
  }

  private isNearResinKit(): boolean {
    return (
      Math.hypot(this.playerPos.x + 14.3, this.playerPos.z + 2.1) < 3.6 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    );
  }

  private isInsideGreenhouseDome(): boolean {
    return (
      Math.hypot(this.playerPos.x, this.playerPos.z + 18.0) < 7.2 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    );
  }

  private isNearHeaterCore(): boolean {
    return (
      Math.hypot(this.playerPos.x + 22.2, this.playerPos.z) < 3.9 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    );
  }

  private isNearCommsDish(): boolean {
    return Math.hypot(this.playerPos.x - 9.85, this.playerPos.z - 25.45) < 5.8;
  }

  private isNearCoolingVentLever(): boolean {
    return (
      Math.hypot(this.playerPos.x + 15.45, this.playerPos.z - 2.35) < 3.4 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    );
  }

  private isNearCommandConsole(): boolean {
    return Math.hypot(this.playerPos.x, this.playerPos.z) < 4.4 && Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4;
  }

  private isNearFuseLocker(): boolean {
    return (
      Math.hypot(this.playerPos.x + 13.85, this.playerPos.z - 2.9) < 3.4 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    );
  }

  private isNearFuseBox(): boolean {
    return (
      Math.hypot(this.playerPos.x + 22.3, this.playerPos.z + 1.35) < 3.5 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    );
  }

  private isNearGroundingSwitch(): boolean {
    return Math.hypot(this.playerPos.x + 5.6, this.playerPos.z - 23.0) < 3.8 && this.playerPos.y < 2.4;
  }

  private isNearJammedSolarPanel(): boolean {
    return Math.hypot(this.playerPos.x + 4.4, this.playerPos.z - 25.6) < 4.4 && this.playerPos.y < 2.4;
  }

  private isNearRoverDock(): boolean {
    return Math.hypot(this.playerPos.x - 6.8, this.playerPos.z - 28.4) < 3.8 && this.playerPos.y < 2.4;
  }

  private getCleanedPanelCount(): number {
    let clean = 0;
    for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
      if (this.modularBase.solarTrackers[i].dustAmount <= 0.08) clean += 1;
    }
    return clean;
  }

  public triggerHazard(kind: HazardId) {
    if (this.phase === 'title') {
      this.phase = 'playing';
    }
    if (this.phase !== 'playing') return;

    // Reset previous hazard wind/props cleanly so switching between hazards works seamlessly
    marsAudio.setWindLoop(false);
    this.hasResinKit = false;
    this.hasSpareFuse = false;
    this.astronaut.heldResinKit.visible = false;
    this.astronaut.heldSpareFuse.visible = false;
    this.modularBase.resinKitProp.visible = false;
    this.modularBase.greenhouseCracksGroup.visible = false;
    this.modularBase.lockerSpareFuseProp.visible = true;
    this.strikeVortex.group.visible = false;
    this.strikeVortexTimer = 0;
    this.dishRepairPct = 100;
    this.dishTilt = 0;
    this.pebblesRemaining = 0;
    this.lightFlickerLevel = 1;
    for (let i = 0; i < this.modularBase.solarJamPebbles.length; i++) {
      this.modularBase.solarJamPebbles[i].visible = false;
    }
    for (let i = 0; i < this.modularBase.doorLightningArcs.length; i++) {
      this.modularBase.doorLightningArcs[i].visible = false;
    }
    for (let i = 0; i < this.meteorStreaks.length; i++) {
      this.meteorStreaks[i].active = false;
      this.meteorStreaks[i].mesh.visible = false;
    }
    for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
      const tr = this.modularBase.solarTrackers[i];
      tr.dustAmount = 0;
      tr.dustMesh.visible = false;
    }

    this.activeHazard = kind;
    this.solarOutputPct = 100;

    if (kind === 'solar_storm') {
      this.unlockedRooms.bunker = true;
      this.leverPullAnim = 0;
      this.radiation = 68;
      marsAudio.playHazardAlarm('solar_storm');
      this.hintTarget = { x: 16.25, y: BUNKER_FLOOR_Y, z: -2.05, timer: 6.5 };
    } else if (kind === 'dust_storm') {
      this.shuttersClosed = false;
      this.solarOutputPct = 10;
      marsAudio.playHazardAlarm('dust_storm');
      marsAudio.setWindLoop(true);
      this.hintTarget = { x: 0, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
    } else if (kind === 'dusty_panels') {
      this.unlockedRooms.airlock = true;
      this.solarOutputPct = 20;
      for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
        const tr = this.modularBase.solarTrackers[i];
        tr.dustAmount = 1;
        tr.dustMesh.visible = true;
        tr.dustMat.opacity = 0.92;
      }
      marsAudio.playHazardAlarm('dusty_panels');
      this.hintTarget = { x: -7.6, y: 0.6, z: 27.9, timer: 6.5 };
    } else if (kind === 'meteor_shower') {
      this.unlockedRooms.power = true;
      this.unlockedRooms.greenhouse = true;
      this.modularBase.resinKitProp.visible = true;
      this.modularBase.greenhouseCracksGroup.visible = true;
      this.meteorSpawnTimer = 0.05;
      marsAudio.playMeteorStrike();
      marsAudio.playHazardAlarm('meteor_shower');
      this.emitBurst(0, HUB_FLOOR_Y + 4.4, -18.0, 20, '#fb923c', 7);
      this.hintTarget = { x: -14.3, y: HUB_FLOOR_Y, z: -2.1, timer: 6.5 };
    } else if (kind === 'cold_snap') {
      this.unlockedRooms.power = true;
      this.heaterBoostTimer = 0;
      marsAudio.playHazardAlarm('cold_snap');
      this.hintTarget = { x: -22.2, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
    } else if (kind === 'dish_strike') {
      this.unlockedRooms.airlock = true;
      this.dishRepairPct = 0;
      this.dishTilt = 0.96;
      this.strikeVortexTimer = 3.0;
      this.strikeVortex.group.visible = true;
      marsAudio.playHazardAlarm('dish_strike');
      this.emitBurst(9.85, 2.8, 25.45, 24, '#fb923c', 8);
      this.hintTarget = { x: 9.85, y: 0.8, z: 25.45, timer: 6.5 };
    } else if (kind === 'battery_overheat') {
      this.unlockedRooms.power = true;
      this.coolingLeverPull = 0;
      this.smokeEmitTimer = 0;
      marsAudio.playHazardAlarm('battery_overheat');
      this.emitBurst(-15.45, HUB_FLOOR_Y + 2.2, 3.7, 16, '#fb923c', 5.5);
      this.hintTarget = { x: -15.45, y: HUB_FLOOR_Y, z: 2.35, timer: 6.5 };
    } else if (kind === 'night_drain') {
      this.nightModeActive = false;
      this.solarOutputPct = 0;
      if (this.solProgress < 0.54 || this.solProgress > 0.88) {
        this.solProgress = 0.56;
      }
      marsAudio.playHazardAlarm('night_drain');
      this.hintTarget = { x: 0, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
    } else if (kind === 'blown_fuse') {
      this.unlockedRooms.power = true;
      this.hasSpareFuse = false;
      this.fuseSparkTimer = 0;
      this.modularBase.lockerSpareFuseProp.visible = true;
      marsAudio.playElectricZap();
      marsAudio.playHazardAlarm('blown_fuse');
      this.emitBurst(-22.7, HUB_FLOOR_Y + 1.45, -1.35, 16, '#facc15', 6);
      this.hintTarget = { x: -13.85, y: HUB_FLOOR_Y, z: 2.9, timer: 6.5 };
    } else if (kind === 'static_surge') {
      this.unlockedRooms.airlock = true;
      this.groundingSwitchPull = 0;
      for (let i = 0; i < this.modularBase.doorLightningArcs.length; i++) {
        this.modularBase.doorLightningArcs[i].visible = true;
      }
      marsAudio.playElectricZap();
      marsAudio.playHazardAlarm('static_surge');
      this.hintTarget = { x: -5.6, y: 0.4, z: 23.0, timer: 6.5 };
    } else if (kind === 'solar_jam') {
      this.unlockedRooms.airlock = true;
      this.solarOutputPct = 65;
      this.pebblesRemaining = this.modularBase.solarJamPebbles.length;
      for (let i = 0; i < this.modularBase.solarJamPebbles.length; i++) {
        this.modularBase.solarJamPebbles[i].visible = true;
      }
      marsAudio.playHazardAlarm('solar_jam');
      this.hintTarget = { x: -4.4, y: 0.4, z: 25.6, timer: 6.5 };
    } else if (kind === 'rover_overload') {
      this.unlockedRooms.airlock = true;
      this.slowChargeActive = false;
      this.roverDockSparkTimer = 0;
      marsAudio.playElectricZap();
      marsAudio.playHazardAlarm('rover_overload');
      this.emitBurst(6.8, 1.5, 28.4, 16, '#ef4444', 6);
      this.hintTarget = { x: 6.8, y: 0.4, z: 28.4, timer: 6.5 };
    }

    this.pushHudState();
  }

  private clearJammedPebble() {
    if (this.activeHazard !== 'solar_jam' || this.pebblesRemaining <= 0) return;
    this.toolSwingTimer = 0.25;
    this.pebblesRemaining -= 1;
    const idxToHide = this.pebblesRemaining;
    if (this.modularBase.solarJamPebbles[idxToHide]) {
      this.modularBase.solarJamPebbles[idxToHide].visible = false;
    }
    marsAudio.playPebbleClear();
    this.emitBurst(-4.4, 0.55, 25.6, 14, '#ea580c', 6);

    if (this.pebblesRemaining <= 0) {
      this.activeHazard = null;
      this.solarOutputPct = 100;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playEmergencyFixed();
      this.emitBurst(-4.4, 1.8, 25.6, 26, '#4ade80', 8);
    }
    this.pushHudState();
  }

  private applyWrenchToDish() {
    if (this.activeHazard !== 'dish_strike') return;
    this.toolSwingTimer = 0.32;
    marsAudio.playWrenchTurn();
    this.dishRepairPct = Math.min(100, this.dishRepairPct + 34);
    this.emitBurst(9.85, 2.8, 25.45, 16, '#facc15', 7);

    if (this.dishRepairPct >= 100) {
      this.activeHazard = null;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playEmergencyFixed();
      this.emitBurst(9.85, 3.2, 25.45, 28, '#4ade80', 8.5);
    }
    this.pushHudState();
  }

  public triggerPrimaryToolAction(e?: PointerEvent) {
    if (this.phase !== 'playing' || this.vehicleMode !== 'foot') return;

    if (this.activeHazard === 'solar_jam' && this.isNearJammedSolarPanel()) {
      this.clearJammedPebble();
      return;
    }

    if (this.activeHazard === 'dish_strike' && this.isNearCommsDish()) {
      this.applyWrenchToDish();
      return;
    }

    if (this.activeHazard === 'dusty_panels') {
      const surface = getBaseWalkableSurface(
        this.playerPos.x,
        this.playerPos.z,
        this.playerPos.y,
        groundHeightAt(this.playerPos.x, this.playerPos.z),
      );
      if (surface.indoors) return;

      this.toolSwingTimer = 0.25;
      marsAudio.playAirBlower();

      // Spray crisp white-cyan air blast stream in facing direction
      const fwdX = -Math.sin(this.playerHeading);
      const fwdZ = -Math.cos(this.playerHeading);
      for (let p = 0; p < 10; p++) {
        const spread = (Math.random() - 0.5) * 0.45;
        this.emitParticle(
          this.playerPos.x + fwdX * 0.9,
          this.playerPos.y + 1.1,
          this.playerPos.z + fwdZ * 0.9,
          (fwdX + spread) * (6.5 + Math.random() * 3.5),
          (Math.random() - 0.3) * 1.4,
          (fwdZ + spread) * (6.5 + Math.random() * 3.5),
          0.32,
          0.36,
          '#e0f2fe',
        );
      }

      // Raycast clicked panel OR clean nearest dusty panel within 7.5m
      let hitIdx = -1;
      if (e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.ndcPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.ndcPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.ndcPointer, this.camera);
        const targets: THREE.Object3D[] = [];
        for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
          targets.push(this.modularBase.solarTrackers[i].dustMesh, this.modularBase.solarTrackers[i].panelMesh);
        }
        const hits = this.raycaster.intersectObjects(targets, false);
        if (hits.length > 0 && hits[0].distance < 16) {
          const pIdx = hits[0].object.userData?.panelIndex;
          if (typeof pIdx === 'number' && this.modularBase.solarTrackers[pIdx].dustAmount > 0.05) {
            this.modularBase.solarTrackers[pIdx].panelMesh.getWorldPosition(_panelWorldPos);
            if (this.playerPos.distanceTo(_panelWorldPos) < 9.5) {
              hitIdx = pIdx;
            }
          }
        }
      }

      if (hitIdx < 0) {
        let bestDist = 7.2;
        for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
          const tr = this.modularBase.solarTrackers[i];
          if (tr.dustAmount <= 0.05) continue;
          tr.panelMesh.getWorldPosition(_panelWorldPos);
          const d = this.playerPos.distanceTo(_panelWorldPos);
          if (d < bestDist) {
            bestDist = d;
            hitIdx = i;
          }
        }
      }

      if (hitIdx >= 0) {
        const tr = this.modularBase.solarTrackers[hitIdx];
        tr.dustAmount = Math.max(0, tr.dustAmount - 0.55);
        tr.dustMat.opacity = tr.dustAmount * 0.92;
        tr.dustMesh.visible = tr.dustAmount > 0.05;
        tr.panelMesh.getWorldPosition(_panelWorldPos);
        this.emitBurst(_panelWorldPos.x, _panelWorldPos.y + 0.35, _panelWorldPos.z, 12, '#ea580c', 5.2);

        if (this.getCleanedPanelCount() >= 6) {
          for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
            this.modularBase.solarTrackers[i].dustAmount = 0;
            this.modularBase.solarTrackers[i].dustMesh.visible = false;
          }
          this.activeHazard = null;
          this.solarOutputPct = 100;
          this.hintTarget = null;
          this.hazardTimer = 24.0;
          this.emergenciesFixed += 1;
          marsAudio.playEmergencyFixed();
          this.emitBurst(_panelWorldPos.x, _panelWorldPos.y + 0.8, _panelWorldPos.z, 26, '#4ade80', 8);
        }
        this.pushHudState();
      }
    }
  }

  public handleInteractKey() {
    if (this.phase !== 'playing') return;

    if (this.activeHologramRoom) {
      this.unlockRoom(this.activeHologramRoom);
      return;
    }

    // 6 Interactive Hazard Repairs
    if (this.activeHazard === 'solar_storm' && this.isNearBunkerLever()) {
      this.leverPullAnim = 1;
      this.activeHazard = null;
      this.radiation = 2;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playLeverPull();
      marsAudio.playEmergencyFixed();
      this.emitBurst(16.25, BUNKER_FLOOR_Y + 1.4, -2.05, 26, '#4ade80', 7.5);
      this.pushHudState();
      return;
    }

    if (
      this.activeHazard === 'dust_storm' &&
      Math.hypot(this.playerPos.x, this.playerPos.z) < 4.4 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    ) {
      this.shuttersClosed = true;
      this.shutterAutoReopenTimer = 6.5;
      this.activeHazard = null;
      this.solarOutputPct = 100;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.setWindLoop(false);
      marsAudio.playDoorSlide(false);
      marsAudio.playEmergencyFixed();
      this.emitBurst(0, HUB_FLOOR_Y + 2.0, 0, 26, '#fb923c', 8);
      this.pushHudState();
      return;
    }

    if (this.activeHazard === 'meteor_shower') {
      if (!this.hasResinKit && this.isNearResinKit()) {
        this.hasResinKit = true;
        this.modularBase.resinKitProp.visible = false;
        this.astronaut.heldResinKit.visible = true;
        marsAudio.playPickup('ice');
        this.emitBurst(-14.3, HUB_FLOOR_Y + 1.0, -2.1, 18, '#38bdf8', 6);
        this.hintTarget = { x: 0, y: HUB_FLOOR_Y, z: -18.0, timer: 6.5 };
        this.pushHudState();
        return;
      }
      if (this.hasResinKit && this.isInsideGreenhouseDome()) {
        this.hasResinKit = false;
        this.astronaut.heldResinKit.visible = false;
        this.modularBase.greenhouseCracksGroup.visible = false;
        this.activeHazard = null;
        this.oxygen = 100;
        this.hintTarget = null;
        this.hazardTimer = 24.0;
        this.emergenciesFixed += 1;
        marsAudio.playResinPatch();
        marsAudio.playEmergencyFixed();
        this.emitBurst(0, HUB_FLOOR_Y + 2.4, -18.0, 32, '#4ade80', 8.5);
        this.pushHudState();
        return;
      }
    }

    if (this.activeHazard === 'cold_snap' && this.isNearHeaterCore()) {
      this.heaterBoostTimer = 4.0;
      this.activeHazard = null;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playHeaterBoost();
      marsAudio.playEmergencyFixed();
      this.emitBurst(-22.2, HUB_FLOOR_Y + 1.6, 0, 28, '#fb923c', 8);
      this.pushHudState();
      return;
    }

    if (this.activeHazard === 'dish_strike' && this.vehicleMode === 'foot' && this.isNearCommsDish()) {
      this.applyWrenchToDish();
      return;
    }

    // 6 Power Bay & Electrical Emergency Repairs
    if (this.activeHazard === 'battery_overheat' && this.isNearCoolingVentLever()) {
      this.coolingLeverPull = 1;
      this.activeHazard = null;
      this.battery = 100;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playLeverPull();
      marsAudio.playVentBlast();
      marsAudio.playEmergencyFixed();
      this.emitBurst(-15.45, HUB_FLOOR_Y + 2.2, 3.7, 24, '#bae6fd', 7.5);
      this.emitBurst(-15.45, HUB_FLOOR_Y + 2.2, -3.7, 24, '#bae6fd', 7.5);
      this.pushHudState();
      return;
    }

    if (this.activeHazard === 'night_drain' && this.isNearCommandConsole()) {
      this.nightModeActive = true;
      this.activeHazard = null;
      this.solarOutputPct = 100;
      this.battery = 100;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playNightModeToggle();
      marsAudio.playEmergencyFixed();
      this.emitBurst(0, HUB_FLOOR_Y + 1.8, 0, 26, '#38bdf8', 7.5);
      this.pushHudState();
      return;
    }

    if (this.activeHazard === 'blown_fuse') {
      if (!this.hasSpareFuse && this.isNearFuseLocker()) {
        this.hasSpareFuse = true;
        this.modularBase.lockerSpareFuseProp.visible = false;
        this.astronaut.heldSpareFuse.visible = true;
        marsAudio.playPickup('ice');
        this.emitBurst(-13.85, HUB_FLOOR_Y + 1.1, 3.15, 16, '#38bdf8', 6);
        this.hintTarget = { x: -22.3, y: HUB_FLOOR_Y, z: -1.35, timer: 6.5 };
        this.pushHudState();
        return;
      }
      if (this.hasSpareFuse && this.isNearFuseBox()) {
        this.hasSpareFuse = false;
        this.astronaut.heldSpareFuse.visible = false;
        this.activeHazard = null;
        this.battery = 100;
        this.oxygen = 100;
        this.hintTarget = null;
        this.hazardTimer = 24.0;
        this.emergenciesFixed += 1;
        marsAudio.playEmergencyFixed();
        this.emitBurst(-22.7, HUB_FLOOR_Y + 1.45, -1.35, 28, '#4ade80', 8);
        this.pushHudState();
        return;
      }
    }

    if (this.activeHazard === 'static_surge' && this.vehicleMode === 'foot' && this.isNearGroundingSwitch()) {
      this.groundingSwitchPull = 1;
      this.activeHazard = null;
      for (let i = 0; i < this.modularBase.doorLightningArcs.length; i++) {
        this.modularBase.doorLightningArcs[i].visible = false;
      }
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playLeverPull();
      marsAudio.playEmergencyFixed();
      this.emitBurst(-5.6, 1.5, 23.0, 28, '#38bdf8', 8.5);
      this.pushHudState();
      return;
    }

    if (this.activeHazard === 'solar_jam' && this.vehicleMode === 'foot' && this.isNearJammedSolarPanel()) {
      this.clearJammedPebble();
      return;
    }

    if (this.activeHazard === 'rover_overload' && this.vehicleMode === 'foot' && this.isNearRoverDock()) {
      this.slowChargeActive = true;
      this.activeHazard = null;
      this.lightFlickerLevel = 1;
      this.battery = 100;
      this.hintTarget = null;
      this.hazardTimer = 24.0;
      this.emergenciesFixed += 1;
      marsAudio.playDockSwitch();
      marsAudio.playEmergencyFixed();
      this.emitBurst(6.8, 1.5, 28.4, 28, '#4ade80', 8);
      this.pushHudState();
      return;
    }

    if (this.canCloseShuttersAtHub()) {
      this.triggerShutters();
      return;
    }

    const nearbyTask = this.findNearbyPracticeTask();
    if (nearbyTask) {
      this.completePracticeTask(nearbyTask);
      return;
    }

    if (this.vehicleMode === 'rover' || this.isNearRover()) {
      this.toggleRoverDrive();
      return;
    }
    this.triggerBuild();
  }

  public toggleRoverDrive() {
    if (this.phase !== 'playing') return;
    if (this.vehicleMode === 'foot') {
      if (!this.isNearRover()) return;
      this.vehicleMode = 'rover';
      this.astronaut.root.visible = false;
      this.playerVelX = 0;
      this.playerVelZ = 0;
      this.playerVelY = 0;
      this.roverSpeed = 0;
      this.playerPos.copy(this.roverPos);
      this.playerHeading = this.roverHeading;
      this.camYaw = this.roverHeading;
      marsAudio.playBuild();
      this.emitBurst(this.roverPos.x, this.roverPos.y + 1.2, this.roverPos.z, 14, '#38bdf8', 5);
      this.showToast('Driving Rookie-1 Rover! WASD Drive · Shift Turbo · Space Hop · [E] Exit');
      this.sayAres('Vroom vroom! Rookie-1 Rover is rolling! Hold Shift for Turbo Boost!', 'wink', 5.8);
    } else {
      this.vehicleMode = 'foot';
      // Place Astronaut safely on the left side of the Rover
      const sideX = this.roverPos.x - Math.cos(this.roverHeading) * 2.25;
      const sideZ = this.roverPos.z + Math.sin(this.roverHeading) * 2.25;
      const [safeX, safeZ] = resolveBaseWallCollisions(sideX, sideZ, this.roverPos.y, 0.55, this.closedDoorColliders);
      const exitSurface = getBaseWalkableSurface(safeX, safeZ, this.roverPos.y, groundHeightAt(safeX, safeZ));
      this.playerPos.set(safeX, exitSurface.floorY, safeZ);
      this.playerVelX = 0;
      this.playerVelZ = 0;
      this.playerVelY = 0;
      this.grounded = true;
      this.playerHeading = this.roverHeading;
      this.astronaut.root.position.copy(this.playerPos);
      this.astronaut.root.rotation.y = this.playerHeading;
      this.astronaut.root.visible = this.viewMode === 'third';
      this.parkedRover.flameLeft.visible = false;
      this.parkedRover.flameRight.visible = false;
      marsAudio.playClick();
      this.showToast('Hopped out of Rookie-1! Press [E] near Rover anytime to drive.');
    }
    this.pushHudState();
  }

  public continueExploring() {
    marsAudio.playClick();
    this.phase = 'playing';
    this.showToast('Free Roam Mode! Explore craters, mesas & starry Martian nights!');
    this.pushHudState();
  }

  public rechargeAtBase() {
    marsAudio.playBuild();
    this.vehicleMode = 'foot';
    this.astronaut.root.visible = this.viewMode === 'third';
    this.playerPos.set(0, HUB_FLOOR_Y, 4.4);
    this.playerVelX = 0;
    this.playerVelZ = 0;
    this.playerVelY = 0;
    this.playerHeading = 0;
    this.camYaw = 0;
    this.oxygen = 100;
    this.battery = 100;
    this.locationName = 'Central Command Hub';
    this.phase = 'playing';
    this.emitBurst(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 22, '#38bdf8', 7);
    this.showToast('Life Support Restored! Oxygen & Suit Battery at 100%!');
    this.pushHudState();
  }

  public restartGame() {
    marsAudio.playClick();
    marsAudio.setWindLoop(false);
    this.iron = 0;
    this.ice = 0;
    this.stars = 0;
    this.totalCollected = 0;
    this.oxygen = 100;
    this.battery = 100;
    this.water = 100;
    this.food = 100;
    this.radiation = 6;
    this.solProgress = 0.18;
    this.solNumber = 1;
    this.viewMode = 'third';
    this.vehicleMode = 'foot';
    this.astronaut.root.visible = true;
    this.astronaut.airBlowerTool.visible = false;
    this.astronaut.wrenchTool.visible = false;
    this.astronaut.heldResinKit.visible = false;
    this.astronaut.heldSpareFuse.visible = false;

    this.activeHazard = null;
    this.hazardTimer = 24.0;
    this.hazardCursor = 0;
    this.solarOutputPct = 100;
    this.frostLevel = 0;
    this.activeTool = 'none';
    this.hasResinKit = false;
    this.hasSpareFuse = false;
    this.nightModeActive = false;
    this.slowChargeActive = false;
    this.pebblesRemaining = 0;
    this.dishRepairPct = 100;
    this.dishTilt = 0;
    this.leverPullAnim = 0;
    this.coolingLeverPull = 0;
    this.groundingSwitchPull = 0;
    this.fuseLockerOpen = 0;
    this.lightFlickerLevel = 1;
    this.heaterBoostTimer = 0;
    this.toolSwingTimer = 0;
    this.weatherPurple = 0;
    this.weatherDust = 0;
    this.weatherFrost = 0;
    this.modularBase.dishAssembly.rotation.z = 0;
    this.modularBase.resinKitProp.visible = false;
    this.modularBase.greenhouseCracksGroup.visible = false;
    this.modularBase.lockerSpareFuseProp.visible = true;
    this.strikeVortex.group.visible = false;
    for (let i = 0; i < this.modularBase.solarJamPebbles.length; i++) {
      this.modularBase.solarJamPebbles[i].visible = false;
    }
    for (let i = 0; i < this.modularBase.doorLightningArcs.length; i++) {
      this.modularBase.doorLightningArcs[i].visible = false;
    }
    for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
      this.modularBase.solarTrackers[i].dustAmount = 0;
      this.modularBase.solarTrackers[i].dustMesh.visible = false;
    }
    for (let i = 0; i < this.meteorStreaks.length; i++) {
      this.meteorStreaks[i].active = false;
      this.meteorStreaks[i].mesh.visible = false;
    }

    this.orientationPhase = 'orientation';
    this.unlockedRooms = {
      power: false,
      greenhouse: false,
      bunker: false,
      airlock: false,
    };
    this.completedTasks = {
      scan: false,
      fan: false,
      plants: false,
      blast: false,
      suit: false,
    };
    this.activeHologramRoom = null;
    this.dismissedHoloRoom = null;
    this.shuttersClosed = false;
    this.shutterAnimProgress = 0;
    this.shutterAutoReopenTimer = 0;
    this.scanBurstTimer = 0;
    this.fanBoostTimer = 0;
    this.blastTestTimer = 0;
    this.hintTarget = null;
    this.builtModules = {
      solar: false,
      biodome: false,
      garage: false,
      antenna: false,
    };
    this.modulePads.forEach((pad) => {
      pad.holoGroup.visible = true;
      pad.builtGroup.visible = false;
    });
    this.collectibles.forEach((c) => {
      c.collected = false;
      c.respawnTimer = 0;
      c.group.visible = true;
    });
    this.roverPos.set(3.8, Math.max(0.09, groundHeightAt(3.8, 28.4)), 28.4);
    this.roverHeading = Math.PI * 0.88;
    this.roverSpeed = 0;
    this.roverSteer = 0;
    this.roverVelY = 0;
    this.roverGrounded = true;
    this.roverPitch = 0;
    this.roverRoll = 0;
    this.parkedRover.root.position.copy(this.roverPos);
    this.parkedRover.root.rotation.y = this.roverHeading;
    this.parkedRover.bodyPivot.rotation.set(0, 0, 0);
    this.parkedRover.flameLeft.visible = false;
    this.parkedRover.flameRight.visible = false;

    this.playerPos.set(0, HUB_FLOOR_Y, 4.4);
    this.playerVelX = 0;
    this.playerVelZ = 0;
    this.playerVelY = 0;
    this.playerHeading = 0;
    this.aresPos.set(0.92, HUB_FLOOR_Y + 1.88, 4.6);
    this.aresHeading = 0;
    this.aresWinkTimer = 1.6;
    this.aresNextWinkCountdown = 7.0;
    this.lastSpokenLocation = 'Central Command Hub';
    this.camYaw = 0;
    this.camPitch = 0.24;
    this.locationName = 'Central Command Hub';
    this.activeEmergency = null;
    this.emergencyTimer = 9.0;
    this.emergencyCursor = 0;
    this.emergenciesFixed = 0;
    this.phase = 'playing';
    this.pushHudState();
  }

  public triggerEmergencyDrill() {
    if (this.phase !== 'playing') return;
    const order: RoomId[] = ['power', 'greenhouse', 'bunker', 'airlock'];
    const nextRoom = order[this.emergencyCursor % order.length];
    this.emergencyCursor += 1;
    this.activateRoomEmergency(nextRoom);
  }

  private activateRoomEmergency(room: RoomId) {
    this.activeEmergency = room;
    const info = ROOM_EMERGENCY_INFO[room];
    marsAudio.playEmergencyAlert();
    this.showToast(`EMERGENCY: ${info.alertTitle} ${info.guideHint}`);
    this.sayAres(`Whoa, storm alert in ${info.roomName}! Follow the pulsing ${info.stripColor} floor strip!`, 'worried', 7.5);
    this.pushHudState();
  }

  public toggleTimeScale() {
    marsAudio.playClick();
    this.timeScale = this.timeScale === 1 ? 8 : 1;
    this.showToast(
      this.timeScale > 1 ? 'Fast-Forward Sol Clock ON — Watch the stars fade in!' : 'Normal Sol Cycle Speed',
    );
    this.pushHudState();
  }

  public setVirtualInput(key: 'forward' | 'backward' | 'left' | 'right' | 'sprint', active: boolean) {
    this.virtualInput[key] = active;
  }

  public triggerJump() {
    if (this.phase === 'playing') {
      this.jumpBufferTimer = 0.15;
    }
  }

  public triggerBuild() {
    if (this.phase !== 'playing') return;
    const nearbyId = this.findNearbyUnbuiltPad();
    if (!nearbyId) return;

    const cfg = MODULE_CONFIGS.find((m) => m.id === nearbyId)!;
    if (this.iron < cfg.cost.iron || this.ice < cfg.cost.ice || this.stars < cfg.cost.stars) {
      marsAudio.playBump();
      this.showToast(`Need ${cfg.cost.iron} Iron, ${cfg.cost.ice} Ice, ${cfg.cost.stars} Star Cores!`);
      return;
    }

    this.iron -= cfg.cost.iron;
    this.ice -= cfg.cost.ice;
    this.stars -= cfg.cost.stars;
    this.builtModules[nearbyId] = true;

    const pad = this.modulePads.find((p) => p.id === nearbyId)!;
    pad.holoGroup.visible = false;
    pad.builtGroup.visible = true;
    pad.builtGroup.scale.set(1.15, 0.72, 1.15);

    this.emitBurst(cfg.x, groundHeightAt(cfg.x, cfg.z) + 2.5, cfg.z, 36, cfg.accentColor, 11);
    this.emitBurst(cfg.x, groundHeightAt(cfg.x, cfg.z) + 3.5, cfg.z, 20, '#facc15', 9);
    this.cameraShake = 0.35;

    const allBuilt = MODULE_CONFIGS.every((m) => this.builtModules[m.id]);
    if (allBuilt) {
      marsAudio.playVictory();
      this.phase = 'victory';
      this.showToast('Ares Alpha Complete! You are Master Mars Commander!');
      this.sayAres('WE DID IT! Ares Alpha is 100% online! Earth Mission Control is cheering!', 'wink', 8.0);
    } else {
      marsAudio.playBuild();
      this.showToast(`${cfg.name} Online! (${cfg.benefit})`);
      this.sayAres(`Awesome engineering! ${cfg.name} is powering up now!`, 'wink', 6.0);
    }
    this.pushHudState();
  }

  private findNearbyUnbuiltPad(): ModuleId | null {
    for (const cfg of MODULE_CONFIGS) {
      if (this.builtModules[cfg.id]) continue;
      const dist = Math.hypot(this.playerPos.x - cfg.x, this.playerPos.z - cfg.z);
      if (dist < 6.4) return cfg.id;
    }
    return null;
  }

  private showToast(msg: string) {
    this.toastMessage = msg;
    this.toastTimer = 4.2;
  }

  private sayAres(msg: string, mood?: AresBotMood, duration = 6.2) {
    this.aresSpeech = msg;
    this.aresSpeechTimer = duration;
    if (mood === 'wink') {
      this.aresWinkTimer = 2.0;
    }
  }

  public unlockRoom(room: RoomId) {
    if (this.phase !== 'playing') return;
    this.unlockedRooms[room] = true;
    this.activeHologramRoom = null;
    this.dismissedHoloRoom = null;
    this.hintTarget = null;
    const ring = this.modularBase.lockRings[room];
    marsAudio.playBuild();
    this.emitBurst(ring.x, ring.y + 1.0, ring.z, 24, '#38bdf8', 7.5);

    const card = ROOM_ORIENTATION_CARDS[room];
    const roomTask = (Object.values(PRACTICE_TASK_CONFIGS)).find((t) => t.room === room);
    this.showToast(`${card.title} Unlocked! Find the bouncing yellow arrow inside!`);
    this.sayAres(
      roomTask
        ? `${card.title} unlocked! Walk inside and look for the bouncing yellow arrow to ${roomTask.label}!`
        : `${card.title} unlocked!`,
      'wink',
      6.6,
    );
    this.pushHudState();
  }

  public dismissHologramCard() {
    if (this.activeHologramRoom) {
      this.dismissedHoloRoom = this.activeHologramRoom;
      this.activeHologramRoom = null;
      marsAudio.playClick();
      this.pushHudState();
    }
  }

  private findNearbyPracticeTask(): PracticeTaskId | null {
    if (this.orientationPhase === 'free_roam') return null;
    const order: PracticeTaskId[] = ['scan', 'fan', 'plants', 'blast', 'suit'];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (this.completedTasks[id]) continue;
      const cfg = PRACTICE_TASK_CONFIGS[id];
      if (cfg.room !== 'hub' && !this.unlockedRooms[cfg.room]) continue;
      const dist = Math.hypot(this.playerPos.x - cfg.x, this.playerPos.z - cfg.z);
      const dy = Math.abs(this.playerPos.y - cfg.y);
      if (dist < 3.45 && dy < 2.4) return id;
    }
    return null;
  }

  public completePracticeTask(taskId: PracticeTaskId) {
    if (this.phase !== 'playing' || this.completedTasks[taskId]) return;
    const cfg = PRACTICE_TASK_CONFIGS[taskId];
    this.completedTasks[taskId] = true;
    this.hintTarget = null;
    marsAudio.playEmergencyFixed();

    if (taskId === 'scan') {
      this.scanBurstTimer = 2.4;
      this.emitBurst(0, HUB_FLOOR_Y + 1.6, 0, 28, '#38bdf8', 7.5);
    } else if (taskId === 'fan') {
      this.fanBoostTimer = 3.2;
      this.oxygen = 100;
      this.battery = 100;
      this.water = 100;
      this.emitBurst(-20.4, HUB_FLOOR_Y + 1.8, 0, 26, '#facc15', 7.5);
    } else if (taskId === 'plants') {
      this.water = 100;
      this.food = 100;
      this.oxygen = 100;
      this.emitBurst(-3.6, HUB_FLOOR_Y + 1.4, -18.2, 20, '#38bdf8', 6.5);
      this.emitBurst(3.6, HUB_FLOOR_Y + 1.4, -18.2, 20, '#4ade80', 6.5);
    } else if (taskId === 'blast') {
      this.blastTestTimer = 1.6;
      this.radiation = 2;
      this.emitBurst(17.2, -2.0, 0, 26, '#fb923c', 7.5);
    } else if (taskId === 'suit') {
      this.oxygen = 100;
      this.battery = 100;
      this.emitBurst(-3.5, HUB_FLOOR_Y + 1.4, 15.8, 26, '#38bdf8', 7.5);
    }

    const doneCount = (Object.values(this.completedTasks)).filter(Boolean).length;
    if (doneCount >= 5) {
      this.orientationPhase = 'dust_drill';
      this.shuttersClosed = false;
      marsAudio.playEmergencyAlert();
      this.showToast('All 5 Practice Tasks Complete! Zero-Penalty Practice Dust Drill Starting!');
      this.sayAres(
        'Practice Dust Drill! Zero penalty—hurry to the Command Hub Radar Table and CLOSE WINDOW SHUTTERS [E]!',
        'worried',
        8.5,
      );
    } else {
      this.showToast(`Task Complete: ${cfg.label}! (${doneCount}/5 Orientation Tasks)`);
      this.sayAres(`Awesome job completing ${cfg.label}! ${5 - doneCount} more task${5 - doneCount === 1 ? '' : 's'} to go!`, 'wink', 5.8);
    }
    this.pushHudState();
  }

  private canCloseShuttersAtHub(): boolean {
    if (this.orientationPhase !== 'dust_drill' && this.orientationPhase !== 'free_roam') return false;
    const dist = Math.hypot(this.playerPos.x, this.playerPos.z);
    const dy = Math.abs(this.playerPos.y - HUB_FLOOR_Y);
    if (this.orientationPhase === 'dust_drill') {
      return !this.shuttersClosed && dist < 4.2 && dy < 2.2;
    }
    return dist < 3.6 && dy < 2.2;
  }

  public triggerShutters() {
    if (this.phase !== 'playing') return;
    if (this.orientationPhase === 'dust_drill') {
      this.shuttersClosed = true;
      this.hintTarget = null;
      this.orientationPhase = 'free_roam';
      this.emergencyTimer = 18.0;
      this.shutterAutoReopenTimer = 6.0;
      this.radiation = 4;
      marsAudio.playVictory();
      this.emitConfettiBurst(0, HUB_FLOOR_Y + 2.3, 0, 85);
      this.cameraShake = 0.25;
      this.showToast('CONFETTI! Practice Dust Drill Passed! Free-Roam & Rookie-1 Rover UNLOCKED!');
      this.sayAres(
        'HOORAY! Shutters sealed, drill passed! Free-Roam is UNLOCKED—head South out the Airlock to drive Rookie-1 Rover!',
        'wink',
        8.5,
      );
      this.pushHudState();
      return;
    }

    if (this.orientationPhase === 'free_roam') {
      this.shuttersClosed = !this.shuttersClosed;
      this.shutterAutoReopenTimer = 0;
      marsAudio.playDoorSlide(!this.shuttersClosed);
      this.showToast(this.shuttersClosed ? 'Command Hub Storm Shutters Sealed!' : 'Command Hub Dome Windows Open!');
      this.pushHudState();
    }
  }

  public triggerHint() {
    if (this.phase !== 'playing') return;
    marsAudio.playClick();

    if (this.activeHazard === 'solar_storm') {
      this.hintTarget = { x: 16.25, y: BUNKER_FLOOR_Y, z: -2.05, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'dust_storm') {
      this.hintTarget = { x: 0, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'dusty_panels') {
      this.hintTarget = { x: -7.6, y: 0.6, z: 27.9, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'meteor_shower') {
      this.hintTarget = this.hasResinKit
        ? { x: 0, y: HUB_FLOOR_Y, z: -18.0, timer: 6.5 }
        : { x: -14.3, y: HUB_FLOOR_Y, z: -2.1, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'cold_snap') {
      this.hintTarget = { x: -22.2, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'dish_strike') {
      this.hintTarget = { x: 9.85, y: 0.8, z: 25.45, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'battery_overheat') {
      this.hintTarget = { x: -15.45, y: HUB_FLOOR_Y, z: 2.35, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'night_drain') {
      this.hintTarget = { x: 0, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'blown_fuse') {
      this.hintTarget = this.hasSpareFuse
        ? { x: -22.3, y: HUB_FLOOR_Y, z: -1.35, timer: 6.5 }
        : { x: -13.85, y: HUB_FLOOR_Y, z: 2.9, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'static_surge') {
      this.hintTarget = { x: -5.6, y: 0.4, z: 23.0, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'solar_jam') {
      this.hintTarget = { x: -4.4, y: 0.4, z: 25.6, timer: 6.5 };
      this.pushHudState();
      return;
    }
    if (this.activeHazard === 'rover_overload') {
      this.hintTarget = { x: 6.8, y: 0.4, z: 28.4, timer: 6.5 };
      this.pushHudState();
      return;
    }

    if (this.activeEmergency) {
      const info = ROOM_EMERGENCY_INFO[this.activeEmergency];
      this.hintTarget = { x: info.targetX, y: info.targetY, z: info.targetZ, timer: 6.5 };
      this.sayAres(
        `Hint! Spotlight on ${info.roomName}: ${info.guideHint}`,
        'worried',
        6.5,
      );
      this.pushHudState();
      return;
    }

    if (this.orientationPhase === 'dust_drill') {
      this.hintTarget = { x: 0, y: HUB_FLOOR_Y, z: 0, timer: 6.5 };
      this.sayAres(
        'Hint! Spotlight on the Command Hub Radar Table—walk here and press [E] to Close Window Shutters!',
        'worried',
        6.5,
      );
      this.pushHudState();
      return;
    }

    if (this.orientationPhase === 'orientation') {
      const taskOrder: PracticeTaskId[] = ['scan', 'fan', 'plants', 'blast', 'suit'];
      for (const id of taskOrder) {
        if (!this.completedTasks[id]) {
          const cfg = PRACTICE_TASK_CONFIGS[id];
          if (cfg.room === 'hub' || this.unlockedRooms[cfg.room]) {
            this.hintTarget = { x: cfg.x, y: cfg.y, z: cfg.z, timer: 6.5 };
            this.sayAres(`Hint! ${cfg.hintText}`, 'wink', 6.5);
            this.pushHudState();
            return;
          }
        }
      }

      const roomOrder: RoomId[] = ['power', 'greenhouse', 'bunker', 'airlock'];
      for (const r of roomOrder) {
        if (!this.unlockedRooms[r]) {
          const ring = this.modularBase.lockRings[r];
          const card = ROOM_ORIENTATION_CARDS[r];
          this.hintTarget = { x: ring.x, y: ring.y, z: ring.z, timer: 6.5 };
          this.sayAres(
            `Hint! Step on the glowing BLUE floor ring toward ${card.title} (${card.stripLabel}) to unlock it!`,
            'wink',
            6.5,
          );
          this.pushHudState();
          return;
        }
      }
    }

    const nextCfg = MODULE_CONFIGS.find((m) => !this.builtModules[m.id]);
    if (nextCfg) {
      this.hintTarget = { x: nextCfg.x, y: groundHeightAt(nextCfg.x, nextCfg.z), z: nextCfg.z, timer: 6.5 };
      this.sayAres(
        `Hint! Head to the ${nextCfg.name} pad outdoors (${nextCfg.cost.iron} Iron, ${nextCfg.cost.ice} Ice${nextCfg.cost.stars ? `, ${nextCfg.cost.stars} Star` : ''})!`,
        'wink',
        6.5,
      );
      this.pushHudState();
      return;
    }

    this.hintTarget = { x: this.roverPos.x, y: this.roverPos.y, z: this.roverPos.z, timer: 5.5 };
    this.sayAres('Hint! Base is complete—hop into Rookie-1 Rover [E] to explore distant Mars craters!', 'wink', 5.5);
    this.pushHudState();
  }

  public promptAresTip() {
    const tips = [
      'Mars looks rusty red because its soil is full of iron oxide—just like rust!',
      'Fun fact: Mars gravity is only 38% of Earth’s, so you can jump super high!',
      'Mars has two tiny potato-shaped moons named Phobos and Deimos. Watch the night sky!',
      'Follow the glowing floor strips in Ares Alpha: Yellow for Power, Green for Plants, Orange for Bunker, Blue for Airlock!',
      'Need guidance? Click "Need a Hint?" anytime and I will fly over and spotlight what to fix next!',
    ];
    const nextTip = tips[this.aresTipIndex % tips.length];
    this.aresTipIndex += 1;
    marsAudio.playClick();
    this.sayAres(nextTip, 'wink', 6.8);
    this.pushHudState();
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    } else {
      this.elapsedTime += dt;
      this.updateSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number) {
    const solRate = (1 / 92) * this.timeScale;
    if (this.phase !== 'paused') {
      this.solProgress += dt * solRate;
      if (this.solProgress >= 1) {
        this.solProgress -= 1;
        this.solNumber += 1;
      }
    }

    const skyFocusX = this.phase === 'title' ? 0 : this.playerPos.x;
    const skyFocusZ = this.phase === 'title' ? 0 : this.playerPos.z;
    _weatherState.purpleFactor = this.weatherPurple;
    _weatherState.dustFactor = this.weatherDust;
    _weatherState.frostFactor = this.weatherFrost;
    const skyInfo = this.sky.update(
      this.solProgress,
      this.elapsedTime,
      skyFocusX,
      skyFocusZ,
      this.scene,
      _weatherState,
    );
    this.timeOfDayLabel = skyInfo.timeOfDayLabel;

    if (this.scanBurstTimer > 0) this.scanBurstTimer -= dt;
    if (this.fanBoostTimer > 0) this.fanBoostTimer -= dt;
    if (this.blastTestTimer > 0) this.blastTestTimer -= dt;
    if (this.heaterBoostTimer > 0) this.heaterBoostTimer -= dt;
    if (this.toolSwingTimer > 0) this.toolSwingTimer -= dt;
    if (this.shutterAutoReopenTimer > 0) {
      this.shutterAutoReopenTimer -= dt;
      if (this.shutterAutoReopenTimer <= 0 && this.shuttersClosed) {
        this.shuttersClosed = false;
        this.pushHudState();
      }
    }

    // Night lighting & animations on Modular Mars Base, Parked Rover, & Astronaut Headlamp
    const nightGlow = THREE.MathUtils.clamp(skyInfo.nightFactor * 1.4, 0, 1);
    this.modularBase.radarSpin.rotation.y += dt * (this.scanBurstTimer > 0 ? 4.2 : 1.1);
    this.modularBase.holoMars.rotation.y += dt * (this.scanBurstTimer > 0 ? 3.2 : 0.8);
    this.modularBase.holoRing.rotation.z += dt * (this.scanBurstTimer > 0 ? 4.5 : 1.3);
    this.modularBase.tableRadarSweep.rotation.y -= dt * (this.scanBurstTimer > 0 ? 9.5 : 2.1);
    this.modularBase.beaconLight.intensity = 1.6 + nightGlow * 2.8 + Math.sin(this.elapsedTime * 3.5) * 0.4;
    this.modularBase.beaconOrbMat.emissiveIntensity = 0.9 + nightGlow * 1.2 + Math.sin(this.elapsedTime * 3.5) * 0.3;
    this.modularBase.interiorLights.forEach((l) => {
      l.intensity = (1.6 + nightGlow * 1.4) * this.lightFlickerLevel;
    });
    this.modularBase.yardLights.forEach((l) => {
      l.intensity = (0.35 + nightGlow * 2.6) * this.lightFlickerLevel;
    });
    this.modularBase.scrubberRings.forEach((ring, idx) => {
      ring.position.y = HUB_FLOOR_Y + 1.55 + Math.sin(this.elapsedTime * 2.4 + idx * 1.5) * 0.55;
    });
    const turbineSpeed = this.fanBoostTimer > 0 ? 15.0 : this.activeEmergency === 'power' ? 11.5 : 5.2;
    this.modularBase.turbineRotors.forEach((rotor, idx) => {
      rotor.rotation.z += dt * turbineSpeed * (idx === 0 ? 1 : -1);
    });
    this.modularBase.waterTankCores.forEach((core, idx) => {
      core.scale.y = 0.96 + Math.sin(this.elapsedTime * 2.4 + idx * 1.3) * 0.04;
    });
    this.modularBase.uvLights.forEach((uv) => {
      uv.intensity = (1.5 + nightGlow * 0.8 + Math.sin(this.elapsedTime * 2.6) * 0.25) * this.lightFlickerLevel;
    });
    this.modularBase.suitBoothRing.position.y = 0.22 + Math.sin(this.elapsedTime * 3.0) * 0.08;

    // Animated 3D Armored Storm Window Shutters on Command Hub
    this.shutterAnimProgress = THREE.MathUtils.damp(this.shutterAnimProgress, this.shuttersClosed ? 1 : 0, 8.5, dt);
    const showShutters = this.shutterAnimProgress > 0.02;
    const panelY = HUB_FLOOR_Y + 7.2 - this.shutterAnimProgress * 3.5;
    for (let i = 0; i < this.modularBase.hubShutters.lowerPanels.length; i++) {
      const p = this.modularBase.hubShutters.lowerPanels[i];
      p.visible = showShutters;
      p.position.y = panelY;
    }
    this.modularBase.hubShutters.crownCap.visible = showShutters;
    this.modularBase.hubShutters.crownCap.position.y = HUB_FLOOR_Y + 9.2 - this.shutterAnimProgress * 2.75;

    // Exterior Yard Animations: 6 Sun-Tracking Solar Panels, Comms Dish & Air Intake Fan
    const sunUp = skyInfo.sunDirY > 0.04;
    const targetPanelYaw = sunUp ? Math.atan2(skyInfo.sunDirX, skyInfo.sunDirZ) : 0;
    const targetPanelTilt = sunUp
      ? Math.PI * 0.5 - Math.asin(THREE.MathUtils.clamp(skyInfo.sunDirY, 0.15, 0.96))
      : 0.16;
    for (let i = 0; i < this.modularBase.solarTrackers.length; i++) {
      const tracker = this.modularBase.solarTrackers[i];
      if (this.activeHazard === 'solar_jam' && i === 2) {
        tracker.tiltGroup.rotation.x = THREE.MathUtils.damp(
          tracker.tiltGroup.rotation.x,
          1.28 + Math.sin(this.elapsedTime * 36) * 0.045,
          12,
          dt,
        );
      } else {
        tracker.yawGroup.rotation.y +=
          shortestAngleDiff(tracker.yawGroup.rotation.y, targetPanelYaw) * Math.min(1, dt * 3.2);
        tracker.tiltGroup.rotation.x = THREE.MathUtils.damp(tracker.tiltGroup.rotation.x, targetPanelTilt, 3.2, dt);
      }
    }
    if (this.activeHazard !== 'dish_strike') {
      this.modularBase.exteriorDishYaw.rotation.y += dt * 0.44;
    }
    const intakeSpeed = this.activeEmergency === 'airlock' ? 18.0 : 9.5;
    this.modularBase.exteriorFanRotor.rotation.z += dt * intakeSpeed;

    this.updateActiveWeatherHazard(dt);
    this.updateDoorsAndEmergencies(dt, nightGlow);
    this.updateOrientationVisuals(dt);

    this.parkedRover.dish.rotation.y += dt * 0.9;
    const roverLampBoost = this.vehicleMode === 'rover' ? 1.2 + nightGlow * 3.6 : nightGlow * 3.0;
    this.parkedRover.headLightLeft.intensity = roverLampBoost;
    this.parkedRover.headLightRight.intensity = roverLampBoost;
    this.parkedRover.headLampMat.emissiveIntensity =
      (this.vehicleMode === 'rover' ? 1.15 : 0.45) + nightGlow * 1.3;

    this.astronaut.headLamp.intensity = nightGlow * 3.8;
    this.astronaut.headLampMat.emissiveIntensity = 0.45 + nightGlow * 1.4;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastMessage = null;
      }
    }

    if (this.phase === 'playing') {
      if (this.vehicleMode === 'rover') {
        this.updateRover(dt, skyInfo.nightFactor);
      } else {
        this.updateAstronaut(dt, skyInfo.nightFactor);
      }
      this.updateCollectibles(dt);
      this.updateHazards(dt);
    } else if (this.phase === 'title') {
      this.updateCollectibles(dt);
      this.updateHazards(dt);
      // Gentle idle breathing on Title Screen
      this.astronaut.leftArmPivot.rotation.z = 0.08 + Math.sin(this.elapsedTime * 2) * 0.04;
      this.astronaut.rightArmPivot.rotation.z = -0.08 - Math.sin(this.elapsedTime * 2) * 0.04;
    }

    this.updateAresBot(dt, skyInfo.nightFactor);

    // Update Diegetic Backpack Bars (Oxygen = Blue, Suit Battery = Green)
    this.astronaut.oxygenBar.scale.y = Math.max(0.05, this.oxygen / 100);
    this.astronaut.batteryBar.scale.y = Math.max(0.05, this.battery / 100);
    this.astronaut.oxygenBarMat.emissiveIntensity =
      this.oxygen < 25 ? 1.1 + Math.sin(this.elapsedTime * 10) * 0.7 : 1.75;
    this.astronaut.batteryBarMat.emissiveIntensity =
      this.battery < 25 ? 1.1 + Math.sin(this.elapsedTime * 10) * 0.7 : 1.75;

    // Animate module pads & newly built structures
    this.modulePads.forEach((pad) => {
      if (pad.holoGroup.visible) {
        pad.animatedParts.forEach((part) => {
          part.rotation.y += dt * 1.4;
          part.position.y = 2.1 + Math.sin(this.elapsedTime * 2.6) * 0.25;
        });
        pad.ringMat.opacity = 0.55 + Math.sin(this.elapsedTime * 3.2) * 0.22;
      } else {
        pad.builtGroup.scale.x = THREE.MathUtils.damp(pad.builtGroup.scale.x, 1, 8, dt);
        pad.builtGroup.scale.y = THREE.MathUtils.damp(pad.builtGroup.scale.y, 1, 8, dt);
        pad.builtGroup.scale.z = THREE.MathUtils.damp(pad.builtGroup.scale.z, 1, 8, dt);
        pad.animatedParts.forEach((part) => {
          part.rotation.y += dt * 0.65;
        });
      }
    });

    this.updateParticles(dt);
    this.updateCamera(dt);

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.085) {
      this.hudSyncTimer = 0;
      this.pushHudState();
    }
  }

  private updateAstronaut(dt: number, nightFactor: number) {
    const moveFwd =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || this.virtualInput.forward ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.virtualInput.backward ? 1 : 0);

    const moveRight =
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || this.virtualInput.right ? 1 : 0) -
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || this.virtualInput.left ? 1 : 0);

    const hasMoveInput = moveFwd !== 0 || moveRight !== 0;
    const wantsSprint =
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight') || this.virtualInput.sprint) &&
      hasMoveInput &&
      this.battery > 4;

    const garageBonus = this.builtModules.garage ? 1.25 : 1.0;
    const maxSpeed = (wantsSprint ? 21.0 : 12.6) * garageBonus;

    // Camera-relative horizontal movement direction
    const camSin = Math.sin(this.camYaw);
    const camCos = Math.cos(this.camYaw);
    let desiredVx = 0;
    let desiredVz = 0;

    if (hasMoveInput) {
      // Forward is (-camSin, -camCos), Right is (camCos, -camSin)
      let dirX = -camSin * moveFwd + camCos * moveRight;
      let dirZ = -camCos * moveFwd - camSin * moveRight;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
      desiredVx = dirX * maxSpeed;
      desiredVz = dirZ * maxSpeed;

      // Rotate astronaut smoothly toward movement direction in 3rd person
      if (this.viewMode === 'third') {
        const targetHeading = Math.atan2(-dirX, -dirZ);
        this.playerHeading += shortestAngleDiff(this.playerHeading, targetHeading) * Math.min(1, dt * 11);
      }
    }

    if (this.viewMode === 'first') {
      this.playerHeading = this.camYaw;
    }

    const accelLambda = this.grounded ? 10.5 : 4.2;
    this.playerVelX = THREE.MathUtils.damp(this.playerVelX, desiredVx, accelLambda, dt);
    this.playerVelZ = THREE.MathUtils.damp(this.playerVelZ, desiredVz, accelLambda, dt);

    let nextX = this.playerPos.x + this.playerVelX * dt;
    let nextZ = this.playerPos.z + this.playerVelZ * dt;

    // Canyon perimeter boundary
    const distCenter = Math.hypot(nextX, nextZ);
    if (distCenter > WORLD_PLAYABLE_RADIUS) {
      const ratio = WORLD_PLAYABLE_RADIUS / distCenter;
      nextX *= ratio;
      nextZ *= ratio;
    }

    // Solid Base Wall, Doorway, Corridor, Closed-Door, and Prop Collisions (smooth sliding)
    [nextX, nextZ] = resolveBaseWallCollisions(
      nextX,
      nextZ,
      this.playerPos.y,
      0.55,
      this.closedDoorColliders,
    );

    // Solid collision against parked Rookie-1 Rover when on foot
    if (Math.abs(this.playerPos.y - this.roverPos.y) < 2.2) {
      const rdx = nextX - this.roverPos.x;
      const rdz = nextZ - this.roverPos.z;
      const minRoverR = 1.65;
      const rdSq = rdx * rdx + rdz * rdz;
      if (rdSq < minRoverR * minRoverR && rdSq > 0.0001) {
        const rd = Math.sqrt(rdSq);
        const overlap = minRoverR - rd;
        nextX += (rdx / rd) * overlap;
        nextZ += (rdz / rd) * overlap;
      }
    }

    // Large Boulder collisions outside base (when below boulder height)
    const rawGroundY = groundHeightAt(nextX, nextZ);
    const clearance = this.playerPos.y - rawGroundY;
    if (clearance < 1.15) {
      for (let i = 0; i < this.boulders.length; i++) {
        const b = this.boulders[i];
        const dx = nextX - b.x;
        const dz = nextZ - b.z;
        const minR = b.radius + 0.65;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const overlap = minR - d;
          nextX += (dx / d) * overlap;
          nextZ += (dz / d) * overlap;
        }
      }
    }

    this.playerPos.x = nextX;
    this.playerPos.z = nextZ;

    // Low Mars Gravity Jump (0.38g bouncy jump + coyote time + input buffering)
    if (this.grounded) {
      this.coyoteTimer = 0.15;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.grounded = false;
        this.playerVelY = 9.6;
        this.battery = Math.max(0, this.battery - 2.2);
        this.squashX = 0.86;
        this.squashY = 1.18;
        marsAudio.playHop();
        this.emitBurst(this.playerPos.x, this.playerPos.y + 0.4, this.playerPos.z, 10, '#7dd3fc', 4.2);
      }
    }

    const surface = getBaseWalkableSurface(
      this.playerPos.x,
      this.playerPos.z,
      this.playerPos.y,
      groundHeightAt(this.playerPos.x, this.playerPos.z),
    );
    this.locationName = surface.locationName;
    const newGroundY = surface.floorY;

    if (!this.grounded || this.playerPos.y > newGroundY + 0.05) {
      this.playerVelY -= 14.8 * dt; // Low Martian gravity!
      this.playerPos.y += this.playerVelY * dt;

      // Solid ceiling collision inside corridors & Underground Storm Bunker
      if (this.playerPos.y + 2.05 > surface.ceilingY) {
        this.playerPos.y = surface.ceilingY - 2.05;
        if (this.playerVelY > 0) this.playerVelY = 0;
      }

      if (this.playerPos.y <= newGroundY) {
        this.playerPos.y = newGroundY;
        if (this.playerVelY < -4.0) {
          this.squashX = 1.16;
          this.squashY = 0.84;
          marsAudio.playLand();
          this.emitBurst(this.playerPos.x, newGroundY + 0.15, this.playerPos.z, 7, '#e07a52', 3.0);
        }
        this.playerVelY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      this.playerPos.y = newGroundY;
      this.grounded = true;
    }

    // Jetpack Thruster Flames during jumps & sprints
    const thrustersActive = !this.grounded || wantsSprint;
    this.astronaut.flameLeft.visible = thrustersActive;
    this.astronaut.flameRight.visible = thrustersActive;
    if (thrustersActive) {
      const baseLen = !this.grounded ? 1.15 : 0.65;
      const flicker = baseLen + Math.random() * 0.45;
      this.astronaut.flameLeft.scale.set(1, flicker, 1);
      this.astronaut.flameRight.scale.set(1, flicker, 1);
    }

    // Transform Astronaut Root & Animate Limbs
    this.astronaut.root.position.copy(this.playerPos);
    this.astronaut.root.rotation.y = this.playerHeading;

    this.squashX = THREE.MathUtils.damp(this.squashX, 1, 11, dt);
    this.squashY = THREE.MathUtils.damp(this.squashY, 1, 11, dt);
    this.astronaut.bodyPivot.scale.set(this.squashX, this.squashY, this.squashX);

    const isShivering = this.activeHazard === 'cold_snap' || this.frostLevel > 0.25;
    if (isShivering) {
      this.astronaut.bodyPivot.position.x = Math.sin(this.elapsedTime * 42) * 0.032;
    } else {
      this.astronaut.bodyPivot.position.x = THREE.MathUtils.damp(this.astronaut.bodyPivot.position.x, 0, 14, dt);
    }

    const speed = Math.hypot(this.playerVelX, this.playerVelZ);
    if (!this.grounded) {
      // Mid-air jetpack pose
      this.astronaut.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.astronaut.leftLegPivot.rotation.x, 0.35, 10, dt);
      this.astronaut.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.astronaut.rightLegPivot.rotation.x, -0.25, 10, dt);
      this.astronaut.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.astronaut.leftArmPivot.rotation.x, -0.55, 10, dt);
      this.astronaut.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.astronaut.rightArmPivot.rotation.x, -0.55, 10, dt);
      this.astronaut.bodyPivot.position.y = THREE.MathUtils.damp(this.astronaut.bodyPivot.position.y, 0, 10, dt);
    } else if (speed > 0.6) {
      // Crisp walk / sprint stride
      this.stridePhase += dt * (speed * 0.92);
      const swing = Math.sin(this.stridePhase) * (wantsSprint ? 0.85 : 0.58);
      this.astronaut.leftLegPivot.rotation.x = swing;
      this.astronaut.rightLegPivot.rotation.x = -swing;
      this.astronaut.leftArmPivot.rotation.x = this.hasResinKit || this.hasSpareFuse ? -0.7 : -swing * 0.8;
      this.astronaut.rightArmPivot.rotation.x = this.activeTool !== 'none' ? -0.65 : swing * 0.8;
      this.astronaut.bodyPivot.position.y = Math.abs(Math.sin(this.stridePhase)) * (wantsSprint ? 0.14 : 0.08);
    } else {
      // Idle pose
      this.astronaut.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.astronaut.leftLegPivot.rotation.x, 0, 12, dt);
      this.astronaut.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.astronaut.rightLegPivot.rotation.x, 0, 12, dt);
      this.astronaut.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        this.astronaut.leftArmPivot.rotation.x,
        this.hasResinKit || this.hasSpareFuse ? -0.75 : 0,
        12,
        dt,
      );
      this.astronaut.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        this.astronaut.rightArmPivot.rotation.x,
        this.activeTool !== 'none' ? -0.65 : 0,
        12,
        dt,
      );
      this.astronaut.bodyPivot.position.y = THREE.MathUtils.damp(this.astronaut.bodyPivot.position.y, 0, 12, dt);
    }

    // Tool Swing or Shivering Arms
    if (this.toolSwingTimer > 0) {
      this.astronaut.rightArmPivot.rotation.x = -1.25 + Math.sin(this.elapsedTime * 34) * 0.45;
    }
    if (isShivering) {
      const sh = Math.sin(this.elapsedTime * 42) * 0.12;
      this.astronaut.leftArmPivot.rotation.z = 0.18 + sh;
      this.astronaut.rightArmPivot.rotation.z = -0.18 - sh;
    } else {
      this.astronaut.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.astronaut.leftArmPivot.rotation.z, 0.08, 10, dt);
      this.astronaut.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.astronaut.rightArmPivot.rotation.z, -0.08, 10, dt);
    }

    // Contact shadow shrinks smoothly when jumping high
    const heightAbove = Math.max(0, this.playerPos.y - newGroundY);
    this.astronaut.contactShadow.scale.setScalar(THREE.MathUtils.clamp(1 - heightAbove * 0.15, 0.45, 1));
    this.astronaut.contactShadow.position.y = Math.max(0.025, 0.025 - heightAbove);

    // Footstep dust & sprint jetpack sparks
    if (this.grounded && speed > 3.2) {
      this.dustEmitTimer += dt * (wantsSprint ? 22 : 10);
      while (this.dustEmitTimer >= 1) {
        this.dustEmitTimer -= 1;
        this.emitParticle(
          this.playerPos.x + (Math.random() - 0.5) * 0.5,
          this.playerPos.y + 0.18,
          this.playerPos.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 1.2,
          0.7 + Math.random() * 1.1,
          (Math.random() - 0.5) * 1.2,
          0.42,
          wantsSprint ? 0.72 : 0.48,
          wantsSprint ? '#7dd3fc' : '#d86942',
        );
      }
    }

    // Suit & Base Vitals: Power, Oxygen, Water, Food, Radiation
    const insideBase = surface.indoors;
    const nearSuitBooth = insideBase && Math.hypot(this.playerPos.x - -2.7, this.playerPos.z - 15.8) < 2.3;
    const nearBioModule = this.builtModules.biodome && Math.hypot(this.playerPos.x - 22, this.playerPos.z - -24) < 9.5;
    const nearSolarModule = this.builtModules.solar && Math.hypot(this.playerPos.x - -30, this.playerPos.z - -16) < 9.5;

    // Equip outdoor repair tools visually in Astronaut's hand when outdoors during dusty_panels or dish_strike
    if (!insideBase && this.vehicleMode === 'foot') {
      if (this.activeHazard === 'dusty_panels') {
        this.activeTool = 'blower';
      } else if (this.activeHazard === 'dish_strike') {
        this.activeTool = 'wrench';
      } else {
        this.activeTool = 'none';
      }
    } else {
      this.activeTool = 'none';
    }
    this.astronaut.airBlowerTool.visible = this.activeTool === 'blower';
    this.astronaut.wrenchTool.visible = this.activeTool === 'wrench';
    this.astronaut.heldResinKit.visible = this.hasResinKit;
    this.astronaut.heldSpareFuse.visible = this.hasSpareFuse;

    const meteorLeakMult = this.activeHazard === 'meteor_shower' ? 0.35 : 1.0;
    if ((insideBase || nearBioModule) && this.activeHazard !== 'meteor_shower') {
      const o2Gain = nearSuitBooth
        ? 48
        : this.locationName === 'Greenhouse Dome' || this.locationName === 'Power & Life Support Bay'
          ? 32
          : 20;
      this.oxygen = Math.min(100, this.oxygen + dt * o2Gain);
    } else if (this.activeHazard === 'meteor_shower' && this.locationName === 'Greenhouse Dome') {
      this.oxygen = Math.max(0, this.oxygen - dt * 1.8);
    } else if (insideBase) {
      this.oxygen = Math.min(100, this.oxygen + dt * 14 * meteorLeakMult);
    } else {
      const o2Drain = this.builtModules.biodome ? 0.35 : 0.72;
      this.oxygen = Math.max(0, this.oxygen - dt * o2Drain);
    }

    const solarMult = this.solarOutputPct / 100;
    if (this.activeHazard === 'night_drain' && !this.nightModeActive) {
      this.battery = Math.max(0, this.battery - dt * 2.2);
    } else if (insideBase || nearSolarModule) {
      const batGain = (nearSuitBooth ? 48 : this.locationName === 'Power & Life Support Bay' ? 35 : 22) * Math.max(0.15, solarMult);
      this.battery = Math.min(100, this.battery + dt * batGain);
    } else if (wantsSprint) {
      this.battery = Math.max(0, this.battery - dt * 5.2);
    } else {
      const dayTrickle = (1 - nightFactor) * (this.builtModules.solar ? 3.5 : 1.4) * solarMult;
      this.battery = Math.min(100, this.battery + dt * dayTrickle);
    }

    if (this.locationName === 'Greenhouse Dome' || nearBioModule) {
      this.water = Math.min(100, this.water + dt * 20);
      this.food = Math.min(100, this.food + dt * 24);
    } else if (this.locationName === 'Power & Life Support Bay') {
      this.water = Math.min(100, this.water + dt * 22);
      this.food = Math.max(0, this.food - dt * 0.08);
    } else {
      this.water = Math.max(0, this.water - dt * (insideBase ? 0.08 : 0.24));
      this.food = Math.max(0, this.food - dt * (insideBase ? 0.07 : 0.18));
    }

    let targetRad = 6;
    if (this.locationName === 'Underground Storm Bunker') {
      targetRad = 1;
    } else if (this.activeHazard === 'solar_storm') {
      targetRad = insideBase ? 58 : 88;
    } else if (insideBase) {
      targetRad = this.shuttersClosed ? 2 : 6;
    } else {
      targetRad = 16 + (1 - nightFactor) * 14 + (this.activeEmergency === 'bunker' ? 18 : 0);
    }
    this.radiation = THREE.MathUtils.damp(this.radiation, targetRad, 2.2, dt);

    // Zero-penalty safety floor during Cadet Orientation & Practice Dust Drill
    if (this.orientationPhase !== 'free_roam') {
      this.oxygen = Math.max(48, this.oxygen);
      this.battery = Math.max(48, this.battery);
      this.water = Math.max(48, this.water);
      this.food = Math.max(48, this.food);
      this.radiation = Math.min(25, this.radiation);
    } else if (this.oxygen <= 0 || this.battery <= 0) {
      this.phase = 'lowpower';
      this.pushHudState();
    }
  }

  private updateRover(dt: number, nightFactor: number) {
    const throttle =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || this.virtualInput.forward ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.virtualInput.backward ? 1 : 0);

    const steerInput =
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || this.virtualInput.left ? 1 : 0) -
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || this.virtualInput.right ? 1 : 0);

    const wantsTurbo =
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight') || this.virtualInput.sprint) &&
      throttle > 0 &&
      this.battery > 4;

    const garageBonus = this.builtModules.garage ? 1.25 : 1.0;
    const maxForward = (wantsTurbo ? 31.0 : 21.5) * garageBonus;
    const maxReverse = -10.5 * garageBonus;

    let targetSpeed = 0;
    if (throttle > 0) targetSpeed = maxForward;
    else if (throttle < 0) targetSpeed = maxReverse;

    const accelLambda = throttle !== 0 ? 5.2 : 3.6;
    this.roverSpeed = THREE.MathUtils.damp(this.roverSpeed, targetSpeed, accelLambda, dt);
    this.roverSteer = THREE.MathUtils.damp(this.roverSteer, steerInput * 0.55, 10, dt);

    if (Math.abs(this.roverSpeed) > 0.4) {
      const dirSign = this.roverSpeed >= 0 ? 1 : -1;
      const speedFactor = Math.min(1, Math.abs(this.roverSpeed) / 6.0);
      this.roverHeading += steerInput * 2.15 * speedFactor * dirSign * dt;
    } else if (steerInput !== 0 && throttle !== 0) {
      this.roverHeading += steerInput * 1.4 * dt;
    }

    // Smoothly align camera slightly behind rover heading when steering without mouse drag
    if (!this.isDraggingLook && document.pointerLockElement !== this.renderer.domElement && Math.abs(this.roverSpeed) > 1.5) {
      this.camYaw += shortestAngleDiff(this.camYaw, this.roverHeading) * Math.min(1, dt * 1.6);
    }

    const fwdX = -Math.sin(this.roverHeading);
    const fwdZ = -Math.cos(this.roverHeading);
    let nextX = this.roverPos.x + fwdX * this.roverSpeed * dt;
    let nextZ = this.roverPos.z + fwdZ * this.roverSpeed * dt;

    // World perimeter check
    const distCenter = Math.hypot(nextX, nextZ);
    if (distCenter > WORLD_PLAYABLE_RADIUS) {
      const ratio = WORLD_PLAYABLE_RADIUS / distCenter;
      nextX *= ratio;
      nextZ *= ratio;
      this.roverSpeed *= 0.5;
    }

    // Base & Exterior Yard Colliders (with rover airlock stop)
    [nextX, nextZ] = resolveBaseWallCollisions(
      nextX,
      nextZ,
      this.roverPos.y,
      1.42,
      this.closedDoorColliders,
      true,
    );

    // Boulder Colliders outside base
    const rawGroundY = groundHeightAt(nextX, nextZ);
    if (this.roverPos.y - rawGroundY < 1.3) {
      for (let i = 0; i < this.boulders.length; i++) {
        const b = this.boulders[i];
        const dx = nextX - b.x;
        const dz = nextZ - b.z;
        const minR = b.radius + 1.38;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const overlap = minR - d;
          nextX += (dx / d) * overlap;
          nextZ += (dz / d) * overlap;
          this.roverSpeed *= 0.88;
        }
      }
    }

    this.roverPos.x = nextX;
    this.roverPos.z = nextZ;

    // Low-gravity Rover Jump
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.roverGrounded) {
        this.jumpBufferTimer = 0;
        this.roverGrounded = false;
        this.roverVelY = 8.4;
        this.battery = Math.max(0, this.battery - 2.0);
        marsAudio.playHop();
        this.emitBurst(this.roverPos.x, this.roverPos.y + 0.4, this.roverPos.z, 12, '#7dd3fc', 4.5);
      }
    }

    const surface = getBaseWalkableSurface(
      this.roverPos.x,
      this.roverPos.z,
      this.roverPos.y,
      groundHeightAt(this.roverPos.x, this.roverPos.z),
    );
    const targetGroundY = Math.max(surface.floorY, surface.floorY === groundHeightAt(this.roverPos.x, this.roverPos.z) ? surface.floorY : surface.floorY + 0.04);
    this.locationName = surface.locationName;

    if (!this.roverGrounded || this.roverPos.y > targetGroundY + 0.06) {
      this.roverVelY -= 15.2 * dt;
      this.roverPos.y += this.roverVelY * dt;
      if (this.roverPos.y <= targetGroundY) {
        this.roverPos.y = targetGroundY;
        if (this.roverVelY < -4.2) {
          marsAudio.playLand();
          this.emitBurst(this.roverPos.x, targetGroundY + 0.15, this.roverPos.z, 9, '#e07a52', 3.4);
        }
        this.roverVelY = 0;
        this.roverGrounded = true;
      }
    } else {
      this.roverPos.y = targetGroundY;
      this.roverGrounded = true;
    }

    // Terrain normal pitch & roll tilt for natural crater driving
    groundNormalAt(this.roverPos.x, this.roverPos.z, _groundNormal);
    const localUpZ = _groundNormal.x * fwdX + _groundNormal.z * fwdZ;
    const rightX = Math.cos(this.roverHeading);
    const rightZ = -Math.sin(this.roverHeading);
    const localUpX = _groundNormal.x * rightX + _groundNormal.z * rightZ;
    const targetPitch = this.roverGrounded ? Math.asin(THREE.MathUtils.clamp(-localUpZ, -0.45, 0.45)) : -this.roverVelY * 0.025;
    const targetRoll = this.roverGrounded ? Math.asin(THREE.MathUtils.clamp(localUpX, -0.45, 0.45)) - this.roverSteer * 0.12 : 0;
    this.roverPitch = THREE.MathUtils.damp(this.roverPitch, targetPitch, 9, dt);
    this.roverRoll = THREE.MathUtils.damp(this.roverRoll, targetRoll, 9, dt);

    // Sync active Rover mesh & playerPos
    this.parkedRover.root.position.copy(this.roverPos);
    this.parkedRover.root.rotation.y = this.roverHeading;
    this.parkedRover.bodyPivot.rotation.set(this.roverPitch, 0, this.roverRoll);

    // Animate 6 wheels, front steering pivots, stereo head & turbo flames
    this.roverWheelSpin -= (this.roverSpeed / 0.42) * dt;
    for (let i = 0; i < this.parkedRover.wheels.length; i++) {
      this.parkedRover.wheels[i].rotation.x = this.roverWheelSpin;
    }
    for (let i = 0; i < this.parkedRover.frontWheelPivots.length; i++) {
      this.parkedRover.frontWheelPivots[i].rotation.y = this.roverSteer * 0.72;
    }
    this.parkedRover.headPivot.rotation.y = THREE.MathUtils.damp(
      this.parkedRover.headPivot.rotation.y,
      this.roverSteer * 0.65,
      8,
      dt,
    );

    const boosterActive = wantsTurbo || !this.roverGrounded;
    this.parkedRover.flameLeft.visible = boosterActive;
    this.parkedRover.flameRight.visible = boosterActive;
    if (boosterActive) {
      const flicker = 0.8 + Math.random() * 0.55;
      this.parkedRover.flameLeft.scale.set(1, 1, flicker);
      this.parkedRover.flameRight.scale.set(1, 1, flicker);
    }

    // Contact shadow height adjustment on jumps
    const hAbove = Math.max(0, this.roverPos.y - targetGroundY);
    this.parkedRover.contactShadow.scale.setScalar(THREE.MathUtils.clamp(1 - hAbove * 0.12, 0.45, 1));
    this.parkedRover.contactShadow.position.y = Math.max(0.03, 0.03 - hAbove);

    // Rear tire dust / turbo sparks
    const absSpd = Math.abs(this.roverSpeed);
    if (this.roverGrounded && absSpd > 3.5) {
      this.dustEmitTimer += dt * (wantsTurbo ? 26 : 13);
      while (this.dustEmitTimer >= 1) {
        this.dustEmitTimer -= 1;
        this.emitParticle(
          this.roverPos.x - fwdX * 1.15 + (Math.random() - 0.5) * 1.5,
          this.roverPos.y + 0.22,
          this.roverPos.z - fwdZ * 1.15 + (Math.random() - 0.5) * 1.5,
          -fwdX * 1.6 + (Math.random() - 0.5) * 1.5,
          0.9 + Math.random() * 1.1,
          -fwdZ * 1.6 + (Math.random() - 0.5) * 1.5,
          0.48,
          wantsTurbo ? 0.8 : 0.62,
          wantsTurbo ? '#7dd3fc' : '#d86942',
        );
      }
    }

    // Sync playerPos & velocities so radar, collectibles, hazards & HUD work seamlessly
    this.playerPos.copy(this.roverPos);
    this.playerHeading = this.roverHeading;
    this.playerVelX = fwdX * this.roverSpeed;
    this.playerVelZ = fwdZ * this.roverSpeed;

    // Onboard Rover Life Support: slower oxygen drain + daytime solar charging on Rover roof
    const nearYardSolar = Math.hypot(this.roverPos.x + 7.6, this.roverPos.z - 28.0) < 9.0;
    const nearBioModule = this.builtModules.biodome && Math.hypot(this.roverPos.x - 22, this.roverPos.z + 24) < 9.5;
    const nearSolarModule = this.builtModules.solar && Math.hypot(this.roverPos.x + 30, this.roverPos.z + 16) < 9.5;

    if (nearBioModule) {
      this.oxygen = Math.min(100, this.oxygen + dt * 24);
    } else {
      const roverO2Drain = this.builtModules.biodome ? 0.22 : 0.42;
      this.oxygen = Math.max(0, this.oxygen - dt * roverO2Drain);
    }

    const solarMult = this.solarOutputPct / 100;
    if (nearYardSolar || nearSolarModule) {
      this.battery = Math.min(100, this.battery + dt * 26 * Math.max(0.15, solarMult));
    } else if (wantsTurbo) {
      this.battery = Math.max(0, this.battery - dt * 3.8);
    } else {
      const roverSolarCharge = (1 - nightFactor) * (this.builtModules.solar ? 4.8 : 2.6) * solarMult;
      this.battery = Math.min(100, this.battery + dt * roverSolarCharge);
    }

    if (nearBioModule) {
      this.water = Math.min(100, this.water + dt * 16);
      this.food = Math.min(100, this.food + dt * 18);
    } else {
      this.water = Math.max(12, this.water - dt * 0.22);
      this.food = Math.max(12, this.food - dt * 0.16);
    }
    const roverTargetRad =
      this.activeHazard === 'solar_storm' ? 88 : 18 + (1 - nightFactor) * 16;
    this.radiation = THREE.MathUtils.damp(this.radiation, roverTargetRad, 1.8, dt);

    if (this.oxygen <= 0 || this.battery <= 0) {
      this.phase = 'lowpower';
      this.pushHudState();
    }
  }

  private updateActiveWeatherHazard(dt: number) {
    // 1. Atmospheric transitions (Purple radiation sky, Orange dust haze, Icy frost blue)
    this.weatherPurple = THREE.MathUtils.damp(this.weatherPurple, this.activeHazard === 'solar_storm' ? 1 : 0, 3.2, dt);
    this.weatherDust = THREE.MathUtils.damp(this.weatherDust, this.activeHazard === 'dust_storm' ? 1 : 0, 3.0, dt);
    this.weatherFrost = THREE.MathUtils.damp(this.weatherFrost, this.activeHazard === 'cold_snap' ? 1 : 0, 2.8, dt);
    this.frostLevel = this.weatherFrost;

    // 2. Solar Radiation Storm expanding waves on Command Radar Table + Bunker Lever glow
    const radActive = this.activeHazard === 'solar_storm';
    for (let i = 0; i < this.modularBase.radiationWaveRings.length; i++) {
      const rMesh = this.modularBase.radiationWaveRings[i];
      rMesh.visible = radActive;
      if (radActive) {
        const waveT = (this.elapsedTime * 1.15 + i * 0.33) % 1;
        const sc = 0.5 + waveT * 3.1;
        rMesh.scale.set(sc, sc, 1);
        const mat = rMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0.05, (1 - waveT) * 0.85);
      }
    }
    const targetLeverRot = this.leverPullAnim > 0.5 ? 0.75 : -0.55;
    this.modularBase.bunkerLeverHandle.rotation.x = THREE.MathUtils.damp(
      this.modularBase.bunkerLeverHandle.rotation.x,
      targetLeverRot,
      10,
      dt,
    );
    if (radActive) {
      const p = 0.5 + 0.5 * Math.sin(this.elapsedTime * 12);
      this.modularBase.bunkerLeverLightMat.color.set('#ef4444');
      this.modularBase.bunkerLeverLightMat.emissive.set('#ef4444');
      this.modularBase.bunkerLeverLightMat.emissiveIntensity = 1.2 + p * 1.6;
    } else {
      this.modularBase.bunkerLeverLightMat.color.set('#4ade80');
      this.modularBase.bunkerLeverLightMat.emissive.set('#22c55e');
      this.modularBase.bunkerLeverLightMat.emissiveIntensity = 1.4;
    }

    // 3. Giant Dust Storm swirling horizontal dust particles
    if (this.activeHazard === 'dust_storm' && this.phase !== 'paused') {
      this.hazardGaleTimer += dt * 36;
      while (this.hazardGaleTimer >= 1) {
        this.hazardGaleTimer -= 1;
        this.emitParticle(
          this.playerPos.x - 16 + (Math.random() - 0.5) * 8,
          Math.max(0.3, this.playerPos.y + Math.random() * 4.5),
          this.playerPos.z + (Math.random() - 0.5) * 24,
          17 + Math.random() * 8,
          (Math.random() - 0.3) * 1.5,
          (Math.random() - 0.5) * 4,
          0.95,
          0.9 + Math.random() * 0.7,
          Math.random() > 0.4 ? '#ea580c' : '#fb923c',
        );
      }
    }

    // 4. Micro-Meteorite Shower streaks & Greenhouse air leak mist
    if (this.activeHazard === 'meteor_shower') {
      this.meteorSpawnTimer -= dt;
      if (this.meteorSpawnTimer <= 0) {
        this.meteorSpawnTimer = 0.75 + Math.random() * 0.65;
        for (let i = 0; i < this.meteorStreaks.length; i++) {
          const m = this.meteorStreaks[i];
          if (!m.active) {
            m.active = true;
            m.x = (Math.random() - 0.5) * 14 - 8;
            m.y = 22 + Math.random() * 6;
            m.z = -18 + (Math.random() - 0.5) * 8 + 4;
            m.vx = 9 + Math.random() * 4;
            m.vy = -21 - Math.random() * 6;
            m.vz = -4 - Math.random() * 3;
            m.mesh.position.set(m.x, m.y, m.z);
            m.mesh.visible = true;
            break;
          }
        }
      }

      this.leakMistTimer += dt * 12;
      while (this.leakMistTimer >= 1) {
        this.leakMistTimer -= 1;
        this.emitParticle(
          (Math.random() - 0.5) * 2.4,
          HUB_FLOOR_Y + 4.3,
          -18.0 + (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 2.5,
          2.8 + Math.random() * 2.2,
          (Math.random() - 0.5) * 2.5,
          0.7,
          0.55,
          '#7dd3fc',
        );
      }
    }

    for (let i = 0; i < this.meteorStreaks.length; i++) {
      const m = this.meteorStreaks[i];
      if (!m.active) continue;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      m.mesh.position.set(m.x, m.y, m.z);
      if (m.y <= HUB_FLOOR_Y + 3.2) {
        m.active = false;
        m.mesh.visible = false;
        this.emitBurst(m.x, HUB_FLOOR_Y + 3.4, m.z, 10, '#f97316', 6);
        if (this.phase === 'playing') marsAudio.playMeteorStrike();
      }
    }

    // 5. Extreme Cold Snap heater core color animation
    if (this.activeHazard === 'cold_snap') {
      this.modularBase.heaterCoilsMat.color.set('#bae6fd');
      this.modularBase.heaterCoilsMat.emissive.set('#60a5fa');
      this.modularBase.heaterCoilsMat.emissiveIntensity = 0.85 + Math.sin(this.elapsedTime * 5) * 0.25;
      this.modularBase.heaterLight.color.set('#60a5fa');
      this.modularBase.heaterLight.intensity = 1.4;
    } else if (this.heaterBoostTimer > 0) {
      this.modularBase.heaterCoilsMat.color.set('#fdba74');
      this.modularBase.heaterCoilsMat.emissive.set('#f97316');
      this.modularBase.heaterCoilsMat.emissiveIntensity = 2.6 + Math.sin(this.elapsedTime * 14) * 0.4;
      this.modularBase.heaterLight.color.set('#fb923c');
      this.modularBase.heaterLight.intensity = 4.2;
    } else {
      this.modularBase.heaterCoilsMat.color.set('#fdba74');
      this.modularBase.heaterCoilsMat.emissive.set('#ea580c');
      this.modularBase.heaterCoilsMat.emissiveIntensity = 1.35;
      this.modularBase.heaterLight.color.set('#fb923c');
      this.modularBase.heaterLight.intensity = 1.8;
    }

    // 6. Dust Devil Strike Comms Dish tilt & rogue strike vortex sweep
    const targetDishTilt = this.activeHazard === 'dish_strike' ? 0.96 * (1 - this.dishRepairPct / 100) : 0;
    this.dishTilt = THREE.MathUtils.damp(this.dishTilt, targetDishTilt, 7.5, dt);
    this.modularBase.dishAssembly.rotation.z = this.dishTilt;

    if (this.strikeVortexTimer > 0) {
      this.strikeVortexTimer -= dt;
      const t = 1 - Math.max(0, this.strikeVortexTimer) / 3.0;
      const vx = 9.85 + Math.sin(t * Math.PI * 1.4) * 8.0 - 4.0 + t * 9.0;
      const vz = 25.45 - 6.0 + t * 11.0;
      this.strikeVortex.group.position.set(vx, groundHeightAt(vx, vz), vz);
      for (let r = 0; r < this.strikeVortex.rings.length; r++) {
        this.strikeVortex.rings[r].rotation.y += dt * (8 + r * 1.5);
      }
      if (this.strikeVortexTimer <= 0) {
        this.strikeVortex.group.visible = false;
      }
    }

    // 7. Main Battery Overheating (Orange smoke plumes + Cooling Vent Lever)
    const overheatActive = this.activeHazard === 'battery_overheat';
    const targetCoolingRot = this.coolingLeverPull > 0.5 ? 0.75 : -0.55;
    this.modularBase.coolingVentLeverHandle.rotation.x = THREE.MathUtils.damp(
      this.modularBase.coolingVentLeverHandle.rotation.x,
      targetCoolingRot,
      10,
      dt,
    );
    if (overheatActive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 11);
      this.modularBase.coolingVentLightMat.color.set('#fb923c');
      this.modularBase.coolingVentLightMat.emissive.set('#ea580c');
      this.modularBase.coolingVentLightMat.emissiveIntensity = 1.1 + pulse * 1.6;
      this.smokeEmitTimer += dt * 14;
      while (this.smokeEmitTimer >= 1) {
        this.smokeEmitTimer -= 1;
        const sideZ = Math.random() > 0.5 ? 3.7 : -3.7;
        this.emitParticle(
          -15.45 + (Math.random() - 0.5) * 1.1,
          HUB_FLOOR_Y + 2.3,
          sideZ + (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9,
          4.2 + Math.random() * 1.6,
          (Math.random() - 0.5) * 0.9,
          1.15,
          0.95 + Math.random() * 0.55,
          Math.random() > 0.35 ? '#fb923c' : '#f97316',
        );
      }
    } else {
      this.modularBase.coolingVentLightMat.color.set('#4ade80');
      this.modularBase.coolingVentLightMat.emissive.set('#22c55e');
      this.modularBase.coolingVentLightMat.emissiveIntensity = 1.4;
    }

    // 8. Nighttime Power Drain (keep sunset solar output at 0% until Night Mode toggled)
    if (this.activeHazard === 'night_drain') {
      this.solarOutputPct = 0;
    }

    // 9. Blown Life Support Fuse (Sparks on Wall Box + Spare Fuse Locker door swing)
    const fuseActive = this.activeHazard === 'blown_fuse';
    const wantLockerOpen = fuseActive || this.hasSpareFuse;
    this.fuseLockerOpen = THREE.MathUtils.damp(this.fuseLockerOpen, wantLockerOpen ? 1 : 0, 8, dt);
    this.modularBase.fuseLockerDoorPivot.rotation.y = -this.fuseLockerOpen * 1.85;
    if (fuseActive) {
      const fPulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 14);
      this.modularBase.fuseWallLightMat.color.set('#ef4444');
      this.modularBase.fuseWallLightMat.emissive.set('#dc2626');
      this.modularBase.fuseWallLightMat.emissiveIntensity = 1.0 + fPulse * 1.8;
      this.fuseSparkTimer -= dt;
      if (this.fuseSparkTimer <= 0) {
        this.fuseSparkTimer = 0.65 + Math.random() * 0.55;
        this.emitBurst(-22.7, HUB_FLOOR_Y + 1.45, -1.35, 10, Math.random() > 0.4 ? '#facc15' : '#38bdf8', 5.2);
        if (this.phase === 'playing' && this.locationName === 'Power & Life Support Bay') {
          marsAudio.playElectricZap();
        }
      }
    } else {
      this.modularBase.fuseWallLightMat.color.set('#4ade80');
      this.modularBase.fuseWallLightMat.emissive.set('#22c55e');
      this.modularBase.fuseWallLightMat.emissiveIntensity = 1.4;
    }

    // 10. Static Electricity Surge (Blue lightning arcs on doors + Outdoor Grounding Switch)
    const staticActive = this.activeHazard === 'static_surge';
    const targetGroundRot = this.groundingSwitchPull > 0.5 ? 0.75 : -0.55;
    this.modularBase.groundingSwitchLever.rotation.x = THREE.MathUtils.damp(
      this.modularBase.groundingSwitchLever.rotation.x,
      targetGroundRot,
      10,
      dt,
    );
    if (staticActive) {
      const gPulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 13);
      this.modularBase.groundingSwitchLightMat.color.set('#38bdf8');
      this.modularBase.groundingSwitchLightMat.emissive.set('#0ea5e9');
      this.modularBase.groundingSwitchLightMat.emissiveIntensity = 1.2 + gPulse * 1.8;
      for (let i = 0; i < this.modularBase.doorLightningArcs.length; i++) {
        const arc = this.modularBase.doorLightningArcs[i];
        arc.visible = Math.sin(this.elapsedTime * 34 + i * 2.1) > -0.35;
        arc.scale.y = 0.85 + Math.sin(this.elapsedTime * 48 + i) * 0.25;
      }
    } else {
      this.modularBase.groundingSwitchLightMat.color.set('#4ade80');
      this.modularBase.groundingSwitchLightMat.emissive.set('#22c55e');
      this.modularBase.groundingSwitchLightMat.emissiveIntensity = 1.4;
    }

    // 12. Rover Charging Overload (Flickering lights + sparking exterior dock)
    const overloadActive = this.activeHazard === 'rover_overload';
    const targetDockRot = this.slowChargeActive ? 0.7 : -0.5;
    this.modularBase.roverDockSwitchHandle.rotation.x = THREE.MathUtils.damp(
      this.modularBase.roverDockSwitchHandle.rotation.x,
      targetDockRot,
      10,
      dt,
    );
    if (overloadActive) {
      const flickerWave = Math.sin(this.elapsedTime * 37) * Math.cos(this.elapsedTime * 19);
      this.lightFlickerLevel = flickerWave > -0.15 ? 1.0 : 0.14;
      this.modularBase.roverDockLightMat.color.set('#ef4444');
      this.modularBase.roverDockLightMat.emissive.set('#dc2626');
      this.modularBase.roverDockLightMat.emissiveIntensity = 1.1 + (0.5 + 0.5 * flickerWave) * 2.0;
      this.roverDockSparkTimer -= dt;
      if (this.roverDockSparkTimer <= 0) {
        this.roverDockSparkTimer = 0.7 + Math.random() * 0.6;
        this.emitBurst(6.8, 1.8, 28.4, 9, Math.random() > 0.5 ? '#ef4444' : '#facc15', 5.2);
      }
    } else {
      this.lightFlickerLevel = this.activeHazard === 'night_drain' ? 0.65 : 1.0;
      this.modularBase.roverDockLightMat.color.set('#4ade80');
      this.modularBase.roverDockLightMat.emissive.set('#22c55e');
      this.modularBase.roverDockLightMat.emissiveIntensity = 1.45;
    }

    // Periodic rotating hazard during Free-Roam if no active hazard or emergency is running
    if (this.phase === 'playing' && this.orientationPhase === 'free_roam') {
      if (this.activeHazard === null && this.activeEmergency === null) {
        this.hazardTimer -= dt;
        if (this.hazardTimer <= 0) {
          const hazardOrder: HazardId[] = [
            'solar_storm',
            'dust_storm',
            'dusty_panels',
            'meteor_shower',
            'cold_snap',
            'dish_strike',
            'battery_overheat',
            'night_drain',
            'blown_fuse',
            'static_surge',
            'solar_jam',
            'rover_overload',
          ];
          const next = hazardOrder[this.hazardCursor % hazardOrder.length];
          this.hazardCursor += 1;
          this.triggerHazard(next);
        }
      }
    }
  }

  private updateDoorsAndEmergencies(dt: number, nightGlow: number) {
    // 1) Automatic Sliding Sci-Fi Doors with Orientation Locks & Soft Pneumatic SFX
    this.closedDoorColliders.length = 0;

    // Keep Bunker Ramp entry sealed cleanly behind the blue floor ring until Bunker is unlocked
    if (!this.unlockedRooms.bunker) {
      this.closedDoorColliders.push({
        minX: 8.2,
        maxX: 8.75,
        minZ: -2.3,
        maxZ: 2.3,
        minY: -0.6,
        maxY: 4.5,
      });
    }

    const doors = this.modularBase.doors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.soundCooldown > 0) d.soundCooldown -= dt;

      const dist = Math.hypot(this.playerPos.x - d.x, this.playerPos.z - d.z);
      const dy = Math.abs(this.playerPos.y - d.y);
      const wasOpen = d.targetOpen;

      const roomUnlocked = this.unlockedRooms[d.room];
      const outdoorHazardOverride =
        this.activeHazard === 'dusty_panels' ||
        this.activeHazard === 'dish_strike' ||
        this.activeHazard === 'static_surge' ||
        this.activeHazard === 'solar_jam' ||
        this.activeHazard === 'rover_overload';
      const outerGateBlocked =
        d.id === 'airlock_outer_door' && this.orientationPhase !== 'free_roam' && !outdoorHazardOverride;
      const blastDoorTesting = d.id === 'bunker_door' && this.blastTestTimer > 0;

      if (this.phase === 'playing' && roomUnlocked && !outerGateBlocked && !blastDoorTesting) {
        if (!d.targetOpen && dist < 5.5 && dy < 2.8) {
          d.targetOpen = true;
        } else if (d.targetOpen && (dist > 6.3 || dy > 3.5)) {
          d.targetOpen = false;
        }
      } else {
        d.targetOpen = false;
      }

      if (this.phase === 'playing' && wasOpen !== d.targetOpen && d.soundCooldown <= 0) {
        marsAudio.playDoorSlide(d.targetOpen);
        d.soundCooldown = 0.25;
      }

      d.openAmount = THREE.MathUtils.damp(d.openAmount, d.targetOpen ? 1 : 0, 14, dt);
      const slide = d.openAmount * 1.42;
      d.leftLeaf.position.x = -0.81 - slide;
      d.rightLeaf.position.x = 0.81 + slide;

      if (!roomUnlocked || outerGateBlocked) {
        d.statusMat.color.set('#38bdf8');
        d.statusMat.emissive.set('#0284c7');
        d.statusMat.emissiveIntensity = 1.6 + Math.sin(this.elapsedTime * 4.2) * 0.45;
      } else if (blastDoorTesting || this.activeEmergency === d.room) {
        const doorPulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 16.0);
        d.statusMat.color.set('#ef4444');
        d.statusMat.emissive.set('#dc2626');
        d.statusMat.emissiveIntensity = 0.6 + doorPulse * 2.4;
      } else if (d.openAmount > 0.5) {
        d.statusMat.color.set('#4ade80');
        d.statusMat.emissive.set('#22c55e');
        d.statusMat.emissiveIntensity = 1.45;
      } else {
        d.statusMat.color.set('#38bdf8');
        d.statusMat.emissive.set('#0ea5e9');
        d.statusMat.emissiveIntensity = 1.25;
      }

      if (d.openAmount < 0.65) {
        this.closedDoorColliders.push(d.colliderBox);
      }
    }

    // 2) Room Emergency State Machine (active during Free-Roam after Cadet Orientation!)
    const rooms: RoomId[] = ['power', 'greenhouse', 'bunker', 'airlock'];
    if (this.phase === 'playing' && this.orientationPhase === 'free_roam') {
      if (this.activeEmergency === null && this.activeHazard === null) {
        this.emergencyTimer -= dt;
        if (this.emergencyTimer <= 0) {
          const nextRoom = rooms[this.emergencyCursor % rooms.length];
          this.emergencyCursor += 1;
          this.activateRoomEmergency(nextRoom);
        }
      } else if (this.activeEmergency !== null) {
        const info = ROOM_EMERGENCY_INFO[this.activeEmergency];
        const dist = Math.hypot(this.playerPos.x - info.targetX, this.playerPos.z - info.targetZ);
        const dy = Math.abs(this.playerPos.y - info.targetY);
        if (dist < 3.4 && dy < 2.5) {
          this.emergenciesFixed += 1;
          this.oxygen = Math.min(100, this.oxygen + 25);
          this.battery = Math.min(100, this.battery + 25);
          this.water = Math.min(100, this.water + 15);
          this.food = Math.min(100, this.food + 15);
          this.radiation = Math.max(2, this.radiation - 10);
          this.iron += 1;
          this.ice += 1;
          this.hintTarget = null;
          this.emitBurst(info.targetX, info.targetY + 1.4, info.targetZ, 26, '#4ade80', 8);
          marsAudio.playEmergencyFixed();
          this.activeEmergency = null;
          this.emergencyTimer = 24.0;
          this.pushHudState();
        }
      }
    }

    // 3) Rapid Pulsing Corridor LED Floor Strips & Room Beacons for Active Emergency / Active Hazard
    const fastPulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 19.0);
    const hazardRoom: RoomId | null =
      this.activeHazard === 'solar_storm'
        ? 'bunker'
        : this.activeHazard === 'cold_snap' || this.activeHazard === 'battery_overheat' || this.activeHazard === 'blown_fuse'
          ? 'power'
          : this.activeHazard === 'meteor_shower'
            ? this.hasResinKit
              ? 'greenhouse'
              : 'power'
            : this.activeHazard === 'dusty_panels' ||
                this.activeHazard === 'dish_strike' ||
                this.activeHazard === 'static_surge' ||
                this.activeHazard === 'solar_jam' ||
                this.activeHazard === 'rover_overload'
              ? 'airlock'
              : null;

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const ledMat = this.modularBase.ledMaterials[r];
      const beacon = this.modularBase.roomBeacons[r];
      const roomLight = this.modularBase.roomLights[r];
      const info = ROOM_EMERGENCY_INFO[r];

      if (this.activeEmergency === r || hazardRoom === r) {
        ledMat.emissiveIntensity = 0.15 + fastPulse * 4.4;
        beacon.visible = true;
        beacon.rotation.y += dt * 3.6;
        beacon.position.y = info.targetY + 1.85 + Math.sin(this.elapsedTime * 6.5) * 0.22;
        roomLight.intensity = (1.1 + fastPulse * 3.4) * this.lightFlickerLevel;
      } else {
        ledMat.emissiveIntensity = 1.1 + nightGlow * 0.45;
        beacon.visible = false;
        roomLight.intensity = (1.6 + nightGlow * 1.4) * this.lightFlickerLevel;
      }
    }
  }

  private updateOrientationVisuals(dt: number) {
    const rooms: RoomId[] = ['power', 'greenhouse', 'bunker', 'airlock'];
    let steppedOnRoom: RoomId | null = null;

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const ring = this.modularBase.lockRings[r];
      const locked = !this.unlockedRooms[r];
      ring.group.visible = locked;
      if (ring.gateMesh) ring.gateMesh.visible = locked;

      if (locked) {
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 4.5 + i);
        ring.discMat.opacity = 0.22 + pulse * 0.22;
        ring.holoCardMesh.position.y = 1.95 + Math.sin(this.elapsedTime * 2.6 + i) * 0.12;

        if (this.phase === 'playing') {
          const dist = Math.hypot(this.playerPos.x - ring.x, this.playerPos.z - ring.z);
          if (dist < 1.8 && Math.abs(this.playerPos.y - ring.y) < 1.6) {
            steppedOnRoom = r;
            ring.holoCardMesh.scale.setScalar(1.14);
          } else {
            ring.holoCardMesh.scale.setScalar(1.0);
          }
        }
      }
    }

    if (this.phase === 'playing') {
      if (steppedOnRoom !== null) {
        if (this.dismissedHoloRoom !== steppedOnRoom && this.activeHologramRoom !== steppedOnRoom) {
          this.activeHologramRoom = steppedOnRoom;
          marsAudio.playClick();
          this.pushHudState();
        }
      } else {
        this.dismissedHoloRoom = null;
        if (this.activeHologramRoom !== null) {
          const curRing = this.modularBase.lockRings[this.activeHologramRoom];
          const awayDist = Math.hypot(this.playerPos.x - curRing.x, this.playerPos.z - curRing.z);
          if (awayDist > 2.3) {
            this.activeHologramRoom = null;
            this.pushHudState();
          }
        }
      }
    }

    // Bouncing Yellow 3D Arrows on Practice Tasks (and Command Radar Table during Practice Dust Drill)
    const tasks: PracticeTaskId[] = ['scan', 'fan', 'plants', 'blast', 'suit'];
    for (let i = 0; i < tasks.length; i++) {
      const id = tasks[i];
      const arrow = this.modularBase.practiceArrows[id];
      const cfg = PRACTICE_TASK_CONFIGS[id];

      let showArrow = false;
      if (this.orientationPhase === 'orientation') {
        const roomOpen = cfg.room === 'hub' || this.unlockedRooms[cfg.room];
        showArrow = roomOpen && !this.completedTasks[id];
      } else if (this.orientationPhase === 'dust_drill' && id === 'scan') {
        showArrow = true;
      }

      arrow.visible = showArrow;
      if (showArrow) {
        const baseY = id === 'scan' ? HUB_FLOOR_Y + 3.05 : cfg.y + 2.45;
        arrow.position.y = baseY + Math.abs(Math.sin(this.elapsedTime * 4.4)) * 0.42;
        arrow.rotation.y += dt * 2.4;
      }
    }
  }

  private updateAresBot(dt: number, nightFactor: number) {
    const bob = Math.sin(this.elapsedTime * 3.5) * 0.085;
    let isSpotlighting = false;
    let targetX = 0;
    let targetY = 0;
    let targetZ = 0;

    if (this.hintTarget && this.hintTarget.timer > 0) {
      this.hintTarget.timer -= dt;
      isSpotlighting = true;
      targetX = this.hintTarget.x;
      targetY = this.hintTarget.y + 2.75 + bob;
      targetZ = this.hintTarget.z;
      const dxH = this.playerPos.x - this.hintTarget.x;
      const dzH = this.playerPos.z - this.hintTarget.z;
      const faceYaw = Math.atan2(-dxH, -dzH);
      this.aresHeading += shortestAngleDiff(this.aresHeading, faceYaw) * Math.min(1, dt * 6.0);
      if (this.hintTarget.timer <= 0) {
        this.hintTarget = null;
      }
    } else {
      // Hover smoothly beside the Astronaut's right shoulder (or over Rover cab when driving)
      const fwdX = -Math.sin(this.playerHeading);
      const fwdZ = -Math.cos(this.playerHeading);
      const rightX = Math.cos(this.playerHeading);
      const rightZ = -Math.sin(this.playerHeading);

      let sideOffset = 0.92;
      let fwdOffset = -0.18;
      let heightOffset = 1.86;
      if (this.vehicleMode === 'rover') {
        sideOffset = 1.38;
        fwdOffset = 0.22;
        heightOffset = 2.52;
      } else if (this.viewMode === 'first') {
        sideOffset = 0.85;
        fwdOffset = 1.32;
        heightOffset = 1.72;
      }

      targetX = this.playerPos.x + rightX * sideOffset + fwdX * fwdOffset;
      targetZ = this.playerPos.z + rightZ * sideOffset + fwdZ * fwdOffset;
      targetY = this.playerPos.y + heightOffset + bob;
      this.aresHeading += shortestAngleDiff(this.aresHeading, this.playerHeading) * Math.min(1, dt * 6.0);
    }

    this.aresBot.hintSpotLight.intensity = isSpotlighting ? 6.2 + Math.sin(this.elapsedTime * 8) * 1.2 : 0;
    this.aresBot.hintBeamMesh.visible = isSpotlighting;

    this.aresPos.x = THREE.MathUtils.damp(this.aresPos.x, targetX, isSpotlighting ? 4.8 : 6.2, dt);
    this.aresPos.y = THREE.MathUtils.damp(this.aresPos.y, targetY, isSpotlighting ? 4.8 : 6.2, dt);
    this.aresPos.z = THREE.MathUtils.damp(this.aresPos.z, targetZ, isSpotlighting ? 4.8 : 6.2, dt);

    this.aresBot.root.position.copy(this.aresPos);
    this.aresBot.root.rotation.y = this.aresHeading;

    // Gentle forward tilt while flying & playful side-to-side wobble
    const speed = Math.hypot(this.playerVelX, this.playerVelZ);
    const desiredPitch = -Math.min(0.28, speed * 0.015);
    const desiredRoll = Math.sin(this.elapsedTime * 2.1) * 0.06;
    this.aresBot.bodyPivot.rotation.x = THREE.MathUtils.damp(this.aresBot.bodyPivot.rotation.x, desiredPitch, 8, dt);
    this.aresBot.bodyPivot.rotation.z = THREE.MathUtils.damp(this.aresBot.bodyPivot.rotation.z, desiredRoll, 8, dt);

    // Thruster flame flicker & glowing ear-ring pulse
    const flamePulse = 0.78 + Math.sin(this.elapsedTime * 24) * 0.16 + Math.min(0.45, speed * 0.02);
    this.aresBot.thrusterFlame.scale.set(1, flamePulse, 1);

    // 2. Expressive Digital LED Face Mood State Machine (happy / worried / wink)
    if (this.aresWinkTimer > 0) {
      this.aresWinkTimer -= dt;
    } else {
      this.aresNextWinkCountdown -= dt;
      if (this.aresNextWinkCountdown <= 0) {
        this.aresWinkTimer = 1.35;
        this.aresNextWinkCountdown = 8.0 + Math.random() * 4.5;
      }
    }

    let nearStormHazard = false;
    for (let i = 0; i < this.dustDevils.length; i++) {
      const d = this.dustDevils[i];
      const dx = this.playerPos.x - d.x;
      const dz = this.playerPos.z - d.z;
      if (dx * dx + dz * dz < 14.5 * 14.5) {
        nearStormHazard = true;
        break;
      }
    }

    const worriedNow =
      this.orientationPhase === 'dust_drill' ||
      this.activeEmergency !== null ||
      this.activeHazard !== null ||
      nearStormHazard ||
      this.oxygen < 30 ||
      this.battery < 30;

    const nextMood: AresBotMood = worriedNow ? 'worried' : this.aresWinkTimer > 0 ? 'wink' : 'happy';
    if (nextMood !== this.aresMood) {
      this.aresMood = nextMood;
      this.aresBot.setExpression(nextMood);
    }

    if (nextMood === 'worried') {
      this.aresBot.antennaOrbMat.color.set('#fb923c');
      this.aresBot.antennaOrbMat.emissive.set('#f97316');
      this.aresBot.antennaOrbMat.emissiveIntensity = 1.3 + Math.sin(this.elapsedTime * 14) * 0.8;
    } else {
      this.aresBot.antennaOrbMat.color.set('#38bdf8');
      this.aresBot.antennaOrbMat.emissive.set('#38bdf8');
      this.aresBot.antennaOrbMat.emissiveIntensity = 1.45;
    }

    // 3. Gentle Hover Thruster Particle Trail
    this.aresParticleTimer += dt;
    if (this.aresParticleTimer >= 0.09) {
      this.aresParticleTimer = 0;
      this.emitParticle(
        this.aresPos.x + (Math.random() - 0.5) * 0.08,
        this.aresPos.y - 0.38,
        this.aresPos.z + (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.35,
        -0.4 - Math.random() * 0.45,
        (Math.random() - 0.5) * 0.35,
        0.36,
        0.34,
        worriedNow ? '#fdba74' : '#7dd3fc',
      );
    }

    // 4. Contextual Kid-Friendly Speech Bubbles
    if (this.aresSpeechTimer > 0) {
      this.aresSpeechTimer -= dt;
      if (this.aresSpeechTimer <= 0) {
        this.aresSpeech = null;
      }
    }

    if (this.phase === 'playing') {
      if (this.locationName !== this.lastSpokenLocation) {
        this.lastSpokenLocation = this.locationName;
        if (this.locationName === 'Greenhouse Dome') {
          this.sayAres('Mmm, Martian potatoes! Those purple UV lights help plants grow on Mars!', 'happy', 5.8);
        } else if (this.locationName === 'Power & Life Support Bay') {
          this.sayAres('Check out those spinning oxygen turbines and glowing water tanks!', 'happy', 5.8);
        } else if (this.locationName === 'Underground Storm Bunker') {
          this.sayAres('Cozy lead-lined Storm Bunker! Even solar radiation cannot reach us down here!', 'wink', 5.8);
        } else if (this.locationName === 'Ares Alpha Exterior Yard') {
          this.sayAres('Look! The 6 yard solar panels tilt to follow the Sun! Rookie-1 Rover is parked right here!', 'wink', 6.2);
        }
      }

      if (nearStormHazard && this.aresSpeechTimer <= 0) {
        this.sayAres('Eek! A swirling Martian Dust Devil is nearby—keep your distance!', 'worried', 5.2);
      } else if ((this.oxygen < 28 || this.battery < 28) && this.aresSpeechTimer <= 0) {
        this.sayAres('Beep-beep! Suit Vitals are getting low! Let us recharge inside Ares Alpha!', 'worried', 5.5);
      } else if (this.aresSpeechTimer <= 0) {
        this.aresTipTimer -= dt;
        if (this.aresTipTimer <= 0) {
          this.aresTipTimer = 17.0;
          if (nightFactor > 0.65) {
            this.sayAres('Ooh, starry Martian night! Look up for Phobos and Deimos orbiting overhead!', 'happy', 6.0);
          } else {
            const idleFacts = [
              'Mars has the biggest volcano in our Solar System—Olympus Mons is 3x taller than Mt. Everest!',
              'Need a speed boost? Hold Shift for jetpack sprints or drive Rookie-1 Rover out to the craters!',
              'Did you know a Martian day is called a "Sol"? It is only 39 minutes longer than an Earth day!',
              'Click my speech bubble anytime if you want a cool Mars explorer tip!',
            ];
            this.sayAres(idleFacts[this.aresTipIndex % idleFacts.length], 'wink', 6.2);
            this.aresTipIndex += 1;
          }
        }
      }
    }
  }

  private updateCollectibles(dt: number) {
    for (let i = 0; i < this.collectibles.length; i++) {
      const c = this.collectibles[i];
      if (c.collected) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.collected = false;
          c.group.visible = true;
        }
        continue;
      }

      c.crystalGroup.rotation.y += dt * (c.kind === 'stars' ? 1.9 : 1.15);
      c.crystalGroup.position.y = 0.75 + Math.sin(this.elapsedTime * 2.5 + c.id) * 0.16;

      if (this.phase === 'playing') {
        const dx = this.playerPos.x - c.x;
        const dz = this.playerPos.z - c.z;
        if (dx * dx + dz * dz < 6.8) {
          c.collected = true;
          c.respawnTimer = c.kind === 'stars' ? 45 : 28;
          c.group.visible = false;

          if (c.kind === 'iron') {
            this.iron += 1;
            this.battery = Math.min(100, this.battery + 10);
            if (this.aresSpeechTimer < 1.0) {
              this.sayAres('Nice grab! Martian Iron Ore gives us metal to expand Ares Alpha!', 'wink', 4.6);
            }
          } else if (c.kind === 'ice') {
            this.ice += 1;
            this.oxygen = Math.min(100, this.oxygen + 16);
            this.water = Math.min(100, this.water + 18);
            if (this.aresSpeechTimer < 1.0) {
              this.sayAres('Brrr! Ice Crystal collected—that boosts Oxygen, Water, and builds new domes!', 'wink', 4.6);
            }
          } else {
            this.stars += 1;
            this.oxygen = Math.min(100, this.oxygen + 30);
            this.battery = Math.min(100, this.battery + 30);
            this.food = Math.min(100, this.food + 25);
            this.sayAres('WOO-HOO! A Golden Star Core! My LED eyes are sparkling!', 'wink', 5.4);
          }

          this.totalCollected += 1;
          const burstColor = c.kind === 'iron' ? '#fb923c' : c.kind === 'ice' ? '#38bdf8' : '#facc15';
          this.emitBurst(c.x, c.y + 1.0, c.z, c.kind === 'stars' ? 22 : 14, burstColor, 7);
          marsAudio.playPickup(c.kind);
          this.pushHudState();
        }
      }
    }
  }

  private updateHazards(dt: number) {
    if (this.devilCooldown > 0) this.devilCooldown -= dt;
    if (this.geyserCooldown > 0) this.geyserCooldown -= dt;

    for (let i = 0; i < this.dustDevils.length; i++) {
      const d = this.dustDevils[i];
      d.phase += d.speed * dt;
      d.x = d.anchorX + Math.cos(d.phase) * d.orbitRadius;
      d.z = d.anchorZ + Math.sin(d.phase * 1.3) * d.orbitRadius;
      const gy = groundHeightAt(d.x, d.z);
      d.group.position.set(d.x, gy, d.z);

      for (let r = 0; r < d.rings.length; r++) {
        d.rings[r].rotation.y += dt * (4.2 + r * 0.9);
      }

      if (this.phase === 'playing' && this.devilCooldown <= 0) {
        const dx = this.playerPos.x - d.x;
        const dz = this.playerPos.z - d.z;
        const hitRadius = d.radius + (this.vehicleMode === 'rover' ? 1.3 : 0.6);
        if (dx * dx + dz * dz < hitRadius * hitRadius) {
          this.devilCooldown = 1.6;
          this.hitstopTimer = 0.045;
          this.cameraShake = 0.55;
          const pushDist = Math.hypot(dx, dz) || 1;
          if (this.vehicleMode === 'rover') {
            this.roverVelY = 7.4;
            this.roverGrounded = false;
            this.roverSpeed *= -0.45;
            this.roverPos.x += (dx / pushDist) * 2.2;
            this.roverPos.z += (dz / pushDist) * 2.2;
          } else {
            this.playerVelY = 7.8;
            this.grounded = false;
            this.playerVelX = (dx / pushDist) * 14;
            this.playerVelZ = (dz / pushDist) * 14;
          }
          this.battery = Math.max(0, this.battery - 18);
          this.oxygen = Math.max(0, this.oxygen - 10);
          marsAudio.playBump();
          this.emitBurst(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 20, '#fb923c', 9);
          this.showToast('Whoa! Spun by a Dust Devil! (-10% O₂, -18% Battery)');
          this.sayAres('Whoa-oa-oa! That Dust Devil nearly spun my antenna off!', 'worried', 5.2);

          if (this.battery <= 0 || this.oxygen <= 0) {
            this.phase = 'lowpower';
          }
          this.pushHudState();
        }
      }
    }

    for (let i = 0; i < this.geysers.length; i++) {
      const g = this.geysers[i];
      g.timer = (g.timer + dt) % g.cycleDuration;
      const isTelegraph = g.timer > g.cycleDuration - 2.6 && g.timer <= g.cycleDuration - 1.3;
      const isErupting = g.timer > g.cycleDuration - 1.3;
      g.erupting = isErupting;

      if (isTelegraph) {
        g.coreMat.emissiveIntensity = 1.6 + Math.sin(this.elapsedTime * 22) * 0.9;
        g.plume.visible = false;
      } else if (isErupting) {
        g.coreMat.emissiveIntensity = 2.6;
        g.plume.visible = true;
        const eruptT = (g.timer - (g.cycleDuration - 1.3)) / 1.3;
        const hScale = Math.sin(eruptT * Math.PI);
        g.plume.scale.set(1 + hScale * 0.3, Math.max(0.08, hScale), 1 + hScale * 0.3);
        g.plume.rotation.y += dt * 6;
      } else {
        g.coreMat.emissiveIntensity = 0.45;
        g.plume.visible = false;
      }

      if (this.phase === 'playing' && isErupting && this.geyserCooldown <= 0) {
        const dx = this.playerPos.x - g.x;
        const dz = this.playerPos.z - g.z;
        if (dx * dx + dz * dz < 5.5) {
          this.geyserCooldown = 1.4;
          if (this.vehicleMode === 'rover') {
            this.roverGrounded = false;
            this.roverVelY = 15.2;
          } else {
            this.grounded = false;
            this.playerVelY = 16.5;
            this.squashX = 0.82;
            this.squashY = 1.28;
          }
          this.cameraShake = 0.25;
          marsAudio.playGeyser();
          this.emitBurst(g.x, groundHeightAt(g.x, g.z) + 1.5, g.z, 18, '#bae6fd', 8);
          this.showToast('CO₂ Geyser Launch! Woo-hoo!');
        }
      }
    }
  }

  private updateParticles(dt: number) {
    let anyChanged = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _particleDummy.position.set(0, -100, 0);
        _particleDummy.scale.setScalar(0.001);
        _particleDummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _particleDummy.matrix);
        continue;
      }
      p.vy -= 4.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      _particleDummy.position.set(p.x, p.y, p.z);
      _particleDummy.scale.setScalar(p.size * t);
      _particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _particleDummy.matrix);
      _particleColor.setRGB(p.r, p.g, p.b);
      this.particleMesh.setColorAt(i, _particleColor);
    }

    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateCamera(dt: number) {
    if (this.phase === 'title') {
      const orbitA = this.elapsedTime * 0.14;
      _camDesiredPos.set(Math.cos(orbitA) * 44, 18.0 + Math.sin(orbitA * 0.7) * 3.0, Math.sin(orbitA) * 44);
      _camDesiredLook.set(0, 2.5, 2);
      this.camera.position.lerp(_camDesiredPos, 1 - Math.exp(-3 * dt));
      _camLookCurrent.lerp(_camDesiredLook, 1 - Math.exp(-3 * dt));
      this.camera.lookAt(_camLookCurrent);
      return;
    }

    const sinY = Math.sin(this.camYaw);
    const cosY = Math.cos(this.camYaw);
    const cosP = Math.cos(this.camPitch);
    const sinP = Math.sin(this.camPitch);

    if (this.viewMode === 'first') {
      const speed = Math.hypot(this.playerVelX, this.playerVelZ);
      const isDriving = this.vehicleMode === 'rover';
      const headBob = !isDriving && this.grounded && speed > 0.8 ? Math.sin(this.stridePhase * 2) * 0.055 : 0;
      const eyeY = this.playerPos.y + (isDriving ? 2.15 : 1.72) + headBob;
      const eyeX = this.playerPos.x;
      const eyeZ = this.playerPos.z;

      this.camera.position.set(eyeX, eyeY, eyeZ);
      _camDesiredLook.set(
        eyeX - sinY * cosP * 12,
        eyeY - sinP * 12,
        eyeZ - cosY * cosP * 12,
      );
      if (this.cameraShake > 0) {
        this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
        _camDesiredLook.x += (Math.random() - 0.5) * this.cameraShake * 0.9;
        _camDesiredLook.y += (Math.random() - 0.5) * this.cameraShake * 0.9;
      }
      this.camera.lookAt(_camDesiredLook);
      return;
    }

    // 3rd-Person Orbit Camera with smooth indoor pull-in & wider rover chase view
    const surface = getBaseWalkableSurface(
      this.playerPos.x,
      this.playerPos.z,
      this.playerPos.y,
      groundHeightAt(this.playerPos.x, this.playerPos.z),
    );
    const baseDist = this.vehicleMode === 'rover' ? Math.max(this.camDistance, 9.2) : this.camDistance;
    const targetDist = surface.indoors ? Math.min(this.camDistance, 3.6) : baseDist;
    this.currentEffectiveDist = THREE.MathUtils.damp(this.currentEffectiveDist, targetDist, 7.5, dt);

    const horizDist = this.currentEffectiveDist * cosP;
    let desiredX = this.playerPos.x + sinY * horizDist;
    let desiredZ = this.playerPos.z + cosY * horizDist;
    const camFloor = getBaseWalkableSurface(desiredX, desiredZ, this.playerPos.y, groundHeightAt(desiredX, desiredZ));
    let desiredY = Math.max(this.playerPos.y + 1.55 + this.currentEffectiveDist * sinP, camFloor.floorY + 0.9);

    if (surface.indoors && Number.isFinite(surface.ceilingY)) {
      desiredY = Math.min(desiredY, surface.ceilingY - 0.45);
    }

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
      desiredX += (Math.random() - 0.5) * this.cameraShake * 1.2;
      desiredY += (Math.random() - 0.5) * this.cameraShake * 1.0;
      desiredZ += (Math.random() - 0.5) * this.cameraShake * 1.2;
    }

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, desiredX, 11, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, desiredY, 10, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, desiredZ, 11, dt);

    _camDesiredLook.set(this.playerPos.x, this.playerPos.y + (this.vehicleMode === 'rover' ? 1.65 : 1.42), this.playerPos.z);
    _camLookCurrent.x = THREE.MathUtils.damp(_camLookCurrent.x, _camDesiredLook.x, 14, dt);
    _camLookCurrent.y = THREE.MathUtils.damp(_camLookCurrent.y, _camDesiredLook.y, 14, dt);
    _camLookCurrent.z = THREE.MathUtils.damp(_camLookCurrent.z, _camDesiredLook.z, 14, dt);
    this.camera.lookAt(_camLookCurrent);
  }

  private pushHudState() {
    const builtCount = Object.values(this.builtModules).filter(Boolean).length;
    const rankTitle =
      builtCount === 0
        ? 'Red Planet Rookie'
        : builtCount === 1
          ? 'Crater Scout'
          : builtCount === 2
            ? 'Outpost Captain'
            : builtCount === 3
              ? 'Ares Commander'
              : 'Master Mars Commander';

    const nextCfg = MODULE_CONFIGS.find((m) => !this.builtModules[m.id]);
    const nearbyPadId = this.findNearbyUnbuiltPad();
    const nearRover = this.isNearRover();
    let activeObjective = 'Explore Mars & build all 4 Ares Alpha modules!';
    if (nearbyPadId) {
      const nCfg = MODULE_CONFIGS.find((m) => m.id === nearbyPadId)!;
      const buildKey = this.vehicleMode === 'rover' || nearRover ? 'F' : 'E';
      activeObjective = `At ${nCfg.shortName} Pad — Press [${buildKey}] to Construct!`;
    } else if (nextCfg) {
      activeObjective = `Next: Build ${nextCfg.shortName} (${nextCfg.cost.iron} Iron, ${nextCfg.cost.ice} Ice${
        nextCfg.cost.stars > 0 ? `, ${nextCfg.cost.stars} Star` : ''
      })`;
    } else {
      activeObjective = 'Ares Alpha Base 100% Operational!';
    }

    const nearbyPracticeTask = this.findNearbyPracticeTask();
    const canCloseShutters = this.canCloseShuttersAtHub();

    if (this.orientationPhase === 'dust_drill') {
      activeObjective = canCloseShutters
        ? 'Practice Dust Drill: Press [E] to Close Window Shutters!'
        : 'Practice Dust Drill (Zero Penalty): Head to Command Hub Radar Table!';
    } else if (this.orientationPhase === 'orientation') {
      const doneCount = (Object.values(this.completedTasks)).filter(Boolean).length;
      if (this.activeHologramRoom) {
        activeObjective = `Inspecting ${ROOM_ORIENTATION_CARDS[this.activeHologramRoom].title} Hologram — Unlock Room!`;
      } else if (nearbyPracticeTask) {
        activeObjective = `Practice Task Ready: Press [E] to ${PRACTICE_TASK_CONFIGS[nearbyPracticeTask].label}!`;
      } else {
        activeObjective = `Cadet Orientation (${doneCount}/5 Tasks): Follow bouncing yellow arrows & blue door rings!`;
      }
    }

    // Minimal Single-Line Contextual Prompt (displays ONLY when near an interactable / active hazard action!)
    let singleLinePrompt: string | null = null;
    if (this.activeHologramRoom) {
      singleLinePrompt = 'Press [E] to unlock door';
    } else if (this.activeHazard === 'solar_storm' && this.isNearBunkerLever()) {
      singleLinePrompt = 'Press [E] to pull Blast Door Lever';
    } else if (
      this.activeHazard === 'dust_storm' &&
      Math.hypot(this.playerPos.x, this.playerPos.z) < 4.4 &&
      Math.abs(this.playerPos.y - HUB_FLOOR_Y) < 2.4
    ) {
      singleLinePrompt = 'Press [E] to close Window Shutters';
    } else if (this.activeHazard === 'meteor_shower' && !this.hasResinKit && this.isNearResinKit()) {
      singleLinePrompt = 'Press [E] to grab Resin Kit';
    } else if (this.activeHazard === 'meteor_shower' && this.hasResinKit && this.isInsideGreenhouseDome()) {
      singleLinePrompt = 'Press [E] to patch Greenhouse Glass';
    } else if (this.activeHazard === 'cold_snap' && this.isNearHeaterCore()) {
      singleLinePrompt = 'Press [E] to boost Power Bay Heaters';
    } else if (this.activeHazard === 'dish_strike' && this.vehicleMode === 'foot' && this.isNearCommsDish()) {
      singleLinePrompt = 'Left-Click Wrench or press [E] to realign Comms Dish';
    } else if (
      this.activeHazard === 'dusty_panels' &&
      this.vehicleMode === 'foot' &&
      Math.hypot(this.playerPos.x + 7.6, this.playerPos.z - 27.9) < 8.5
    ) {
      singleLinePrompt = 'Left-Click Air-Blower to clean Solar Panels';
    } else if (this.activeHazard === 'battery_overheat' && this.isNearCoolingVentLever()) {
      singleLinePrompt = 'Press [E] to pull Battery Cooling Vent Lever';
    } else if (this.activeHazard === 'night_drain' && this.isNearCommandConsole()) {
      singleLinePrompt = 'Press [E] to toggle Night Mode';
    } else if (this.activeHazard === 'blown_fuse' && !this.hasSpareFuse && this.isNearFuseLocker()) {
      singleLinePrompt = 'Press [E] to grab Spare Fuse from Locker';
    } else if (this.activeHazard === 'blown_fuse' && this.hasSpareFuse && this.isNearFuseBox()) {
      singleLinePrompt = 'Press [E] to swap Life Support Fuse';
    } else if (this.activeHazard === 'static_surge' && this.vehicleMode === 'foot' && this.isNearGroundingSwitch()) {
      singleLinePrompt = 'Press [E] to pull Yellow Grounding Switch';
    } else if (this.activeHazard === 'solar_jam' && this.vehicleMode === 'foot' && this.isNearJammedSolarPanel()) {
      singleLinePrompt = 'Press [E] to clear jammed pebbles';
    } else if (this.activeHazard === 'rover_overload' && this.vehicleMode === 'foot' && this.isNearRoverDock()) {
      singleLinePrompt = 'Press [E] to switch Rover Dock to Slow Charge';
    } else if (nearRover && this.vehicleMode === 'foot') {
      singleLinePrompt = 'Press [E] to enter into the Rover';
    } else if (this.vehicleMode === 'rover') {
      singleLinePrompt = nearbyPadId ? 'Press [F] to build module | [E] to exit Rover' : 'Press [E] to exit Rover';
    } else if (canCloseShutters) {
      singleLinePrompt = 'Press [E] to close Window Shutters';
    } else if (nearbyPracticeTask) {
      singleLinePrompt = `Press [E] to ${PRACTICE_TASK_CONFIGS[nearbyPracticeTask].label}`;
    } else if (nearbyPadId) {
      const pCfg = MODULE_CONFIGS.find((m) => m.id === nearbyPadId)!;
      singleLinePrompt = `Press [E] to build ${pCfg.shortName}`;
    }

    const radarBlips: RadarBlip[] = [];
    const norm = 1 / WORLD_PLAYABLE_RADIUS;
    MODULE_CONFIGS.forEach((m) => {
      radarBlips.push({
        x: m.x * norm,
        z: m.z * norm,
        kind: this.builtModules[m.id] ? 'built' : 'pad',
      });
    });
    for (let i = 0; i < this.collectibles.length; i++) {
      const c = this.collectibles[i];
      if (!c.collected) {
        radarBlips.push({
          x: c.x * norm,
          z: c.z * norm,
          kind: c.kind === 'stars' ? 'star' : c.kind,
        });
      }
    }
    for (let i = 0; i < this.dustDevils.length; i++) {
      const d = this.dustDevils[i];
      radarBlips.push({ x: d.x * norm, z: d.z * norm, kind: 'devil' });
    }

    const speed = Math.hypot(this.playerVelX, this.playerVelZ);

    this.onHudUpdate({
      phase: this.phase,
      viewMode: this.viewMode,
      iron: this.iron,
      ice: this.ice,
      stars: this.stars,
      oxygen: Math.round(this.oxygen),
      battery: Math.round(this.battery),
      water: Math.round(this.water),
      food: Math.round(this.food),
      radiation: Math.round(this.radiation),
      speedKmh: Math.round(speed * 2.2),
      solNumber: this.solNumber,
      solProgress: this.solProgress,
      timeOfDayLabel: this.timeOfDayLabel,
      locationName: this.locationName,
      activeEmergency: this.activeEmergency,
      emergenciesFixed: this.emergenciesFixed,
      activeHazard: this.activeHazard,
      solarOutputPct: this.solarOutputPct,
      frostLevel: this.frostLevel,
      activeTool: this.activeTool,
      hasResinKit: this.hasResinKit,
      hasSpareFuse: this.hasSpareFuse,
      nightModeActive: this.nightModeActive,
      slowChargeActive: this.slowChargeActive,
      pebblesRemaining: this.pebblesRemaining,
      panelsCleaned: this.getCleanedPanelCount(),
      totalPanels: this.modularBase.solarTrackers.length,
      dishRepairPct: Math.min(100, Math.round(this.dishRepairPct)),
      singleLinePrompt,
      orientationPhase: this.orientationPhase,
      unlockedRooms: { ...this.unlockedRooms },
      completedTasks: { ...this.completedTasks },
      activeHologramRoom: this.activeHologramRoom,
      nearbyPracticeTask,
      canCloseShutters,
      shuttersClosed: this.shuttersClosed,
      builtModules: { ...this.builtModules },
      nearbyPadId,
      rankTitle,
      activeObjective: this.activeHazard ? HAZARD_SHORT_LABELS[this.activeHazard] : activeObjective,
      toastMessage: this.toastMessage,
      roverPos: { x: this.playerPos.x, z: this.playerPos.z, heading: this.playerHeading },
      vehicleMode: this.vehicleMode,
      nearRover,
      aresMood: this.aresMood,
      aresSpeech: this.aresSpeech,
      radarBlips,
      totalCollected: this.totalCollected,
      timeScale: this.timeScale,
    });
  }

  public dispose() {
    this.disposed = true;
    marsAudio.setWindLoop(false);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    const canvas = this.renderer.domElement;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('wheel', this.handleWheel);

    this.sky.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (canvas.parentNode === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
