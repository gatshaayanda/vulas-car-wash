"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RacingWarmup, { newRace, type Controls, type Phase, type Race } from "./racing-warmup";
import Racing3DScene from "./racing-3d-scene";
import "./racing-main-menu.css";

type Difficulty = "Easy" | "Normal" | "Hard";
type LocalRaceSave = { race: Race; difficulty: Difficulty; savedAt: string; carColor?: string };
type RaceResult = { id: string; completedAt: string; difficulty: Difficulty; elapsed: number; bestLap: number | null; position: 1 | 2; laps: number; pitStopMissed?: boolean };
type SaveSlot = { id: string; name: string; createdAt: string; updatedAt: string; state: LocalRaceSave | null };
type LocalData = { version: 1; activeSlotId: string | null; slots: SaveSlot[]; scores: RaceResult[] };
const STORAGE_KEY = "vula-racing-local-v1";
const emptyData: LocalData = { version: 1, activeSlotId: null, slots: [], scores: [] };
const readData = (): LocalData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as LocalData;
    if (parsed?.version !== 1 || !Array.isArray(parsed.slots) || !Array.isArray(parsed.scores)) return emptyData;
    const slots = parsed.slots.filter(slot => slot && typeof slot.id === "string" && typeof slot.name === "string" && typeof slot.createdAt === "string" && typeof slot.updatedAt === "string" && (slot.state === null || (slot.state && slot.state.race && Number.isFinite(slot.state.race.elapsed) && Number.isFinite(slot.state.race.progress) && ["Easy", "Normal", "Hard"].includes(slot.state.difficulty))));
    const scores = parsed.scores.filter(score => score && typeof score.id === "string" && Number.isFinite(score.elapsed) && (score.position === 1 || score.position === 2) && (score.bestLap === null || Number.isFinite(score.bestLap))).slice(0, 100);
    return { version: 1, activeSlotId: typeof parsed.activeSlotId === "string" ? parsed.activeSlotId : null, slots, scores };
  } catch { return emptyData; }
};
const writeData = (data: LocalData) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch { return false; } };
const time = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : `${Math.floor(value / 60)}:${(value % 60).toFixed(2).padStart(5, "0")}`;

function RacingMenuPreview({ graphics, onGraphicsStatus }: { graphics: "procedural" | "kenney"; onGraphicsStatus: (status: "loading" | "ready" | "error") => void }) {
  const raceRef = useRef<Race>({ ...newRace(), worldX: 0, worldZ: 72, worldYaw: -1.34, playerGarageExit: false, playerOutLap: false });
  const controlsRef = useRef<Controls>({ steer: 0, accelerate: false, brake: false, boost: false });
  const phaseRef = useRef<Phase>("running");
  return <Racing3DScene key={graphics} raceRef={raceRef} controlsRef={controlsRef} phaseRef={phaseRef} preview previewGraphics={graphics} onGraphicsStatus={onGraphicsStatus} />;
}

