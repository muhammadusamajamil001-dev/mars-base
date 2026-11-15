import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CloudLightning,
  Droplets,
  Eye,
  FastForward,
  Flame,
  Lightbulb,
  Lock,
  Moon,
  Pause,
  Play,
  Radiation,
  Rocket,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Sun,
  Trophy,
  Unlock,
  Utensils,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { MarsGameEngine } from './game/MarsGameEngine';
import { marsAudio } from './game/audio';
import { WORLD_PLAYABLE_RADIUS } from './game/terrain';
import {
  GameHudState,
  HAZARD_SHORT_LABELS,
  HazardId,
  ROOM_ORIENTATION_CARDS,
} from './game/types';

const INITIAL_HUD: GameHudState = {
  phase: 'title',
  viewMode: 'third',
  iron: 0,
  ice: 0,
  stars: 0,
  oxygen: 100,
  battery: 100,
  water: 100,
  food: 100,
  radiation: 6,
  speedKmh: 0,
  solNumber: 1,
  solProgress: 0.18,
  timeOfDayLabel: 'High Noon',
  locationName: 'Central Command Hub',
  activeEmergency: null,
  emergenciesFixed: 0,
  activeHazard: null,
  solarOutputPct: 100,
  frostLevel: 0,
  activeTool: 'none',
  hasResinKit: false,
  hasSpareFuse: false,
  nightModeActive: false,
  slowChargeActive: false,
  pebblesRemaining: 0,
  panelsCleaned: 6,
  totalPanels: 6,
  dishRepairPct: 100,
  singleLinePrompt: null,
  orientationPhase: 'orientation',
  unlockedRooms: {
    power: false,
    greenhouse: false,
    bunker: false,
    airlock: false,
  },
  completedTasks: {
    scan: false,
    fan: false,
    plants: false,
    blast: false,
    suit: false,
  },
  activeHologramRoom: null,
  nearbyPracticeTask: null,
  canCloseShutters: false,
  shuttersClosed: false,
  builtModules: {
    solar: false,
    biodome: false,
    garage: false,
    antenna: false,
  },
  nearbyPadId: null,
  rankTitle: 'Red Planet Rookie',
  activeObjective: '',
  toastMessage: null,
  roverPos: { x: 0, z: 4.4, heading: 0 },
  vehicleMode: 'foot',
  nearRover: false,
  aresMood: 'happy',
  aresSpeech: null,
  radarBlips: [],
  totalCollected: 0,
  timeScale: 1,
};

function IronIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <polygon points="12,2 20,8 17,20 7,20 4,8" fill="#fb923c" stroke="#fed7aa" strokeWidth="1.5" />
      <polygon points="12,2 17,20 12,13 7,20" fill="#ea580c" opacity="0.55" />
    </svg>
  );
}

function IceIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <polygon points="12,2 19,9 12,22 5,9" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1.5" />
      <polygon points="12,2 19,9 12,12" fill="#7dd3fc" opacity="0.65" />
    </svg>
  );
}

function StarCoreIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <polygon
        points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"
        fill="#facc15"
        stroke="#fef08a"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function TitleLockupSvg() {
  return (
    <svg viewBox="0 0 680 185" className="w-full max-w-[560px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]">
      <defs>
        <linearGradient id="marsTitleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="55%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="marsBadgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      <ellipse
        cx="340"
        cy="92"
        rx="288"
        ry="58"
        fill="none"
        stroke="#fb923c"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="8 8"
      />
      <circle cx="84" cy="48" r="18" fill="#e05a33" stroke="#fed7aa" strokeWidth="2" />
      <circle cx="78" cy="43" r="4.5" fill="#b43c1d" />
      <circle cx="90" cy="52" r="3" fill="#b43c1d" />
      <circle cx="604" cy="52" r="4" fill="#fde047" />
      <circle cx="582" cy="36" r="2.5" fill="#7dd3fc" />

      <text
        x="340"
        y="78"
        textAnchor="middle"
        fill="url(#marsTitleGrad)"
        fontSize="50"
        fontWeight="900"
        letterSpacing="2"
        style={{ fontFamily: 'Trebuchet MS, Nunito, sans-serif' }}
      >
        RED PLANET ROOKIE
      </text>

      <rect x="165" y="100" width="350" height="40" rx="10" fill="url(#marsBadgeGrad)" />
      <rect x="169" y="104" width="342" height="32" rx="7" fill="none" stroke="#fff7ed" strokeOpacity="0.45" strokeWidth="1.5" />
      <text
        x="340"
        y="126"
        textAnchor="middle"
        fill="#1c0d07"
        fontSize="19"
        fontWeight="900"
        letterSpacing="4"
      >
        MARS BASE COMMANDER
      </text>
    </svg>
  );
}

