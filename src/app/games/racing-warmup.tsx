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
function signedRoadCurveAt(t: number): number {
  const a = centerline(t - 0.008), b = centerline(t), c = centerline(t + 0.008);
  return clamp((c.x - 2 * b.x + a.x) * 2400, -1.4, 1.4);
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
        // Steering is lateral acceleration, not an automatic rail: speed and corner load
        // determine how much grip remains, while the curve gently pulls the car outward.
        const speedRatio = race.speed / 205;
        const curveLoad = clamp(bend / 2.25, 0, 1);
        const speedFactor = 0.42 + speedRatio * 1.2;
        const gripLimit = 0.82 - speedRatio * 0.2 - curveLoad * speedRatio * 0.28;
        const turn = c.steer * speedFactor;
        const cornerForce = signedRoadCurveAt(race.progress + .008) * curveLoad * speedRatio * .42;
        race.lateralVelocity += (turn * 1.35 - cornerForce - race.lateralVelocity * (1.05 + speedRatio * .8)) * dt;
        race.lateral += race.lateralVelocity * dt * (0.45 + speedRatio * 1.15);
        const gripDemand = Math.abs(turn) * speedRatio * (0.38 + curveLoad * 1.15);
        const excessGrip = Math.max(0, gripDemand - gripLimit);
        race.drift = clamp(excessGrip * Math.sign(turn) * 2.15, -0.95, 0.95);
        if (excessGrip > 0) {
          race.lateral += Math.sign(turn) * excessGrip * dt * .24;
          race.speed = Math.max(0, race.speed - excessGrip * (14 + race.speed * .06) * dt);
        }
        // A tidy racing line preserves speed; running wide costs grip and momentum.
        if (Math.abs(race.lateral) > .28 && Math.abs(race.lateral) <= .46) {
          race.speed = Math.max(0, race.speed - (Math.abs(race.lateral) - .28) * 7 * dt);
        }
        race.progress += race.speed * dt / 4200;
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
        const oldLap = Math.floor((race.progress - race.speed * dt / 4200));
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
      // Low chase camera, rendered as a layered pseudo-3D arcade road.
      ctx.clearRect(0, 0, w, h);
      const horizon = h * 0.29;
      const carBaseY = h * 0.835;
      const currentT = wrap(race.progress, 1);
      const currentCenter = centerline(currentT).x;
      const curveAt = (t: number) => {
        const p0 = centerline(t - .008), p1 = centerline(t), p2 = centerline(t + .008);
        const dx = p2.x - p0.x;
        const ddx = p2.x - 2 * p1.x + p0.x;
        return clamp(ddx * 150 - dx * 1.5, -1.5, 1.5);
      };
      const sky = ctx.createLinearGradient(0, 0, 0, horizon + 65);
      sky.addColorStop(0, "#0e2033"); sky.addColorStop(.42, "#31556c"); sky.addColorStop(.78, "#8da4a0"); sky.addColorStop(1, "#e4cda3");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // Soft sun, mountain silhouettes and layered hills.
      const sunX = w * .78, sunY = horizon * .37, sunR = Math.min(w, h) * .105;
      const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, sunR);
      glow.addColorStop(0, "#fff0c5a8"); glow.addColorStop(.35, "#ffdca455"); glow.addColorStop(1, "#ffdca400");
      ctx.fillStyle = glow; ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
      ctx.fillStyle = "#415f61"; ctx.beginPath(); ctx.moveTo(0, horizon + 38);
      for (let x = 0; x <= w + 8; x += 8) {
        const peak = Math.sin(x * .009 + .8) * 13 + Math.sin(x * .021) * 6 + Math.cos(x * .004) * 18;
        ctx.lineTo(x, horizon + 13 + peak);
      }
      ctx.lineTo(w, horizon + 95); ctx.lineTo(0, horizon + 95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#728b6d"; ctx.beginPath(); ctx.moveTo(0, horizon + 58);
      for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, horizon + 43 + Math.sin(x * .015 + 1.4) * 13 + Math.cos(x * .031) * 5);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b4a078"; ctx.fillRect(0, horizon + 75, w, h - horizon - 75);
      const rows = Math.max(48, Math.ceil((h - horizon) / 3.5));
      const roadAt = (depth: number) => {
        // Integrate the bends ahead so every road edge, lane dash and barrier shares one projection.
        const ahead = depth * .23;
        const future = centerline(currentT + ahead);
        // Keep the projected bend inside the visible circuit; map coordinates are not screen-space offsets.
        const offset = clamp((future.x - currentCenter) * 1.15, -0.22, 0.22);
        const nearCurve = curveAt(currentT + ahead);
        const perspective = .22 + depth * 1.18;
        const center = w * .5 + offset * w * perspective - race.lateral * w * .18 * depth;
        const roadWidth = w * (.055 + depth * .79);
        return { center, roadWidth, t: wrap(currentT + ahead, 1), bend: nearCurve };
      };
      // Ground bands create parallax even on slower devices.
      for (let i = 0; i < rows; i++) {
        const d1 = i / rows, d2 = (i + 1) / rows;
        const y1 = horizon + d1 * d1 * (h - horizon), y2 = horizon + d2 * d2 * (h - horizon);
        ctx.fillStyle = Math.floor((race.progress * 240 + i) / 8) % 2 ? "#728b62" : "#7b9468";
        ctx.fillRect(0, y1, w, Math.max(1, y2 - y1 + 1));
      }
      // Roadside silhouettes: grandstands, fencing, marshal lights and boards, drawn from far to near.
      for (let i = 0; i < 22; i++) {
        const depth = (i + 1) / 23;
        const road = roadAt(depth);
        const y = horizon + depth * depth * (h - horizon);
        const scale = .12 + depth * 1.05;
        const side = i % 2 === 0 ? -1 : 1;
        const x = road.center + side * (road.roadWidth * .66 + 17 * scale);
        if (i % 4 === 1) {
          const sw = 29 * scale, sh = 17 * scale;
          ctx.fillStyle = "#25383a"; ctx.fillRect(x - sw / 2, y - sh, sw, sh);
          ctx.fillStyle = "#526766"; ctx.fillRect(x - sw / 2, y - sh, sw, sh * .25);
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = k % 2 ? "#e9dfc8" : "#d24a43";
            ctx.fillRect(x - sw / 2 + k * sw / 4, y - sh * .7, sw / 4 - 1, sh * .7);
          }
        } else if (i % 3 === 0) {
          // Stylised trees have a trunk and two overlapping foliage layers.
          ctx.fillStyle = "#514b3c"; ctx.fillRect(x - 2 * scale, y - 20 * scale, 4 * scale, 20 * scale);
          ctx.fillStyle = "#294b40"; ctx.beginPath(); ctx.moveTo(x, y - 43 * scale); ctx.lineTo(x - 13 * scale, y - 10 * scale); ctx.lineTo(x + 13 * scale, y - 10 * scale); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#3b6650"; ctx.beginPath(); ctx.moveTo(x, y - 32 * scale); ctx.lineTo(x - 11 * scale, y - 5 * scale); ctx.lineTo(x + 11 * scale, y - 5 * scale); ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = "#b8c4b9"; ctx.fillRect(x - 1.4 * scale, y - 29 * scale, 2.8 * scale, 29 * scale);
          ctx.fillStyle = "#f3c96d"; ctx.fillRect(x - 4.5 * scale, y - 31 * scale, 9 * scale, 3.4 * scale);
          ctx.fillStyle = "#3d5553"; ctx.fillRect(x - 8 * scale, y - 9 * scale, 16 * scale, 9 * scale);
        }
      }
      // Draw each road slice back-to-front: red/ivory kerbs, dark asphalt, shoulder and racing-line sheen.
      for (let i = 0; i < rows; i++) {
        const d1 = i / rows, d2 = (i + 1) / rows;
        const y1 = horizon + d1 * d1 * (h - horizon), y2 = horizon + d2 * d2 * (h - horizon);
        const a = roadAt(d1), b = roadAt(d2);
        const stripe = Math.floor((race.progress * 205 + d1 * 105) / 2) % 2;
        const poly = (leftA: number, rightA: number, leftB: number, rightB: number, fill: string) => {
          ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(leftA, y1); ctx.lineTo(rightA, y1); ctx.lineTo(rightB, y2); ctx.lineTo(leftB, y2); ctx.closePath(); ctx.fill();
        };
        poly(a.center - a.roadWidth * .59, a.center + a.roadWidth * .59, b.center - b.roadWidth * .59, b.center + b.roadWidth * .59, stripe ? "#f0eadb" : "#d44a42");
        poly(a.center - a.roadWidth * .52, a.center + a.roadWidth * .52, b.center - b.roadWidth * .52, b.center + b.roadWidth * .52, stripe ? "#303b42" : "#26333b");
        poly(a.center - a.roadWidth * .13, a.center + a.roadWidth * .13, b.center - b.roadWidth * .13, b.center + b.roadWidth * .13, "#5c68704a");
        // White edge lines and dashed lane guides fade naturally with perspective.
        poly(a.center - a.roadWidth * .49, a.center - a.roadWidth * .477, b.center - b.roadWidth * .49, b.center - b.roadWidth * .477, "#f2f0e6");
        poly(a.center + a.roadWidth * .477, a.center + a.roadWidth * .49, b.center + b.roadWidth * .477, b.center + b.roadWidth * .49, "#f2f0e6");
        const dash = (race.progress * 48 + d1 * 18) % 1;
        if (dash < .42) {
          for (const lane of [-1 / 3, 1 / 3]) {
            const widthA = Math.max(.6, a.roadWidth * .006), widthB = Math.max(.6, b.roadWidth * .006);
            poly(a.center + a.roadWidth * lane - widthA, a.center + a.roadWidth * lane + widthA, b.center + b.roadWidth * lane - widthB, b.center + b.roadWidth * lane + widthB, "#d7ddd9b8");
          }
        }
      }
      // The ideal racing line is projected through the same camera as the road.
      // Red warns of a braking zone; amber marks turn-in; mint marks the cleaner exit.
      const racingPoint = (depth: number) => {
        const road = roadAt(depth);
        const curve = road.bend;
        const cornerLoad = Math.abs(curve);
        const lineOffset = clamp(-curve * 0.105, -0.24, 0.24);
        const x = road.center + road.roadWidth * lineOffset;
        const y = horizon + depth * depth * (h - horizon);
        const braking = cornerLoad > 0.22 && depth > 0.42 && depth < 0.82;
        const turnIn = cornerLoad > 0.12;
        return { x, y, width: Math.max(1.2, road.roadWidth * (0.008 + depth * 0.009)), color: braking ? "#ff554b" : turnIn ? "#ffd36b" : "#c8ff83" };
      };
      for (let i = 0; i < 72; i++) {
        const d1 = 0.035 + i / 72 * 0.965;
        const d2 = 0.035 + (i + 1) / 72 * 0.965;
        const p1 = racingPoint(d1), p2 = racingPoint(d2);
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.2 + d1 * 0.72;
        ctx.strokeStyle = p1.color;
        ctx.lineWidth = p1.width * 2.8;
        ctx.shadowColor = p1.color;
        ctx.shadowBlur = 5 * d1;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, p1.width * 0.72);
        ctx.strokeStyle = "#fffde8";
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.restore();
      }
      // Trackside boards and safety barriers follow the same road projection.
      for (let i = 0; i < 15; i++) {
        const depth = ((i / 15 + race.progress * .65) % 1);
        if (depth < .09) continue;
        const road = roadAt(depth), y = horizon + depth * depth * (h - horizon);
        const size = 2 + depth * 17;
        for (const side of [-1, 1]) {
          const x = road.center + side * (road.roadWidth * .61 + size * .65);
          ctx.fillStyle = "#cbd4ce"; ctx.fillRect(x - size * .14, y - size * 1.25, size * .28, size * 1.25);
          ctx.fillStyle = "#d74b43"; ctx.fillRect(x - size * .14, y - size * 1.25, size * .28, size * .36);
        }
      }
      // Rear-facing formula car: broad rear tyres and wing nearest the player,
      // a compact cockpit, and a short blunt nose toward the horizon.
      const bob = Math.sin(now * .018) * Math.min(1.4, race.speed / 120);
      const carX = w * .5 + race.lateral * w * .25 + controlsRef.current.steer * w * .012 - roadAt(.98).bend * race.speed * .055;
      const carY = carBaseY + bob;
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(clamp(race.drift * .1 + controlsRef.current.steer * .025, -.1, .1));
      const cw = Math.min(w * .36, 158), ch = Math.min(h * .205, 94);
      // Ground shadow and speed glow.
      ctx.fillStyle = "#071014a8";
      ctx.beginPath(); ctx.ellipse(0, ch * .015, cw * .39, ch * .15, 0, 0, Math.PI * 2); ctx.fill();
      if (boostActive) {
        const flame = ch * (.3 + Math.sin(now / 24) * .1);
        const fg = ctx.createLinearGradient(0, 0, 0, flame);
        fg.addColorStop(0, "#fffbd0"); fg.addColorStop(.32, "#70f2ff"); fg.addColorStop(1, "#40aaff00");
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.moveTo(-cw * .075, -ch * .02); ctx.lineTo(0, flame); ctx.lineTo(cw * .075, -ch * .02); ctx.closePath(); ctx.fill();
      }
      // Rear tyres sit outside the body; tread and sidewalls make the silhouette read clearly.
      ctx.fillStyle = "#090e12";
      ctx.beginPath();
      ctx.roundRect(-cw * .405, -ch * .015, cw * .145, ch * .31, 5);
      ctx.roundRect(cw * .26, -ch * .015, cw * .145, ch * .31, 5);
      ctx.fill();
      ctx.fillStyle = "#69757b";
      ctx.fillRect(-cw * .376, ch * .045, cw * .085, ch * .17);
      ctx.fillRect(cw * .291, ch * .045, cw * .085, ch * .17);
      // Rear wing, the widest and closest part of the car.
      ctx.fillStyle = "#121b21";
      ctx.beginPath();
      ctx.moveTo(-cw * .46, ch * .19); ctx.lineTo(-cw * .43, ch * .105);
      ctx.lineTo(-cw * .29, ch * .075); ctx.lineTo(cw * .29, ch * .075);
      ctx.lineTo(cw * .43, ch * .105); ctx.lineTo(cw * .46, ch * .19);
      ctx.lineTo(cw * .34, ch * .225); ctx.lineTo(-cw * .34, ch * .225); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b9ed4b"; ctx.fillRect(-cw * .39, ch * .12, cw * .78, ch * .035);
      ctx.fillStyle = "#eaffb0"; ctx.fillRect(-cw * .34, ch * .19, cw * .68, ch * .018);
      // Main rear body: wide shoulders, curved sidepods and a rounded taper instead of a spike.
      const body = new Path2D();
      body.moveTo(-cw * .34, ch * .17);
      body.quadraticCurveTo(-cw * .37, ch * .06, -cw * .29, -ch * .04);
      body.lineTo(-cw * .205, -ch * .24);
      body.quadraticCurveTo(-cw * .16, -ch * .33, -cw * .105, -ch * .36);
      body.lineTo(-cw * .075, -ch * .43);
      body.quadraticCurveTo(0, -ch * .49, cw * .075, -ch * .43);
      body.lineTo(cw * .105, -ch * .36);
      body.quadraticCurveTo(cw * .16, -ch * .33, cw * .205, -ch * .24);
      body.lineTo(cw * .29, -ch * .04);
      body.quadraticCurveTo(cw * .37, ch * .06, cw * .34, ch * .17);
      body.closePath();
      const paint = ctx.createLinearGradient(-cw * .35, 0, cw * .35, 0);
      paint.addColorStop(0, "#6f9f2b"); paint.addColorStop(.2, "#a9df40"); paint.addColorStop(.52, "#d6ff76"); paint.addColorStop(.8, "#a9df40"); paint.addColorStop(1, "#658f29");
      ctx.fillStyle = paint; ctx.fill(body);
      ctx.strokeStyle = "#e8ffae"; ctx.lineWidth = 1.2; ctx.stroke(body);
      // Rear diffuser and exhaust details.
      ctx.fillStyle = "#1b272d";
      ctx.beginPath(); ctx.moveTo(-cw * .22, ch * .16); ctx.lineTo(-cw * .17, ch * .07); ctx.lineTo(cw * .17, ch * .07); ctx.lineTo(cw * .22, ch * .16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4e5b61";
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * cw * .055 - cw * .012, ch * .095, cw * .024, ch * .055);
      // Cockpit viewed from behind: dark halo, glass and a visible helmet.
      ctx.fillStyle = "#17252d";
      ctx.beginPath(); ctx.ellipse(0, -ch * .255, cw * .105, ch * .105, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4f707b";
      ctx.beginPath(); ctx.ellipse(0, -ch * .275, cw * .071, ch * .072, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f4f6e9";
      ctx.beginPath(); ctx.ellipse(0, -ch * .3, cw * .035, ch * .035, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#eaffb5"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-cw * .125, -ch * .3); ctx.lineTo(-cw * .09, -ch * .18); ctx.lineTo(cw * .09, -ch * .18); ctx.lineTo(cw * .125, -ch * .3); ctx.stroke();
      // Brake lights and rear bodywork accents make the camera orientation unmistakable.
      ctx.fillStyle = controlsRef.current.brake ? "#ff554b" : "#e8473f";
      ctx.shadowColor = "#ff554b"; ctx.shadowBlur = controlsRef.current.brake ? 12 : 3;
      ctx.fillRect(-cw * .275, ch * .035, cw * .09, ch * .045);
      ctx.fillRect(cw * .185, ch * .035, cw * .09, ch * .045);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#25343b"; ctx.fillRect(-cw * .17, -ch * .005, cw * .34, ch * .045);
      ctx.fillStyle = "#e8ffb0"; ctx.fillRect(-cw * .12, ch * .01, cw * .24, ch * .012);
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
