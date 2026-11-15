export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'lowpower';

export type ModuleId = 'solar' | 'biodome' | 'garage' | 'antenna';

export type ResourceType = 'iron' | 'ice' | 'stars';

export interface ResourceCost {
  iron: number;
  ice: number;
  stars: number;
}

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  shortName: string;
  description: string;
  benefit: string;
  cost: ResourceCost;
  x: number;
  z: number;
  accentColor: string;
}

export const MODULE_CONFIGS: ModuleConfig[] = [
  {
    id: 'solar',
    name: 'Solar Power Array',
    shortName: 'Solar Array',
    description: 'Unfolds giant solar wings to power the base & recharge your suit faster.',
    benefit: '+50% Battery Recharge',
    cost: { iron: 3, ice: 2, stars: 0 },
    x: -30,
    z: -16,
    accentColor: '#38bdf8',
  },
  {
    id: 'biodome',
    name: 'Exo-Botany Array',
    shortName: 'Bio-Garden',
    description: 'Expands exterior oxygen-producing algae domes around Ares Alpha.',
    benefit: 'Base Life Support Online',
    cost: { iron: 4, ice: 4, stars: 0 },
    x: 22,
    z: -24,
    accentColor: '#4ade80',
  },
  {
    id: 'garage',
    name: 'Turbo Suit & Rover Bay',
    shortName: 'Turbo Bay',
    description: 'Supercharges your spacesuit thrusters for +25% sprint speed.',
    benefit: '+25% Sprint Speed',
    cost: { iron: 5, ice: 3, stars: 1 },
    x: -24,
    z: 28,
    accentColor: '#fb923c',
  },
  {
    id: 'antenna',
    name: 'Deep-Space Relay Dish',
    shortName: 'Relay Dish',
    description: 'Links Ares Alpha directly to Earth Mission Control!',
    benefit: 'Completes Mars Base!',
    cost: { iron: 6, ice: 5, stars: 3 },
    x: 26,
    z: 28,
    accentColor: '#facc15',
  },
];

export interface RadarBlip {
  x: number; // normalized -1..1 relative to world radius
  z: number;
  kind: 'iron' | 'ice' | 'star' | 'pad' | 'built' | 'devil';
}

export type ViewMode = 'third' | 'first';

export type RoomId = 'power' | 'greenhouse' | 'bunker' | 'airlock';

export const ROOM_EMERGENCY_INFO: Record<
  RoomId,
  {
    roomName: string;
    stripColor: string;
    badgeBg: string;
    badgeText: string;
    alertTitle: string;
    guideHint: string;
    targetX: number;
    targetZ: number;
    targetY: number;
  }
> = {
  power: {
    roomName: 'Power & Life Support Bay',
    stripColor: 'YELLOW',
    badgeBg: 'bg-yellow-400/20 border-yellow-400 text-yellow-200',
    badgeText: 'text-yellow-300',
    alertTitle: 'O₂ Scrubber Overload!',
    guideHint: 'Follow the pulsing YELLOW floor strip West to Power Bay!',
    targetX: -18.5,
    targetZ: 0,
    targetY: 0.45,
  },
  greenhouse: {
    roomName: 'Greenhouse Dome',
    stripColor: 'GREEN',
    badgeBg: 'bg-emerald-400/20 border-emerald-400 text-emerald-200',
    badgeText: 'text-emerald-300',
    alertTitle: 'Bio-Dome Frost Alert!',
    guideHint: 'Follow the pulsing GREEN floor strip North to Greenhouse Dome!',
    targetX: 0,
    targetZ: -18.0,
    targetY: 0.45,
  },
  bunker: {
    roomName: 'Underground Storm Bunker',
    stripColor: 'ORANGE',
    badgeBg: 'bg-orange-400/20 border-orange-400 text-orange-200',
    badgeText: 'text-orange-300',
    alertTitle: 'Radiation Shield Check!',
    guideHint: 'Follow the pulsing ORANGE floor strip down the East Ramp to Storm Bunker!',
    targetX: 20.3,
    targetZ: 0,
    targetY: -3.2,
  },
  airlock: {
    roomName: 'Airlock & Suit Bay',
    stripColor: 'BLUE',
    badgeBg: 'bg-sky-400/20 border-sky-400 text-sky-200',
    badgeText: 'text-sky-300',
    alertTitle: 'Airlock Pressure Drop!',
    guideHint: 'Follow the pulsing BLUE floor strip South to Airlock & Suit Bay!',
    targetX: 0,
    targetZ: 15.8,
    targetY: 0.45,
  },
};

