export interface WallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export interface WalkableSurface {
  floorY: number;
  ceilingY: number; // Infinity if open sky or high dome
  indoors: boolean;
  locationName: string;
}

export const HUB_FLOOR_Y = 0.45;
export const BUNKER_FLOOR_Y = -3.2;

export const RAMP_START_X = 7.8;
export const RAMP_END_X = 15.2;

export const EXT_RAMP_START_Z = 19.6;
export const EXT_RAMP_END_Z = 22.8;

// Axis-aligned solid wall colliders for corridors, Power Bay, Storm Bunker, and Airlock Bay.
// Doorways are clean openings |x| < 2.1 or |z| < 2.1.
export const BASE_WALL_BOXES: WallBox[] = [
  // --- North Corridor (x = ±2.3, z = -12.4 .. -7.6) ---
  { minX: -2.75, maxX: -2.15, minZ: -12.4, maxZ: -7.6, minY: 0, maxY: 4.2 },
  { minX: 2.15, maxX: 2.75, minZ: -12.4, maxZ: -7.6, minY: 0, maxY: 4.2 },

  // --- West Corridor (x = -13.2 .. -7.6, z = ±2.3) ---
  { minX: -13.2, maxX: -7.6, minZ: -2.75, maxZ: -2.15, minY: 0, maxY: 4.2 },
  { minX: -13.2, maxX: -7.6, minZ: 2.15, maxZ: 2.75, minY: 0, maxY: 4.2 },

  // --- Power & Life Support Bay (x = -23.2 .. -13.0, z = -5.4 .. +5.4) ---
  // East wall with central doorway (|z| < 2.15)
  { minX: -13.4, maxX: -12.8, minZ: -5.4, maxZ: -2.15, minY: 0, maxY: 4.8 },
  { minX: -13.4, maxX: -12.8, minZ: 2.15, maxZ: 5.4, minY: 0, maxY: 4.8 },
  // West, North, South outer walls
  { minX: -23.6, maxX: -23.0, minZ: -5.4, maxZ: 5.4, minY: 0, maxY: 4.8 },
  { minX: -23.6, maxX: -12.8, minZ: -5.6, maxZ: -5.0, minY: 0, maxY: 4.8 },
  { minX: -23.6, maxX: -12.8, minZ: 5.0, maxZ: 5.6, minY: 0, maxY: 4.8 },

  // --- East Ramp Corridor (x = 7.6 .. 15.2, z = ±2.3, spans underground depth) ---
  { minX: 7.6, maxX: 15.4, minZ: -2.75, maxZ: -2.15, minY: -3.6, maxY: 4.2 },
  { minX: 7.6, maxX: 15.4, minZ: 2.15, maxZ: 2.75, minY: -3.6, maxY: 4.2 },

  // --- Lead-Lined Underground Storm Bunker (x = 15.2 .. 25.4, z = -5.4 .. +5.4) ---
  // West wall with central ramp entrance (|z| < 2.15)
  { minX: 15.0, maxX: 15.6, minZ: -5.4, maxZ: -2.15, minY: -3.6, maxY: 1.0 },
  { minX: 15.0, maxX: 15.6, minZ: 2.15, maxZ: 5.4, minY: -3.6, maxY: 1.0 },
  // East, North, South lead-lined walls
  { minX: 25.2, maxX: 25.9, minZ: -5.4, maxZ: 5.4, minY: -3.6, maxY: 1.0 },
  { minX: 15.0, maxX: 25.9, minZ: -5.6, maxZ: -5.0, minY: -3.6, maxY: 1.0 },
  { minX: 15.0, maxX: 25.9, minZ: 5.0, maxZ: 5.6, minY: -3.6, maxY: 1.0 },

  // --- South Corridor (x = ±2.3, z = 7.6 .. 12.2) ---
  { minX: -2.75, maxX: -2.15, minZ: 7.6, maxZ: 12.2, minY: 0, maxY: 4.2 },
  { minX: 2.15, maxX: 2.75, minZ: 7.6, maxZ: 12.2, minY: 0, maxY: 4.2 },

  // --- Airlock & Suit Bay (x = -5.0 .. +5.0, z = 12.0 .. 19.6) ---
  // North wall with central doorway (|x| < 2.15)
  { minX: -5.2, maxX: -2.15, minZ: 11.8, maxZ: 12.4, minY: 0, maxY: 4.5 },
  { minX: 2.15, maxX: 5.2, minZ: 11.8, maxZ: 12.4, minY: 0, maxY: 4.5 },
  // West & East walls
  { minX: -5.4, maxX: -4.8, minZ: 11.8, maxZ: 19.8, minY: 0, maxY: 4.5 },
  { minX: 4.8, maxX: 5.4, minZ: 11.8, maxZ: 19.8, minY: 0, maxY: 4.5 },
  // South Airlock Gate with open exterior exit (|x| < 2.15)
  { minX: -5.4, maxX: -2.15, minZ: 19.2, maxZ: 19.8, minY: 0, maxY: 4.5 },
  { minX: 2.15, maxX: 5.4, minZ: 19.2, maxZ: 19.8, minY: 0, maxY: 4.5 },
];

