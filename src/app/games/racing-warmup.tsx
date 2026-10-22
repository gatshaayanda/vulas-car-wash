"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./racing-warmup.css";
import Racing3DScene from "./racing-3d-scene";
import { subscribeSettings } from "@/lib/firebase/vula-data";
import { createRacingTrack, getTrackTurn } from "./racing-track";

export type Phase = "ready" | "countdown" | "running" | "paused" | "crashed" | "finished";
export type Controls = { steer: number; accelerate: boolean; brake: boolean; boost: boolean };
export type Race = {
  progress: number; speed: number; elapsed: number; lap: number; lapTime: number; steering: number; throttle: number; brakePressure: number;
  bestLap: number | null; lateral: number; lateralVelocity: number; heading: number; drift: number;
  worldX: number; worldZ: number; trackT: number;
  nos: number; last: number; lapInvalid: boolean; offTrack: number;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const newRace = (): Race => ({ progress: 0, speed: 0, elapsed: 0, lap: 1, lapTime: 0, steering: 0, throttle: 0, brakePressure: 0, bestLap: null, lateral: 0, lateralVelocity: 0, heading: -Math.PI / 2, drift: 0, worldX: 0, worldZ: 72, trackT: 0, nos: 100, last: 0, lapInvalid: false, offTrack: 0 });
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
  const [crashMessage, setCrashMessage] = useState("");
  const [speed, setSpeed] = useState(0);
  const [lapTime, setLapTime] = useState(0);
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [lap, setLap] = useState(1);
  const [nos, setNos] = useState(100);
  const [signal, setSignal] = useState({ label: "GREEN LIGHT · BUILD SPEED", tone: "go" });
  const lastSignal = useRef("");
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
    if (phase !== "crashed") return;
    const timer = window.setTimeout(() => {
      const race = raceRef.current;
      race.lateral = 0;
      race.lateralVelocity = 0;
      race.heading = 0;
      race.offTrack = 0;
      race.speed = 42;
      race.last = 0;
      race.lapInvalid = true;
      controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
      phaseRef.current = "running";
      setCrashMessage("");
      setPhase("running");
      notify("Pit recovery complete — back on track. Lap invalidated.", "error");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [phase, notify]);

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
        const t = wrap(race.trackT, 1);
        const track = trackRef.current!;
        const trackTurn = getTrackTurn(track, t, .006);
        const bend = clamp(Math.abs(trackTurn) * 28, 0, 1);
        const upcomingTurn = getTrackTurn(track, t + .018, .006);
        const upcomingBend = clamp(Math.abs(upcomingTurn) * 28, 0, 1);
        const speedRatio = clamp(race.speed / 205, 0, 1.25);
        const throttleTarget = controls.accelerate && !controls.brake ? 1 : 0;
        const brakeTarget = controls.brake ? 1 : 0;
        race.throttle += (throttleTarget - race.throttle) * (1 - Math.exp(-dt * (throttleTarget ? 4.8 : 7)));
        race.brakePressure += (brakeTarget - race.brakePressure) * (1 - Math.exp(-dt * (brakeTarget ? 12 : 7)));
        const boost = controls.boost && race.nos > 0 && !controls.brake;
        const acceleration = 138 * race.throttle;
        const braking = 245 * race.brakePressure;
        race.speed = clamp(race.speed + (acceleration - race.speed * 0.19 - braking + (boost ? 95 : 0)) * dt, 0, boost ? 250 : 205);
        race.nos = boost ? Math.max(0, race.nos - 25 * dt) : Math.min(100, race.nos + (controls.accelerate ? 5 : 10) * dt);
        if (race.nos <= 0 && controls.boost) { controls.boost = false; setBoostActive(false); }

        // World-space arcade driving: the car owns its position and direction;
        // the circuit is no longer a spline rail that dictates its movement.
        const steerRate = 0.82 + speedRatio * 0.72;
        race.heading += -race.steering * steerRate * dt;
        const forwardX = -Math.sin(race.heading);
        const forwardZ = -Math.cos(race.heading);
        const travel = race.speed * 0.115 * dt;
        race.worldX += forwardX * travel;
        race.worldZ += forwardZ * travel;

        // Project onto the track only for lap timing and edge assistance. This
        // does not pull the car back to the racing line.
        let nearestT = race.trackT;
        let nearestX = 0;
        let nearestZ = 0;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;
        for (let i = 0; i < 240; i++) {
          const sampleT = i / 240;
          const point = track.getPointAt(sampleT);
          const dx = race.worldX - point.x;
          const dz = race.worldZ - point.z;
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq;
            nearestT = sampleT;
            nearestX = point.x;
            nearestZ = point.z;
          }
        }
        const trackDistance = Math.sqrt(nearestDistanceSq);
        const previousTrackT = race.trackT;
        let progressDelta = nearestT - previousTrackT;
        if (progressDelta < -0.5) progressDelta += 1;
        else if (progressDelta > 0.5) progressDelta -= 1;
        if (progressDelta > 0 && progressDelta < .035 && trackDistance < 13) race.progress += progressDelta;
        race.trackT = nearestT;

        // Gentle edge response replaces repeated instant crash/respawn loops.
        if (trackDistance > 7.2) {
          race.speed = Math.max(0, race.speed - (trackDistance > 10 ? 34 : 16) * dt);
          race.lapInvalid = true;
          race.offTrack += dt;
        } else {
          race.offTrack = Math.max(0, race.offTrack - dt * 1.8);
        }
        if (trackDistance > 11.5 && race.offTrack > 3.8) {
          const nearest = track.getPointAt(nearestT);
          const tangent = track.getTangentAt(nearestT).normalize();
          const sideX = -tangent.z, sideZ = tangent.x;
          const sideDistance = (race.worldX - nearestX) * sideX + (race.worldZ - nearestZ) * sideZ;
          const safeSide = Math.sign(sideDistance || 1);
          race.worldX = nearest.x + sideX * safeSide * 5.2;
          race.worldZ = nearest.z + sideZ * safeSide * 5.2;
          race.heading = Math.atan2(-tangent.x, -tangent.z);
          race.speed = Math.min(race.speed, 38);
          race.offTrack = 0;
          race.lapInvalid = true;
          notify("Back on the circuit — build speed again.", "info");
        }
        race.drift = clamp(-race.steering * speedRatio * .75, -1, 1);
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
  // NOS is a tap-to-toggle burst, not another hold target. Tap once to fire,
  // tap again to cut it; braking safely cancels the burst.
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
          <strong>{phase === "ready" ? "Find your racing line" : phase === "countdown" ? String(countdown || 1) : phase === "paused" ? "Paused" : phase === "crashed" ? "Pit-lane recovery" : "Nice driving!"}</strong>
          <p>{phase === "ready" ? "Follow the green line. Brake at the boards, turn in on cue, clip the apex and unwind onto the exit." : phase === "countdown" ? "Get set. Smooth steering beats sudden corrections." : phase === "paused" ? "Take a breath. Resume when you're ready." : phase === "crashed" ? crashMessage : "Session complete. Take another lap and beat your time."}</p>
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