export type AresBotMood = 'happy' | 'worried' | 'wink';

export type PracticeTaskId = 'scan' | 'fan' | 'plants' | 'blast' | 'suit';

export type OrientationPhase = 'orientation' | 'dust_drill' | 'free_roam';

export const ROOM_ORIENTATION_CARDS: Record<
  RoomId,
  {
    title: string;
    stripLabel: string;
    accentHex: string;
    whatsInside: string;
    whatItDoes: string;
    whenToRunHere: string;
  }
> = {
  power: {
    title: 'Power & Life Support Bay',
    stripLabel: 'YELLOW FLOOR STRIP · WEST',
    accentHex: '#facc15',
    whatsInside: 'Spinning oxygen turbines, glowing blue water tanks, and high-voltage battery racks.',
    whatItDoes: 'Pumps clean oxygen into Ares Alpha, circulates water, and recharges suit batteries.',
    whenToRunHere: 'Run here whenever Power or Oxygen drops—or when the YELLOW floor strip pulses!',
  },
  greenhouse: {
    title: 'Greenhouse Bio-Dome',
    stripLabel: 'GREEN FLOOR STRIP · NORTH',
    accentHex: '#4ade80',
    whatsInside: 'Raised planter beds full of Martian potato plants under bright purple UV grow-lights.',
    whatItDoes: 'Grows fresh astronaut food while plants naturally scrub CO₂ into crisp Oxygen.',
    whenToRunHere: 'Run here to refill Food & Water—or when the GREEN floor strip pulses!',
  },
  bunker: {
    title: 'Underground Storm Bunker',
    stripLabel: 'ORANGE FLOOR STRIP · EAST RAMP',
    accentHex: '#fb923c',
    whatsInside: 'Thick lead-lined walls, heavy armored blast doors, cozy bunk beds, and storm consoles.',
    whatItDoes: 'Blocks cosmic radiation spikes and shields the crew during fierce Martian dust storms.',
    whenToRunHere: 'Run down the East Ramp when Radiation rises—or when the ORANGE floor strip pulses!',
  },
  airlock: {
    title: 'Airlock & Suit Bay',
    stripLabel: 'BLUE FLOOR STRIP · SOUTH',
    accentHex: '#38bdf8',
    whatsInside: 'A glowing Suit-Up Booth, EVA spacesuit lockers, helmet chargers, and the exterior ramp.',
    whatItDoes: 'Equalizes air pressure safely so you can step outside to Rookie-1 Rover and solar arrays.',
    whenToRunHere: 'Run here before venturing outside onto Mars—or when the BLUE floor strip pulses!',
  },
};

export interface PracticeTaskConfig {
  id: PracticeTaskId;
  room: 'hub' | RoomId;
  roomLabel: string;
  label: string;
  actionText: string;
  x: number;
  y: number;
  z: number;
  hintText: string;
}

export const PRACTICE_TASK_CONFIGS: Record<PracticeTaskId, PracticeTaskConfig> = {
  scan: {
    id: 'scan',
    room: 'hub',
    roomLabel: 'Central Command Hub',
    label: 'Run Base Scan',
    actionText: 'RUN BASE SCAN [E]',
    x: 0,
    y: 0.45,
    z: 0,
    hintText: 'Walk up to the Central Radar Table in the Command Hub and press [E] to Run Base Scan!',
  },
  fan: {
    id: 'fan',
    room: 'power',
    roomLabel: 'Power & Life Support Bay',
    label: 'Boost Air Fan',
    actionText: 'BOOST AIR FAN [E]',
    x: -20.4,
    y: 0.45,
    z: 0,
    hintText: 'Head West into Power Bay between the spinning oxygen turbines and press [E] to Boost Air Fan!',
  },
  plants: {
    id: 'plants',
    room: 'greenhouse',
    roomLabel: 'Greenhouse Dome',
    label: 'Water Plants',
    actionText: 'WATER PLANTS [E]',
    x: 0,
    y: 0.45,
    z: -18.0,
    hintText: 'Head North into the Greenhouse Dome between the potato beds and press [E] to Water Plants!',
  },
  blast: {
    id: 'blast',
    room: 'bunker',
    roomLabel: 'Underground Storm Bunker',
    label: 'Test Blast Door',
    actionText: 'TEST BLAST DOOR [E]',
    x: 17.5,
    y: -3.2,
    z: 0,
    hintText: 'Walk down the East Ramp into Storm Bunker by the thick blast door and press [E] to Test Blast Door!',
  },
  suit: {
    id: 'suit',
    room: 'airlock',
    roomLabel: 'Airlock & Suit Bay',
    label: 'Equip Spacesuit',
    actionText: 'EQUIP SPACESUIT [E]',
    x: -2.4,
    y: 0.45,
    z: 15.8,
    hintText: 'Walk South into the Airlock beside the glowing Suit-Up Booth and press [E] to Equip Spacesuit!',
  },
};