export function isInsideBunkerExcavation(x: number, z: number): boolean {
  // Terrain recess beneath East Ramp and Underground Storm Bunker so ground never clips inside
  const inRamp = x >= 8.4 && x <= 15.6 && Math.abs(z) <= 3.2;
  const inBunker = x >= 14.5 && x <= 26.2 && Math.abs(z) <= 6.2;
  return inRamp || inBunker;
}

export function getBaseWalkableSurface(
  x: number,
  z: number,
  currentY: number,
  terrainGroundY: number,
): WalkableSurface {
  // 1) Central Command Hub (circle radius 8.4)
  const rHub = Math.hypot(x, z);
  if (rHub <= 8.4 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 8.6,
      indoors: true,
      locationName: 'Central Command Hub',
    };
  }

  // 2) North Corridor & Greenhouse Dome
  if (Math.abs(x) <= 2.3 && z >= -12.4 && z <= -7.6 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 3.7,
      indoors: true,
      locationName: 'North Bio-Corridor',
    };
  }
  const rGreen = Math.hypot(x, z + 18.0);
  if (rGreen <= 6.6 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 6.9,
      indoors: true,
      locationName: 'Greenhouse Dome',
    };
  }

  // 3) West Corridor & Power / Life Support Bay
  if (x >= -13.2 && x <= -7.6 && Math.abs(z) <= 2.3 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 3.7,
      indoors: true,
      locationName: 'West Power Corridor',
    };
  }
  if (x >= -23.3 && x <= -13.0 && Math.abs(z) <= 5.3 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 4.5,
      indoors: true,
      locationName: 'Power & Life Support Bay',
    };
  }

  // 4) East Ramp Corridor & Lead-Lined Underground Storm Bunker
  if (x >= RAMP_START_X && x <= RAMP_END_X && Math.abs(z) <= 2.3) {
    const t = Math.max(0, Math.min(1, (x - RAMP_START_X) / (RAMP_END_X - RAMP_START_X)));
    const rampFloor = HUB_FLOOR_Y + (BUNKER_FLOOR_Y - HUB_FLOOR_Y) * t;
    // Allow walking on top of ramp cover only if well above ramp roof
    if (currentY > 1.8) {
      return { floorY: 2.2, ceilingY: Infinity, indoors: false, locationName: 'Ares Alpha Rooftop' };
    }
    return {
      floorY: rampFloor,
      ceilingY: rampFloor + 3.4,
      indoors: true,
      locationName: 'Bunker Access Ramp',
    };
  }
  if (x >= 15.0 && x <= 25.5 && Math.abs(z) <= 5.3) {
    // Check if astronaut is walking INSIDE underground bunker vs ON TOP of armored bunker roof
    if (currentY < 0.1) {
      return {
        floorY: BUNKER_FLOOR_Y,
        ceilingY: 0.35,
        indoors: true,
        locationName: 'Underground Storm Bunker',
      };
    }
    return {
      floorY: 0.85,
      ceilingY: Infinity,
      indoors: false,
      locationName: 'Bunker Armored Roof',
    };
  }

  // 5) South Corridor, Airlock & Suit Bay, Exterior Ramp & Yard
  if (Math.abs(x) <= 2.3 && z >= 7.6 && z <= 12.2 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 3.7,
      indoors: true,
      locationName: 'South Airlock Corridor',
    };
  }
  if (Math.abs(x) <= 5.1 && z >= 12.0 && z <= 19.6 && currentY >= -0.4) {
    return {
      floorY: HUB_FLOOR_Y,
      ceilingY: 4.3,
      indoors: true,
      locationName: 'Airlock & Suit Bay',
    };
  }
  if (Math.abs(x) <= 2.5 && z >= EXT_RAMP_START_Z && z <= EXT_RAMP_END_Z) {
    const t = Math.max(0, Math.min(1, (z - EXT_RAMP_START_Z) / (EXT_RAMP_END_Z - EXT_RAMP_START_Z)));
    return {
      floorY: HUB_FLOOR_Y * (1 - t),
      ceilingY: Infinity,
      indoors: false,
      locationName: 'Exterior Airlock Ramp',
    };
  }
  if (Math.abs(x) <= 15.5 && z >= 22.8 && z <= 36.5) {
    return {
      floorY: Math.max(0.04, terrainGroundY),
      ceilingY: Infinity,
      indoors: false,
      locationName: 'Ares Alpha Exterior Yard',
    };
  }

  return {
    floorY: terrainGroundY,
    ceilingY: Infinity,
    indoors: false,
    locationName: 'Martian Plains',
  };
}

