"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./racing-warmup.css";
import Racing3DScene from "./racing-3d-scene";
import { subscribeSettings } from "@/lib/firebase/vula-data";
import { createRacingTrack, createRacingPitLane, getTrackTurn, getVehicleSafeOffset, RACING_FENCE_OFFSET, RACING_TRACK_COLLISION_OFFSET, RACING_PIT_LANE_OFFSET, RACING_PIT_COLLISION_OFFSET } from "./racing-track";

export type Phase = "ready" | "grid" | "countdown" | "running" | "paused" | "pit" | "finished" | "crashed";
export type Controls = { steer: number; accelerate: boolean; brake: boolean; boost: boolean };
export type Race = {
  progress: number; speed: number; elapsed: number; lap: number; lapTime: number; steering: number; throttle: number; brakePressure: number;
  bestLap: number | null; lateral: number; lateralVelocity: number; heading: number; drift: number;
  nos: number; last: number; lapInvalid: boolean; offTrack: number;
  longitudinalLoad: number; lateralG: number; wheelLock: number;
  worldX: number; worldZ: number; worldYaw: number; velocityX: number; velocityZ: number; damage: number; lastImpactAt: number; trackT: number; botProgress: number; botSpeed: number;
  botWorldX: number; botWorldZ: number; botWorldYaw: number; botVelocityX: number; botVelocityZ: number; botSteering: number; botThrottle: number; botBrake: number; botDrift: number; botNos: number; botBoostActive: boolean; botInitialized: boolean; botRaceTyreChoice: "Soft" | "Hard";
  botImpactX: number; botImpactZ: number; botImpactAt: number; botImpactStrength: number; botLineOffset: number; botNosCooldown: number; botRaceEnabled: boolean; raceLapsCompleted: number; qualifyingTime: number | null; qualifyingValid: boolean; botQualifyingTime: number | null; botPitting: boolean; botPitDone: boolean; botPitProgress: number; botPitServiceRemaining: number; botPitServiced: boolean; playerPitRequested: boolean; playerGarageExit: boolean; playerOutLap: boolean; playerPitting: boolean; playerPitEntryProgress: number; playerPitEntryTrackT: number; playerPitDone: boolean; playerPitProgress: number; playerPitServiceRemaining: number; playerPitServiced: boolean;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const RACING_PIT_LANE = createRacingPitLane(createRacingTrack());
// Immutable arc-length samples keep the authoritative collision/projection
// geometry identical while avoiding repeated spline evaluations each frame.
const COLLISION_SAMPLE_COUNT = 1920;
function createCollisionSamples(curve: ReturnType<typeof createRacingTrack>) {
  return Array.from({ length: COLLISION_SAMPLE_COUNT + 1 }, (_, index) => {
    const t = index / COLLISION_SAMPLE_COUNT;
    const point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    return { x: point.x, z: point.z, tx: tangent.x, tz: tangent.z };
  });
}
const MAIN_TRACK_COLLISION_SAMPLES = createCollisionSamples(createRacingTrack());
const PIT_LANE_COLLISION_SAMPLES = createCollisionSamples(RACING_PIT_LANE);
export const newRace = (): Race => {
  const garagePoint = RACING_PIT_LANE.getPointAt(.52);
  const garageTangent = RACING_PIT_LANE.getTangentAt(.52).normalize();
  const garageYaw = Math.atan2(-garageTangent.x, -garageTangent.z);
  return { progress: 0, speed: 0, elapsed: 0, lap: 1, lapTime: 0, steering: 0, throttle: 0, brakePressure: 0, bestLap: null, lateral: 0, lateralVelocity: 0, heading: 0, drift: 0, nos: 100, last: 0, lapInvalid: false, offTrack: 0, longitudinalLoad: 0, lateralG: 0, wheelLock: 0, worldX: garagePoint.x, worldZ: garagePoint.z, worldYaw: garageYaw, velocityX: 0, velocityZ: 0, damage: 0, lastImpactAt: 0, trackT: 0, botProgress: .025, botSpeed: 17.9, botWorldX: 0, botWorldZ: 0, botWorldYaw: 0, botVelocityX: 0, botVelocityZ: 0, botSteering: 0, botThrottle: 0, botBrake: 0, botDrift: 0, botNos: 100, botBoostActive: false, botInitialized: false, botRaceTyreChoice: "Soft", botImpactX: 0, botImpactZ: 0, botImpactAt: 0, botImpactStrength: 0, botLineOffset: -2.45, botNosCooldown: 0, botRaceEnabled: false, raceLapsCompleted: 0, qualifyingTime: null, qualifyingValid: false, botQualifyingTime: null, botPitting: false, botPitDone: false, botPitProgress: 0, botPitServiceRemaining: 0, botPitServiced: false, playerPitRequested: false, playerGarageExit: true, playerOutLap: false, playerPitting: false, playerPitEntryProgress: 0, playerPitEntryTrackT: 0, playerPitDone: false, playerPitProgress: .52, playerPitServiceRemaining: 0, playerPitServiced: false };
};
function createPitResumeState(saved?: Race): Race {
  const race = { ...newRace(), ...(saved ?? {}) };
  const point = RACING_PIT_LANE.getPointAt(.52);
  const tangent = RACING_PIT_LANE.getTangentAt(.52).normalize();
  race.worldX = point.x; race.worldZ = point.z;
  race.worldYaw = Math.atan2(-tangent.x, -tangent.z);
  settlePlayerCar(race);
  race.playerGarageExit = true; race.playerOutLap = false; race.playerPitting = false;
  race.playerPitProgress = .52; race.playerPitEntryProgress = 0; race.playerPitEntryTrackT = 0;
  race.playerPitServiceRemaining = 0; race.playerPitDone = false; race.playerPitServiced = false;
  race.progress = 0; race.trackT = 0; race.elapsed = 0; race.lapTime = 0; race.last = 0; race.lap = 1;
  race.botRaceEnabled = false; race.botPitting = false; race.botPitDone = false;
  race.botPitProgress = 0; race.botPitServiceRemaining = 0; race.botPitServiced = false;
  race.botProgress = .025; race.botInitialized = false; race.botSpeed = 8.5;
  race.botVelocityX = 0; race.botVelocityZ = 0; race.botBoostActive = false;
  return race;
}

function settlePlayerCar(race: Race) {
  race.velocityX = 0; race.velocityZ = 0; race.speed = 0;
  race.steering = 0; race.throttle = 0; race.brakePressure = 0;
  race.lateral = 0; race.lateralVelocity = 0; race.heading = 0; race.drift = 0;
  race.longitudinalLoad = 0; race.lateralG = 0; race.wheelLock = 0;
}

function createQuickRaceState(): Race {
  const race = newRace();
  const track = createRacingTrack();
  const gridPoint = track.getPointAt(0);
  const tangent = track.getTangentAt(0).normalize();
  const sideX = -tangent.z, sideZ = tangent.x;
  const yaw = Math.atan2(-tangent.x, -tangent.z);
  race.worldX = gridPoint.x + sideX * 2.45;
  race.worldZ = gridPoint.z + sideZ * 2.45;
  race.worldYaw = yaw;
  settlePlayerCar(race);
  race.progress = 2; race.trackT = 0; race.lap = 3;
  race.playerGarageExit = false; race.playerOutLap = false; race.playerPitting = false;
  race.playerPitEntryProgress = 2; race.playerPitEntryTrackT = 0;
  race.playerPitDone = false; race.playerPitProgress = 0; race.playerPitServiced = false;
  race.botWorldX = gridPoint.x - sideX * 2.45;
  race.botWorldZ = gridPoint.z - sideZ * 2.45;
  race.botWorldYaw = yaw; race.botVelocityX = 0; race.botVelocityZ = 0;
  race.botSpeed = 0; race.botProgress = 2; race.botInitialized = true;
  race.botPitDone = false; race.botPitting = false; race.botPitProgress = 0;
  race.botPitServiceRemaining = 0; race.botPitServiced = false;
  race.botLineOffset = -2.45; race.elapsed = 0; race.lapTime = 0;
  return race;
}
function fmt(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
}

type LocalRaceSave = { race: Race; difficulty: "Easy" | "Normal" | "Hard"; savedAt: string };
type RaceResult = { id: string; completedAt: string; difficulty: "Easy" | "Normal" | "Hard"; elapsed: number; bestLap: number | null; position: 1 | 2; laps: number };

export default function RacingWarmup({ embedded = false, initialSave, onSave, onComplete, onExit, quickStart = false }: { embedded?: boolean; initialSave?: LocalRaceSave | null; onSave?: (save: LocalRaceSave) => void; onComplete?: (result: RaceResult) => void; onExit?: () => void; quickStart?: boolean }) {
  const [expanded, setExpanded] = useState(!embedded);
  const raceRef = useRef<Race>(initialSave?.race ? createPitResumeState(initialSave.race) : quickStart ? createQuickRaceState() : newRace());
  const trackRef = useRef<ReturnType<typeof createRacingTrack> | null>(null);
  if (!trackRef.current) trackRef.current = createRacingTrack();
  const controlsRef = useRef<Controls>({ steer: 0, accelerate: false, brake: false, boost: false });
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const sessionModeRef = useRef<"idle" | "warmup" | "qualifying" | "race">("idle");
  const [pitFlowOpen, setPitFlowOpen] = useState(false);
  const [pitFlowStep, setPitFlowStep] = useState<"activity" | "setup">("activity");
  const [selectedActivity, setSelectedActivity] = useState<"warmup" | "qualifying" | "race">("warmup");
  const completedRef = useRef(false);
  const [countdown, setCountdown] = useState(3);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [speed, setSpeed] = useState(0);
  const [botDifficulty, setBotDifficulty] = useState<"Easy" | "Normal" | "Hard">(initialSave?.difficulty ?? "Normal");
  const botDifficultyRef = useRef<"Easy" | "Normal" | "Hard">(initialSave?.difficulty ?? "Normal");
  const [rivalGap, setRivalGap] = useState(0);
  const [lapTime, setLapTime] = useState(0);
  const [bestLap, setBestLap] = useState<number | null>(initialSave?.race.bestLap ?? null);
  const [lap, setLap] = useState(1);
  const [nos, setNos] = useState(raceRef.current.nos);
  const [tyreChoice, setTyreChoice] = useState<"Soft" | "Hard">("Soft");
  const [raceTyreChoice, setRaceTyreChoice] = useState<"Soft" | "Hard">("Soft");
  const [racePitReplacementUsed, setRacePitReplacementUsed] = useState(false);
  const racePitReplacementUsedRef = useRef(false);
  const activeTyreRef = useRef<"Soft" | "Hard">("Soft");
  const raceTyreRef = useRef<"Soft" | "Hard">("Soft");
  const firstScoredRaceLapActiveRef = useRef(false);
  const [steeringMode, setSteeringMode] = useState<"analog" | "buttons">("analog");
  const directionalSteerRef = useRef({ left: false, right: false });
  const [carColor, setCarColor] = useState("#f04478");
  const [pitMenuAvailable, setPitMenuAvailable] = useState(false);
  const [pitMenuOpen, setPitMenuOpen] = useState(false);
  const pitMenuAvailableRef = useRef(false);
  const pitMenuOpenRef = useRef(false);
  const pitMenuPromptedRef = useRef(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("vula-racing-car-paint-v1");
      if (saved && /^#[0-9a-fA-F]{6}$/.test(saved)) setCarColor(saved);
      const savedSteering = window.localStorage.getItem("vula-racing-steering-v1");
      if (savedSteering === "analog" || savedSteering === "buttons") setSteeringMode(savedSteering);
    } catch { /* Storage restrictions must not block driving. */ }
  }, []);
  const chooseCarColor = (color: string) => {
    setCarColor(color);
    try { window.localStorage.setItem("vula-racing-car-paint-v1", color); } catch { /* Session-only selection remains usable. */ }
  };
  const choosePracticeTyre = (tyre: "Soft" | "Hard") => {
    setTyreChoice(tyre);
    if (sessionModeRef.current === "warmup") activeTyreRef.current = tyre;
  };
  const chooseRaceTyre = (tyre: "Soft" | "Hard") => {
    setRaceTyreChoice(tyre);
    raceTyreRef.current = tyre;
    if (sessionModeRef.current !== "race") activeTyreRef.current = tyre;
  };
  const chooseRacePitTyre = (tyre: "Soft" | "Hard") => {
    if (racePitReplacementUsedRef.current || tyre === raceTyreRef.current) return;
    raceTyreRef.current = tyre;
    activeTyreRef.current = tyre;
    setRaceTyreChoice(tyre);
    racePitReplacementUsedRef.current = true;
    setRacePitReplacementUsed(true);
    notify("PIT CREW · Replacement set fitted. This compound is locked for the rest of the race.", "success");
  };
  const chooseSteeringMode = (mode: "analog" | "buttons") => {
    setSteeringMode(mode);
    directionalSteerRef.current = { left: false, right: false };
    controlsRef.current.steer = 0;
    try { window.localStorage.setItem("vula-racing-steering-v1", mode); } catch { /* Session-only selection remains usable. */ }
  };
  const setDirectionalSteer = (direction: "left" | "right", pressed: boolean) => {
    directionalSteerRef.current[direction] = pressed;
    controlsRef.current.steer = Number(directionalSteerRef.current.right) - Number(directionalSteerRef.current.left);
  };
  const [signal, setSignal] = useState({ label: "GREEN LIGHT · BUILD SPEED", tone: "go" });
  const botQualifyingElapsedRef = useRef(0);
  const botQualifyingTimeRef = useRef<number | null>(null);
  const lastPitPromptLapRef = useRef(-1);
  const cornerSkillRef = useRef({ brakedForCorner: false, turnedIn: false, exitBoostUntil: 0 });
  const [boostActive, setBoostActive] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" | "info" } | null>(null);
  const [businessName, setBusinessName] = useState("Vula's Car Wash");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  phaseRef.current = phase;

  const notify = useCallback((text: string, kind: "success" | "error" | "info" = "success") => {
    const activePhase = phaseRef.current;
    if (activePhase !== "running" && activePhase !== "pit" && activePhase !== "finished") return;
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => {
    if (phase === "ready" || phase === "grid" || phase === "countdown" || phase === "paused") {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = null;
      setToast(null);
    }
  }, [phase]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const stop = subscribeSettings(settings => {
      const name = settings?.businessName;
      if (typeof name === "string" && name.trim()) setBusinessName(name.trim());
    }, () => {});
    return stop;
  }, []);
  useEffect(() => { if (!embedded) document.title = businessName + " · Racing warm-up"; }, [businessName, embedded]);

  const reset = useCallback(() => {
    const previous = raceRef.current;
    raceRef.current = createPitResumeState(previous); sessionModeRef.current = "idle";
    firstScoredRaceLapActiveRef.current = false;
    racePitReplacementUsedRef.current = false;
    setRacePitReplacementUsed(false);
    botQualifyingElapsedRef.current = 0; botQualifyingTimeRef.current = null; lastPitPromptLapRef.current = -1;
    cornerSkillRef.current = { brakedForCorner: false, turnedIn: false, exitBoostUntil: 0 };
    controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
    setSpeed(0); setLapTime(0); setBestLap(raceRef.current.bestLap); setLap(1); setNos(raceRef.current.nos); setBoostActive(false); setRivalGap(0); setRaceResult(null);
    if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = null; setToast(null);
    pitMenuPromptedRef.current = false; pitMenuAvailableRef.current = false; pitMenuOpenRef.current = false;
    setPitMenuAvailable(false); setPitMenuOpen(false);
    setPitFlowOpen(false); setPitFlowStep("activity");
    setCountdown(3); phaseRef.current = "ready"; setPhase("ready");
  }, []);
  const startRace = useCallback(() => { completedRef.current = false; reset(); setPitFlowOpen(true); }, [reset]);
  const startDriving = () => {
    controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
    sessionModeRef.current = "idle";
    phaseRef.current = "running"; setPhase("running");
  };
  const beginSelectedActivity = () => {
    const previous = raceRef.current;
    const race = newRace();
    race.bestLap = previous.bestLap;
    race.qualifyingTime = previous.qualifyingTime;
    race.qualifyingValid = previous.qualifyingValid;
    race.botQualifyingTime = previous.botQualifyingTime;
    botQualifyingElapsedRef.current = 0;
    botQualifyingTimeRef.current = null;
    completedRef.current = false;
    controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
    setRaceResult(null); setSpeed(0); setLapTime(0); setNos(100); setBestLap(race.bestLap);
    setLap(1); setRivalGap(0); setBoostActive(false);
    firstScoredRaceLapActiveRef.current = false;
    racePitReplacementUsedRef.current = false;
    setRacePitReplacementUsed(false);
    if (selectedActivity === "warmup") {
      activeTyreRef.current = tyreChoice;
      sessionModeRef.current = "warmup";
      race.botRaceEnabled = false;
      race.progress = 0; race.trackT = 0; race.lap = 1;
      race.playerGarageExit = true;
      race.botProgress = .025; race.botInitialized = false;
      raceRef.current = race;
      phaseRef.current = "running"; setPhase("running");
      setSignal({ label: "HOLD GAS TO LEAVE THE PIT ↑", tone: "go" });
    } else {
      const track = trackRef.current!;
      const gridT = .12;
      const point = track.getPointAt(gridT);
      const tangent = track.getTangentAt(gridT).normalize();
      const sideX = -tangent.z, sideZ = tangent.x;
      const yaw = Math.atan2(-tangent.x, -tangent.z);
      const playerOnPole = selectedActivity === "race"
        && race.qualifyingValid
        && race.qualifyingTime !== null
        && race.botQualifyingTime !== null
        && race.qualifyingTime <= race.botQualifyingTime;
      if (selectedActivity === "qualifying") {
        activeTyreRef.current = tyreChoice;
        raceTyreRef.current = raceTyreChoice;
        sessionModeRef.current = "qualifying";
        race.botRaceEnabled = false;
        race.progress = 1 + gridT; race.trackT = gridT; race.lap = 2;
        race.worldX = point.x + sideX * 2.45; race.worldZ = point.z + sideZ * 2.45;
        race.worldYaw = yaw; settlePlayerCar(race);
        race.playerGarageExit = false; race.playerOutLap = false;
        race.botProgress = 1 + gridT;
        race.botWorldX = point.x - sideX * 2.45;
        race.botWorldZ = point.z - sideZ * 2.45;
        race.botWorldYaw = yaw; race.botVelocityX = -Math.sin(yaw) * 8.5; race.botVelocityZ = -Math.cos(yaw) * 8.5;
        race.botInitialized = true;
        setLap(2);
      } else {
        raceTyreRef.current = raceTyreChoice;
        activeTyreRef.current = raceTyreChoice;
        sessionModeRef.current = "race";
        race.botRaceEnabled = true;
        // Kago independently selects a compound for this event; the player never
        // configures the opponent. He changes to the opposite compound at his stop.
        race.botRaceTyreChoice = Math.random() < 0.5 ? "Soft" : "Hard";
        race.raceLapsCompleted = 0;
        race.progress = 2 + gridT; race.trackT = gridT; race.lap = 3;
        const playerGridSide = playerOnPole ? 1 : -1;
        const rearT = Math.max(.106, gridT - 3.2 / track.getLength());
        const rearPoint = track.getPointAt(rearT);
        const playerT = playerOnPole ? gridT : rearT;
        const botT = playerOnPole ? rearT : gridT;
        const playerPoint = playerOnPole ? point : rearPoint;
        const botPoint = playerOnPole ? rearPoint : point;
        race.worldX = playerPoint.x + sideX * 2.45 * playerGridSide;
        race.worldZ = playerPoint.z + sideZ * 2.45 * playerGridSide;
        race.worldYaw = yaw; settlePlayerCar(race);
        race.progress = 2 + playerT; race.trackT = playerT;
        race.botWorldX = botPoint.x - sideX * 2.45 * playerGridSide;
        race.botWorldZ = botPoint.z - sideZ * 2.45 * playerGridSide;
        race.botWorldYaw = yaw; race.botVelocityX = 0; race.botVelocityZ = 0;
        race.botSpeed = 0; race.botProgress = 2 + botT; race.botInitialized = true;
        race.botLineOffset = -2.45 * playerGridSide;
        race.botPitDone = false; race.botPitting = false; race.botPitServiced = false;
        race.botPitProgress = 0; race.botPitServiceRemaining = 0;
        race.elapsed = 0; race.lapTime = 0; race.botNos = 100; race.botNosCooldown = 0; race.botBoostActive = false; race.nos = 100;
        setLap(3);
      }
      raceRef.current = race;
      setCountdown(3);
      phaseRef.current = "countdown"; setPhase("countdown");
    }
    setPitFlowOpen(false); setPitFlowStep("activity");
  };
  const pauseRace = useCallback(() => {
    if (phaseRef.current === "running") {
      controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
      setBoostActive(false); phaseRef.current = "paused"; setPhase("paused");
    } else if (phaseRef.current === "paused") {
      raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running");
    }
  }, []);

  useEffect(() => {
    if (phase === "grid") {
      const timer = window.setTimeout(() => { setCountdown(3); phaseRef.current = "countdown"; setPhase("countdown"); }, 1100);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "countdown") return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(0);
        if (sessionModeRef.current === "race") {
          activeTyreRef.current = raceTyreRef.current;
          firstScoredRaceLapActiveRef.current = true;
          racePitReplacementUsedRef.current = false;
          setRacePitReplacementUsed(false);
        }
        raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running");
      } else setCountdown(n => n - 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, notify]);

  useEffect(() => {
    let raf = 0;
    let previous = 0;
    let lastUi = 0;

    const frame = (now: number) => {
      const race = raceRef.current;
      const dt = previous ? Math.min((now - previous) / 1000, 0.035) : 0;
      previous = now;
      if (phaseRef.current === "running" && dt > 0) {
        const controls = controlsRef.current;
        // Pit entry is a real connector, not a proximity trigger around the
        // whole parallel lane. Only acquire pit-road projection at the marked
        // entrance; the rest of the circuit keeps its normal collision envelope.
        if (!race.playerPitting && !race.playerGarageExit
          && race.trackT >= .895 && race.trackT <= .935) {
          let entryDistanceSq = Number.POSITIVE_INFINITY;
          for (let sampleIndex = 0; sampleIndex <= 96; sampleIndex += 4) {
            const point = PIT_LANE_COLLISION_SAMPLES[sampleIndex];
            const dx = race.worldX - point.x, dz = race.worldZ - point.z;
            entryDistanceSq = Math.min(entryDistanceSq, dx * dx + dz * dz);
          }
          if (entryDistanceSq <= 8.5 * 8.5) {
            race.playerPitting = true;
            race.playerPitProgress = 0;
            race.playerPitEntryProgress = race.progress;
            race.playerPitEntryTrackT = race.trackT;
            race.playerPitServiced = false;
            race.playerPitServiceRemaining = 0;
          }
        }
        const pitSteer = controls.steer;
        // Smooth steering inputs before applying tyre force; ease back to centre on release.
        const steerEase = 1 - Math.exp(-dt * (Math.abs(pitSteer) > Math.abs(race.steering) ? 10.5 : 6.5));
        race.steering += (pitSteer - race.steering) * steerEase;
        const steering = race.steering;
        const onPitGuidanceRoute = race.playerPitting || race.playerGarageExit;
        const guidanceCurve = onPitGuidanceRoute ? RACING_PIT_LANE : trackRef.current!;
        const t = onPitGuidanceRoute ? race.playerPitProgress : wrap(race.progress, 1);
        const trackTurn = getTrackTurn(guidanceCurve, t, .006);
        const bend = clamp(Math.abs(trackTurn) * 28, 0, 1);
        const upcomingTurn = getTrackTurn(guidanceCurve, t + .018, .006);
        const upcomingBend = clamp(Math.abs(upcomingTurn) * 28, 0, 1);
        const speedRatio = race.speed / 230;
        const throttleTarget = controls.accelerate && !controls.brake ? 1 : 0;
        const brakeTarget = controls.brake ? 1 : 0;
        race.throttle += (throttleTarget - race.throttle) * (1 - Math.exp(-dt * (throttleTarget ? 3.8 : 6.5)));
        race.brakePressure += (brakeTarget - race.brakePressure) * (1 - Math.exp(-dt * (brakeTarget ? 32 : 12)));
        const boost = controls.boost && race.nos > 0 && !controls.brake;
        const exitBonus = now < cornerSkillRef.current.exitBoostUntil ? 5 : 0;

        // Simplified vehicle dynamics: speed is represented in km/h, forces in
        // equivalent km/h per second. Braking integrates over time, so stopping
        // distance emerges from the speed trajectory (rather than a fixed distance).
        // A speed-squared stopping-distance estimate is also used to anticipate grip.
        const speedMs = race.speed / 3.6;
        const nominalBrakeMs2 = 9.2;
        const estimatedStoppingDistance = speedMs * speedMs / (2 * nominalBrakeMs2);
        const frontLoadTransfer = clamp(race.brakePressure * (0.10 + speedRatio * 0.08), 0, 0.22);
        race.longitudinalLoad += (frontLoadTransfer - race.longitudinalLoad) * (1 - Math.exp(-dt * 7));
        const lateralDemand = Math.abs(steering) * speedRatio * speedRatio * 0.92;
        const longitudinalDemand = race.brakePressure * 0.94;
        const combinedDemand = Math.sqrt(lateralDemand * lateralDemand + longitudinalDemand * longitudinalDemand);
        const availableGrip = clamp(1.06 + race.longitudinalLoad * 0.18, 0.72, 1.12);
        const gripUse = combinedDemand / availableGrip;
        // ABS modulates a near-lock brake request. A small residual slip remains
        // visible to the handling model; steering and braking compete for tyre grip.
        const absThreshold = estimatedStoppingDistance > 45 ? 0.78 : 0.84;
        const lockDemand = clamp((gripUse - absThreshold) / 0.48, 0, 1) * race.brakePressure;
        const absActive = lockDemand > 0.08 && race.brakePressure > 0.55;
        const targetWheelLock = absActive ? lockDemand * 0.22 : lockDemand;
        race.wheelLock += (targetWheelLock - race.wheelLock) * (1 - Math.exp(-dt * (absActive ? 18 : 5)));
        const brakeEfficiency = 1 - race.wheelLock * (absActive ? 0.12 : 0.52);
        const brakeDeceleration = 36 * race.brakePressure * brakeEfficiency
          * clamp(availableGrip / Math.max(0.82, combinedDemand), 0.35, 1.08);
        const engineAcceleration = 42 * race.throttle + exitBonus;
        const aerodynamicDrag = race.speed * (0.055 + speedRatio * 0.025);
        const boostAcceleration = boost ? 52 : 0;
        race.speed = clamp(race.speed + (engineAcceleration + boostAcceleration - aerodynamicDrag - brakeDeceleration) * dt, 0, boost ? 290 : 255);
        race.nos = boost ? Math.max(0, race.nos - 25 * dt) : Math.min(100, race.nos + (controls.accelerate ? 4 : 9) * dt);
        if (race.nos <= 0 && controls.boost) { controls.boost = false; setBoostActive(false);  }

        // A friction-circle model limits cornering when the tyres are already
        // spending grip on braking. Low-speed steering remains stable; excess
        // lateral demand at speed becomes slip instead of an arbitrary bend skid.
        const updatedSpeedRatio = race.speed / 230;
        const updatedLateralDemand = Math.abs(steering) * updatedSpeedRatio * updatedSpeedRatio * 0.92;
        const updatedLongitudinalDemand = race.brakePressure * 0.94;
        const remainingGrip = Math.sqrt(Math.max(0, availableGrip * availableGrip
          - Math.min(availableGrip * availableGrip, updatedLongitudinalDemand * updatedLongitudinalDemand)));
        const cornerGripRatio = updatedLateralDemand > 0
          ? clamp(remainingGrip / updatedLateralDemand, 0, 1)
          : 1;
        const brakeTurnSlide = clamp((gripUse - 0.88) / 0.55, 0, 1)
          * clamp((race.speed - 68) / 105, 0, 1)
          * clamp((Math.abs(steering) - 0.22) / 0.5, 0, 1);
        const excessSteering = (1 - cornerGripRatio) * clamp(updatedLateralDemand, 0, 1);
        const corneringLoss = excessSteering * (3 + race.speed * 0.018);
        if (excessSteering > 0) race.speed = Math.max(0, race.speed - corneringLoss * dt);

        // Vehicle dynamics must integrate tyre forces in WORLD space. The old
        // implementation decomposed velocity in the old car basis, rotated the
        // chassis, then rebuilt velocity in the new basis every frame. That rotated
        // the velocity vector with the nose and erased the very slip angle needed
        // for a sustained, controllable drift.
        // GOLDEN BASE STEERING SIGN CONVENTION:
        // Forward is (-sin(yaw), 0, -cos(yaw)); positive yaw turns toward world -X.
        // Negating the signed steering input keeps left thumb input turning left.
        const steerAngle = -steering * (0.38 - updatedSpeedRatio * 0.10);
        const forwardX = -Math.sin(race.worldYaw);
        const forwardZ = -Math.cos(race.worldYaw);
        const lateralX = Math.cos(race.worldYaw);
        const lateralZ = -Math.sin(race.worldYaw);
        const longitudinalVelocity = race.velocityX * forwardX + race.velocityZ * forwardZ;
        const lateralVelocity = race.velocityX * lateralX + race.velocityZ * lateralZ;
        // Signed velocity keeps steering/recovery natural when backing up.
        // Braking while turning deliberately unloads rear grip: the same steering input
        // creates a stronger yaw response under a high-speed trail-brake, rather than
        // the brake simply scrubbing speed and keeping the car planted.
        const targetYawRate = Math.tan(steerAngle) * longitudinalVelocity / 2.65 * (1 + brakeTurnSlide * 0.48);
        const hardTyre = activeTyreRef.current === "Hard";
        const softBonusActive = sessionModeRef.current === "race"
          && activeTyreRef.current === "Soft" && firstScoredRaceLapActiveRef.current;
        const gripLimit = 8.2 * (hardTyre ? 1.2 : 1)
          * clamp(1.04 - race.brakePressure * 0.48 - race.wheelLock * 0.58, 0.28, 1.04);
        // Braking and cornering share tyre grip. Hard trail-braking therefore
        // leaves less lateral force available and can naturally start a slide.
        const brakeGripShare = clamp(race.brakePressure * 1.05, 0, 0.97);
        const availableLateralGrip = gripLimit * Math.sqrt(Math.max(0.08, 1 - brakeGripShare * brakeGripShare));
        const demandedLateralAccel = -targetYawRate * longitudinalVelocity;
        const gripRatio = clamp(availableLateralGrip / Math.max(0.001, Math.abs(demandedLateralAccel)), 0, 1);
        // Chassis yaw does not get artificially locked to the velocity heading
        // when the tyres saturate; this is what lets the rear step out under load.
        const yawGrip = gripRatio < 1 ? 0.88 + gripRatio * 0.12 : 1;
        race.worldYaw += targetYawRate * yawGrip * dt;
        race.worldYaw = Math.atan2(Math.sin(race.worldYaw), Math.cos(race.worldYaw));

        const driveAccel = (race.throttle * 20 + (boost ? 20 : 0))
          * (longitudinalVelocity < 0 ? 1.7 : 1)
          * (softBonusActive && longitudinalVelocity >= 0 ? 1.05 : 1);
        const brakeAccel = race.brakePressure * 13.5 * brakeEfficiency;
        const dragAccel = longitudinalVelocity * (0.24 + Math.abs(longitudinalVelocity) * 0.009);
        const nextLongitudinal = clamp(longitudinalVelocity + (driveAccel - brakeAccel - dragAccel) * dt, -7, 22.5);
        const longitudinalAccel = dt > 0 ? (nextLongitudinal - longitudinalVelocity) / dt : 0;
        // Normal grip recentres lateral slip progressively. Once the friction
        // circle is exceeded, weaker recovery lets momentum carry the car sideways
        // until the driver counter-steers or eases off the brake/throttle.
        const slipRecovery = gripRatio < 0.98
          ? 0.42 * (hardTyre ? 1.1 : 1)
          : 1.65 * (hardTyre ? 1.2 : 1);
        const lateralAccel = clamp(demandedLateralAccel - lateralVelocity * slipRecovery,
          -availableLateralGrip, availableLateralGrip);

        // Drift invariant: preserve world-space momentum while the chassis yaws.
        // Keep this physics path independent of UI refresh cadence.
        // QA checkpoint: keep this world-space integration intact; rebuilding velocity
        // from the new chassis heading would make the car snap straight and kill drift.
        // Integrate forces against the current world velocity; do not reconstruct
        // velocity from a freshly rotated chassis basis (which suppresses drifting).
        race.velocityX += (forwardX * longitudinalAccel + lateralX * lateralAccel) * dt;
        race.velocityZ += (forwardZ * longitudinalAccel + lateralZ * lateralAccel) * dt;
        const maxWorldSpeed = (boost ? 290 : 255) * (softBonusActive ? 1.08 : 1) * 0.28 / 3.6;
        const worldSpeed = Math.hypot(race.velocityX, race.velocityZ);
        if (worldSpeed > maxWorldSpeed) {
          const speedScale = maxWorldSpeed / worldSpeed;
          race.velocityX *= speedScale;
          race.velocityZ *= speedScale;
        }
        const sweepStartX = race.worldX;
        const sweepStartZ = race.worldZ;
        race.worldX += race.velocityX * dt;
        race.worldZ += race.velocityZ * dt;

        // One swept collision solver covers the complete connected driving
        // surface. The main circuit and pit connector are candidate pieces of
        // road, not mutually exclusive physics modes selected by pit-state flags.
        const trackSafetyOffset = RACING_TRACK_COLLISION_OFFSET;
        const pitSafetyOffset = RACING_PIT_COLLISION_OFFSET;
        const pitFenceClearance = RACING_PIT_LANE_OFFSET - RACING_FENCE_OFFSET;
        const sweepDx = race.worldX - sweepStartX;
        const sweepDz = race.worldZ - sweepStartZ;
        const sweepDistance = Math.hypot(sweepDx, sweepDz);
        const sweepSteps = Math.min(12, Math.max(1, Math.ceil(sweepDistance / 0.28)));
        const sweepSamples = COLLISION_SAMPLE_COUNT;
        // Anchor both candidate searches to the car's actual world position.
        // This avoids losing the main fence merely because a pit-state flag or
        // progress value is stale, and avoids switching collision systems.
        let nearestMainSample = 0, nearestPitSample = 0;
        let nearestMainStartSq = Number.POSITIVE_INFINITY;
        let nearestPitStartSq = Number.POSITIVE_INFINITY;
        for (let index = 0; index < sweepSamples; index++) {
          const mainPoint = MAIN_TRACK_COLLISION_SAMPLES[index];
          const mainDx = race.worldX - mainPoint.x, mainDz = race.worldZ - mainPoint.z;
          const mainSq = mainDx * mainDx + mainDz * mainDz;
          if (mainSq < nearestMainStartSq) { nearestMainStartSq = mainSq; nearestMainSample = index; }
          const pitPoint = PIT_LANE_COLLISION_SAMPLES[index];
          const pitDx = race.worldX - pitPoint.x, pitDz = race.worldZ - pitPoint.z;
          const pitSq = pitDx * pitDx + pitDz * pitDz;
          if (pitSq < nearestPitStartSq) { nearestPitStartSq = pitSq; nearestPitSample = index; }
        }
        for (let step = 1; step <= sweepSteps; step++) {
          const fraction = step / sweepSteps;
          const sampleX = sweepStartX + sweepDx * fraction;
          const sampleZ = sweepStartZ + sweepDz * fraction;
          let mainDistanceSq = Number.POSITIVE_INFINITY, mainIndex = nearestMainSample;
          let mainX = 0, mainZ = 0, mainTangentX = 0, mainTangentZ = -1;
          let pitDistanceSq = Number.POSITIVE_INFINITY, pitIndex = nearestPitSample;
          let pitX = 0, pitZ = 0, pitTangentX = 0, pitTangentZ = -1;
          // Search locally around each curve's previous closest sample. Both
          // searches run every frame, regardless of playerPitting/garageExit.
          for (let offset = -72; offset <= 72; offset++) {
            const mainSample = ((nearestMainSample + offset) % sweepSamples + sweepSamples) % sweepSamples;
            const mainPoint = MAIN_TRACK_COLLISION_SAMPLES[mainSample];
            const mainDx = sampleX - mainPoint.x, mainDz = sampleZ - mainPoint.z;
            const candidateMainSq = mainDx * mainDx + mainDz * mainDz;
            if (candidateMainSq < mainDistanceSq) {
              mainDistanceSq = candidateMainSq; mainIndex = mainSample;
              mainX = mainPoint.x; mainZ = mainPoint.z;
              mainTangentX = mainPoint.tx; mainTangentZ = mainPoint.tz;
            }
            const pitSample = Math.round(clamp(nearestPitSample + offset, 0, sweepSamples));
            const pitPoint = PIT_LANE_COLLISION_SAMPLES[pitSample];
            const pitDx = sampleX - pitPoint.x, pitDz = sampleZ - pitPoint.z;
            const candidatePitSq = pitDx * pitDx + pitDz * pitDz;
            if (candidatePitSq < pitDistanceSq) {
              pitDistanceSq = candidatePitSq; pitIndex = pitSample;
              pitX = pitPoint.x; pitZ = pitPoint.z;
              pitTangentX = pitPoint.tx; pitTangentZ = pitPoint.tz;
            }
          }
          nearestMainSample = mainIndex;
          nearestPitSample = pitIndex;

          const mainDistance = Math.sqrt(mainDistanceSq);
          const mainDx = sampleX - mainX, mainDz = sampleZ - mainZ;
          const mainSideX = -mainTangentZ, mainSideZ = mainTangentX;
          const mainSignedOffset = mainDx * mainSideX + mainDz * mainSideZ;
          const mainT = mainIndex / sweepSamples;
          const mainSafeOffset = getVehicleSafeOffset(mainTangentX, mainTangentZ, race.worldYaw, RACING_FENCE_OFFSET, trackSafetyOffset);
          // The only open main-track edges are the two visible pit connectors.
          // This is a narrow geometric opening, not a broad pit-mode exemption.
          const mainConnectorOpening = mainSignedOffset < 0
            && ((mainT >= .905 && mainT <= .94) || (mainT >= .075 && mainT <= .11))
            && mainDistance <= 16;
          const mainPenetration = mainConnectorOpening
            ? Number.POSITIVE_INFINITY
            : Math.max(mainDistance, Math.abs(mainSignedOffset)) - mainSafeOffset;

          const pitDistance = Math.sqrt(pitDistanceSq);
          const pitDx = sampleX - pitX, pitDz = sampleZ - pitZ;
          const pitSideX = -pitTangentZ, pitSideZ = pitTangentX;
          const pitSignedOffset = pitDx * pitSideX + pitDz * pitSideZ;
          const pitSafeOffset = getVehicleSafeOffset(pitTangentX, pitTangentZ, race.worldYaw, pitFenceClearance, pitSafetyOffset);
          // The circuit-facing pit boundary must be open only through the
          // physical entry taper. Its length matches createRacingPitLane's
          // 12-of-84-sample transition and the visible main-track fence gap.
          // Once the connector has merged into the parallel pit road, the
          // ordinary inner pit boundary applies again.
          const pitEntryOpening = nearestPitSample <= Math.round(sweepSamples * (12 / 84))
            && mainT >= .905 && mainT <= .94 && mainDistance <= 16;
          const pitPenetration = pitEntryOpening
            ? Number.NEGATIVE_INFINITY
            : pitSignedOffset > pitSafeOffset
              ? pitSignedOffset - pitSafeOffset
              : pitDistance <= 8 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

          const usePitBoundary = pitPenetration < mainPenetration;
          const penetration = Math.min(mainPenetration, pitPenetration);
          if (penetration > 0) {
            const safeOffset = usePitBoundary ? pitSafeOffset : mainSafeOffset;
            const distance = usePitBoundary ? pitDistance : mainDistance;
            const dx = usePitBoundary ? pitDx : mainDx;
            const dz = usePitBoundary ? pitDz : mainDz;
            const sideX = usePitBoundary ? pitSideX : mainSideX;
            const sideZ = usePitBoundary ? pitSideZ : mainSideZ;
            const signedOffset = usePitBoundary ? pitSignedOffset : mainSignedOffset;
            const normalX = usePitBoundary ? sideX : distance > safeOffset && distance > .0001
              ? dx / distance : sideX * (signedOffset < 0 ? -1 : 1);
            const normalZ = usePitBoundary ? sideZ : distance > safeOffset && distance > .0001
              ? dz / distance : sideZ * (signedOffset < 0 ? -1 : 1);
            const remainingX = race.worldX - sampleX;
            const remainingZ = race.worldZ - sampleZ;
            const outwardRemainder = Math.max(0, remainingX * normalX + remainingZ * normalZ);
            const boundaryX = usePitBoundary ? pitX : mainX;
            const boundaryZ = usePitBoundary ? pitZ : mainZ;
            race.worldX = boundaryX + normalX * safeOffset + remainingX - normalX * outwardRemainder;
            race.worldZ = boundaryZ + normalZ * safeOffset + remainingZ - normalZ * outwardRemainder;
            const outwardVelocity = race.velocityX * normalX + race.velocityZ * normalZ;
            if (outwardVelocity > 0) {
              const impactKmh = outwardVelocity * 3.6 / 0.28;
              const restitution = impactKmh > 80 ? .16 : .04;
              race.velocityX -= normalX * outwardVelocity * (1 + restitution);
              race.velocityZ -= normalZ * outwardVelocity * (1 + restitution);
              if (now - race.lastImpactAt > 180) {
                race.lastImpactAt = now;
                race.damage = clamp(race.damage + Math.max(0, impactKmh - 18)
                  * (impactKmh > 115 ? .78 : impactKmh > 65 ? .38 : .12), 0, 99);
              }
            } else {
              race.velocityX *= .98;
              race.velocityZ *= .98;
            }
            break;
          }
        }
        // Pit state still controls service and lap bookkeeping below. It no
        // longer selects a different collision solver or disables circuit walls.
        const onPitRoute = race.playerPitting || race.playerGarageExit;
        let nearestPitT = onPitRoute ? race.playerPitProgress : 0;
        if (onPitRoute) {
          let nearestPitDistanceSq = Number.POSITIVE_INFINITY;
          const centre = Math.round(clamp(nearestPitT, 0, 1) * sweepSamples);
          for (let offset = -144; offset <= 144; offset++) {
            const sampleIndex = Math.round(clamp(centre + offset, 0, sweepSamples));
            const point = PIT_LANE_COLLISION_SAMPLES[sampleIndex];
            const distanceSq = (race.worldX - point.x) ** 2 + (race.worldZ - point.z) ** 2;
            if (distanceSq < nearestPitDistanceSq) {
              nearestPitDistanceSq = distanceSq;
              nearestPitT = sampleIndex / sweepSamples;
            }
          }
        }
        race.speed = clamp(Math.hypot(race.velocityX, race.velocityZ) * 3.6 / 0.28, 0, (boost ? 290 : 255) * (sessionModeRef.current === "race" && activeTyreRef.current === "Soft" && firstScoredRaceLapActiveRef.current ? 1.08 : 1));
        const finalForwardX = -Math.sin(race.worldYaw);
        const finalForwardZ = -Math.cos(race.worldYaw);
        const finalLateralX = Math.cos(race.worldYaw);
        const finalLateralZ = -Math.sin(race.worldYaw);
        const finalLongitudinalVelocity = race.velocityX * finalForwardX + race.velocityZ * finalForwardZ;
        const finalLateralVelocity = race.velocityX * finalLateralX + race.velocityZ * finalLateralZ;
        // Measure sideslip against the car's forward direction, not the world
        // velocity sign; pure reverse travel must not look like a 180-degree drift.
        race.heading = Math.atan2(-race.velocityX, -race.velocityZ) - race.worldYaw;
        race.heading = Math.atan2(Math.sin(race.heading), Math.cos(race.heading));
        if (finalLongitudinalVelocity < -0.2) {
          race.heading = Math.atan2(Math.sin(race.heading - Math.PI), Math.cos(race.heading - Math.PI));
        }
        race.lateral = clamp(finalLateralVelocity, -18, 18);
        race.lateralVelocity = finalLateralVelocity;
        race.lateralG += ((targetYawRate * yawGrip) - race.lateralG) * (1 - Math.exp(-dt * 5));
        // A meaningful, signed slip angle feeds the car's body lean and drift visuals.
        race.drift = clamp(race.heading * clamp(Math.abs(finalLateralVelocity) / 1.8, 0, 1) * 1.15, -0.95, 0.95);

        // Pit lane is ordinary drivable road. Player steering and the same
        // world-space vehicle integration remain authoritative throughout.
        // Circuit projection is used only for lap timing, track limits, and collision queries.
        let nearestT = onPitRoute ? race.playerPitProgress : wrap(race.trackT, 1);
        let nearestDistanceSq = Number.POSITIVE_INFINITY;
        // Project onto the local section of the circuit, not the globally nearest
        // section. At hairpins and nearby return legs, a global nearest-point search
        // can snap to the wrong branch of the road and make the car appear to cut
        // across the track or pass through a barrier. The previous frame's trackT
        // anchors this search while still allowing forward and reverse movement.
        const projectionSamples = COLLISION_SAMPLE_COUNT;
        const projectionCurveSamples = onPitRoute ? PIT_LANE_COLLISION_SAMPLES : MAIN_TRACK_COLLISION_SAMPLES;
        // Keep projection on the current circuit branch while giving tight corners
        // and frame-time spikes enough search room to avoid jumping over the boundary.
        const projectionWindow = 72;
        const projectionCentre = Math.round(nearestT * projectionSamples);
        for (let offset = -projectionWindow; offset <= projectionWindow; offset++) {
          const sample = onPitRoute ? Math.round(clamp(nearestT + offset / projectionSamples, 0, 1) * projectionSamples) : ((projectionCentre + offset) % projectionSamples + projectionSamples) % projectionSamples;
          const sampleT = sample / projectionSamples;
          const point = projectionCurveSamples[sample];
          const dx = race.worldX - point.x;
          const dz = race.worldZ - point.z;
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq; nearestT = sampleT;
          }
        }
        // Keep track-limit telemetry derived from the local road projection.
        // This is measurement only; physical boundaries are resolved above by
        // the single swept collision solver.
        const projectedIndex = Math.round(clamp(nearestT, 0, 1) * projectionSamples);
        const projectedPoint = projectionCurveSamples[projectedIndex];
        const projectedTangentX = projectedPoint.tx;
        const projectedTangentZ = projectedPoint.tz;
        const projectionDx = race.worldX - projectedPoint.x;
        const projectionDz = race.worldZ - projectedPoint.z;
        const distanceFromCentre = Math.hypot(projectionDx, projectionDz);
        const signedOffset = projectionDx * -projectedTangentZ + projectionDz * projectedTangentX;
        const previousProgress = race.progress;
        if (race.playerGarageExit) {
          race.playerPitProgress = nearestT;
          race.trackT = 0;
          race.progress = 0;
          // Garage exit is a real drive to the far end of the pit connector.
          // Release only at the physical merge point, never at a nearby spline
          // projection elsewhere on the circuit.
          if (race.playerPitProgress >= .965) {
            const mergePoint = MAIN_TRACK_COLLISION_SAMPLES[Math.round(.105 * COLLISION_SAMPLE_COUNT)];
            const mergeDistance = Math.hypot(race.worldX - mergePoint.x, race.worldZ - mergePoint.z);
            // Require the car to physically reach the merge area, with enough
            // tolerance to avoid a latched garage-exit state on mobile.
            if (mergeDistance <= 7.5) {
              race.playerGarageExit = false;
              race.playerOutLap = true;
              race.trackT = .105;
              setPitFlowOpen(false);
              setPitMenuOpen(false);
              pitMenuOpenRef.current = false;
              notify("PIT CREW · Pit exit clear. Rejoin the circuit.", "success");
            }
          }
        } else if (race.playerPitting) {
          race.playerPitProgress = nearestT;
          // Offer the optional setup panel only when the car reaches the marked
          // service bay inside the physical pit lane (not merely at pit entry).
          if (race.playerPitProgress >= .46 && race.playerPitProgress <= .76 && !pitMenuPromptedRef.current) {
            pitMenuPromptedRef.current = true;
            pitMenuAvailableRef.current = true;
            setPitMenuAvailable(true);
            notify("PIT CREW · Service bay reached. Tap PIT SETUP to change paint or tyres.", "info");
          }
          // Forward exit: the pit curve ends on the main circuit centreline at
          // T=.105. Require the car to reach that endpoint physically.
          if (race.playerPitProgress >= .985 && race.playerPitServiceRemaining <= 0) {
            const mergePoint = MAIN_TRACK_COLLISION_SAMPLES[Math.round(.105 * COLLISION_SAMPLE_COUNT)];
            const mergeDistance = Math.hypot(race.worldX - mergePoint.x, race.worldZ - mergePoint.z);
            if (mergeDistance <= 4.8) {
              race.playerPitting = false;
              setPitFlowOpen(false);
              setPitMenuOpen(false);
              pitMenuOpenRef.current = false;
              const entryProgress = race.playerPitEntryProgress;
              const entryTrackT = race.playerPitEntryTrackT;
              race.trackT = .105;
              race.progress = entryProgress + wrap(.105 - entryTrackT, 1);
            }
          } else if (race.playerPitProgress <= .015 && race.playerPitServiceRemaining <= 0) {
            // Reverse exit is also allowed through the same open entry. It does
            // not advance the lap counter or teleport to a nearest track segment.
            const pitTangent = RACING_PIT_LANE.getTangentAt(.01);
            const reversingAlongPit = race.velocityX * pitTangent.x + race.velocityZ * pitTangent.z < -0.5;
            const entryPoint = PIT_LANE_COLLISION_SAMPLES[0];
            const entryDistance = Math.hypot(race.worldX - entryPoint.x, race.worldZ - entryPoint.z);
            if (reversingAlongPit && entryDistance <= 4.8) {
              race.playerPitting = false;
              race.trackT = race.playerPitEntryTrackT;
              race.progress = race.playerPitEntryProgress;
              setPitFlowOpen(false);
              setPitMenuOpen(false);
              pitMenuOpenRef.current = false;
            }
          }

          // Until one of the two physical endpoints is reached, race progress
          // remains at the entry point; the car itself is never moved or reset.
          if (race.playerPitting) {
            race.progress = race.playerPitEntryProgress;
            race.trackT = race.playerPitEntryTrackT;
          }
        } else if (race.playerOutLap) {
          const completedOutLap = nearestT < .08 && race.trackT > .82 && longitudinalVelocity > 0;
          race.trackT = nearestT;
          race.progress = 0;
          if (completedOutLap) {
            race.playerOutLap = false;
            race.elapsed = 0; race.lapTime = 0;
            
          }
        } else {
          race.trackT = nearestT;
          const crossedStartFinish = nearestT < 0.08 && race.trackT > 0.82 && longitudinalVelocity > 0;
          race.progress = crossedStartFinish
            ? Math.floor(previousProgress) + 1 + nearestT
            : Math.floor(previousProgress) + nearestT;
          if (crossedStartFinish && sessionModeRef.current === "race" && race.botRaceEnabled) {
            race.raceLapsCompleted = Math.min(2, race.raceLapsCompleted + 1);
          }
        }
        if (!race.playerPitting && pitMenuPromptedRef.current) {
          pitMenuPromptedRef.current = false;
          pitMenuAvailableRef.current = false;
          pitMenuOpenRef.current = false;
          setPitMenuAvailable(false);
          setPitMenuOpen(false);
        }
        // Kago has his own world-space vehicle state. The spline is navigation
        // and progress reference only; it no longer moves his car.
        const botTrack = trackRef.current!;
        const botPitLane = RACING_PIT_LANE;
        if (!race.botInitialized) {
          const p = botTrack.getPointAt(race.botProgress), tangent = botTrack.getTangentAt(race.botProgress).normalize();
          const sideX = -tangent.z, sideZ = tangent.x;
          race.botWorldX = p.x - sideX * 2.45; race.botWorldZ = p.z - sideZ * 2.45;
          race.botWorldYaw = Math.atan2(-tangent.x, -tangent.z);
          race.botVelocityX = -Math.sin(race.botWorldYaw) * 8.5; race.botVelocityZ = -Math.cos(race.botWorldYaw) * 8.5;
          race.botInitialized = true;
        }
        const botLevel = botDifficultyRef.current;
        // One strategic stop maximum: Kago enters on the second scored lap, then rejoins.
        // The physical pit lane uses the same route geometry as the rendered circuit.
        const botCurrentT = wrap(race.botProgress, 1);
        const botWasPitting = race.botPitting;
        if (race.botRaceEnabled && !race.botPitDone && !race.botPitting && Math.floor(race.botProgress) === 3 && botCurrentT >= .895 && botCurrentT < .96) {
          race.botPitting = true;
          race.botPitProgress = 0;
          race.botPitServiced = false;
          notify("PIT CREW · Kago is entering the pit lane.", "info");
        }
        const botSoftLapActive = race.botRaceEnabled && race.botRaceTyreChoice === "Soft" && race.botProgress < 3 && !race.botPitting;
        const botHardGrip = race.botRaceTyreChoice === "Hard" ? 1.2 : 1;
        const botTargetSpeed = race.botPitting ? (race.botPitServiceRemaining > 0 ? 0 : 9.2) : 24.11 * (botSoftLapActive ? 1.08 : 1);
        const botProfile = botLevel === "Easy"
          ? { aggression: .76, steeringGain: 1.78, steeringResponse: 4.0, cornerConfidence: .105, brakeMargin: .36, brakeResponse: .22, brakeLimit: .34, mistakeThreshold: .42, mistakeStrength: .19, nosDrain: 30, nosRegen: 10, nosStart: 42, nosReserve: 12, nosCooldown: 3.8, nosBoost: 1.045 }
          : botLevel === "Normal"
            ? { aggression: .91, steeringGain: 2.02, steeringResponse: 4.8, cornerConfidence: .045, brakeMargin: .56, brakeResponse: .27, brakeLimit: .41, mistakeThreshold: .82, mistakeStrength: .075, nosDrain: 27, nosRegen: 8, nosStart: 28, nosReserve: 8, nosCooldown: 2.5, nosBoost: 1.08 }
            : { aggression: 1, steeringGain: 2.2, steeringResponse: 5.35, cornerConfidence: .022, brakeMargin: .72, brakeResponse: .30, brakeLimit: .46, mistakeThreshold: .965, mistakeStrength: .025, nosDrain: 24, nosRegen: 6, nosStart: 18, nosReserve: 5, nosCooldown: 1.5, nosBoost: 1.12 };
        const botAggression = botProfile.aggression;
        const botTurn = getTrackTurn(botTrack, botCurrentT, .006);
        // Use actual world-space proximity for tactical decisions rather than wrapped
        // progress fractions, which can be ambiguous around the start/finish line.
        const botHeadingX = -Math.sin(race.botWorldYaw), botHeadingZ = -Math.cos(race.botWorldYaw);
        const botLateralX = Math.cos(race.botWorldYaw), botLateralZ = -Math.sin(race.botWorldYaw);
        const playerRelativeX = race.worldX - race.botWorldX;
        const playerRelativeZ = race.worldZ - race.botWorldZ;
        const playerLongitudinal = playerRelativeX * botHeadingX + playerRelativeZ * botHeadingZ;
        const playerLateral = playerRelativeX * botLateralX + playerRelativeZ * botLateralZ;
        const playerNear = Math.abs(playerLongitudinal) < 30 && Math.abs(playerLateral) < 9.5;
        const playerAhead = playerLongitudinal > 0;
        const playerClosing = (race.velocityX - race.botVelocityX) * botHeadingX + (race.velocityZ - race.botVelocityZ) * botHeadingZ;
        const attackWindow = playerAhead && playerLongitudinal < 34 && playerClosing < 1.8;
        const defendWindow = !playerAhead && Math.abs(playerLongitudinal) < 17;
        // Choose a passing lane opposite the car ahead, or defend the side occupied
        // by a close challenger. Blend lane changes to avoid snapping the chassis.
        let desiredOffset = race.botPitting ? 0 : -2.45;
        if (playerNear && !race.botPitting) {
          if (attackWindow) desiredOffset = playerLateral >= 0
            ? (botAggression > .85 ? -3.25 : -2.55)
            : (botAggression > .85 ? 3.25 : 2.55);
          else if (defendWindow) desiredOffset = playerLateral >= 0 ? 3.0 : -3.0;
          else if (playerAhead) desiredOffset = playerLateral >= 0 ? -2.8 : 2.8;
        }
        const lineBlend = 1 - Math.exp(-dt * (botLevel === "Hard" ? 4.5 : botLevel === "Normal" ? 3.8 : 3.2));
        race.botLineOffset += (clamp(desiredOffset, -3.35, 3.35) - race.botLineOffset) * lineBlend;
        const lookAhead = clamp(.012 + Math.hypot(race.botVelocityX, race.botVelocityZ) * .0011, .018, .038);
        const pitAimProgress = race.botPitServiceRemaining > 0 ? .52 : clamp(race.botPitProgress + lookAhead * 2.2, 0, .995);
        const targetPoint = race.botPitting ? botPitLane.getPointAt(pitAimProgress) : botTrack.getPointAt(wrap(botCurrentT + lookAhead, 1));
        const targetTangent = (race.botPitting ? botPitLane.getTangentAt(pitAimProgress) : botTrack.getTangentAt(wrap(botCurrentT + lookAhead, 1))).normalize();
        const targetSideX = -targetTangent.z, targetSideZ = targetTangent.x;
        // Commit to a corner-specific entry line: attack wider for a pass, defend
        // the inside when challenged, otherwise use a small deterministic apex bias.
        // This is a bounded offset from the canonical centreline, not a second track.
        const cornerLineDemand = race.botPitting ? 0 : clamp(Math.abs(botTurn) * 30, 0, 1);
        const cornerLineBias = cornerLineDemand > .24
          ? Math.sign(botTurn || 1) * (attackWindow ? -0.9 : defendWindow ? 0.85 : 0.32)
          : 0;
        const racingLineOffset = race.botPitting ? 0 : clamp(race.botLineOffset + clamp(botTurn * 16, -1.25, 1.25) + cornerLineBias, -3.45, 3.45);
        const aimX = targetPoint.x + targetSideX * racingLineOffset, aimZ = targetPoint.z + targetSideZ * racingLineOffset;
        const aimYaw = Math.atan2(-(aimX - race.botWorldX), -(aimZ - race.botWorldZ));
        const yawError = Math.atan2(Math.sin(aimYaw - race.botWorldYaw), Math.cos(aimYaw - race.botWorldYaw));
        const cornerDemand = race.botPitting ? 0 : clamp(Math.abs(botTurn) * 30, 0, 1);
        // Repeatable corner-pressure windows create deliberate Easy mistakes without
        // adding random frame noise. Normal is steadier; Hard rarely misses a cue.
        const mistakeWave = Math.sin(botCurrentT * Math.PI * 14 + .7);
        const botMistake = cornerDemand > .32 && mistakeWave > botProfile.mistakeThreshold ? botProfile.mistakeStrength : 0;
        const desiredSteer = clamp(-yawError * botProfile.steeringGain * (1 - botMistake), -1, 1);
        race.botSteering += (desiredSteer - race.botSteering) * (1 - Math.exp(-dt * botProfile.steeringResponse));
        const cornerPace = botTargetSpeed * (1 - cornerDemand * botProfile.cornerConfidence - botMistake * .12);
        const brakingMargin = botProfile.brakeMargin;
        const brakeResponse = botProfile.brakeResponse;
        const brakeLimit = botProfile.brakeLimit;
        const botBrakeTarget = race.botSpeed > cornerPace + brakingMargin
          ? clamp((race.botSpeed - cornerPace) * brakeResponse + .06, 0, brakeLimit) : 0;
        const botThrottleTarget = botBrakeTarget > .34 ? 0 : 1;
        race.botThrottle += (botThrottleTarget - race.botThrottle) * (1 - Math.exp(-dt * (botThrottleTarget ? 2.8 : 5)));
        race.botBrake += (botBrakeTarget - race.botBrake) * (1 - Math.exp(-dt * (botBrakeTarget ? 7.5 : 4.5)));
        const botOnStraight = cornerDemand < .16;
        const botNeedsPace = race.botSpeed < botTargetSpeed * (botLevel === "Easy" ? .91 : botLevel === "Normal" ? .96 : .99);
        const botNosOpportunity = botOnStraight && (
          botNeedsPace ||
          (attackWindow && race.botSpeed < botTargetSpeed * .995) ||
          (defendWindow && botLevel !== "Easy" && race.botSpeed < botTargetSpeed * .985)
        );
        race.botNosCooldown = Math.max(0, (race.botNosCooldown || 0) - dt);
        const botNosCanStart = race.botNos >= botProfile.nosStart && race.botNosCooldown <= 0;
        const botUseNos = race.botBoostActive
          ? botNosOpportunity && race.botNos > botProfile.nosReserve
          : botNosCanStart && botNosOpportunity;
        if (race.botBoostActive && !botUseNos) race.botNosCooldown = botProfile.nosCooldown;
        race.botBoostActive = botUseNos;
        race.botNos = botUseNos ? Math.max(0, race.botNos - botProfile.nosDrain * dt) : Math.min(100, race.botNos + botProfile.nosRegen * dt);
        const botForwardX = -Math.sin(race.botWorldYaw), botForwardZ = -Math.cos(race.botWorldYaw);
        const botSideX = Math.cos(race.botWorldYaw), botSideZ = -Math.sin(race.botWorldYaw);
        const botLongitudinal = race.botVelocityX * botForwardX + race.botVelocityZ * botForwardZ;
        const botLateral = race.botVelocityX * botSideX + race.botVelocityZ * botSideZ;
        const botYawRate = Math.tan(-race.botSteering * .42) * botLongitudinal / 2.8;
        race.botWorldYaw = Math.atan2(Math.sin(race.botWorldYaw + botYawRate * dt), Math.cos(race.botWorldYaw + botYawRate * dt));
        // Match the player's established engine, braking and aerodynamic drag model.
        // The old 3.45 drive force could not overcome drag at the advertised target
        // speeds, so Kago settled well below race pace and never challenged the player.
        // Keep the bot's own throttle, brake, NOS reserve and speed cap independent.
        const botDrive = race.botThrottle * 20 * (botSoftLapActive ? 1.05 : 1) + (botUseNos && !race.botPitting ? (botLevel === "Easy" ? 9 : botLevel === "Normal" ? 16 : 23) : 0);
        const botDrag = botLongitudinal * (.24 + Math.abs(botLongitudinal) * .009);
        const nosSpeedMultiplier = botProfile.nosBoost;
        const nextBotLongitudinal = clamp(botLongitudinal + (botDrive - race.botBrake * 13.5 - botDrag) * dt, 0, botTargetSpeed * (!race.botPitting && botUseNos ? nosSpeedMultiplier : 1.0));
        const botLongAccel = dt > 0 ? (nextBotLongitudinal - botLongitudinal) / dt : 0;
        const botLateralAccel = clamp((-botYawRate * botLongitudinal - botLateral * (cornerDemand > .7 ? .58 : 1.35) * botHardGrip) * botHardGrip, -7.2 * botHardGrip, 7.2 * botHardGrip);
        race.botVelocityX += (botForwardX * botLongAccel + botSideX * botLateralAccel) * dt;
        race.botVelocityZ += (botForwardZ * botLongAccel + botSideZ * botLateralAccel) * dt;
        race.botWorldX += race.botVelocityX * dt; race.botWorldZ += race.botVelocityZ * dt;
        // Local projection is for lap progress and gradual off-line recovery only.
        const previousBotProgress = race.botProgress;
        if (race.progress >= 1 && race.progress < 2 && botQualifyingTimeRef.current === null) botQualifyingElapsedRef.current += dt;
        let botNearestT = botCurrentT, botNearestDistance = Number.POSITIVE_INFINITY;
        let botNearestPoint = botTrack.getPointAt(botCurrentT), botNearestTangent = botTrack.getTangentAt(botCurrentT).normalize();
        if (race.botPitting) {
          const pitSearchCenter = race.botPitProgress;
          let pitNearestT = pitSearchCenter;
          for (let i = -48; i <= 48; i++) {
            const sampleT = clamp(pitSearchCenter + i / 1200, 0, 1), p = botPitLane.getPointAt(sampleT);
            const dx = race.botWorldX - p.x, dz = race.botWorldZ - p.z, d = dx * dx + dz * dz;
            if (d < botNearestDistance) { botNearestDistance = d; pitNearestT = sampleT; botNearestPoint = p; botNearestTangent = botPitLane.getTangentAt(sampleT).normalize(); }
          }
          race.botPitProgress = pitNearestT;
          if (!race.botPitServiced && race.botPitProgress >= .49) {
            race.botPitServiced = true;
            race.botPitServiceRemaining = 2.8;
            race.botRaceTyreChoice = race.botRaceTyreChoice === "Soft" ? "Hard" : "Soft";
            notify(`PIT CREW · Kago is fitting ${race.botRaceTyreChoice} tyres.`, "info");
          }
          if (race.botPitServiceRemaining > 0) {
            race.botPitServiceRemaining = Math.max(0, race.botPitServiceRemaining - dt);
            race.botVelocityX *= Math.max(0, 1 - dt * 5);
            race.botVelocityZ *= Math.max(0, 1 - dt * 5);
          }
          if (race.botPitProgress >= .985 && race.botPitServiceRemaining <= 0) {
            race.botPitting = false;
            race.botPitDone = true;
            race.botProgress = 3.105;
            notify("PIT CREW · Kago has rejoined the circuit.", "success");
          } else {
            race.botProgress = 2.91;
          }
        } else {
          for (let i = -56; i <= 56; i++) {
            const sampleT = wrap(botCurrentT + i / 1920, 1), p = botTrack.getPointAt(sampleT);
            const dx = race.botWorldX - p.x, dz = race.botWorldZ - p.z, d = dx * dx + dz * dz;
            if (d < botNearestDistance) { botNearestDistance = d; botNearestT = sampleT; botNearestPoint = p; botNearestTangent = botTrack.getTangentAt(sampleT).normalize(); }
          }
          const trackSideX = -botNearestTangent.z, trackSideZ = botNearestTangent.x;
          const botOffset = (race.botWorldX - botNearestPoint.x) * trackSideX + (race.botWorldZ - botNearestPoint.z) * trackSideZ;
          if (Math.abs(botOffset) > 5.15) {
            const correction = Math.sign(botOffset) * (Math.abs(botOffset) - 5.15);
            race.botWorldX -= trackSideX * correction * .72; race.botWorldZ -= trackSideZ * correction * .72;
            const outward = (race.botVelocityX * trackSideX + race.botVelocityZ * trackSideZ) * Math.sign(botOffset);
            if (outward > 0) { race.botVelocityX -= trackSideX * Math.sign(botOffset) * outward * 1.15; race.botVelocityZ -= trackSideZ * Math.sign(botOffset) * outward * 1.15; }
            if (Math.hypot(race.botVelocityX, race.botVelocityZ) < 3.2) {
              const recoveryYaw = Math.atan2(-botNearestTangent.x, -botNearestTangent.z);
              const error = Math.atan2(Math.sin(recoveryYaw - race.botWorldYaw), Math.cos(recoveryYaw - race.botWorldYaw));
              race.botWorldYaw += clamp(error, -dt * 1.4, dt * 1.4); race.botThrottle = Math.max(race.botThrottle, .55);
            }
          }
          race.botProgress = wrap(previousBotProgress, 1) > .82 && botNearestT < .08
            ? Math.floor(previousBotProgress) + 1 + botNearestT
            : Math.floor(previousBotProgress) + botNearestT;
        }
        const botHeading = Math.atan2(-race.botVelocityX, -race.botVelocityZ);
        race.botDrift = clamp(Math.atan2(Math.sin(botHeading - race.botWorldYaw), Math.cos(botHeading - race.botWorldYaw)), -.95, .95);
        race.botSpeed = Math.hypot(race.botVelocityX, race.botVelocityZ);
        if (!race.botPitting && !botWasPitting) {
          race.botProgress = wrap(previousBotProgress, 1) > .82 && botNearestT < .08
            ? Math.floor(previousBotProgress) + 1 + botNearestT
            : Math.floor(previousBotProgress) + botNearestT;
        }
        if (race.progress >= 1 && race.progress < 2 && botQualifyingTimeRef.current === null
          && previousBotProgress < 2 && race.botProgress >= 2) {
          botQualifyingTimeRef.current = botQualifyingElapsedRef.current;
        }

        if (race.botRaceEnabled && race.progress >= 2 && !race.playerPitting && !race.botPitting) {
        // Player-vs-Kago collision: oriented vehicle footprints are tested in
        // world space using the separating-axis theorem. Resolve the player
        // against Kago's independently moving chassis for this frame, preserving the
        // existing player movement, steering and track-boundary solver.
        {
          const botX = race.botWorldX, botZ = race.botWorldZ;
          const botForwardX = -Math.sin(race.botWorldYaw), botForwardZ = -Math.cos(race.botWorldYaw);
          const botSideX = Math.cos(race.botWorldYaw), botSideZ = -Math.sin(race.botWorldYaw);
          const playerForwardX = -Math.sin(race.worldYaw);
          const playerForwardZ = -Math.cos(race.worldYaw);
          const playerSideX = Math.cos(race.worldYaw);
          const playerSideZ = -Math.sin(race.worldYaw);
          const deltaX = race.worldX - botX;
          const deltaZ = race.worldZ - botZ;
          const axes = [
            [playerForwardX, playerForwardZ],
            [playerSideX, playerSideZ],
            [botForwardX, botForwardZ],
            [botSideX, botSideZ],
          ];
          let minimumOverlap = Number.POSITIVE_INFINITY;
          let collisionNormalX = 0;
          let collisionNormalZ = 0;
          let colliding = true;
          for (const [axisX, axisZ] of axes) {
            const playerRadius = 1.52 * Math.abs(axisX * playerForwardX + axisZ * playerForwardZ)
              + 0.89 * Math.abs(axisX * playerSideX + axisZ * playerSideZ);
            const botRadius = 1.52 * Math.abs(axisX * botForwardX + axisZ * botForwardZ)
              + 0.89 * Math.abs(axisX * botSideX + axisZ * botSideZ);
            const separation = deltaX * axisX + deltaZ * axisZ;
            const overlap = playerRadius + botRadius - Math.abs(separation);
            if (overlap <= 0) {
              colliding = false;
              break;
            }
            if (overlap < minimumOverlap) {
              minimumOverlap = overlap;
              const direction = separation < 0 ? -1 : 1;
              collisionNormalX = axisX * direction;
              collisionNormalZ = axisZ * direction;
            }
          }
          if (colliding) {
            // Separate the complete car footprints instead of allowing their
            // noses/doors to occupy the same space. The small margin prevents
            // the same contact from being re-detected due to floating-point noise.
            race.worldX += collisionNormalX * (minimumOverlap + 0.035);
            race.worldZ += collisionNormalZ * (minimumOverlap + 0.035);

            const botVelocityX = race.botVelocityX;
            const botVelocityZ = race.botVelocityZ;
            const relativeX = race.velocityX - botVelocityX;
            const relativeZ = race.velocityZ - botVelocityZ;
            const closingSpeed = relativeX * collisionNormalX + relativeZ * collisionNormalZ;
            if (closingSpeed < 0) {
              // Low restitution gives a believable thud, while retaining enough
              // tangential momentum for a recoverable sideswipe or glancing hit.
              const impulse = closingSpeed * 1.12;
              race.velocityX -= collisionNormalX * impulse;
              race.velocityZ -= collisionNormalZ * impulse;
              // Reciprocal, mass-biased contact response keeps the player's feel intact.
              race.botVelocityX += collisionNormalX * impulse * .62;
              race.botVelocityZ += collisionNormalZ * impulse * .62;
              race.botWorldYaw += clamp((race.botVelocityX * botSideX + race.botVelocityZ * botSideZ) * .018, -.08, .08);
              race.botImpactX = (race.worldX + race.botWorldX) * .5;
              race.botImpactZ = (race.worldZ + race.botWorldZ) * .5;
              if (now - race.botImpactAt > 180 && Math.abs(closingSpeed) > 1.2) {
                race.botImpactAt = now;
                race.botImpactStrength = clamp(Math.abs(closingSpeed) / 8, .2, 1);
              }
              const tangentX = -collisionNormalZ;
              const tangentZ = collisionNormalX;
              const tangentialSpeed = race.velocityX * tangentX + race.velocityZ * tangentZ;
              race.velocityX -= tangentX * tangentialSpeed * 0.045;
              race.velocityZ -= tangentZ * tangentialSpeed * 0.045;
              race.speed *= 0.84;
            } else {
              // A car pressed against Kago can still reverse or steer away.
              race.velocityX *= 0.985;
              race.velocityZ *= 0.985;
            }

            const impactKmh = Math.max(0, -closingSpeed) * 3.6 / 0.28;
            if (impactKmh > 18 && now - race.lastImpactAt > 220) {
              race.lastImpactAt = now;
              race.damage = Math.min(99, clamp(race.damage + (impactKmh - 18) * (impactKmh > 75 ? 0.34 : 0.14), 0, 100));
              
            }
            race.speed = clamp(Math.hypot(race.velocityX, race.velocityZ) * 3.6 / 0.28, 0, 290);
          }
        }
        }


        race.offTrack = distanceFromCentre > 7.2 ? race.offTrack + dt : Math.max(0, race.offTrack - dt * 1.5);
        if (distanceFromCentre > 7.2 || race.offTrack > 0.5) race.lapInvalid = true;
        race.lateral = signedOffset;
        // Practice has no crash/recovery interruption. Going wide can invalidate a
        // lap, but never takes the car away from the player or resets their inputs.

        if (!race.playerGarageExit && !race.playerOutLap) { race.elapsed += dt; race.lapTime += dt; }
        const lapNow = Math.floor(race.progress) + 1;
        if (lapNow > race.lap) {
          const completedLapTime = race.lapTime;
          const completedLapValid = !race.lapInvalid;
          if (sessionModeRef.current === "race" && firstScoredRaceLapActiveRef.current && lapNow > 3) {
            firstScoredRaceLapActiveRef.current = false;
            notify("SOFT TYRE · One-lap performance boost complete.", "info");
          }
          const practiceComplete = race.lap === 1 && lapNow === 2;
          const qualifyingComplete = race.lap === 2 && lapNow === 3;
          if (!practiceComplete && !race.lapInvalid && (race.bestLap === null || race.lapTime < race.bestLap)) {
            race.bestLap = race.lapTime;
            setBestLap(race.lapTime);
            
          } else if (!practiceComplete && race.lapInvalid) notify("RACE CONTROL · Lap invalid: track limits exceeded.", "error");
          race.lap = lapNow;
          race.lapTime = 0;
          race.lapInvalid = false;
          setLap(lapNow);
          if (practiceComplete && sessionModeRef.current === "warmup") {
            race.lap = lapNow;
            race.lapTime = 0;
            race.elapsed = 0;
            notify("RACE CONTROL · Warm-up lap complete. Keep practising or return to the pit.", "success");
          } else if (qualifyingComplete && sessionModeRef.current === "qualifying") {
            const botQualifyingTime = botQualifyingTimeRef.current
              ?? (botQualifyingElapsedRef.current + trackRef.current!.getLength() * Math.max(0, 2 - race.botProgress) / Math.max(8.5, race.botSpeed));
            race.qualifyingTime = completedLapTime;
            race.qualifyingValid = completedLapValid;
            race.botQualifyingTime = botQualifyingTime;

            // Qualifying is a separate session. Preserve its result, return the
            // player to the pit, and let them explicitly choose Start Race.
            const pitState = createPitResumeState(race);
            raceRef.current = pitState;
            sessionModeRef.current = "idle";
            firstScoredRaceLapActiveRef.current = false;
            racePitReplacementUsedRef.current = false;
            setRacePitReplacementUsed(false);
            controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
            setSpeed(0); setLapTime(0); setNos(pitState.nos); setLap(1);
            setSelectedActivity("warmup");
            setPitFlowStep("activity");
            setPitFlowOpen(true);
            phaseRef.current = "ready"; setPhase("ready");
            setSignal({ label: "QUALIFIER COMPLETE · REVIEW YOUR GRID POSITION", tone: "go" });
            notify(completedLapValid ? "RACE CONTROL · Qualifying complete. Review your grid position, then choose Start Race." : "RACE CONTROL · Qualifying lap invalid. You will start last if you choose a direct race.", completedLapValid ? "success" : "error");
            onSave?.({ race: { ...pitState }, difficulty: botDifficultyRef.current, savedAt: new Date().toISOString() });
            
          } else if (sessionModeRef.current === "race" && race.raceLapsCompleted >= 2 && !completedRef.current) {
            completedRef.current = true;
            controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
            const position: 1 | 2 = race.progress >= race.botProgress ? 1 : 2;
            const result: RaceResult = {
              id: "race-" + Date.now(), completedAt: new Date().toISOString(),
              difficulty: botDifficultyRef.current, elapsed: race.elapsed,
              bestLap: race.bestLap ?? (completedLapValid ? completedLapTime : null),
              position, laps: 2,
            };
            setRaceResult(result);
            phaseRef.current = "finished"; setPhase("finished");
            if (position === 1) notify("🏆 RACE CONTROL · YOU BEAT KAGO! RACE WINNER!", "success");
            onComplete?.(result);
          }
        }
        if (now - lastUi > 33) {
          lastUi = now;
          setSpeed(race.speed);
          setLapTime(race.lapTime);
          setNos(race.nos);
          setBoostActive(boost);
          const cue = pitMenuAvailableRef.current && race.playerPitting && !pitMenuOpenRef.current
            ? { label: "PIT SERVICE BAY · TAP PIT SETUP ↓", tone: "pit" }
            : race.playerGarageExit
            ? { label: controlsRef.current.accelerate ? "FOLLOW THE PIT ROAD →" : "HOLD GAS TO LEAVE GARAGE", tone: "go" }
            : race.playerPitting
              ? { label: "PIT EXIT AHEAD →", tone: "pit" }
              : race.playerOutLap
                ? { label: "FOLLOW THE ROAD TO START →", tone: "go" }
                : race.speed < 10 && !controlsRef.current.accelerate && !controlsRef.current.brake
                  ? { label: "PRESS & HOLD GAS ↑", tone: "go" }
                  : upcomingBend > 0.62 && race.speed > 105
                    ? { label: "BRAKE BEFORE THE CORNER ↓", tone: "brake" }
                    : upcomingBend > 0.34
                      ? { label: upcomingTurn < 0 ? "STEER LEFT ←" : "STEER RIGHT →", tone: "turn" }
                      : sessionModeRef.current === "warmup"
                        ? { label: race.speed < 10 ? "HOLD GAS TO DRIVE" : "WARM-UP LAP · KEEP GOING", tone: "go" }
                        : sessionModeRef.current === "qualifying"
                          ? { label: "QUALIFIER · SET YOUR LAP", tone: "go" }
                          : sessionModeRef.current === "race"
                            ? { label: "RACE ON · KEEP GOING", tone: "go" }
                            : race.progress < 1
                              ? { label: race.speed < 10 ? "HOLD GAS TO DRIVE" : "PRACTICE LAP · KEEP GOING", tone: "go" }
                              : race.progress < 2
                                ? { label: "QUALIFYING · SET YOUR LAP", tone: "go" }
                                : { label: "RACE ON · KEEP GOING", tone: "go" };
          setSignal(cue);
        }
      }
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(raf);
  }, [notify, onComplete]);

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (embedded && !expanded) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") controlsRef.current.steer = -1;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") controlsRef.current.steer = 1;
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") controlsRef.current.accelerate = true;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") controlsRef.current.brake = true;
      if (e.key === " " || e.key === "Shift") controlsRef.current.boost = true;
      if ((e.key.toLowerCase() === "p" || e.key === "Escape") && !e.repeat) pauseRace();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key) || ["a", "d"].includes(e.key.toLowerCase())) controlsRef.current.steer = 0;
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") controlsRef.current.accelerate = false;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") controlsRef.current.brake = false;
      if (e.key === " " || e.key === "Shift") { controlsRef.current.boost = false; setBoostActive(false); }
    };
    const release = () => { controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false }; setBoostActive(false); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", release);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", release); };
  }, [pauseRace, embedded, expanded]);

  // Circular thumbstick, like the movement controls in Shooters Trigger/Paws World.
  // The knob follows the thumb in two dimensions; horizontal displacement steers the car.
  const steerStickPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const maxX = Math.max(1, rect.width * 0.28);
    const maxY = Math.max(1, rect.height * 0.28);
    const rawX = (event.clientX - (rect.left + rect.width / 2)) / maxX;
    const rawY = (event.clientY - (rect.top + rect.height / 2)) / maxY;
    const magnitude = Math.hypot(rawX, rawY);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    controlsRef.current.steer = clamp(x, -1, 1);
    const knob = event.currentTarget.querySelector<HTMLElement>(".steering-stick-knob");
    if (knob) knob.style.transform = `translate3d(${x * maxX}px, ${y * maxY}px, 0)`;
  };
  const releaseSteerStick = (event: { currentTarget: HTMLDivElement }) => {
    controlsRef.current.steer = 0;
    const knob = event.currentTarget.querySelector<HTMLElement>(".steering-stick-knob");
    if (knob) knob.style.transform = "translate3d(0, 0, 0)";
  };
  const hold = (key: "accelerate" | "brake", down: boolean) => {
    controlsRef.current[key] = down;
    if (key === "brake" && down) {
      controlsRef.current.boost = false;
      setBoostActive(false);
    }
  };
  // NOS is a compact tap-to-toggle tactical burst, not a hold pedal.
  // Tap once to fire, tap again to cut it; braking safely cancels the burst.
  const toggleBoost = () => {
    if (phaseRef.current !== "running" || raceRef.current.nos <= 0 || raceRef.current.playerPitting) return;
    const next = !controlsRef.current.boost;
    controlsRef.current.boost = next;
    setBoostActive(next);
    
  };

  if (embedded && !expanded) return <div className="race-inline-promo"><div><p className="vula-eyebrow">VULA RACING · QUICK BREAK</p><h2>Take a quick lap.</h2><p>A little circuit practice while you wait. Your wash booking stays right where you left it.</p></div><button type="button" className="vula-button primary" onClick={() => setExpanded(true)}>Play now ↗</button></div>;

  return <div className={"vula race-hub" + (embedded ? " race-hub-embedded" : "")}>
    {!embedded && <><div className="vula-status"><span className="status-dot online" />Vula Racing · solo circuit practice</div><header className="vula-nav"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Racing warm-up</small></span></Link><nav><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></nav></header><section className="vula-section warmup-intro"><p className="vula-eyebrow">VULA RACING · SOLO PRACTICE</p><h1>Find your racing line.</h1><p>Hold GAS to build speed. Use the left stick to steer, brake before tight corners, and save NOS for straights.</p></section></>}
    {embedded && <div className="race-inline-heading"><div><p className="vula-eyebrow">VULA RACING · CIRCUIT PRACTICE</p><h2>Find your racing line.</h2><p>One more lap? Smooth corners, clean exits, well-timed NOS.</p></div><button type="button" className="vula-button secondary" onClick={() => { if (phaseRef.current === "running") pauseRace(); setExpanded(false); }}>Close game ×</button></div>}
    <section className="vula-section warmup-game">
      <div className="warmup-canvas-wrap warmup-circuit-wrap">
        <Racing3DScene raceRef={raceRef} controlsRef={controlsRef} phaseRef={phaseRef} carColor={carColor} />
        <div className={"warmup-signal-chip " + signal.tone} aria-live="polite"><span />{signal.label}</div>
        {(phase === "ready" || (phase === "running" && ((raceRef.current.playerGarageExit && raceRef.current.playerPitProgress < .94) || (raceRef.current.playerPitting && sessionModeRef.current !== "race")))) && <button type="button" className="warmup-pit-flow-trigger" onClick={() => { setPitFlowStep("activity"); setPitFlowOpen(true); }}>PIT MENU <span>↗</span></button>}
        {pitFlowOpen && <div className="warmup-pit-flow-panel" role="dialog" aria-modal="true" aria-label="Pit menu">
          <div className="warmup-pit-setup-heading"><div><span>VULA RACING · PIT CREW</span><strong>{pitFlowStep === "activity" ? "What are we driving?" : "Set up your car"}</strong></div><button type="button" aria-label="Close pit menu" onClick={() => setPitFlowOpen(false)}>×</button></div>
          {pitFlowStep === "activity" ? <>{sessionModeRef.current === "warmup" && <section className="warmup-practice-tyre-quick"><b>PRACTICE TYRE · FREE CHANGES</b><div className="warmup-pit-setup-tyres">{(["Soft","Hard"] as const).map(tyre => <button key={tyre} type="button" aria-pressed={tyreChoice === tyre} className={tyreChoice === tyre ? "selected" : ""} onClick={() => choosePracticeTyre(tyre)}>{tyre}</button>)}</div></section>}<section className="warmup-pit-activities">
            <button type="button" onClick={() => { setSelectedActivity("warmup"); setPitFlowStep("setup"); }}><strong>WARM-UP LAPS</strong><span>Practice from the pit. Kago stays off track.</span></button>
            <button type="button" onClick={() => { setSelectedActivity("qualifying"); setPitFlowStep("setup"); }}><strong>QUALIFIER</strong><span>Start alone from the grid and earn your position.</span></button>
            <button type="button" onClick={() => { setSelectedActivity("race"); setPitFlowStep("setup"); }}><strong>START RACE</strong><span>{raceRef.current.qualifyingValid && raceRef.current.qualifyingTime !== null ? `${raceRef.current.qualifyingTime <= (raceRef.current.botQualifyingTime ?? Number.POSITIVE_INFINITY) ? "POLE" : "SECOND"} · You ${fmt(raceRef.current.qualifyingTime)} · Kago ${fmt(raceRef.current.botQualifyingTime)}` : "No valid qualifier yet · start from last."}</span></button>
          </section></> : <>
            <section><b>VEHICLE COLOUR</b><div className="warmup-pit-setup-colours">{[["#f04478","Pink"],["#e44361","Red"],["#2878d0","Blue"],["#f2c230","Yellow"],["#f0f1e9","White"],["#252b31","Graphite"]].map(([color,label]) => <button key={color} type="button" title={label} aria-label={`Choose ${label}`} aria-pressed={carColor === color} style={{backgroundColor:color}} className={carColor === color ? "selected" : ""} onClick={() => chooseCarColor(color)} />)}</div></section>
            {selectedActivity === "warmup" && <section><b>PRACTICE TYRE <small>FREE CHANGES · HARD ADDS GRIP</small></b><div className="warmup-pit-setup-tyres">{(["Soft","Hard"] as const).map(tyre => <button key={tyre} type="button" aria-pressed={tyreChoice === tyre} className={tyreChoice === tyre ? "selected" : ""} onClick={() => choosePracticeTyre(tyre)}>{tyre}</button>)}</div></section>}
            {selectedActivity === "qualifying" && <>
              <section><b>QUALIFYING SET <small>LOCKED FOR THIS SESSION</small></b><div className="warmup-pit-setup-tyres">{(["Soft","Hard"] as const).map(tyre => <button key={tyre} type="button" aria-pressed={tyreChoice === tyre} className={tyreChoice === tyre ? "selected" : ""} onClick={() => setTyreChoice(tyre)}>{tyre}</button>)}</div></section>
              <section><b>MAIN RACE SET <small>SEPARATE ALLOCATION</small></b><div className="warmup-pit-setup-tyres">{(["Soft","Hard"] as const).map(tyre => <button key={tyre} type="button" aria-pressed={raceTyreChoice === tyre} className={raceTyreChoice === tyre ? "selected" : ""} onClick={() => chooseRaceTyre(tyre)}>{tyre}</button>)}</div></section>
            </>}
            {selectedActivity === "race" && <>
              <section><b>MAIN RACE SET <small>ONE SET FOR THE EVENT</small></b><div className="warmup-pit-setup-tyres">{(["Soft","Hard"] as const).map(tyre => <button key={tyre} type="button" aria-pressed={raceTyreChoice === tyre} className={raceTyreChoice === tyre ? "selected" : ""} onClick={() => chooseRaceTyre(tyre)}>{tyre}</button>)}</div></section>
            </>}
            <section className="warmup-pit-steering"><b>STEERING CONTROL</b><div><button type="button" aria-pressed={steeringMode === "analog"} className={steeringMode === "analog" ? "selected" : ""} onClick={() => chooseSteeringMode("analog")}>ANALOG STICK</button><button type="button" aria-pressed={steeringMode === "buttons"} className={steeringMode === "buttons" ? "selected" : ""} onClick={() => chooseSteeringMode("buttons")}>DIRECTIONAL</button></div></section>
            <section className="warmup-pit-difficulty"><b>KAGO · AI DIFFICULTY</b><select value={botDifficulty} onChange={event => { const next = event.target.value as "Easy" | "Normal" | "Hard"; botDifficultyRef.current = next; setBotDifficulty(next); }}><option>Easy</option><option>Normal</option><option>Hard</option></select></section>
            <button type="button" className="warmup-pit-setup-done" onClick={beginSelectedActivity}>{selectedActivity === "warmup" ? "START WARM-UP" : selectedActivity === "qualifying" ? "START QUALIFIER" : "START RACE"} ↗</button>
          </>}
        </div>}
        {pitMenuAvailable && raceRef.current.playerPitting && sessionModeRef.current === "race" && !pitMenuOpen && <button type="button" className="warmup-pit-setup-trigger" onClick={() => { pitMenuOpenRef.current = true; setPitMenuOpen(true); }}>PIT SETUP <span>↗</span></button>}
        {pitMenuAvailable && raceRef.current.playerPitting && sessionModeRef.current === "race" && pitMenuOpen && <div className="warmup-pit-setup-panel" role="dialog" aria-label="Pit setup">
          <div className="warmup-pit-setup-heading"><div><span>PIT CREW · OPTIONAL SETUP</span><strong>Quick adjustments</strong></div><button type="button" aria-label="Close pit setup" onClick={() => { pitMenuOpenRef.current = false; setPitMenuOpen(false); }}>×</button></div>
          <section><b>VEHICLE COLOUR</b><div className="warmup-pit-setup-colours">{[["#f04478","Pink"],["#e44361","Red"],["#2878d0","Blue"],["#f2c230","Yellow"],["#f0f1e9","White"],["#252b31","Graphite"]].map(([color,label]) => <button key={color} type="button" title={label} aria-label={`Choose ${label}`} aria-pressed={carColor === color} style={{backgroundColor:color}} className={carColor === color ? "selected" : ""} onClick={() => chooseCarColor(color)} />)}</div></section>
          <section><b>RACE TYRE SET <small>{racePitReplacementUsed ? "REPLACEMENT USED · SET LOCKED" : "ONE COMPOUND CHANGE AVAILABLE"}</small></b><div className="warmup-pit-setup-tyres">{(["Soft","Hard"] as const).map(tyre => <button key={tyre} type="button" disabled={racePitReplacementUsed || raceTyreChoice === tyre} aria-pressed={raceTyreChoice === tyre} className={raceTyreChoice === tyre ? "selected" : ""} onClick={() => chooseRacePitTyre(tyre)}>{tyre}</button>)}</div></section>
            <section className="warmup-pit-steering"><b>STEERING CONTROL</b><div><button type="button" aria-pressed={steeringMode === "analog"} className={steeringMode === "analog" ? "selected" : ""} onClick={() => chooseSteeringMode("analog")}>ANALOG STICK</button><button type="button" aria-pressed={steeringMode === "buttons"} className={steeringMode === "buttons" ? "selected" : ""} onClick={() => chooseSteeringMode("buttons")}>DIRECTIONAL</button></div></section>
          <button type="button" className="warmup-pit-setup-done" onClick={() => { pitMenuOpenRef.current = false; setPitMenuOpen(false); }}>DONE · BACK TO RACE</button>
        </div>}
        <div className="warmup-hud warmup-circuit-hud" aria-label="Live race timing">
          <div><span>Speed</span><strong>{Math.round(speed)} <small>km/h</small></strong></div>
          <div><span>{sessionModeRef.current === "warmup" || sessionModeRef.current === "qualifying" ? "Session" : "Race lap"}</span><strong>{sessionModeRef.current === "warmup" ? "Warm-up" : sessionModeRef.current === "qualifying" ? "Qualifier" : sessionModeRef.current === "race" ? Math.min(Math.max(1, lap - 2), 2) + "/2" : "Pit"}</strong></div>
          <div><span>Current lap</span><strong>{fmt(lapTime)}</strong></div>
          <div><span>Best lap</span><strong>{fmt(bestLap)}</strong></div>
          <div><span>{raceRef.current.botPitting ? "Opponent" : sessionModeRef.current === "race" ? "Rival gap" : "Opponent"}</span><strong>{raceRef.current.botPitting ? <small>KAGO IN PITS</small> : sessionModeRef.current === "race" ? <>{Math.abs(Math.round(rivalGap))}m <small>{rivalGap >= 0 ? "Kago ahead" : "You ahead"}</small></> : <small>SOLO SESSION</small>}</strong></div>
        </div>
        {phase === "finished" && raceResult && <div className={"warmup-race-result " + (raceResult.position === 1 ? "victory" : "defeat")} role="status" aria-live="assertive"><span>{raceResult.position === 1 ? "CHEQUERED FLAG" : "RACE FINISHED"}</span><strong>{raceResult.position === 1 ? "YOU BEAT KAGO!" : "YOU FINISHED THE RACE!"}</strong><p>{fmt(raceResult.elapsed)} · 2 scored laps · {raceResult.difficulty}</p><button type="button" onClick={startRace}>RACE AGAIN ↗</button></div>}
        {phase === "running" && raceRef.current.botPitting && <div className="warmup-kago-pit-status" role="status">KAGO · IN PITS</div>}
        <div className={"warmup-3d-overlay"} hidden={phase === "ready" || phase === "running" || phase === "finished" || phase === "pit"} aria-live="polite">
          <span>🏁 VULA RACING · LET’S PLAY!</span>
          <strong>{phase === "ready" ? "PIT GARAGE · RACE PREP" : phase === "grid" ? "FORMATION COMPLETE · GRID" : phase === "countdown" ? String(countdown || 1) : phase === "paused" ? "Paused" : phase === "pit" ? "PIT STOP" : phase === "crashed" ? "Car disabled" : "Session ready"}</strong>
          <p>{phase === "grid" ? "Grid positions are set." : phase === "countdown" ? "Lights out in..." : phase === "paused" ? "Take a breath. Resume when you're ready." : "Session complete."}</p>
        </div>
        {null}
        
      </div>
      <div className="warmup-notification-slot">{toast && <div className={"warmup-toast " + toast.kind} role="status" aria-atomic="true">{toast.text}</div>}</div>
      <div className="warmup-nos"><div><strong>NOS</strong><span>{Math.round(nos)}%</span></div><div className="nos-track"><span style={{ width: nos + "%" }} /></div></div>
      <div className="warmup-controls warmup-circuit-controls">
        <div className="warmup-steering" aria-label={steeringMode === "analog" ? "Analogue steering" : "Directional steering"}>
          {steeringMode === "analog" ? <div className={"steering-stick" + (phase !== "running" ? " is-disabled" : "")}
            role="slider" aria-label="Steering thumbstick" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(controlsRef.current.steer * 100)}
            tabIndex={phase === "running" ? 0 : -1}
            onPointerDown={e => { if (phase !== "running") return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); steerStickPointer(e); }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) steerStickPointer(e); }}
            onPointerUp={releaseSteerStick} onPointerCancel={releaseSteerStick} onLostPointerCapture={releaseSteerStick}
            onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const steer = e.key === "ArrowLeft" ? -0.72 : 0.72; controlsRef.current.steer = steer; const knob = e.currentTarget.querySelector<HTMLElement>(".steering-stick-knob"); if (knob) knob.style.transform = `translate3d(${steer * 25}px, 0, 0)`; } }}
            onKeyUp={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") releaseSteerStick({currentTarget:e.currentTarget}); }}>
            <span className="steering-stick-track" /><span className="steering-stick-knob"><span>●</span></span>
          </div> : <div className="steering-pad" aria-label="Hold to steer">
            <button type="button" className="steer-button" aria-label="Steer left" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDirectionalSteer("left", true); }} onPointerUp={() => setDirectionalSteer("left", false)} onPointerCancel={() => setDirectionalSteer("left", false)} onLostPointerCapture={() => setDirectionalSteer("left", false)}>←</button>
            <button type="button" className="steer-button" aria-label="Steer right" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDirectionalSteer("right", true); }} onPointerUp={() => setDirectionalSteer("right", false)} onPointerCancel={() => setDirectionalSteer("right", false)} onLostPointerCapture={() => setDirectionalSteer("right", false)}>→</button>
          </div>}
        </div>
        <div className="warmup-driving"> 
          <button type="button" aria-label="Brake" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("brake", true); }} onPointerUp={() => hold("brake", false)} onPointerCancel={() => hold("brake", false)} onLostPointerCapture={() => hold("brake", false)}>BRAKE ↓</button>
          <button type="button" className="accelerate-button" aria-label="Accelerate" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("accelerate", true); }} onPointerUp={() => hold("accelerate", false)} onPointerCancel={() => hold("accelerate", false)} onLostPointerCapture={() => hold("accelerate", false)}>GAS ↑</button>
          <button type="button" className="nos-button" aria-label="Toggle NOS burst" aria-pressed={boostActive} disabled={phase !== "running" || nos <= 0} onClick={toggleBoost}>{boostActive ? "NOS ON ⚡" : "TAP NOS ⚡"}</button>
        </div>
        <div className="warmup-actions">{phase === "paused" && onSave && <button type="button" className="vula-button secondary" onClick={() => onSave({ race: { ...raceRef.current }, difficulty: botDifficultyRef.current, savedAt: new Date().toISOString() })}>Save game</button>}{phase === "ready" ? <button type="button" className="vula-button primary" onClick={startDriving}>Start driving ↗</button> : phase === "countdown" || phase === "grid" ? <button type="button" className="vula-button primary" disabled>Ready {countdown || 1}…</button> : phase === "running" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Pause Ⅱ</button> : phase === "paused" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Resume ▶</button> : <button type="button" className="vula-button primary" onClick={startRace}>Back to pit ↻</button>}{onExit && <button type="button" className="vula-button secondary" onClick={onExit}>Racing menu</button>}</div>
      </div>
      <p className="warmup-help">Phone: start in the pit, open PIT MENU and choose Warm-up, Qualifier or Race. Soft gives +8% speed and +5% acceleration for the first scored race lap; Hard adds 20% lateral grip and reduces sliding. Qualifying and race sets are separate; one race tyre replacement is allowed. Choose paint and steering control. Hold GAS with your right thumb while steering with the left analogue stick or by holding LEFT/RIGHT. BRAKE slows you before corners. During a race, steer into the marked pit entry when called; Kago disappears from the circuit while his crew services the car. Tap NOS once for a burst, tap again to stop; lifting off the gas recharges it faster. Desktop: ← / → or A / D steer, ↑ / W gas, ↓ / S brake, Space / Shift NOS, P pause.</p>
    </section>
    {!embedded && <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></Link><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></footer>}
  </div>;
}