export type HazardId =
  | 'solar_storm'
  | 'dust_storm'
  | 'dusty_panels'
  | 'meteor_shower'
  | 'cold_snap'
  | 'dish_strike'
  | 'battery_overheat'
  | 'night_drain'
  | 'blown_fuse'
  | 'static_surge'
  | 'solar_jam'
  | 'rover_overload';

export type ToolId = 'none' | 'blower' | 'wrench';

export const HAZARD_SHORT_LABELS: Record<HazardId, string> = {
  solar_storm: 'Solar Radiation Storm — Pull Storm Bunker Lever [E]',
  dust_storm: 'Giant Dust Storm — Close Window Shutters in Command Hub [E]',
  dusty_panels: 'Dust-Covered Solar Panels — Use Air-Blower Outdoors (Left-Click)',
  meteor_shower: 'Micro-Meteorite Shower — Grab Power Bay Resin Kit [E] & Patch Greenhouse',
  cold_snap: 'Extreme Cold Snap — Boost Power Bay Heaters [E]',
  dish_strike: 'Dust Devil Strike — Realign Comms Dish Outside with Wrench (Left-Click / [E])',
  battery_overheat: 'Main Battery Overheating — Pull Power Bay Cooling Vent Lever [E]',
  night_drain: 'Nighttime Power Drain — Toggle Night Mode in Command Hub [E]',
  blown_fuse: 'Blown Life Support Fuse — Grab Spare Fuse from Locker [E] & Swap on Wall Box',
  static_surge: 'Static Electricity Surge — Pull Outdoor Yellow Grounding Switch [E]',
  solar_jam: 'Solar Panel Motor Jam — Clear Jammed Pebbles Outside [E]',
  rover_overload: 'Rover Charging Overload — Switch Exterior Rover Dock to Slow Charge [E]',
};

export interface GameHudState {
  phase: GamePhase;
  viewMode: ViewMode;
  iron: number;
  ice: number;
  stars: number;
  oxygen: number; // 0..100 (diegetic blue backpack bar)
  battery: number; // 0..100 (Power / suit battery)
  water: number; // 0..100
  food: number; // 0..100
  radiation: number; // 0..100
  speedKmh: number;
  solNumber: number;
  solProgress: number; // 0..1 (0.25 = noon, 0.5 = sunset, 0.75 = midnight, 0.0 = dawn)
  timeOfDayLabel: string;
  locationName: string;
  activeEmergency: RoomId | null;
  emergenciesFixed: number;
  activeHazard: HazardId | null;
  solarOutputPct: number;
  frostLevel: number; // 0..1 visual frost on screen during Cold Snap
  activeTool: ToolId;
  hasResinKit: boolean;
  hasSpareFuse: boolean;
  nightModeActive: boolean;
  slowChargeActive: boolean;
  pebblesRemaining: number;
  panelsCleaned: number;
  totalPanels: number;
  dishRepairPct: number;
  singleLinePrompt: string | null;
  orientationPhase: OrientationPhase;
  unlockedRooms: Record<RoomId, boolean>;
  completedTasks: Record<PracticeTaskId, boolean>;
  activeHologramRoom: RoomId | null;
  nearbyPracticeTask: PracticeTaskId | null;
  canCloseShutters: boolean;
  shuttersClosed: boolean;
  builtModules: Record<ModuleId, boolean>;
  nearbyPadId: ModuleId | null;
  rankTitle: string;
  activeObjective: string;
  toastMessage: string | null;
  roverPos: { x: number; z: number; heading: number };
  vehicleMode: 'foot' | 'rover';
  nearRover: boolean;
  aresMood: AresBotMood;
  aresSpeech: string | null;
  radarBlips: RadarBlip[];
  totalCollected: number;
  timeScale: number; // 1 = normal sol cycle, 8 = fast-forward sky view
}