function pushCircleOutOfDomeWall(
  x: number,
  z: number,
  cx: number,
  cz: number,
  innerR: number,
  outerR: number,
  radius: number,
  doorOpenCheck: (dx: number, dz: number) => boolean,
): [number, number] {
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d < 0.0001) return [x, z];

  if (doorOpenCheck(dx, dz)) return [x, z];

  const midR = (innerR + outerR) * 0.5;
  if (d > innerR - radius && d <= midR) {
    const target = innerR - radius;
    return [cx + (dx / d) * target, cz + (dz / d) * target];
  }
  if (d > midR && d < outerR + radius) {
    const target = outerR + radius;
    return [cx + (dx / d) * target, cz + (dz / d) * target];
  }
  return [x, z];
}

export const EXTERIOR_YARD_BOXES: WallBox[] = [
  // Exterior Air Intake Fan Housing (West side of Airlock exterior wall)
  { minX: -8.65, maxX: -5.1, minZ: 19.3, maxZ: 21.85, minY: 0, maxY: 3.4 },
  // 6 Tilting Solar Panel Pedestals (West Yard 2x3 Solar Array)
  { minX: -11.45, maxX: -10.15, minZ: 24.95, maxZ: 26.25, minY: 0, maxY: 3.2 },
  { minX: -8.25, maxX: -6.95, minZ: 24.95, maxZ: 26.25, minY: 0, maxY: 3.2 },
  { minX: -5.05, maxX: -3.75, minZ: 24.95, maxZ: 26.25, minY: 0, maxY: 3.2 },
  { minX: -11.45, maxX: -10.15, minZ: 29.55, maxZ: 30.85, minY: 0, maxY: 3.2 },
  { minX: -8.25, maxX: -6.95, minZ: 29.55, maxZ: 30.85, minY: 0, maxY: 3.2 },
  { minX: -5.05, maxX: -3.75, minZ: 29.55, maxZ: 30.85, minY: 0, maxY: 3.2 },
  // Rotating Satellite Comms Dish Tower (East-North Yard)
  { minX: 8.65, maxX: 11.05, minZ: 24.25, maxZ: 26.65, minY: 0, maxY: 6.2 },
  // Exterior Water Storage Tank (East-South Yard)
  { minX: 7.75, maxX: 11.95, minZ: 30.15, maxZ: 33.05, minY: 0, maxY: 3.6 },
  // 4 Exterior Yard Floodlight Poles
  { minX: -12.82, maxX: -12.18, minZ: 23.68, maxZ: 24.32, minY: 0, maxY: 5.0 },
  { minX: 12.18, maxX: 12.82, minZ: 23.68, maxZ: 24.32, minY: 0, maxY: 5.0 },
  { minX: -12.82, maxX: -12.18, minZ: 34.18, maxZ: 34.82, minY: 0, maxY: 5.0 },
  { minX: 12.18, maxX: 12.82, minZ: 34.18, maxZ: 34.82, minY: 0, maxY: 5.0 },
];

const ROVER_AIRLOCK_GATE_STOP: WallBox[] = [
  { minX: -5.4, maxX: 5.4, minZ: 18.8, maxZ: 21.8, minY: 0, maxY: 4.5 },
];

