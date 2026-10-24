"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./racing-warmup.css";
import Racing3DScene from "./racing-3d-scene";
import { subscribeSettings } from "@/lib/firebase/vula-data";
import { createRacingTrack, getTrackTurn } from "./racing-track";

export type Phase = "ready" | "countdown" | "running" | "paused" | "finished" | "crashed";
export type Controls = { steer: number; accelerate: boolean; brake: boolean; boost: boolean };
export type Race = {
  progress: number; speed: number; elapsed: number; lap: number; lapTime: number; steering: number; throttle: number; brakePressure: number;
  bestLap: number | null; lateral: number; lateralVelocity: number; heading: number; drift: number;
  nos: number; last: number; lapInvalid: boolean; offTrack: number;
  longitudinalLoad: number; lateralG: number; wheelLock: number;
  worldX: number; worldZ: number; worldYaw: number; velocityX: number; velocityZ: number; damage: number; lastImpactAt: number; trackT: number;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const newRace = (): Race => ({ progress: 0, speed: 0, elapsed: 0, lap: 1, lapTime: 0, steering: 0, throttle: 0, brakePressure: 0, bestLap: null, lateral: 0, lateralVelocity: 0, heading: 0, drift: 0, nos: 100, last: 0, lapInvalid: false, offTrack: 0, longitudinalLoad: 0, lateralG: 0, wheelLock: 0, worldX: 0, worldZ: 72, worldYaw: -1.2, velocityX: 0, velocityZ: 0, damage: 0, lastImpactAt: 0, trackT: 0 });
function fmt(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
}

export default function RacingWarmup({ embedded = false }: { embedded?: boolean }) {
  const [expanded, setExpanded] = useState(!embedded);
  const raceRef = useRef<Race>(newRace());
  const trackRef = useRef<ReturnType<typeof createRacingTrack> | null>(null);
  if (!trackRef.current) trackRef.current = createRacingTrack();
  const controlsRef = useRef<Controls>({ steer: 0, accelerate: false, brake: false, boost: false });
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(3);
  const [speed, setSpeed] = useState(0);
  const [lapTime, setLapTime] = useState(0);
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [lap, setLap] = useState(1);
  const [nos, setNos] = useState(100);
  const [signal, setSignal] = useState({ label: "GREEN LIGHT · BUILD SPEED", tone: "go" });
  const lastSignal = useRef("");
  const cornerSkillRef = useRef({ brakedForCorner: false, turnedIn: false, exitBoostUntil: 0 });
  const [boostActive, setBoostActive] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" | "info" } | null>(null);
  const [businessName, setBusinessName] = useState("Vula's Car Wash");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  phaseRef.current = phase;

  const notify = useCallback((text: string, kind: "success" | "error" | "info" = "success") => {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const stop = subscribeSettings(settings => {
      const name = settings?.businessName;
      if (typeof name === "string" && name.trim()) setBusinessName(name.trim());
    }, () => {});
    return stop;
  }, []);
  useEffect(() => { if (!embedded) document.title = businessName + " · Racing warm-up"; }, [businessName, embedded]);

  const reset = useCallback((start: boolean) => {
    raceRef.current = newRace();
    cornerSkillRef.current = { brakedForCorner: false, turnedIn: false, exitBoostUntil: 0 };
    controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
    setSpeed(0); setLapTime(0); setBestLap(null); setLap(1); setNos(100); setBoostActive(false);
    setCountdown(3); phaseRef.current = start ? "countdown" : "ready"; setPhase(start ? "countdown" : "ready");
  }, []);
  const startRace = useCallback(() => reset(true), [reset]);
  const pauseRace = useCallback(() => {
    if (phaseRef.current === "running") {
      controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
      setBoostActive(false); phaseRef.current = "paused"; setPhase("paused");
    } else if (phaseRef.current === "paused") {
      raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running");
    }
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(0); raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running");
      } else setCountdown(n => n - 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [phase, countdown]);



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
        // Smooth steering inputs before applying tyre force; ease back to centre on release.
        const steerEase = 1 - Math.exp(-dt * (Math.abs(controls.steer) > Math.abs(race.steering) ? 7.5 : 4.5));
        race.steering += (controls.steer - race.steering) * steerEase;
        const steering = race.steering;
        const t = wrap(race.progress, 1);
        const trackTurn = getTrackTurn(trackRef.current!, t, .006);
        const bend = clamp(Math.abs(trackTurn) * 28, 0, 1);
        const upcomingTurn = getTrackTurn(trackRef.current!, t + .018, .006);
        const upcomingBend = clamp(Math.abs(upcomingTurn) * 28, 0, 1);
        const speedRatio = race.speed / 205;
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
        const engineAcceleration = 34 * race.throttle + exitBonus;
        const aerodynamicDrag = race.speed * (0.055 + speedRatio * 0.025);
        const boostAcceleration = boost ? 30 : 0;
        race.speed = clamp(race.speed + (engineAcceleration + boostAcceleration - aerodynamicDrag - brakeDeceleration) * dt, 0, boost ? 250 : 205);
        race.nos = boost ? Math.max(0, race.nos - 25 * dt) : Math.min(100, race.nos + (controls.accelerate ? 4 : 9) * dt);
        if (race.nos <= 0 && controls.boost) { controls.boost = false; setBoostActive(false); }

        // A friction-circle model limits cornering when the tyres are already
        // spending grip on braking. Low-speed steering remains stable; excess
        // lateral demand at speed becomes slip instead of an arbitrary bend skid.
        const updatedSpeedRatio = race.speed / 205;
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

        // Heading and lateral motion now respond to speed, grip and load transfer.
        const grip = clamp(1.12 - updatedSpeedRatio * 0.06 - race.brakePressure * 0.08 - race.wheelLock * 0.18, 0.62, 1.12);
        // Independent world-space vehicle dynamics: the track no longer advances the car.
        // Steering changes the car's yaw; tyre grip determines how much velocity follows.
        const steerAngle = steering * (0.28 - updatedSpeedRatio * 0.12);
        const forwardX = -Math.sin(race.worldYaw);
        const forwardZ = -Math.cos(race.worldYaw);
        const lateralX = Math.cos(race.worldYaw);
        const lateralZ = -Math.sin(race.worldYaw);
        const longitudinalVelocity = race.velocityX * forwardX + race.velocityZ * forwardZ;
        const lateralVelocity = race.velocityX * lateralX + race.velocityZ * lateralZ;
        const targetYawRate = Math.tan(steerAngle) * Math.max(0, longitudinalVelocity) / 2.65;
        const gripLimit = 7.8 * clamp(1.08 - race.brakePressure * 0.35 - race.wheelLock * 0.5, 0.42, 1.08);
        const demandedLateralAccel = targetYawRate * Math.max(0, longitudinalVelocity);
        const gripRatio = Math.min(1, gripLimit / Math.max(0.001, Math.abs(demandedLateralAccel)));
        const yawResponse = 1 - Math.exp(-dt * (3.5 + updatedSpeedRatio * 2.5));
        race.worldYaw += targetYawRate * gripRatio * yawResponse * dt;
        race.worldYaw = Math.atan2(Math.sin(race.worldYaw), Math.cos(race.worldYaw));
        const updatedForwardX = -Math.sin(race.worldYaw);
        const updatedForwardZ = -Math.cos(race.worldYaw);
        const updatedLateralX = Math.cos(race.worldYaw);
        const updatedLateralZ = -Math.sin(race.worldYaw);
        const driveAccel = (race.throttle * 17 + (boost ? 12 : 0)) * (longitudinalVelocity < 0 ? 1.7 : 1);
        const brakeAccel = race.brakePressure * 28 * brakeEfficiency;
        const dragAccel = longitudinalVelocity * (0.32 + Math.abs(longitudinalVelocity) * 0.012);
        let nextLongitudinal = longitudinalVelocity + (driveAccel - brakeAccel - dragAccel) * dt;
        nextLongitudinal = clamp(nextLongitudinal, -7, 15.9);
        const lateralSlipAccel = clamp(-lateralVelocity * (gripRatio < 0.98 ? 1.2 : 5.5), -gripLimit, gripLimit);
        const nextLateral = lateralVelocity + lateralSlipAccel * dt;
        race.velocityX = updatedForwardX * nextLongitudinal + updatedLateralX * nextLateral;
        race.velocityZ = updatedForwardZ * nextLongitudinal + updatedLateralZ * nextLateral;
        race.worldX += race.velocityX * dt;
        race.worldZ += race.velocityZ * dt;
        race.speed = clamp(Math.hypot(race.velocityX, race.velocityZ) * 3.6 / 0.28, 0, boost ? 250 : 205);
        race.heading = Math.atan2(race.velocityX, -race.velocityZ) - race.worldYaw;
        race.heading = Math.atan2(Math.sin(race.heading), Math.cos(race.heading));
        race.lateral = clamp(nextLateral, -18, 18);
        race.lateralVelocity = nextLateral;
        race.lateralG += ((targetYawRate * gripRatio) - race.lateralG) * (1 - Math.exp(-dt * 5));
        race.drift = clamp(race.heading * clamp(Math.abs(nextLateral) / 7, 0, 1) * 0.25, -0.22, 0.22);

        // Circuit projection is used only for lap timing, track limits, and collision queries.
        let nearestT = race.trackT;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;
        let nearestX = 0;
        let nearestZ = 0;
        let nearestTangentX = 0;
        let nearestTangentZ = -1;
        for (let sample = 0; sample < 240; sample++) {
          const sampleT = sample / 240;
          const point = trackRef.current!.getPointAt(sampleT);
          const dx = race.worldX - point.x;
          const dz = race.worldZ - point.z;
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq; nearestT = sampleT; nearestX = point.x; nearestZ = point.z;
            const tangent = trackRef.current!.getTangentAt(sampleT);
            nearestTangentX = tangent.x; nearestTangentZ = tangent.z;
          }
        }
        const dx = race.worldX - nearestX;
        const dz = race.worldZ - nearestZ;
        const signedOffset = dx * -nearestTangentZ + dz * nearestTangentX;
        const distanceFromCentre = Math.sqrt(nearestDistanceSq);
        const outwardX = race.worldX - nearestX;
        const outwardZ = race.worldZ - nearestZ;
        const outwardLength = Math.max(0.001, Math.hypot(outwardX, outwardZ));
        const normalX = outwardX / outwardLength;
        const normalZ = outwardZ / outwardLength;
        const impactVelocity = race.velocityX * normalX + race.velocityZ * normalZ;
        if (distanceFromCentre > 8.35 && impactVelocity > 0 && now - race.lastImpactAt > 450) {
          const impactKmh = impactVelocity * 3.6 / 0.28;
          race.lastImpactAt = now;
          race.worldX = nearestX + normalX * 8.25;
          race.worldZ = nearestZ + normalZ * 8.25;
          race.velocityX -= normalX * impactVelocity * (impactKmh > 115 ? 1.18 : 0.78);
          race.velocityZ -= normalZ * impactVelocity * (impactKmh > 115 ? 1.18 : 0.78);
          race.speed *= impactKmh > 115 ? 0.52 : impactKmh > 65 ? 0.72 : 0.88;
          race.damage = clamp(race.damage + Math.max(0, impactKmh - 18) * (impactKmh > 115 ? 0.78 : impactKmh > 65 ? 0.38 : 0.12), 0, 100);
          if (impactKmh > 28) notify(impactKmh > 90 ? "Heavy impact · car damaged" : "Barrier contact · speed lost", impactKmh > 90 ? "error" : "info");
          if (race.damage >= 100 || impactKmh > 178) {
            controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
            race.velocityX = 0; race.velocityZ = 0; race.speed = 0;
            phaseRef.current = "crashed"; setPhase("crashed");
            notify("Major crash · restart the session", "error");
          }
        }
        const previousProgress = race.progress;
        race.trackT = nearestT;
        race.progress = nearestT < 0.08 && previousProgress % 1 > 0.82 && longitudinalVelocity > 0
          ? Math.floor(previousProgress) + 1 + nearestT
          : Math.floor(previousProgress) + nearestT;
        race.offTrack = distanceFromCentre > 7.2 ? race.offTrack + dt : Math.max(0, race.offTrack - dt * 1.5);
        if (distanceFromCentre > 7.2 || race.offTrack > 0.5) race.lapInvalid = true;
        race.lateral = signedOffset;
        // Practice has no crash/recovery interruption. Going wide can invalidate a
        // lap, but never takes the car away from the player or resets their inputs.

        race.elapsed += dt;
        race.lapTime += dt;
        const lapNow = Math.floor(race.progress) + 1;
        if (lapNow > race.lap) {
          if (!race.lapInvalid && (race.bestLap === null || race.lapTime < race.bestLap)) {
            race.bestLap = race.lapTime;
            setBestLap(race.lapTime);
            notify("New personal best lap!", "success");
          } else if (race.lapInvalid) notify("Lap invalid — stay on the racing surface.", "error");
          race.lap = lapNow;
          race.lapTime = 0;
          race.lapInvalid = false;
          setLap(lapNow);
        }
        if (now - lastUi > 33) {
          lastUi = now;
          setSpeed(race.speed);
          setLapTime(race.lapTime);
          setNos(race.nos);
          setBoostActive(boost);
          const cue = upcomingBend > 0.62 && race.speed > 105
            ? { label: "BRAKE POINT · LIFT NOW", tone: "brake" }
            : upcomingBend > 0.34
              ? { label: (upcomingTurn < 0 ? "TURN LEFT" : "TURN RIGHT") + " · PREPARE", tone: "turn" }
              : { label: "GREEN LIGHT · BUILD SPEED", tone: "go" };
          if (cue.tone === "brake" && lastSignal.current !== "brake") notify("Brake point ahead — lift before turn-in.", "info");
          lastSignal.current = cue.tone;
          setSignal(cue);
        }
      }
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(raf);
  }, [notify]);

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

  // Digital steering is deliberately predictable: hold LEFT or RIGHT.
  // It avoids the angle-sensitive virtual wheel that made thumbs fight the pedals.
  const holdSteer = (direction: -1 | 1, down: boolean) => {
    if (down) controlsRef.current.steer = direction * 0.68;
    else if (Math.sign(controlsRef.current.steer) === direction) controlsRef.current.steer = 0;
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
    if (phaseRef.current !== "running" || raceRef.current.nos <= 0) return;
    const next = !controlsRef.current.boost;
    controlsRef.current.boost = next;
    setBoostActive(next);
  };

  if (embedded && !expanded) return <div className="race-inline-promo"><div><p className="vula-eyebrow">VULA RACING · QUICK BREAK</p><h2>Take a quick lap.</h2><p>A little circuit practice while you wait. Your wash booking stays right where you left it.</p></div><button type="button" className="vula-button primary" onClick={() => setExpanded(true)}>Play now ↗</button></div>;

  return <div className={"vula race-hub" + (embedded ? " race-hub-embedded" : "")}>
    {!embedded && <><div className="vula-status"><span className="status-dot online" />Vula Racing · solo circuit practice</div><header className="vula-nav"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Racing warm-up</small></span></Link><nav><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></nav></header><section className="vula-section warmup-intro"><p className="vula-eyebrow">VULA RACING · SOLO PRACTICE</p><h1>Find your racing line.</h1><p>Follow the recommended line: brake before turn-in, ease off through the apex, then build throttle on exit. Save NOS for straights.</p></section></>}
    {embedded && <div className="race-inline-heading"><div><p className="vula-eyebrow">VULA RACING · CIRCUIT PRACTICE</p><h2>Find your racing line.</h2><p>One more lap? Smooth corners, clean exits, well-timed NOS.</p></div><button type="button" className="vula-button secondary" onClick={() => { if (phaseRef.current === "running") pauseRace(); setExpanded(false); }}>Close game ×</button></div>}
    <section className="vula-section warmup-game">
      <div className="warmup-hud warmup-circuit-hud"><div><span>Speed</span><strong>{Math.round(speed)} <small>km/h</small></strong></div><div><span>Lap</span><strong>{lap}</strong></div><div><span>Current lap</span><strong>{fmt(lapTime)}</strong></div><div><span>Best lap</span><strong>{fmt(bestLap)}</strong></div></div>
      <div className="warmup-canvas-wrap warmup-circuit-wrap">
        <Racing3DScene raceRef={raceRef} controlsRef={controlsRef} phaseRef={phaseRef} />
        <div className={"warmup-signal-chip " + signal.tone} aria-live="polite"><span />{signal.label}</div>
        {toast && <div className={"warmup-toast " + toast.kind} role="status">{toast.text}</div>}
        <div className="warmup-3d-overlay" hidden={phase === "running"} aria-live="polite">
          <span>VULA RACING · CIRCUIT PRACTICE</span>
          <strong>{phase === "ready" ? "Find your racing line" : phase === "countdown" ? String(countdown || 1) : phase === "paused" ? "Paused" : phase === "crashed" ? "Car disabled" : "Nice driving!"}</strong>
          <p>{phase === "ready" ? "Follow the green line. Brake at the boards, turn in on cue, clip the apex and unwind onto the exit." : phase === "countdown" ? "Get set. Smooth steering beats sudden corrections." : phase === "paused" ? "Take a breath. Resume when you're ready." : "Session complete. Take another lap and beat your time."}</p>
        </div>
      </div>
      <div className="warmup-nos"><div><strong>NOS</strong><span>{Math.round(nos)}%</span></div><div className="nos-track"><span style={{ width: nos + "%" }} /></div></div>
      <div className="warmup-controls warmup-circuit-controls">
        <div className="warmup-steering" aria-label="Steering controls">
          <span className="steering-caption">STEER</span>
          <div className="steering-pad">
            <button type="button" className="steer-button" aria-label="Steer left" aria-pressed={controlsRef.current.steer < 0} disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); holdSteer(-1, true); }} onPointerUp={() => holdSteer(-1, false)} onPointerCancel={() => holdSteer(-1, false)} onLostPointerCapture={() => holdSteer(-1, false)}>←</button>
            <button type="button" className="steer-button" aria-label="Steer right" aria-pressed={controlsRef.current.steer > 0} disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); holdSteer(1, true); }} onPointerUp={() => holdSteer(1, false)} onPointerCancel={() => holdSteer(1, false)} onLostPointerCapture={() => holdSteer(1, false)}>→</button>
          </div>
          <span className="steering-caption">Hold to turn</span>
        </div>
        <div className="warmup-driving">
          <button type="button" className="accelerate-button" aria-label="Accelerate" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("accelerate", true); }} onPointerUp={() => hold("accelerate", false)} onPointerCancel={() => hold("accelerate", false)} onLostPointerCapture={() => hold("accelerate", false)}>GAS ↑</button>
          <button type="button" aria-label="Brake" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("brake", true); }} onPointerUp={() => hold("brake", false)} onPointerCancel={() => hold("brake", false)} onLostPointerCapture={() => hold("brake", false)}>BRAKE ↓</button>
          <button type="button" className="nos-button" aria-label="Toggle NOS burst" aria-pressed={boostActive} disabled={phase !== "running" || nos <= 0} onClick={toggleBoost}>{boostActive ? "NOS ON ⚡" : "TAP NOS ⚡"}</button>
        </div>
        <div className="warmup-actions">{phase === "ready" ? <button type="button" className="vula-button primary" onClick={startRace}>Start driving ↗</button> : phase === "countdown" ? <button type="button" className="vula-button primary" disabled>Ready {countdown || 1}…</button> : phase === "running" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Pause Ⅱ</button> : phase === "paused" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Resume ▶</button> : <button type="button" className="vula-button primary" onClick={startRace}>Drive again ↻</button>}<button type="button" className="vula-button secondary" onClick={() => reset(false)}>Restart ↻</button></div>
      </div>
      <p className="warmup-help">Phone: hold ← / → with your left thumb; hold GAS or BRAKE with your right. Tap NOS once for a burst, tap again to stop. Desktop: ← / → or A / D steer, ↑ / W gas, ↓ / S brake, Space / Shift NOS, P pause.</p>
    </section>
    {!embedded && <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></Link><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></footer>}
  </div>;
}
