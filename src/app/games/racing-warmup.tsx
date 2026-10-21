"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./racing-warmup.css";
import { subscribeSettings } from "@/lib/firebase/vula-data";

type Phase = "ready" | "countdown" | "running" | "paused" | "finished";
type Point = { x: number; y: number };
type Controls = { steer: number; accelerate: boolean; brake: boolean; boost: boolean };
type Race = {
  progress: number; speed: number; elapsed: number; lap: number; lapTime: number;
  bestLap: number | null; lateral: number; lateralVelocity: number; drift: number;
  nos: number; last: number; lapInvalid: boolean; offTrack: number;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const trackLength = 1;
const newRace = (): Race => ({ progress: 0, speed: 0, elapsed: 0, lap: 1, lapTime: 0, bestLap: null, lateral: 0, lateralVelocity: 0, drift: 0, nos: 100, last: 0, lapInvalid: false, offTrack: 0 });

function centerline(t: number): Point {
  const a = t * Math.PI * 2;
  return {
    x: 0.5 + 0.365 * Math.cos(a) + 0.035 * Math.cos(3 * a + 0.3),
    y: 0.5 + 0.405 * Math.sin(a) + 0.025 * Math.sin(2 * a + 0.4),
  };
}
function trackPoint(t: number, width: number, height: number): Point {
  const p = centerline(wrap(t, trackLength));
  return { x: p.x * width, y: p.y * height };
}
function tangentAt(t: number, width: number, height: number): Point {
  const a = trackPoint(t - 0.001, width, height), b = trackPoint(t + 0.001, width, height);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
function curvatureAt(t: number): number {
  const a = tangentAt(t - 0.006, 1, 1), b = tangentAt(t + 0.006, 1, 1);
  return Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) / 0.012;
}
function fmt(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
}

export default function RacingWarmup({ embedded = false }: { embedded?: boolean }) {
  const [expanded, setExpanded] = useState(!embedded);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raceRef = useRef<Race>(newRace());
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
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0, w = 0, h = 0, dpr = 1, engineerCooldown = 0, lastCoach = "";
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(300, rect.width); h = Math.max(360, rect.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const drawCar = (x: number, y: number, angle: number, drift: number, boosting: boolean) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle + drift * 0.24);
      if (boosting) {
        const flame = 10 + Math.sin(performance.now() / 35) * 4;
        ctx.fillStyle = "#70eaff"; ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(0, 12 + flame); ctx.lineTo(7, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#d9ff76"; ctx.beginPath(); ctx.moveTo(-3, 12); ctx.lineTo(0, 12 + flame * .65); ctx.lineTo(3, 12); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#101a18"; ctx.fillRect(-9, -7, 4, 9); ctx.fillRect(5, -7, 4, 9); ctx.fillRect(-9, 4, 4, 8); ctx.fillRect(5, 4, 4, 8);
      ctx.fillStyle = "#b7ef4c"; ctx.beginPath(); ctx.roundRect(-7, -13, 14, 28, 5); ctx.fill();
      ctx.fillStyle = "#d8f0ef"; ctx.beginPath(); ctx.roundRect(-4.5, -7, 9, 8, 2); ctx.fill();
      ctx.fillStyle = "#ff6e64"; ctx.fillRect(-5, 10, 3, 2); ctx.fillRect(2, 10, 3, 2);
      ctx.restore();
    };
    const draw = (now: number) => {
      const race = raceRef.current, phaseNow = phaseRef.current;
      const dt = race.last ? Math.min((now - race.last) / 1000, 0.035) : 0;
      race.last = now;
      if (phaseNow === "running" && dt > 0) {
        const c = controlsRef.current, bend = curvatureAt(race.progress);
        const braking = c.brake ? 120 : 0;
        const boost = c.boost && race.nos > 0 && !c.brake;
        const targetAccel = c.accelerate ? 82 : 0;
        race.speed += (targetAccel - race.speed * 0.22 - braking + (boost ? 55 : 0)) * dt;
        race.speed = clamp(race.speed, 0, boost ? 250 : 205);
        if (boost) race.nos = Math.max(0, race.nos - 24 * dt);
        else race.nos = Math.min(100, race.nos + (c.accelerate ? 4.5 : 10) * dt);
        const speedFactor = 0.35 + race.speed / 130;
        const gripLimit = 0.56 / (0.55 + bend * 0.55);
        const turn = c.steer * speedFactor;
        race.lateralVelocity += (turn * 0.9 - race.lateralVelocity * (0.9 + (race.speed / 100) * 0.65)) * dt;
        race.lateral += race.lateralVelocity * dt * (race.speed / 90);
        const gripDemand = Math.abs(turn) * (race.speed / 150) * (0.5 + bend);
        race.drift = clamp((gripDemand - gripLimit) * Math.sign(turn) * 1.6, -0.8, 0.8);
        if (Math.abs(race.drift) > 0.12) race.speed = Math.max(0, race.speed - Math.abs(race.drift) * 9 * dt);
        race.progress += race.speed * dt / 1250;
        race.elapsed += dt; race.lapTime += dt;
        const t = wrap(race.progress, 1);
        const coachKey = t < .04 || t > .96 ? "start" : Math.floor(t * 18);
        if (engineerCooldown <= 0 && String(coachKey) !== lastCoach) {
          const curve = curvatureAt(t);
          let line = "Good pace. Keep your inputs smooth.";
          if (curve > 1.7) line = c.brake ? "Nice control. Start feeding in steering as you release the brake." : "Tighter corner ahead — lift and brake before you turn.";
          else if (curve > 1.05) line = "Medium bend ahead. Set the car early, then ease back onto power.";
          else if (Math.abs(race.lateral) > 0.24) line = "You're wide. Ease off, let the car settle, then guide it back.";
          else if (boost && curve < 0.8) line = "Good NOS timing — use the clear straight to build speed.";
          else if (curve < 0.65 && race.speed > 100) line = "Clear straight. Build speed now; save some NOS for the next exit.";
          else if (Math.abs(race.drift) > 0.22) line = "Grip is fading. Ease the steering slightly to catch the slide.";
          setEngineer(line); lastCoach = String(coachKey); engineerCooldown = 2.6;
        }
        engineerCooldown = Math.max(0, engineerCooldown - dt);
        if (Math.abs(race.lateral) > 0.46) {
          race.offTrack += dt; race.lapInvalid = true; race.speed = Math.max(35, race.speed - 48 * dt);
          if (race.offTrack > 0.55) { race.lateral *= 0.985; race.lateralVelocity *= -0.25; }
        } else race.offTrack = Math.max(0, race.offTrack - dt * 2);
        const oldLap = Math.floor((race.progress - race.speed * dt / 1250));
        const newLap = Math.floor(race.progress);
        if (newLap > oldLap) {
          const valid = !race.lapInvalid;
          if (valid && (race.bestLap === null || race.lapTime < race.bestLap)) {
            race.bestLap = race.lapTime; setBestLap(race.lapTime); notify("New personal best lap!", "success");
          } else if (!valid) notify("Lap invalid — keep all four wheels on track.", "error");
          race.lap += 1; race.lapTime = 0; race.lapInvalid = false; setLap(race.lap);
          setEngineer(valid ? "Lap complete. Pick one corner to improve on the next lap." : "Lap reset. Stay inside the white line for a valid time.");
        }
        setSpeed(race.speed); setLapTime(race.lapTime); setNos(race.nos); setBoostActive(boost);
      }
      // Cockpit-follow perspective: pseudo-3D road, layered scenery and a low, detailed F1 car.
      ctx.clearRect(0, 0, w, h);
      const horizon = h * 0.285;
      const carBaseY = h * 0.82;
      const currentT = wrap(race.progress, 1);
      const currentCenter = centerline(currentT).x;
      const bendAt = (t: number) => {
        const before = centerline(t - 0.008), after = centerline(t + 0.008);
        return clamp((after.x - before.x) * 12, -1.25, 1.25);
      };
      const sky = ctx.createLinearGradient(0, 0, 0, horizon + 35);
      sky.addColorStop(0, "#152d43"); sky.addColorStop(0.58, "#477b91"); sky.addColorStop(1, "#d7c49a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // Distant hills and a low sun add depth without heavyweight image assets.
      ctx.fillStyle = "#6f8b77"; ctx.beginPath(); ctx.moveTo(0, horizon + 20);
      for (let x = 0; x <= w + 12; x += 12) ctx.lineTo(x, horizon + 8 + Math.sin(x * 0.012) * h * 0.025 + Math.sin(x * 0.027) * h * 0.012);
      ctx.lineTo(w, horizon + 75); ctx.lineTo(0, horizon + 75); ctx.closePath(); ctx.fill();
      const sunX = w * 0.77, sunY = horizon * 0.42;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, Math.min(w, h) * 0.12);
      sunGlow.addColorStop(0, "#ffe7ad88"); sunGlow.addColorStop(1, "#ffe7ad00");
      ctx.fillStyle = sunGlow; ctx.fillRect(sunX - h * .15, sunY - h * .15, h * .3, h * .3);
      ctx.fillStyle = "#c2a66f"; ctx.fillRect(0, horizon + 30, w, h - horizon - 30);
      const rows = Math.max(36, Math.ceil((h - horizon) / 5));
      const roadAt = (depth: number) => {
        const t = wrap(currentT + depth * 0.2, 1);
        const p = centerline(t);
        const curveShift = clamp((p.x - currentCenter) * w * 1.65, -w * .43, w * .43);
        const center = w * .5 + curveShift * (0.2 + depth * 0.95);
        const roadWidth = w * (0.075 + depth * 0.74);
        return { center, roadWidth, t, bend: bendAt(t) };
      };
      // Roadside stands, safety barriers and lamps shrink into the horizon.
      for (let i = 0; i < 14; i++) {
        const depth = (i + 1) / 15;
        const y = horizon + depth * depth * (h - horizon);
        const road = roadAt(depth);
        const scale = 0.12 + depth * 1.1;
        const side = i % 2 ? -1 : 1;
        const x = road.center + side * (road.roadWidth * .66 + 18 * scale);
        ctx.fillStyle = i % 3 === 0 ? "#d8e0d9" : "#7d8c8a";
        ctx.fillRect(x - 2 * scale, y - 30 * scale, 4 * scale, 30 * scale);
        ctx.fillStyle = "#f3c15e"; ctx.fillRect(x - 5 * scale, y - 32 * scale, 10 * scale, 3 * scale);
        if (i < 9) {
          ctx.fillStyle = i % 2 ? "#233b3a" : "#e8e6d8";
          ctx.fillRect(road.center + side * (road.roadWidth * .72 + 10 * scale), y - 11 * scale, 19 * scale, 11 * scale);
        }
      }
      // Draw back-to-front asphalt bands. The alternating shoulders create a strong speed cue.
      for (let i = 0; i < rows; i++) {
        const d1 = i / rows, d2 = (i + 1) / rows;
        const y1 = horizon + d1 * d1 * (h - horizon), y2 = horizon + d2 * d2 * (h - horizon);
        const a = roadAt(d1), b = roadAt(d2);
        const stripe = Math.floor((race.progress * 190 + d1 * 100) / 1.8) % 2;
        ctx.fillStyle = stripe ? "#e9e6d8" : "#d54d43";
        ctx.beginPath(); ctx.moveTo(a.center - a.roadWidth * .56, y1); ctx.lineTo(a.center + a.roadWidth * .56, y1);
        ctx.lineTo(b.center + b.roadWidth * .56, y2); ctx.lineTo(b.center - b.roadWidth * .56, y2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = stripe ? "#28353b" : "#303d43";
        ctx.beginPath(); ctx.moveTo(a.center - a.roadWidth * .5, y1); ctx.lineTo(a.center + a.roadWidth * .5, y1);
        ctx.lineTo(b.center + b.roadWidth * .5, y2); ctx.lineTo(b.center - b.roadWidth * .5, y2); ctx.closePath(); ctx.fill();
        // Asphalt sheen and racing-line dashes.
        ctx.fillStyle = "#53606855";
        ctx.beginPath(); ctx.moveTo(a.center - a.roadWidth * .12, y1); ctx.lineTo(a.center + a.roadWidth * .12, y1);
        ctx.lineTo(b.center + b.roadWidth * .12, y2); ctx.lineTo(b.center - b.roadWidth * .12, y2); ctx.closePath(); ctx.fill();
        const dashPhase = (race.progress * 52 + d1 * 22) % 1;
        if (dashPhase < .45) {
          ctx.fillStyle = "#e7e8df";
          const laneW1 = Math.max(1, a.roadWidth * .006), laneW2 = Math.max(1, b.roadWidth * .006);
          for (const lane of [-1 / 3, 1 / 3]) {
            ctx.beginPath(); ctx.moveTo(a.center + a.roadWidth * lane - laneW1, y1); ctx.lineTo(a.center + a.roadWidth * lane + laneW1, y1);
            ctx.lineTo(b.center + b.roadWidth * lane + laneW2, y2); ctx.lineTo(b.center + b.roadWidth * lane - laneW2, y2); ctx.closePath(); ctx.fill();
          }
        }
      }
      // Moving trackside posts give a sense of velocity and perspective.
      for (let i = 0; i < 18; i++) {
        const depth = ((i / 18 + race.progress * 0.7) % 1);
        if (depth < .08) continue;
        const y = horizon + depth * depth * (h - horizon);
        const road = roadAt(depth);
        const size = 2 + depth * 15;
        for (const side of [-1, 1]) {
          const x = road.center + side * (road.roadWidth * .58 + size * 1.4);
          ctx.fillStyle = "#e8e7dc"; ctx.fillRect(x - size * .14, y - size, size * .28, size);
          ctx.fillStyle = "#d94c42"; ctx.fillRect(x - size * .14, y - size, size * .28, size * .35);
        }
      }
      // Speed-responsive camera bob and lateral steering make the car feel planted in the scene.
      const bob = Math.sin(now * 0.018) * Math.min(2.5, race.speed / 70);
      const carX = w * .5 + race.lateral * w * .25 - roadAt(.98).bend * race.speed * .13;
      const carY = carBaseY + bob;
      ctx.save(); ctx.translate(carX, carY); ctx.rotate(clamp(race.drift * .15 + controlsRef.current.steer * .06, -.18, .18));
      if (boostActive) {
        const flame = 17 + Math.sin(now / 32) * 8;
        const flameGradient = ctx.createLinearGradient(0, 8, 0, 8 + flame);
        flameGradient.addColorStop(0, "#d9ff76"); flameGradient.addColorStop(.5, "#57eaff"); flameGradient.addColorStop(1, "#57eaff00");
        ctx.fillStyle = flameGradient; ctx.beginPath(); ctx.moveTo(-12, 9); ctx.lineTo(0, 9 + flame); ctx.lineTo(12, 9); ctx.closePath(); ctx.fill();
      }
      // Shadow and rear diffuser.
      ctx.fillStyle = "#101c2480"; ctx.beginPath(); ctx.ellipse(0, 11, w * .14, h * .026, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#171e25"; ctx.beginPath(); ctx.moveTo(-w*.12, 7); ctx.lineTo(-w*.1, -2); ctx.lineTo(-w*.075, -12); ctx.lineTo(w*.075, -12); ctx.lineTo(w*.1, -2); ctx.lineTo(w*.12, 7); ctx.closePath(); ctx.fill();
      // Wide front wing, sculpted sidepods and pointed nose.
      ctx.fillStyle = "#b7ef4c"; ctx.beginPath(); ctx.moveTo(-w*.16, 4); ctx.lineTo(-w*.12, -1); ctx.lineTo(-w*.065, -5); ctx.lineTo(-w*.035, -18); ctx.lineTo(0, -h*.17); ctx.lineTo(w*.035, -18); ctx.lineTo(w*.065, -5); ctx.lineTo(w*.12, -1); ctx.lineTo(w*.16, 4); ctx.lineTo(w*.145, 10); ctx.lineTo(w*.075, 7); ctx.lineTo(-w*.075, 7); ctx.lineTo(-w*.145, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e5ff9a"; ctx.beginPath(); ctx.moveTo(-w*.025, -17); ctx.lineTo(0, -h*.165); ctx.lineTo(w*.025, -17); ctx.lineTo(w*.04, 1); ctx.lineTo(-w*.04, 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#1b2b35"; ctx.beginPath(); ctx.ellipse(0, -13, w*.032, h*.025, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7f9aa6"; ctx.beginPath(); ctx.ellipse(0, -14, w*.02, h*.016, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111a20"; ctx.fillRect(-w*.115, -4, w*.038, h*.045); ctx.fillRect(w*.077, -4, w*.038, h*.045);
      ctx.fillRect(-w*.14, 4, w*.045, h*.025); ctx.fillRect(w*.095, 4, w*.045, h*.025);
      ctx.fillStyle = "#ff554a"; ctx.fillRect(-w*.085, 5, w*.035, 2); ctx.fillRect(w*.05, 5, w*.035, 2);
      ctx.fillStyle = "#d9e8ed"; ctx.fillRect(-w*.07, -1, w*.14, 1.5);
      ctx.restore();
      if (phaseNow !== "running") {
        ctx.fillStyle = "#172820a8"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#c6f36b"; ctx.font = "800 11px system-ui"; ctx.textAlign = "center";
        ctx.fillText(phaseNow === "ready" ? "VULA RACING · CIRCUIT PRACTICE" : phaseNow === "countdown" ? "GET READY" : phaseNow === "paused" ? "PAUSED" : "SESSION COMPLETE", w / 2, h / 2 - 14);
        ctx.fillStyle = "#fff"; ctx.font = "700 26px system-ui";
        ctx.fillText(phaseNow === "ready" ? "Find your racing line" : phaseNow === "countdown" ? String(countdown || 1) : phaseNow === "paused" ? "Take a breather" : "Nice driving!", w / 2, h / 2 + 20);
      }
      raf = window.requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === "running") {
        controlsRef.current = { steer: 0, accelerate: false, brake: false, boost: false };
        phaseRef.current = "paused"; setPhase("paused"); raceRef.current.last = 0; setBoostActive(false);
      }
    };
    resize(); window.addEventListener("resize", resize); document.addEventListener("visibilitychange", onVisibility);
    raf = window.requestAnimationFrame(draw);
    return () => { window.cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisibility); };
  }, [expanded, notify, countdown, boostActive]);

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
    {!embedded && <><div className="vula-status"><span className="status-dot online" />Vula Racing · solo circuit practice</div><header className="vula-nav"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Racing warm-up</small></span></Link><nav><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></nav></header><section className="vula-section warmup-intro"><p className="vula-eyebrow">VULA RACING · SOLO PRACTICE</p><h1>Find your racing line.</h1><p>A quick, repeatable circuit. Learn the corners, manage your grip, and spend NOS on the straights.</p></section></>}
    {embedded && <div className="race-inline-heading"><div><p className="vula-eyebrow">VULA RACING · CIRCUIT PRACTICE</p><h2>Find your racing line.</h2><p>One more lap? Smooth corners, clean exits, well-timed NOS.</p></div><button type="button" className="vula-button secondary" onClick={() => { if (phaseRef.current === "running") pauseRace(); setExpanded(false); }}>Close game ×</button></div>}
    <section className="vula-section warmup-game">
      <div className="warmup-hud warmup-circuit-hud"><div><span>Speed</span><strong>{Math.round(speed)} <small>km/h</small></strong></div><div><span>Lap</span><strong>{lap}</strong></div><div><span>Current lap</span><strong>{fmt(lapTime)}</strong></div><div><span>Best lap</span><strong>{fmt(bestLap)}</strong></div></div>
      <div className="warmup-canvas-wrap warmup-circuit-wrap"><canvas ref={canvasRef} aria-label="Top-down circuit racing game. Drag the steering wheel to steer, hold accelerate and brake, and use NOS on straights." role="img" /></div>
      <div className="warmup-engineer" aria-live="polite"><span className="engineer-light" /> <div><strong>RACE ENGINEER</strong><p>{engineer}</p></div></div>
      <div className="warmup-nos"><div><strong>NOS</strong><span>{Math.round(nos)}%</span></div><div className="nos-track"><span style={{ width: nos + "%" }} /></div></div>
      <div className="warmup-controls warmup-circuit-controls">
        <div className="warmup-steering"><button type="button" className="warmup-wheel" aria-label="Drag to steer" disabled={phase !== "running"} style={{ transform: `rotate(${wheelRotation}deg)` }} onPointerDown={onWheelDown} onPointerMove={onWheelMove} onPointerUp={onWheelUp} onPointerCancel={onWheelUp} onLostPointerCapture={onWheelUp}><span className="wheel-ring"><span className="wheel-spoke vertical"/><span className="wheel-spoke horizontal"/><span className="wheel-hub"/></span><span className="wheel-caption">STEER</span></button><span className="steering-caption">Drag left / right</span></div>
        <div className="warmup-driving">
          <button type="button" aria-label="Accelerate" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("accelerate", true); }} onPointerUp={() => hold("accelerate", false)} onPointerLeave={() => hold("accelerate", false)} onPointerCancel={() => hold("accelerate", false)}>ACCELERATE ↑</button>
          <button type="button" aria-label="Brake" disabled={phase !== "running"} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("brake", true); }} onPointerUp={() => hold("brake", false)} onPointerLeave={() => hold("brake", false)} onPointerCancel={() => hold("brake", false)}>BRAKE ↓</button>
          <button type="button" className="nos-button" aria-label="Hold for NOS" aria-pressed={boostActive} disabled={phase !== "running" || nos <= 0} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold("boost", true); }} onPointerUp={() => hold("boost", false)} onPointerLeave={() => hold("boost", false)} onPointerCancel={() => hold("boost", false)}>NOS ⚡</button>
        </div>
        <div className="warmup-actions">{phase === "ready" ? <button type="button" className="vula-button primary" onClick={startRace}>Start driving ↗</button> : phase === "countdown" ? <button type="button" className="vula-button primary" disabled>Ready {countdown || 1}…</button> : phase === "running" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Pause Ⅱ</button> : phase === "paused" ? <button type="button" className="vula-button primary" onClick={pauseRace}>Resume ▶</button> : <button type="button" className="vula-button primary" onClick={startRace}>Drive again ↻</button>}<button type="button" className="vula-button secondary" onClick={() => reset(false)}>Restart ↻</button></div>
      </div>
      <p className="warmup-help">Phone: drag the wheel; hold accelerate, brake or NOS. Desktop: ← / → or A / D to steer, ↑ / W accelerate, ↓ / S brake, Space / Shift NOS, P pause.</p>
      {toast && <p className={"warmup-feedback " + toast.kind} role="status">{toast.text}</p>}
    </section>
    {!embedded && <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></Link><Link href="/#request">Book a wash</Link><Link href="/#my-wash">My Wash</Link></footer>}
  </div>;
}