export function resolveBaseWallCollisions(
  x: number,
  z: number,
  y: number,
  radius: number,
  closedDoors?: WallBox[],
  forRover = false,
): [number, number] {
  let px = x;
  let pz = z;

  // 1) Resolve Circular Dome Walls (only if below dome top height)
  if (y < 6.8) {
    [px, pz] = pushCircleOutOfDomeWall(
      px,
      pz,
      0,
      0,
      8.0,
      8.9,
      radius,
      (dx, dz) => !forRover && (Math.abs(dx) < 1.95 || Math.abs(dz) < 1.95),
    );
    [px, pz] = pushCircleOutOfDomeWall(
      px,
      pz,
      0,
      -18.0,
      6.25,
      7.05,
      radius,
      (dx, dz) => !forRover && dz > 0 && Math.abs(dx) < 1.95,
    );
  }

  // 2) Interior Prop Colliders (Central Radar Table & 4 Command Desks)
  if (y < 2.4) {
    const rTable = Math.hypot(px, pz);
    const minTableR = 1.32 + radius;
    if (rTable < minTableR && rTable > 0.0001) {
      px = (px / rTable) * minTableR;
      pz = (pz / rTable) * minTableR;
    }

    const deskCoords: Array<[number, number]> = [
      [-4.6, -4.6],
      [4.6, -4.6],
      [-4.6, 4.6],
      [4.6, 4.6],
    ];
    for (let i = 0; i < deskCoords.length; i++) {
      const [dxPos, dzPos] = deskCoords[i];
      const dx = px - dxPos;
      const dz = pz - dzPos;
      const dist = Math.hypot(dx, dz);
      const minDeskR = 1.05 + radius;
      if (dist < minDeskR && dist > 0.0001) {
        px = dxPos + (dx / dist) * minDeskR;
        pz = dzPos + (dz / dist) * minDeskR;
      }
    }
  }

  // 3) Resolve Axis-Aligned Wall Boxes & Interior Furniture (smooth sliding along X or Z)
  const interiorBoxes: WallBox[] = [
    // Greenhouse Raised Planter Beds
    { minX: -4.9, maxX: -2.7, minZ: -21.2, maxZ: -15.6, minY: 0, maxY: 2.2 },
    { minX: 2.7, maxX: 4.9, minZ: -21.2, maxZ: -15.6, minY: 0, maxY: 2.2 },
    // Power Bay: West Oxygen Turbines
    { minX: -22.4, maxX: -19.8, minZ: -4.3, maxZ: -1.85, minY: 0, maxY: 3.6 },
    { minX: -22.4, maxX: -19.8, minZ: 1.85, maxZ: 4.3, minY: 0, maxY: 3.6 },
    // Power Bay: Center-Flank Glowing Blue Water Tanks
    { minX: -19.15, maxX: -17.35, minZ: -4.6, maxZ: -2.65, minY: 0, maxY: 3.6 },
    { minX: -19.15, maxX: -17.35, minZ: 2.65, maxZ: 4.6, minY: 0, maxY: 3.6 },
    // Power Bay: East Battery Racks
    { minX: -16.4, maxX: -14.5, minZ: -4.6, maxZ: -2.75, minY: 0, maxY: 3.4 },
    { minX: -16.4, maxX: -14.5, minZ: 2.75, maxZ: 4.6, minY: 0, maxY: 3.4 },
    // Storm Bunker: Two-Tier Bunk Beds & Corner Supply Crates
    { minX: 18.8, maxX: 22.4, minZ: -4.75, maxZ: -2.85, minY: -3.5, maxY: -0.4 },
    { minX: 18.8, maxX: 22.4, minZ: 2.85, maxZ: 4.75, minY: -3.5, maxY: -0.4 },
    { minX: 16.5, maxX: 18.1, minZ: -4.6, maxZ: -3.1, minY: -3.5, maxY: -1.2 },
    { minX: 16.5, maxX: 18.1, minZ: 3.1, maxZ: 4.6, minY: -3.5, maxY: -1.2 },
    { minX: 23.6, maxX: 25.0, minZ: -1.5, maxZ: 1.5, minY: -3.5, maxY: -0.8 },
    // Airlock & Suit Bay: West Suit-Up Booth Back Wall & East Suit Lockers
    { minX: -4.9, maxX: -3.5, minZ: 14.4, maxZ: 17.2, minY: 0, maxY: 3.6 },
    { minX: 3.3, maxX: 4.9, minZ: 13.3, maxZ: 18.3, minY: 0, maxY: 3.6 },
  ];

  const resolveBoxList = (list: WallBox[]) => {
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (y + 1.8 < w.minY || y > w.maxY) continue;

      const closestX = Math.max(w.minX, Math.min(px, w.maxX));
      const closestZ = Math.max(w.minZ, Math.min(pz, w.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 0.00001) {
          const d = Math.sqrt(distSq);
          const push = radius - d;
          px += (dx / d) * push;
          pz += (dz / d) * push;
        } else {
          const penLeft = Math.abs(px - w.minX);
          const penRight = Math.abs(w.maxX - px);
          const penTop = Math.abs(pz - w.minZ);
          const penBottom = Math.abs(w.maxZ - pz);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) px = w.minX - radius;
          else if (minPen === penRight) px = w.maxX + radius;
          else if (minPen === penTop) pz = w.minZ - radius;
          else pz = w.maxZ + radius;
        }
      }
    }
  };

  resolveBoxList(BASE_WALL_BOXES);
  resolveBoxList(interiorBoxes);
  resolveBoxList(EXTERIOR_YARD_BOXES);
  if (forRover) {
    resolveBoxList(ROVER_AIRLOCK_GATE_STOP);
  } else if (closedDoors && closedDoors.length > 0) {
    resolveBoxList(closedDoors);
  }

  return [px, pz];
}