const HAZARD_MENU_ITEMS: Array<{ id: HazardId; keyNum: string; label: string }> = [
  { id: 'solar_storm', keyNum: '1', label: 'Radiation' },
  { id: 'dust_storm', keyNum: '2', label: 'Dust Storm' },
  { id: 'dusty_panels', keyNum: '3', label: 'Dust Panels' },
  { id: 'meteor_shower', keyNum: '4', label: 'Meteors' },
  { id: 'cold_snap', keyNum: '5', label: 'Cold Snap' },
  { id: 'dish_strike', keyNum: '6', label: 'Dust Devil' },
  { id: 'battery_overheat', keyNum: '7', label: 'Overheat' },
  { id: 'night_drain', keyNum: '8', label: 'Night Drain' },
  { id: 'blown_fuse', keyNum: '9', label: 'Blown Fuse' },
  { id: 'static_surge', keyNum: '0', label: 'Static Arcs' },
  { id: 'solar_jam', keyNum: '-', label: 'Motor Jam' },
  { id: 'rover_overload', keyNum: '=', label: 'Rover Dock' },
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MarsGameEngine | null>(null);

  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [hazardMenuOpen, setHazardMenuOpen] = useState(false);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new MarsGameEngine(mount, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    marsAudio.setMuted(next);
    if (!next) marsAudio.playClick();
  };

  const isNight = hud.solProgress >= 0.52 && hud.solProgress <= 0.94;
  const normRoverX = hud.roverPos.x / WORLD_PLAYABLE_RADIUS;
  const normRoverZ = hud.roverPos.z / WORLD_PLAYABLE_RADIUS;

  const handlePromptClick = () => {
    if (hud.activeTool === 'blower' && hud.activeHazard === 'dusty_panels') {
      engineRef.current?.triggerPrimaryToolAction();
    } else {
      engineRef.current?.handleInteractKey();
    }
  };

  let hazardProgressBadge: string | null = null;
  if (hud.activeHazard === 'dust_storm' || hud.activeHazard === 'night_drain') {
    hazardProgressBadge = `Solar ${hud.solarOutputPct}%`;
  } else if (hud.activeHazard === 'dusty_panels') {
    hazardProgressBadge = `${hud.panelsCleaned}/${hud.totalPanels}`;
  } else if (hud.activeHazard === 'dish_strike') {
    hazardProgressBadge = `${hud.dishRepairPct}%`;
  } else if (hud.activeHazard === 'meteor_shower' && hud.hasResinKit) {
    hazardProgressBadge = 'Resin Equipped';
  } else if (hud.activeHazard === 'blown_fuse' && hud.hasSpareFuse) {
    hazardProgressBadge = 'Fuse Ready';
  } else if (hud.activeHazard === 'solar_jam') {
    hazardProgressBadge = `${hud.pebblesRemaining} Pebbles`;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1b0c08]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0" />

      {/* Extreme Cold Snap Window Frost Vignette (pure radial gradient, zero backdrop-filter) */}
      {hud.phase === 'playing' && hud.frostLevel > 0.02 && (
        <div
          className="fixed inset-0 z-[4] pointer-events-none transition-opacity duration-200"
          style={{
            opacity: Math.min(0.92, hud.frostLevel),
            background:
              'radial-gradient(circle at 50% 50%, rgba(186,230,253,0) 56%, rgba(125,211,252,0.34) 84%, rgba(224,242,254,0.72) 100%)',
            boxShadow: 'inset 0 0 70px rgba(186,230,253,0.7)',
          }}
        />
      )}

      {/* 1st-Person Gold Helmet Visor Overlay */}
      {hud.phase === 'playing' && hud.viewMode === 'first' && (
        <div className="fixed inset-0 z-[5] pointer-events-none">
          <svg viewBox="0 0 1000 600" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <radialGradient id="visorTint" cx="50%" cy="50%" r="65%">
                <stop offset="68%" stopColor="#fbbf24" stopOpacity="0" />
                <stop offset="90%" stopColor="#d97706" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#451a03" stopOpacity="0.58" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="1000" height="600" fill="url(#visorTint)" />
            <path d="M 35 120 Q 500 18 965 120" fill="none" stroke="#fbbf24" strokeOpacity="0.32" strokeWidth="4" />
            <path d="M 35 480 Q 500 582 965 480" fill="none" stroke="#fbbf24" strokeOpacity="0.28" strokeWidth="4" />
            <circle cx="500" cy="300" r="14" fill="none" stroke="#fde68a" strokeOpacity="0.45" strokeWidth="1.5" />
            <circle cx="500" cy="300" r="2.5" fill="#fde68a" fillOpacity="0.7" />
          </svg>
        </div>
      )}

      {/* Title Screen (Minimal Lockup + Launch Button only) */}
      {hud.phase === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-between py-12 px-6 pointer-events-none">
          <div className="w-full flex justify-center mt-2">
            <TitleLockupSvg />
          </div>

          <div className="mb-6 pointer-events-auto">
            <button
              type="button"
              onClick={() => engineRef.current?.startMission()}
              className="flex items-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 active:translate-y-0.5 text-slate-950 font-black text-xl tracking-wide shadow-[0_8px_0_#9a3412,0_16px_30px_rgba(0,0,0,0.5)] transition-transform cursor-pointer"
            >
              <Rocket className="w-6 h-6" />
              LAUNCH MISSION
            </button>
          </div>
        </div>
      )}

      {/* Minimalist Playing HUD */}
      {hud.phase !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
          {/* Top Bar */}
          <div className="flex items-start justify-between gap-2">
            {/* Top-Left: Ultra-Compact Icon Bars & Crystal Counters */}
            <div className="pointer-events-auto flex flex-col gap-1.5 bg-[rgba(20,12,11,0.78)] border border-orange-500/30 rounded-xl px-2.5 py-2 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1" title="Battery">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="w-10 h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${hud.battery > 25 ? 'bg-emerald-400' : 'bg-rose-500'}`}
                      style={{ width: `${hud.battery}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1" title="Oxygen">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <div className="w-10 h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${hud.oxygen > 25 ? 'bg-sky-400' : 'bg-rose-500'}`}
                      style={{ width: `${hud.oxygen}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1" title="Water">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <div className="w-8 h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${hud.water}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-1" title="Food">
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  <div className="w-8 h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${hud.food}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-1" title="Radiation">
                  <Radiation className={`w-3.5 h-3.5 ${hud.radiation > 40 ? 'text-orange-400' : 'text-violet-400'}`} />
                  <div className="w-8 h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${hud.radiation > 45 ? 'bg-orange-500' : 'bg-violet-400'}`}
                      style={{ width: `${hud.radiation}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-black tabular-nums pt-0.5 border-t border-white/10">
                <span className="flex items-center gap-1 text-orange-200">
                  <IronIcon /> {hud.iron}
                </span>
                <span className="flex items-center gap-1 text-sky-200">
                  <IceIcon /> {hud.ice}
                </span>
                <span className="flex items-center gap-1 text-yellow-200">
                  <StarCoreIcon /> {hud.stars}
                </span>
              </div>
            </div>

            {/* Top-Center: Single-Line Active Hazard Alert Banner ONLY during hazards */}
            {hud.activeHazard && (
              <div className="flex items-center gap-2 bg-[rgba(45,14,10,0.92)] border border-orange-400 text-amber-100 text-xs sm:text-sm font-extrabold px-3.5 py-1.5 rounded-xl shadow-lg max-w-[46vw] truncate">
                {hud.activeHazard === 'cold_snap' ? (
                  <Snowflake className="w-4 h-4 text-sky-300 shrink-0" />
                ) : hud.activeHazard === 'solar_storm' ? (
                  <Radiation className="w-4 h-4 text-fuchsia-300 shrink-0" />
                ) : hud.activeHazard === 'dish_strike' ? (
                  <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
                ) : hud.activeHazard === 'meteor_shower' || hud.activeHazard === 'battery_overheat' ? (
                  <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                ) : hud.activeHazard === 'night_drain' ? (
                  <Moon className="w-4 h-4 text-sky-300 shrink-0" />
                ) : hud.activeHazard === 'blown_fuse' ||
                  hud.activeHazard === 'static_surge' ||
                  hud.activeHazard === 'rover_overload' ? (
                  <Zap className="w-4 h-4 text-yellow-300 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-orange-300 shrink-0" />
                )}
                <span className="truncate">{HAZARD_SHORT_LABELS[hud.activeHazard]}</span>
                {hazardProgressBadge && (
                  <span className="px-1.5 py-0.5 rounded bg-black/45 text-[11px] font-black text-sky-300 shrink-0 tabular-nums">
                    {hazardProgressBadge}
                  </span>
                )}
              </div>
            )}

            {/* Top-Right: Compact Icon Controls & Hazard Switcher */}
            <div className="pointer-events-auto relative flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 bg-[rgba(20,12,11,0.78)] border border-orange-500/30 rounded-xl px-2 py-1.5 shadow-md">
                <div className="flex items-center gap-1 px-1.5 text-[11px] font-black text-amber-100 tabular-nums">
                  {isNight ? <Moon className="w-3.5 h-3.5 text-sky-300" /> : <Sun className="w-3.5 h-3.5 text-amber-300" />}
                  <span>S{hud.solNumber}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setHazardMenuOpen((o) => !o)}
                  title="Trigger Hazard (Keys 1-6, 7-=)"
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    hazardMenuOpen || hud.activeHazard
                      ? 'bg-orange-500 text-slate-950'
                      : 'bg-white/10 hover:bg-white/20 text-amber-100'
                  }`}
                >
                  <CloudLightning className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => engineRef.current?.triggerHint()}
                  title="A.R.E.S. Bot Spotlight Hint"
                  className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleViewMode()}
                  title="Toggle 3rd / 1st Person (V)"
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    hud.viewMode === 'first' ? 'bg-sky-400 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-amber-100'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleTimeScale()}
                  title="Toggle Sol Clock Speed"
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    hud.timeScale > 1 ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-amber-100'
                  }`}
                >
                  <FastForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-100 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    hud.phase === 'paused' ? engineRef.current?.resumeMission() : engineRef.current?.pauseMission()
                  }
                  aria-label="Pause"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-100 cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>

              {hazardMenuOpen && (
                <div className="flex flex-wrap justify-end gap-1 bg-[rgba(20,12,11,0.92)] border border-orange-500/40 rounded-xl p-1.5 shadow-lg max-w-[330px]">
                  {HAZARD_MENU_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        engineRef.current?.triggerHazard(item.id);
                        setHazardMenuOpen(false);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                        hud.activeHazard === item.id
                          ? 'bg-orange-400 text-slate-950'
                          : 'bg-white/10 hover:bg-white/20 text-amber-100'
                      }`}
                    >
                      [{item.keyNum}] {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3D Hologram Room Unlock Card (Only when standing on a blue floor lock ring) */}
          {hud.activeHologramRoom && hud.phase === 'playing' && (
            <div className="pointer-events-auto self-center my-auto w-full max-w-[420px] px-2">
              <div
                className="relative rounded-2xl border-2 border-sky-400 bg-[rgba(7,22,42,0.95)] p-5 shadow-[0_0_45px_rgba(56,189,248,0.45)] text-sky-50"
                style={{
                  transform: 'perspective(960px) rotateX(3deg)',
                }}
              >
                <button
                  type="button"
                  onClick={() => engineRef.current?.dismissHologramCard()}
                  aria-label="Close"
                  className="absolute right-3 top-3 p-1 rounded-lg bg-white/10 hover:bg-white/20 text-sky-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5 text-[11px] font-black tracking-widest text-sky-300 uppercase">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{ROOM_ORIENTATION_CARDS[hud.activeHologramRoom].stripLabel}</span>
                </div>
                <h3 className="mt-1 text-lg font-black text-white">
                  {ROOM_ORIENTATION_CARDS[hud.activeHologramRoom].title}
                </h3>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="rounded-lg bg-sky-950/75 border border-sky-400/35 px-3 py-1.5">
                    <div className="text-[10px] font-black uppercase text-sky-300">What&apos;s Inside</div>
                    <p className="text-sky-50 font-semibold">{ROOM_ORIENTATION_CARDS[hud.activeHologramRoom].whatsInside}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-950/65 border border-emerald-400/35 px-3 py-1.5">
                    <div className="text-[10px] font-black uppercase text-emerald-300">What It Does</div>
                    <p className="text-emerald-50 font-semibold">{ROOM_ORIENTATION_CARDS[hud.activeHologramRoom].whatItDoes}</p>
                  </div>
                  <div className="rounded-lg bg-amber-950/65 border border-amber-400/35 px-3 py-1.5">
                    <div className="text-[10px] font-black uppercase text-amber-300">When to Run Here</div>
                    <p className="text-amber-50 font-semibold">{ROOM_ORIENTATION_CARDS[hud.activeHologramRoom].whenToRunHere}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => hud.activeHologramRoom && engineRef.current?.unlockRoom(hud.activeHologramRoom)}
                  className="mt-3.5 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-sm shadow-[0_4px_0_#0369a1] cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  UNLOCK ROOM [E]
                </button>
              </div>
            </div>
          )}

          {/* Bottom Row: ONLY Single-Line Contextual Prompt (when near interactable) + Compact Radar */}
          <div className="relative flex items-end justify-center w-full min-h-[44px]">
            {hud.singleLinePrompt && hud.phase === 'playing' && (
              <button
                type="button"
                onClick={handlePromptClick}
                className="pointer-events-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-[rgba(17,11,10,0.9)] border border-orange-400/80 text-amber-100 text-sm font-black tracking-wide shadow-lg hover:bg-[rgba(35,19,14,0.95)] cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                <span>{hud.singleLinePrompt}</span>
              </button>
            )}

            {/* Touch Controls on small mobile viewports */}
            <div className="sm:hidden pointer-events-auto absolute left-0 bottom-0 flex items-center gap-1">
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setVirtualInput('left', true)}
                onPointerUp={() => engineRef.current?.setVirtualInput('left', false)}
                onPointerLeave={() => engineRef.current?.setVirtualInput('left', false)}
                className="px-2.5 py-2 rounded-lg bg-black/65 text-xs font-black text-white"
              >
                ◀
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setVirtualInput('forward', true)}
                onPointerUp={() => engineRef.current?.setVirtualInput('forward', false)}
                onPointerLeave={() => engineRef.current?.setVirtualInput('forward', false)}
                className="px-2.5 py-2 rounded-lg bg-orange-500 text-xs font-black text-slate-950"
              >
                ▲
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setVirtualInput('backward', true)}
                onPointerUp={() => engineRef.current?.setVirtualInput('backward', false)}
                onPointerLeave={() => engineRef.current?.setVirtualInput('backward', false)}
                className="px-2.5 py-2 rounded-lg bg-black/65 text-xs font-black text-white"
              >
                ▼
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setVirtualInput('right', true)}
                onPointerUp={() => engineRef.current?.setVirtualInput('right', false)}
                onPointerLeave={() => engineRef.current?.setVirtualInput('right', false)}
                className="px-2.5 py-2 rounded-lg bg-black/65 text-xs font-black text-white"
              >
                ▶
              </button>
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerJump()}
              className="sm:hidden pointer-events-auto absolute right-0 bottom-0 px-3 py-2 rounded-lg bg-amber-400 text-xs font-black text-slate-950"
            >
              ▲▲
            </button>

            {/* Bottom-Right Compact SVG Radar (no text label) */}
            <div className="hidden sm:block pointer-events-auto absolute right-0 bottom-0 bg-[rgba(20,12,11,0.78)] border border-orange-500/30 rounded-2xl p-1.5 shadow-md">
              <svg viewBox="-100 -100 200 200" className="w-20 h-20">
                <circle cx="0" cy="0" r="95" fill="#22110c" stroke="#7c2d12" strokeWidth="3" />
                <circle cx="0" cy="0" r="55" fill="none" stroke="#9a3412" strokeOpacity="0.35" strokeDasharray="4 4" />
                <circle cx="0" cy="0" r="7" fill="#e2e8f0" stroke="#f97316" strokeWidth="2.5" />

                {hud.radarBlips.map((b, idx) => {
                  const cx = b.x * 88;
                  const cy = b.z * 88;
                  if (b.kind === 'pad') {
                    return <rect key={idx} x={cx - 4} y={cy - 4} width="8" height="8" rx="1.5" fill="#38bdf8" />;
                  }
                  if (b.kind === 'built') {
                    return <rect key={idx} x={cx - 4} y={cy - 4} width="8" height="8" rx="1.5" fill="#4ade80" />;
                  }
                  if (b.kind === 'devil') {
                    return <circle key={idx} cx={cx} cy={cy} r="4.2" fill="none" stroke="#fb923c" strokeWidth="2" />;
                  }
                  const fill = b.kind === 'star' ? '#facc15' : b.kind === 'ice' ? '#38bdf8' : '#fb923c';
                  return <circle key={idx} cx={cx} cy={cy} r={b.kind === 'star' ? 3.2 : 2.2} fill={fill} />;
                })}

                <g
                  transform={`translate(${normRoverX * 88}, ${normRoverZ * 88}) rotate(${
                    (-hud.roverPos.heading * 180) / Math.PI
                  })`}
                >
                  <polygon points="0,-7 5,5 0,2 -5,5" fill="#ffffff" stroke="#ea580c" strokeWidth="1.5" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-sm bg-[#1e110d] border-2 border-orange-500/60 rounded-2xl p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-black text-amber-100">PAUSED</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => engineRef.current?.resumeMission()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm cursor-pointer"
              >
                <Play className="w-4 h-4" /> RESUME
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.restartGame()}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 font-bold text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> RESTART
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low Power / Low Oxygen Recovery Modal */}
      {hud.phase === 'lowpower' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-sm bg-[#1e110d] border-2 border-rose-400/70 rounded-2xl p-6 text-center shadow-2xl">
            <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-2" />
            <h2 className="text-2xl font-black text-amber-100">SUIT VITALS LOW</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => engineRef.current?.rechargeAtBase()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm cursor-pointer"
              >
                <BatteryCharging className="w-4 h-4" /> RECHARGE AT BASE
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.restartGame()}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 font-bold text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> RESTART
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {hud.phase === 'victory' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-sm bg-[#1e110d] border-2 border-yellow-400/80 rounded-2xl p-6 text-center shadow-2xl">
            <Trophy className="w-14 h-14 text-yellow-400 mx-auto mb-2" />
            <h2 className="text-2xl font-black text-amber-50">ARES ALPHA COMPLETE</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => engineRef.current?.continueExploring()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm cursor-pointer"
              >
                <Rocket className="w-4 h-4" /> FREE ROAM
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.restartGame()}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 font-bold text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