export default function RacingMainMenu({ embedded = false }: { embedded?: boolean }) {
  const Root = embedded ? "section" : "main";
  const [data, setData] = useState<LocalData>(emptyData);
  const [view, setView] = useState<"home" | "slots" | "scores">("home");
  const [session, setSession] = useState(false);
  const [quickStart, setQuickStart] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [previewGraphics, setPreviewGraphics] = useState<"procedural" | "kenney">("kenney");
  const [graphicsStatus, setGraphicsStatus] = useState<"loading" | "ready" | "error" | "idle">("idle");
  const activeSlot = useMemo(() => data.slots.find(slot => slot.id === activeSlotId) ?? null, [data.slots, activeSlotId]);
  useEffect(() => { setData(readData()); }, []);
  const commit = (next: LocalData) => { if (writeData(next)) { setData(next); setNotice("Saved on this device."); } else setNotice("Storage is unavailable. Your game was not saved."); };
  const newGame = () => {
    if (data.slots.length >= 5) { setNotice("All five save slots are in use. Load a slot before starting another game."); return; }
    const slot: SaveSlot = { id: `slot-${Date.now()}`, name: `Driver ${data.slots.length + 1}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state: null };
    const next = { ...data, activeSlotId: slot.id, slots: [...data.slots, slot].slice(-5) };
    if (!writeData(next)) { setNotice("Could not create a save on this device."); return; }
    setData(next); setActiveSlotId(slot.id); setQuickStart(false); setSession(true); setNotice("");
  };
  const startQuickRace = () => {
    // Quick Race is a one-tap playable session, not a save-slot operation.
    // It must work even when all save slots are occupied or storage is blocked.
    setActiveSlotId(null);
    setQuickStart(true);
    setSession(true);
    setView("home");
    setNotice("");
  };
  const continueGame = () => {
    const slot = data.slots.find(item => item.id === data.activeSlotId) ?? data.slots[data.slots.length - 1];
    if (!slot || !slot.state) { setNotice("There is no saved progress to continue. Start a driver save, then save from the pit garage."); return; }
    setQuickStart(false); setActiveSlotId(slot.id); setSession(true); setNotice("");
  };
  const loadGame = (slot: SaveSlot) => { setQuickStart(false); setActiveSlotId(slot.id); setSession(true); setView("home"); setNotice(""); };
  const saveGame = (state: LocalRaceSave) => {
    if (!activeSlotId) return;
    const next = { ...data, activeSlotId, slots: data.slots.map(slot => slot.id === activeSlotId ? { ...slot, state, updatedAt: new Date().toISOString() } : slot) };
    commit(next);
  };
  const completeRace = (result: RaceResult) => { commit({ ...data, scores: [result, ...data.scores.filter(item => item.id !== result.id)].slice(0, 100) }); };
  if (session) return <Root className={`racing-menu-game${embedded ? " racing-menu-game-embedded" : ""}`}><div className="racing-menu-gamebar"><button type="button" onClick={() => setSession(false)}>← Racing menu</button><span>QUICK RACE · KAGO OFFLINE AI</span></div><RacingWarmup initialSave={activeSlot?.state ?? null} quickStart={quickStart} driverName={activeSlot?.name ?? "Guest Driver"} onSave={saveGame} onComplete={completeRace} onExit={() => setSession(false)} /></Root>;
  return <Root className={`racing-main-menu${embedded ? " racing-main-menu-embedded" : ""}`}>
    <div className="racing-menu-topline"><Link href="/" className="racing-menu-brand"><span className="racing-menu-mark">V</span><span>VULA RACING<small>GABORONE CIRCUIT</small></span></Link><span className="racing-menu-status"><i /> OFFLINE</span></div>
    <section className="racing-menu-hero">
      <div className="racing-menu-copy"><p className="racing-menu-kicker">01 / QUICK RACE</p><h1>TAKE<br/><em>THE LINE.</em></h1><p className="racing-menu-lede">One circuit. One rival. Your best lap.</p>
        <div className="racing-menu-rival"><span className="racing-menu-rival-mark">K</span><span><small>YOUR RIVAL</small><strong>KAGO</strong></span><span className="racing-menu-rival-level">OFFLINE AI</span></div>
      </div>
      <div className="racing-menu-preview"><div className="racing-menu-art" aria-label="Live view of the actual Vula Racing 3D circuit"><RacingMenuPreview graphics={previewGraphics} onGraphicsStatus={setGraphicsStatus}/><div className="racing-menu-art-caption"><b>LIVE</b><span>IN-GAME<br/>RACE VIEW</span></div><div className="racing-menu-art-index">VULA CIRCUIT <i/> KAGO ON TRACK</div></div><div className="racing-menu-preview-controls"><div className="racing-menu-graphics-switch" role="group" aria-label="Preview car graphics"><button type="button" aria-pressed={previewGraphics === "procedural"} onClick={() => setPreviewGraphics("procedural")}>PROCEDURAL</button><button type="button" aria-pressed={previewGraphics === "kenney"} onClick={() => setPreviewGraphics("kenney")}>KENNEY ASSET</button></div><div className="racing-menu-graphics-status" aria-live="polite">{previewGraphics === "procedural" ? "PROCEDURAL CAR" : graphicsStatus === "loading" ? "LOADING COLOURED KENNEY CAR…" : graphicsStatus === "ready" ? "COLOURED KENNEY ASSET ACTIVE" : graphicsStatus === "error" ? "ASSET UNAVAILABLE · PROCEDURAL FALLBACK" : "KENNEY ASSET"}</div></div></div>
    </section>
    <section className="racing-menu-sessions"><div className="racing-menu-sectionhead"><div><p className="racing-menu-kicker">RACE CONTROL</p><h2>Get on track.</h2></div><span>LOCAL SAVE</span></div>
      <div className="racing-menu-actions"><button type="button" onClick={newGame}>New Driver Save <span>↗</span></button><button type="button" onClick={continueGame}>Continue <span>→</span></button><button type="button" onClick={() => setView("slots")}>Load Game <span>⌄</span></button><button type="button" onClick={() => setView("scores")}>High Scores <span>↗</span></button></div>
      {notice && <p className="racing-menu-notice" role="status">{notice}</p>}
      {view === "slots" && <div className="racing-menu-panel"><div className="racing-menu-panelhead"><h3>Saved games</h3><button type="button" onClick={() => setView("home")}>Close ×</button></div>{data.slots.length ? data.slots.map(slot => <article className="racing-menu-slot" key={slot.id}><div><strong>{slot.name}</strong><small>{slot.state ? `Saved ${new Date(slot.updatedAt).toLocaleString()}` : "New race · not yet saved"}</small></div><div className="racing-menu-slot-actions"><button type="button" onClick={() => loadGame(slot)}>Load</button><button type="button" onClick={() => { const name = window.prompt("Driver name", slot.name); if (name?.trim()) commit({ ...data, slots: data.slots.map(item => item.id === slot.id ? { ...item, name: name.trim().slice(0, 28), updatedAt: new Date().toISOString() } : item) }); }}>Rename</button></div></article>) : <p>No saved games on this device yet.</p>}</div>}
      {view === "scores" && <div className="racing-menu-panel"><div className="racing-menu-panelhead"><h3>High scores</h3><button type="button" onClick={() => setView("home")}>Close ×</button></div>{data.scores.length ? <div className="racing-menu-scorelist">{data.scores.map((score,index)=><article key={score.id}><b>#{index+1}</b><div><strong>{score.pitStopMissed ? "DNF · Pit stop missed" : score.position === 1 ? "1st · Beat Kago" : "2nd · Kago won"}</strong><small>{new Date(score.completedAt).toLocaleString()} · {score.difficulty} · {score.laps} lap · Race {time(score.elapsed)}</small></div><span>Best {time(score.bestLap)}</span></article>)}</div> : <p>No completed races yet. Finish a Quick Race to create your first score.</p>}</div>}
    </section>
    <section className="racing-menu-next"><div><p className="racing-menu-kicker">LOCAL RACING</p><h2>Your races. Your records.</h2><p>Saved sessions and completed results stay on this device and remain available offline. They are not shared or server-verified.</p></div><div className="racing-menu-roadmap"><span><b>{data.slots.length}</b> Save slots <small>ON THIS DEVICE</small></span><span><b>{data.scores.length}</b> Completed races <small>LOCAL RECORDS</small></span></div></section>
    <footer className="racing-menu-footer"><span>VULA RACING</span><span>BUILT TO DRIVE · DESIGNED TO COMPETE</span><Link href="/">Back to Vula&apos;s Car Wash ↗</Link></footer>
  </Root>;
}
