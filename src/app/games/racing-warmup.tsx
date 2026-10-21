"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./racing-warmup.css";
import Racing3DScene from "./racing-3d-scene";
import { subscribeSettings } from "@/lib/firebase/vula-data";
import { createRacingTrack, getTrackTurn } from "./racing-track";

export type Phase = "ready" | "countdown" | "running" | "paused" | "finished";
export type Controls = { steer: number; accelerate: boolean; brake: boolean; boost: boolean };
export type Race = {
  progress: number; speed: number; elapsed: number; lap: number; lapTime: number; steering: number; throttle: number; brakePressure: number;
  bestLap: number | null; lateral: number; lateralVelocity: number; drift: number;
  nos: number; last: number; lapInvalid: boolean; offTrack: number;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const newRace = (): Race => ({ progress: 0, speed: 0, elapsed: 0, lap: 1, lapTime: 0, steering: 0, throttle: 0, brakePressure: 0, bestLap: null, lateral: 0, lateralVelocity: 0, drift: 0, nos: 100, last: 0, lapInvalid: false, offTrack: 0 });
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
  const wheelStart = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(3);
  const [speed, setSpeed] = useState(0);
  const [lapTime, setLapTime] = useState(0);
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [lap, setLap] = useState(1);
  const [nos, setNos] = useState(100);
  const [boostActive, setBoostActive] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [engineer, setEngineer] = useState("Welcome to the circuit. Smooth inputs keep the car quick.");
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [businessName, setBusinessName] = useState("Vula's Car Wash");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  phaseRef.current = phase;

  const notify = useCallback((text: string, kind: "success" | "error" = "success") => {
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
    setSpeed(0); setLapTime(0); setBestLap(null); setLap(1); setNos(100); setBoostActive(false); setWheelRotation(0);
    setCountdown(3); phaseRef.current = start ? "countdown" : "ready"; setPhase(start ? "countdown" : "ready");
    setEngineer("Find your rhythm: brake before the tighter bends, then unwind the wheel on exit.");
  }, []);
  const startRace = useCallback(() => reset(true), [reset]);
  const pauseRace = useCallback(() => {
    if (phaseRef.current === "running") {
      controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
      setBoostActive(false); setWheelRotation(0); phaseRef.current = "paused"; setPhase("paused");
    } else if (phaseRef.current === "paused") {
      raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running");
    }
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(0); raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running");
        setEngineer("Go! Brake before the corner, turn smoothly, then accelerate out.");
      } else setCountdown(n => n - 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [phase, countdown]);



  useEffect(() => {
    let raf = 0;
    let previous = 0;
    let lastUi = 0;
    let lastCoachAt = 0;
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
        // Pedals have their own response curves so keyboard/touch inputs do not make
        // engine torque jump between frames. Brake pressure builds more quickly than throttle.
        race.throttle += (throttleTarget - race.throttle) * (1 - Math.exp(-dt * (throttleTarget ? 3.8 : 6.5)));
        race.brakePressure += (brakeTarget - race.brakePressure) * (1 - Math.exp(-dt * (brakeTarget ? 11 : 7)));
        const boost = controls.boost && race.nos > 0 && !controls.brake;
        const acceleration = 112 * race.throttle;
        const braking = 205 * race.brakePressure;
        race.speed = clamp(race.speed + (acceleration - race.speed * 0.145 - braking + (boost ? 76 : 0)) * dt, 0, boost ? 250 : 205);
        race.nos = boost ? Math.max(0, race.nos - 25 * dt) : Math.min(100, race.nos + (controls.accelerate ? 4 : 9) * dt);
        const grip = 0.94 - speedRatio * 0.22 - bend * speedRatio * 0.12 - race.brakePressure * 0.08;
        const steeringForce = steering * (0.68 + speedRatio * 0.22);
        const cornerForce = trackTurn * speedRatio * 2.5;
        race.lateralVelocity += (steeringForce - cornerForce - race.lateralVelocity * (2.15 + speedRatio * 0.45)) * dt;
        race.lateral = clamp(race.lateral + race.lateralVelocity * dt * (0.62 + speedRatio * 0.55), -0.95, 0.95);
        const demand = Math.abs(steering) * speedRatio * (0.62 + bend * 0.55) + race.brakePressure * 0.12 + race.throttle * speedRatio * 0.1;
        const excess = Math.max(0, demand - grip);
        race.drift = clamp(excess * Math.sign(steering || trackTurn) * 1.65 + race.lateralVelocity * 0.28, -1, 1);
        if (excess > 0) race.speed = Math.max(0, race.speed - excess * (24 + race.speed * 0.065) * dt);
        if (bend > 0.42 && speedRatio > 0.62 && !controls.brake) race.lateralVelocity += Math.sign(trackTurn) * bend * speedRatio * 0.22 * dt;
        if (Math.abs(race.lateral) > 0.7) {
          race.speed = Math.max(0, race.speed - 38 * dt);
          race.lapInvalid = true;
        }
        race.progress += race.speed * dt / 4200;
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
          setEngineer("Lap complete. Pick one corner to improve on the next lap.");
        }
        if (now - lastCoachAt > 1700) {
          lastCoachAt = now;
          const currentCurve = bend;
          let message = "Good pace. Keep your inputs smooth.";
          if (upcomingBend > 0.62 && race.speed > 112 && !controls.brake) message = "BRAKE BOARD: brake now, before turn-in.";
          else if (currentCurve > 0.52 && race.speed > 155 && !controls.brake) message = "Late braking — ease off speed and turn smoothly toward the apex.";
          else if (upcomingBend > 0.48 && currentCurve < 0.24 && Math.abs(steering) > 0.38) message = "Early turn-in. Hold your line until the amber corner cue.";
          else if (currentCurve > 0.4 && controls.brake && race.speed >= 95 && race.speed < 150) message = "Good braking range. Bleed off pressure as you turn in.";
          else if (currentCurve > 0.4 && controls.brake && race.speed < 95) message = "Brake release: ease off as the car rotates toward the apex.";
          else if (currentCurve > 0.4 && Math.abs(steering) >= 0.12 && race.speed < 155) message = "Good turn-in. Clip the apex, then unwind the wheel on exit.";
          else if (currentCurve > 0.4 && Math.abs(steering) < 0.12) message = "Turn-in cue: steer progressively toward the apex.";
          else if (Math.abs(race.lateral) > 0.52) message = "Running wide. Ease off, unwind the wheel and recover the line.";
          else if (Math.abs(race.drift) > 0.38) message = "Slip warning: grip is overloaded. Reduce steering or brake before adding power.";
          else if (boost && currentCurve < 0.3) message = "Good NOS timing. Keep it for the straight and release before braking.";
          else if (currentCurve < 0.28 && race.speed > 100) message = "Clear exit. Unwind the wheel, build throttle and save NOS for the straight.";
          setEngineer(message);
        }
        if (now - lastUi > 33) {
          lastUi = now;
          setSpeed(race.speed);
          setLapTime(race.lapTime);
          setNos(race.nos);
          setBoostActive(boost);
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
    const release = () => { controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false }; setBoostActive(false); setWheelRotation(0); wheelStart.current = null; };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", release);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", release); };
  }, [pauseRace, embedded, expanded]);

  const wheelAngle = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const onWheelDown = (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); wheelStart.current = wheelAngle(e); };
  const onWheelMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (wheelStart.current === null) return;
    e.preventDefault();
    let d = wheelAngle(e) - wheelStart.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const steer = clamp(d / 1.55, -1, 1);
    controlsRef.current.steer = steer; setWheelRotation(steer * 125);
  };
  const onWheelUp = () => { wheelStart.current = null; controlsRef.current.steer = 0; setWheelRotation(0); };
  const hold = (key: "accelerate" | "brake" | "boost", down: boolean) => {
    controlsRef.current[key] = down;
    if (key === "boost") setBoostActive(down && nos > 0);
  };

  if (embedded && !expanded) return <div className="race-inline-promo"><div><p className="vula-eyebrow">VULA RACING · QUICK BREAK</p><h2>Take a quick lap.</h2><p>A little circuit practice while you wait. Your wash booking stays right where you left it.</p></div><button type="button" className="vula-button primary" onClick={() => setExpanded(true)}>Play now ↗</button></div>;

  return <div className={"vula race-hub" + (embedded ? " race-hub-embedded" : "")}>
    {!embedded && <><div className="vula-status"><span className="status-dot online" />Vula Racing · solo circuit practice</div><header className="vula-nav"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Racing warm-up</small></span></Link><nav><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></nav></header><section className="vula-section warmup-intro"><p className="vula-eyebrow">VULA RACING · SOLO PRACTICE</p><h1>Find your racing line.</h1><p>Follow the recommended line: brake before turn-in, ease off through the apex, then build throttle on exit. Save NOS for straights.</p></section></>}
    {embedded && <div className="race-inline-heading"><div><p className="vula-eyebrow">VULA RACING · CIRCUIT PRACTICE</p><h2>Find your racing line.</h2><p>One more lap? Smooth corners, clean exits, well-timed NOS.</p></div><button type="button" className="vula-button secondary" onClick={() => { if (phaseRef.current === "running") pauseRace(); setExpanded(false); }}>Close game ×</button></div>}
    <section className="vula-section warmup-game">
      <div className="warmup-hud warmup-circuit-hud"><div><span>Speed</span><strong>{Math.round(speed)} <small>km/h</small></strong></div><div><span>Lap</span><strong>{lap}</strong></div><div><span>Current lap</span><strong>{fmt(lapTime)}</strong></div><div><span>Best lap</span><strong>{fmt(bestLap)}</strong></div></div>
      <div className="warmup-canvas-wrap warmup-circuit-wrap">
        <Racing3DScene raceRef={raceRef} controlsRef={controlsRef} phaseRef={phaseRef} />
        <div className="warmup-3d-overlay" hidden={phase === "running"} aria-live="polite">
          <span>VULA RACING · CIRCUIT PRACTICE</span>
          <strong>{phase === "ready" ? "Find your racing line" : phase === "countdown" ? String(countdown || 1) : phase === "paused" ? "Paused" : "Nice driving!"}</strong>
          <p>{phase === "ready" ? "Follow the green line. Brake at the boards, turn in on cue, clip the apex and unwind onto the exit." : phase === "countdown" ? "Get set. Smooth steering beats sudden corrections." : phase === "paused" ? "Take a breath. Resume when you're ready." : "Session complete. Take another lap and beat your time."}</p>
        </div>
      </div>
      <div className="warmup-line-legend" aria-label="Racing line guide"><span><i className="line-green" />Green · build speed</span><span><i className="line-amber" />Amber · prepare / lift</span><span><i className="line-red" />Red · brake</span></div>
      <div className="warmup-engineer" aria-live="polite"><span className="engineer-light" /> <div><strong>RACE ENGINEER</strong><p>{engineer}</p></div></div>
      <div className="warmup-nos"><div><strong>NOS</strong><span>{Math.round(nos)}%</span></div><div className="nos-track"><span style={{ width: nos + "%" }} /></div></div>
      <div className="warmup-controls warmup-circuit-controls">
        <div className="warmup-steering"><button type="button" className="warmup-wheel" aria-label="Drag to steer" disabled={phase !== "running"} style={{ transform: `rotate(${wheelRotation}deg)` }} onPointerDown={onWheelDown} onPointerMove={onWheelMove} onPointerUp={onWheelUp} onPointerCancel={onWheelUp}><span className="wheel-ring"><span className="wheel-spoke vertical"/><span className="wheel-spoke horizontal"/><span className="wheel-hub"/></span><span className="wheel-caption">STEER</span></button><span className="steering-caption">Drag left / right</span></div>
        <div className="warmup-driving">
          <button type="button" aria-label="Accelerate" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("accelerate", true); }} onPointerUp={() => hold("accelerate", false)} onPointerLeave={() => hold("accelerate", false)} onPointerCancel={() => hold("accelerate", false)} onLostPointerCapture={() => hold("accelerate", false)}>ACCELERATE ↑</button>
          <button type="button" aria-label="Brake" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("brake", true); }} onPointerUp={() => hold("brake", false)} onPointerLeave={() => hold("brake", false)} onPointerCancel={() => hold("brake", false)} onLostPointerCapture={() => hold("brake", false)}>BRAKE ↓</button>
          <button type="button" className="nos-button" aria-label="Hold for NOS" aria-pressed={boostActive} disabled={phase !== "running" || nos <= 0} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("boost", true); }} onPointerUp={() => hold("boost", false)} onPointerLeave={() => hold("boost", false)} onPointerCancel={() => hold("boost", false)} onLostPointerCapture={() => hold("boost", false)}>NOS ⚡</button>
        </div>
        <div className="warmup-actions">{phase === "ready" ? <button type="button" className="vula-button primary" onClick={startRace}>Start driving ↗</button> : phase === "countdown" ? <button type="button" className="vula-button primary" disabled>Ready {countdown || 1}…</button> : phase === "running" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Pause Ⅱ</button> : phase === "paused" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Resume ▶</button> : <button type="button" className="vula-button primary" onClick={startRace}>Drive again ↻</button>}<button type="button" className="vula-button secondary" onClick={() => reset(false)}>Restart ↻</button></div>
      </div>
      <p className="warmup-help">Phone: drag the wheel; hold accelerate, brake or NOS. Desktop: ← / → or A / D to steer, ↑ / W accelerate, ↓ / S brake, Space / Shift NOS, P pause.</p>
      {toast && <p className={"warmup-feedback " + toast.kind} role="status">{toast.text}</p>}
    </section>
    {!embedded && <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></Link><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></footer>}
  </div>;
}
