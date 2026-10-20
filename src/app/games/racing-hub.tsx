"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "./racing.css";

type Phase = "ready" | "running" | "paused" | "finished";
type TrafficCar = { lane: number; y: number; color: string; hit: boolean };
type RaceState = { lane: number; distance: number; elapsed: number; speed: number; traffic: TrafficCar[]; spawn: number; stripeOffset: number; hits: number; last: number };

const newRace = (): RaceState => ({ lane: 1, distance: 0, elapsed: 0, speed: 105, traffic: [], spawn: 0.6, stripeOffset: 0, hits: 0, last: 0 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finishDistance = 500;

export default function RacingHub() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raceRef = useRef<RaceState>(newRace());
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(105);
  const [hits, setHits] = useState(0);
  const [lane, setLane] = useState(1);
  phaseRef.current = phase;

  function moveLane(direction: number) {
    const next = clamp(raceRef.current.lane + direction, 0, 2);
    raceRef.current.lane = next;
    setLane(next);
  }
  function startRace() {
    if (phaseRef.current === "finished") { raceRef.current = newRace(); setElapsed(0); setDistance(0); setSpeed(105); setHits(0); setLane(1); }
    raceRef.current.last = 0;
    phaseRef.current = "running";
    setPhase("running");
  }
  function pauseRace() {
    if (phaseRef.current === "running") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { raceRef.current.last = 0; phaseRef.current = "running"; setPhase("running"); }
  }
  function restartRace() {
    raceRef.current = newRace(); setElapsed(0); setDistance(0); setSpeed(105); setHits(0); setLane(1);
    phaseRef.current = "running"; setPhase("running");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0; let width = 0; let height = 0; let dpr = 1; let finished = false;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(320, rect.width); height = Math.max(360, rect.height);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const drawCar = (x: number, y: number, color: string, label = "") => {
      const carWidth = Math.min(40, width * .09); const carHeight = carWidth * 1.65;
      context.fillStyle = "rgba(0,0,0,.22)"; context.beginPath(); context.ellipse(x + carWidth / 2, y + carHeight - 2, carWidth * .58, 6, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#151b18"; context.fillRect(x - 3, y + 8, 5, 12); context.fillRect(x + carWidth - 2, y + 8, 5, 12); context.fillRect(x - 3, y + carHeight - 20, 5, 12); context.fillRect(x + carWidth - 2, y + carHeight - 20, 5, 12);
      context.fillStyle = color; context.beginPath(); context.roundRect(x, y, carWidth, carHeight, 8); context.fill();
      context.fillStyle = "#dce9e7"; context.beginPath(); context.roundRect(x + carWidth * .19, y + carHeight * .19, carWidth * .62, carHeight * .25, 4); context.fill();
      context.fillStyle = "#fff4bd"; context.fillRect(x + 5, y + 3, 5, 3); context.fillRect(x + carWidth - 10, y + 3, 5, 3);
      context.fillStyle = "#ff7166"; context.fillRect(x + 5, y + carHeight - 5, 5, 3); context.fillRect(x + carWidth - 10, y + carHeight - 5, 5, 3);
      if (label) { context.fillStyle = "#ffffff"; context.font = "bold 8px system-ui"; context.textAlign = "center"; context.fillText(label, x + carWidth / 2, y + carHeight * .65); }
    };
    const draw = (now: number) => {
      const race = raceRef.current; const currentPhase = phaseRef.current;
      const dt = race.last ? Math.min((now - race.last) / 1000, .04) : 0; race.last = now;
      if (currentPhase === "running" && !finished) {
        race.elapsed += dt; race.speed = Math.min(155, race.speed + dt * 1.6); race.distance += race.speed * dt / 8; race.stripeOffset = (race.stripeOffset + race.speed * dt * 1.3) % 72; race.spawn -= dt;
        if (race.spawn <= 0) { race.traffic.push({ lane: Math.floor(Math.random() * 3), y: -72, color: ["#e5a34b", "#c85b4c", "#6586a8"][Math.floor(Math.random() * 3)], hit: false }); race.spawn = .9 + Math.random() * .7; }
        const roadLeft = width * .15; const roadWidth = width * .7; const laneWidth = roadWidth / 3; const carWidth = Math.min(40, width * .09); const playerY = height - 100;
        for (const car of race.traffic) { car.y += race.speed * dt * 1.2; if (!car.hit && car.lane === race.lane && car.y + carWidth * 1.6 > playerY && car.y < playerY + carWidth * 1.6) { car.hit = true; race.hits += 1; race.speed = Math.max(65, race.speed - 22); } }
        race.traffic = race.traffic.filter(car => car.y < height + 80);
        if (race.distance >= finishDistance) { race.distance = finishDistance; finished = true; phaseRef.current = "finished"; setPhase("finished"); }
        setElapsed(race.elapsed); setDistance(race.distance); setSpeed(race.speed); setHits(race.hits);
      }
      context.clearRect(0, 0, width, height); context.fillStyle = "#8aa96e"; context.fillRect(0, 0, width, height); context.fillStyle = "#76965e";
      for (let y = -40; y < height + 40; y += 72) { const offset = currentPhase === "running" ? race.stripeOffset : 0; context.fillRect(width * .035, y + offset, width * .045, 26); context.fillRect(width * .92, y + offset, width * .045, 26); }
      const roadLeft = width * .15; const roadWidth = width * .7; context.fillStyle = "#3c4544"; context.fillRect(roadLeft, 0, roadWidth, height); context.fillStyle = "#f5f0d9"; context.fillRect(roadLeft, 0, 4, height); context.fillRect(roadLeft + roadWidth - 4, 0, 4, height);
      context.fillStyle = "#d4d5c6"; for (let laneIndex = 1; laneIndex < 3; laneIndex++) { const x = roadLeft + roadWidth * laneIndex / 3; for (let y = -72 + race.stripeOffset; y < height; y += 72) context.fillRect(x - 2, y, 4, 36); }
      for (const car of race.traffic) { const laneWidth = roadWidth / 3; const carWidth = Math.min(40, width * .09); drawCar(roadLeft + laneWidth * (car.lane + .5) - carWidth / 2, car.y, car.hit ? "#6d7774" : car.color); }
      const playerWidth = Math.min(40, width * .09); drawCar(roadLeft + roadWidth / 3 * (race.lane + .5) - playerWidth / 2, height - 100, "#a7d84d", "YOU");
      frame = window.requestAnimationFrame(draw);
    };
    resize(); window.addEventListener("resize", resize); frame = window.requestAnimationFrame(draw);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) event.preventDefault();
      if ((event.key === "ArrowLeft" || event.key.toLowerCase() === "a") && !event.repeat) moveLane(-1);
      if ((event.key === "ArrowRight" || event.key.toLowerCase() === "d") && !event.repeat) moveLane(1);
      if ((event.key.toLowerCase() === "p" || event.key === "Escape") && !event.repeat) pauseRace();
    };
    window.addEventListener("keydown", keyDown); return () => window.removeEventListener("keydown", keyDown);
  }, []);

  return <main className="vula race-hub">
    <div className="vula-status"><span className="status-dot online" />Vula Racing · 2D warm-up · local test only</div>
    <header className="vula-nav"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>Vula&apos;s Car Wash<small>Racing warm-up</small></span></Link><nav><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></nav></header>
    <section className="vula-section warmup-intro"><p className="vula-eyebrow">VULA RACING · MECHANICS TEST</p><h1>Take the warm-up lap.</h1><p>A simple top-down 2D driving test. Steer between lanes, avoid traffic, and finish 500 m. We can tune these mechanics before bringing them into the in-account racing experience.</p><p className="warmup-boundary">This prototype does not use accounts, credits, upgrades, bookings, loyalty or receipts. Your controls and race run only in this open page.</p></section>
    <section className="vula-section warmup-game">
      <div className="warmup-hud" aria-live="polite"><div><span>Distance</span><strong>{Math.round(distance)} <small>/ {finishDistance} m</small></strong></div><div><span>Speed</span><strong>{Math.round(speed)} <small>km/h</small></strong></div><div><span>Time</span><strong>{elapsed.toFixed(1)} <small>s</small></strong></div><div><span>Traffic bumps</span><strong>{hits}</strong></div></div>
      <div className="warmup-canvas-wrap"><canvas ref={canvasRef} aria-label="Top-down 2D road racing warm-up. Use left and right arrows or the controls below to steer." role="img" />
        {phase !== "running" && <div className="warmup-overlay"><span>{phase === "ready" ? "READY ON THE GRID" : phase === "paused" ? "RACE PAUSED" : "FINISH LINE"}</span><strong>{phase === "ready" ? "Start when you are." : phase === "paused" ? "Take your time." : "Warm-up complete."}</strong><p>{phase === "ready" ? "Use ← / → or A / D to change lanes." : phase === "paused" ? "Your timer and traffic are stopped." : "You finished in " + elapsed.toFixed(1) + " seconds with " + hits + " traffic bump" + (hits === 1 ? "" : "s") + "."}</p></div>}
      </div>
      <div className="warmup-controls"><div className="warmup-steering"><button type="button" aria-label="Steer left" onClick={() => moveLane(-1)} disabled={phase === "finished"}>← Left</button><button type="button" aria-label="Steer right" onClick={() => moveLane(1)} disabled={phase === "finished"}>Right →</button></div><div className="warmup-actions">{phase === "ready" ? <button type="button" className="vula-button primary" onClick={startRace}>Start race ↗</button> : phase === "running" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Pause race Ⅱ</button> : phase === "paused" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Resume race ▶</button> : <button type="button" className="vula-button primary" onClick={startRace}>Run again ↗</button>}<button type="button" className="vula-button secondary" onClick={restartRace}>Restart race ↻</button></div></div>
      <p className="warmup-help">Keyboard: ← / → or A / D to steer · P or Esc to pause. Touch: tap the steering controls. Collisions slow the car; they do not end the test.</p>
    </section>
    <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>Vula&apos;s Car Wash<small>Wash. Care. Go.</small></span></Link><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></footer>
  </main>;
}