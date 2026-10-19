"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "./racing.css";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { auth, hasFirebaseWebConfig } from "@/lib/firebase/client";

type Division = { name: string; tracks: string[]; unlock: number };
const divisions: Division[] = [
  { name: "Kart Rookie", tracks: ["Gaborone Dust Loop", "Tlokweng Sprint", "Makgadikgadi Bend"], unlock: 0 },
  { name: "Pro Circuit", tracks: ["Kgale Ridge Circuit", "Okavango Run", "Kalahari GP"], unlock: 3 },
  { name: "International Series", tracks: ["Alpine Ring", "Riviera Sprint", "Old Town Grand Prix"], unlock: 6 },
  { name: "World Apex", tracks: ["Neon Meridian", "Orbital Crown", "Apex Zero"], unlock: 9 },
];
type Result = { id: string; track: string; place: number; time: number; credits: number; at: string };
type Racer = { id: string; alias: string; division: number; wins: number; credits: number; upgrade: number; best: Record<string, number>; history: Result[] };
const starter = (id: string, alias: string): Racer => ({ id, alias, division: 0, wins: 0, credits: 250, upgrade: 0, best: {}, history: [] });
const storageKey = "vulas-car-wash:racing-career:v1";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function RacingHub() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [activeId, setActiveId] = useState("");
  const [alias, setAlias] = useState("");
  const [trackIndex, setTrackIndex] = useState(0);
  const [selectedDivision, setSelectedDivision] = useState(0);
  const [phase, setPhase] = useState<"garage" | "race" | "finished">("garage");
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("Career saves on this device. Online racer sync is not enabled yet.");
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [lap, setLap] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [boost, setBoost] = useState(2);
  const [steer, setSteer] = useState(0);
  const [brake, setBrake] = useState(false);
  const [lastPlace, setLastPlace] = useState<number | null>(null);
  const [lastReward, setLastReward] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const frame = useRef<number | null>(null);
  const lastFrame = useRef(0);
  const active = racers.find(r => r.id === activeId) ?? null;
  const division = divisions[selectedDivision] ?? divisions[0];
  const track = division.tracks[trackIndex % 3];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { racers?: Racer[]; activeId?: string };
        if (Array.isArray(parsed.racers)) setRacers(parsed.racers.filter(r => r && typeof r.id === "string" && typeof r.alias === "string"));
        if (parsed.activeId) setActiveId(parsed.activeId);
      }
    } catch { setNotice("Local save is unavailable in this browser. Keep this tab open during your session."); }
    const stop = onAuthStateChanged(auth, async current => {
      if (!current && hasFirebaseWebConfig) {
        try { await signInAnonymously(auth); } catch { setNotice("Guest sign-in unavailable. Racing remains available locally on this device."); }
      } else if (current) setUser(current);
      setAuthReady(true);
    });
    return () => stop();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ racers, activeId, savedAt: new Date().toISOString() })); }
    catch { setNotice("Browser storage is full or blocked. Your latest progress may not survive closing this tab."); }
  }, [racers, activeId]);

  useEffect(() => {
    if (phase !== "race" || paused) return;
    let mounted = true;
    const tick = (now: number) => {
      if (!mounted) return;
      if (!lastFrame.current) lastFrame.current = now;
      const dt = Math.min((now - lastFrame.current) / 1000, 0.05);
      lastFrame.current = now;
      setElapsed(v => v + dt);
      setPosition(v => {
        const corner = Math.abs(Math.sin((v / 100) * Math.PI * 5));
        const target = brake ? 23 : 42 + active?.upgrade * 3 + (boost > 0 ? 0 : 0);
        setSpeed(s => clamp(s + (target - s) * dt * (steer === 0 ? 1.8 : 1.2) - corner * Math.abs(steer) * 12 * dt, 0, 62));
        const drift = steer * (0.24 + (brake ? 0.08 : 0)) * dt;
        return clamp(v + (brake ? 1.2 : 2.0 + (active?.upgrade ?? 0) * 0.12) * dt - corner * Math.abs(steer) * 0.12 * dt, 0, 100);
      });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { mounted = false; if (frame.current) cancelAnimationFrame(frame.current); lastFrame.current = 0; };
  }, [phase, paused, steer, brake, boost, active?.upgrade]);

  useEffect(() => {
    if (phase === "race" && position >= 100) finishRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, phase]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (phase !== "race") return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") setSteer(-1);
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") setSteer(1);
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") setBrake(true);
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") setBrake(false);
      if (e.key === " " && !e.repeat) useBoost();
      if (e.key.toLowerCase() === "p" || e.key === "Escape") setPaused(v => !v);
    };
    const release = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key.toLowerCase()) || e.key.startsWith("Arrow")) setSteer(0);
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") setBrake(false);
    };
    window.addEventListener("keydown", key); window.addEventListener("keyup", release);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("keyup", release); };
  }, [phase]);

  function patchActive(update: (r: Racer) => Racer) {
    setRacers(current => current.map(r => r.id === activeId ? update(r) : r));
  }
  function createRacer() {
    const clean = alias.trim().replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 18);
    if (clean.length < 2) { setNotice("Choose an alias with at least two letters or numbers."); return; }
    const racer = starter(crypto.randomUUID?.() ?? String(Date.now()), clean);
    setRacers(current => [...current, racer]); setActiveId(racer.id); setSelectedDivision(0); setTrackIndex(0); setAlias("");
    setNotice("Racer created. Career progress is saved locally on this device.");
  }
  function startRace() {
    if (!active) { setNotice("Create or select a racer first."); return; }
    setPosition(0); setSpeed(0); setLap(1); setElapsed(0); setBoost(2); setSteer(0); setBrake(false); setPaused(false); setLastPlace(null); lastFrame.current = 0; setPhase("race");
  }
  function useBoost() {
    if (phase !== "race" || paused || boost <= 0) return;
    setBoost(v => Math.max(0, v - 1)); setSpeed(v => Math.min(62, v + 18)); setPosition(v => Math.min(100, v + 4.5));
  }
  function finishRace() {
    if (phase !== "race" || !active) return;
    setPhase("finished");
    const ai1 = 42 + Math.random() * 28;
    const ai2 = 40 + Math.random() * 30;
    const playerScore = Math.max(8, 100 - elapsed * 0.65 + active.upgrade * 2 + Math.random() * 5);
    const scores = [{ name: active.alias, score: playerScore, player: true }, { name: "Kago · The Attacker", score: ai1, player: false }, { name: "Neo · The Smooth One", score: ai2, player: false }].sort((a,b) => b.score-a.score);
    const place = scores.findIndex(s => s.player) + 1;
    const reward = [0, 120, 75, 45][place] + (place === 1 ? 30 : 0);
    const result: Result = { id: String(Date.now()), track, place, time: Number(elapsed.toFixed(2)), credits: reward, at: new Date().toISOString() };
    setLastPlace(place); setLastReward(reward);
    setRacers(current => current.map(r => {
      if (r.id !== activeId) return r;
      const wins = r.wins + (place === 1 ? 1 : 0);
      const history = [result, ...r.history].slice(0, 50);
      const best = { ...r.best, [track]: Math.min(r.best[track] ?? Infinity, result.time) };
      let nextDivision = r.division;
      const played = history.filter(x => x.place <= 3).length;
      if (wins >= (r.division + 1) * 3 && r.division < 3) nextDivision++;
      else if (played >= 4 && wins === 0 && r.division > 0) nextDivision--;
      return { ...r, wins, credits: r.credits + reward, best, history, division: nextDivision };
    }));
    setNotice("Race result saved on this device only. It has not been uploaded or verified by Vula's server.");
  }
  function upgrade() {
    if (!active || active.upgrade >= 5 || active.credits < (active.upgrade + 1) * 100) return;
    const cost = (active.upgrade + 1) * 100;
    patchActive(r => ({ ...r, credits: r.credits - cost, upgrade: r.upgrade + 1 }));
    setNotice("Upgrade purchased with virtual credits on this device.");
  }
  function resetRacer() {
    if (!active) return;
    const id = active.id; setRacers(current => current.filter(r => r.id !== id)); setActiveId(""); setConfirmReset(false); setNotice("Racer profile removed from this device. Your Vula customer account and bookings were not changed.");
  }
  const leaderboard = useMemo(() => racers.flatMap(r => r.history.map(h => ({ alias: r.alias, ...h }))).sort((a,b) => a.time-b.time).slice(0, 10), [racers]);

  return <main className="vula race-hub">
    <div className="vula-status"><span className="status-dot online"/>Vula Racing · Virtual credits only · No purchases or wagering</div>
    <header className="vula-nav"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>Vula's Car Wash<small>Racing garage</small></span></Link><nav><Link href="/#my-wash">My Wash</Link><Link href="/admin">Staff sign in</Link></nav></header>
    <section className="vula-section race-intro"><p className="vula-eyebrow">YOUR SECOND ENGINE</p><h1>Earn your racing stripes.</h1><p>Build a career across 12 tracks, tune your kart and race Kago the Attacker and Neo the Smooth One.</p><p className="vula-notice pending" role="status">{notice}</p><p className="race-save-state">{authReady ? user ? "Guest/customer session active · game progress currently device-local" : "Racing offline · device-local career" : "Checking guest session…"}</p></section>
    <section className="vula-section race-layout">
      <aside className="race-garage">
        <p className="vula-eyebrow">RACER PROFILE</p>
        {racers.length > 0 && <label>Choose racer<select value={activeId} onChange={e=>setActiveId(e.target.value)}><option value="">Select profile</option>{racers.map(r=><option key={r.id} value={r.id}>{r.alias}</option>)}</select></label>}
        {!active && <form className="race-create" onSubmit={e=>{e.preventDefault();createRacer()}}><label>Racer alias<input value={alias} onChange={e=>setAlias(e.target.value)} minLength={2} maxLength={18} placeholder="e.g. Dust Runner" required/></label><button className="vula-button primary" type="submit">Create racer</button></form>}
        {active && <><div className="race-profile"><div className="race-avatar">{active.alias.slice(0,1).toUpperCase()}</div><div><strong>{active.alias}</strong><span>{divisions[active.division].name}</span></div></div><div className="race-stats"><div><strong>{active.credits}</strong><span>Virtual credits</span></div><div><strong>{active.wins}</strong><span>Race wins</span></div><div><strong>{active.upgrade}/5</strong><span>Kart upgrade</span></div><div><strong>{active.history.length}</strong><span>Races logged</span></div></div><div className="race-upgrade"><div><strong>Engine tune · Level {active.upgrade}/5</strong><p>Cost: {(active.upgrade+1)*100} credits · improves pace.</p></div><button className="vula-button secondary" onClick={upgrade} disabled={active.upgrade>=5||active.credits<(active.upgrade+1)*100}>Upgrade</button></div><button className="vula-button secondary race-reset" onClick={()=>setConfirmReset(true)}>Reset this racer…</button>{confirmReset&&<div className="race-confirm"><p>Delete {active.alias}'s local career, credits, upgrades and race history? Your Vula customer account will remain untouched.</p><button className="vula-button secondary" onClick={()=>setConfirmReset(false)}>Keep racer</button><button className="vula-button primary" onClick={resetRacer}>Delete racer</button></div>}</>}
      </aside>
      <div className="race-main">
        {phase === "garage" && <><p className="vula-eyebrow">CHOOSE YOUR NEXT CIRCUIT</p><div className="race-track-grid">{divisions.map((d,di)=><article key={d.name} className={"race-division "+(selectedDivision===di?"selected":"")+(active&&active.division<di?" locked":"")}><span>DIVISION {String(di+1).padStart(2,"0")}</span><h2>{d.name}</h2><p>{di===0?"Learn the racing line and master your boost.":di===1?"Technical bends and higher pace.":di===2?"International-style circuits, tighter margins.":"Elite tracks for the sharpest racers."}</p>{d.tracks.map((t,ti)=><button key={t} type="button" disabled={!active||active.division<di} className={track===t?"active":""} onClick={()=>{setSelectedDivision(di);setTrackIndex(ti);}}><span>{String(di*3+ti+1).padStart(2,"0")}</span>{t}</button>)}</article>)}</div><button className="vula-button primary race-start" disabled={!active} onClick={startRace}>Start race · {track} ↗</button></>}
        {phase === "race" && <div className="race-play"><div className="race-play-head"><div><p className="vula-eyebrow">LIVE RACE</p><h2>{track}</h2></div><div className="race-timer">{elapsed.toFixed(1)}s <small>elapsed</small></div></div><div className="race-scene"><div className="race-sky"/><div className="race-hills"/><div className="race-track-surface"><div className="race-lane"/><div className="race-car rival rival-a" style={{left:`${25+Math.sin(elapsed*1.3)*7}%`}}>K</div><div className="race-car rival rival-b" style={{left:`${58+Math.cos(elapsed*.8)*8}%`}}>N</div><div className="race-car player-car" style={{left:`${clamp(50+steer*10,10,82)}%`,bottom:`${8+position*.55}%`}}>YOU</div></div><div className="race-hud"><span>PACE <b>{Math.round(speed)} km/h</b></span><span>PROGRESS <b>{Math.round(position)}%</b></span><span>BOOST <b>{boost} left</b></span></div></div><div className="race-controls"><div className="race-steering"><button aria-label="Steer left" onPointerDown={()=>setSteer(-1)} onPointerUp={()=>setSteer(0)} onPointerLeave={()=>setSteer(0)} onPointerCancel={()=>setSteer(0)}>←</button><button aria-label="Steer right" onPointerDown={()=>setSteer(1)} onPointerUp={()=>setSteer(0)} onPointerLeave={()=>setSteer(0)} onPointerCancel={()=>setSteer(0)}>→</button></div><div className="race-driving"><button onPointerDown={()=>setBrake(true)} onPointerUp={()=>setBrake(false)} onPointerLeave={()=>setBrake(false)} onPointerCancel={()=>setBrake(false)}>Brake</button><button className="boost-button" onClick={useBoost} disabled={boost<=0}>Boost ⚡</button></div><button className="vula-button secondary" onClick={()=>setPaused(v=>!v)}>{paused?"Resume":"Pause"} (P)</button></div>{paused&&<div className="race-paused"><strong>Race paused</strong><p>Take a breath. Your timer is stopped.</p><button className="vula-button primary" onClick={()=>setPaused(false)}>Resume race</button><button className="vula-button secondary" onClick={()=>{setPhase("garage");setPaused(false);}}>Retire to garage</button></div>}<p className="race-help">Keyboard: A/D or ←/→ steer · W/↑ release brake · S/↓ brake · Space boost · P pause. On touch screens, hold the controls.</p></div>}
        {phase === "finished" && <div className="race-result"><p className="vula-eyebrow">FINISH LINE</p><h2>{lastPlace===1?"P1. Clean racing.":lastPlace===2?"P2. A podium finish.":"P3. Keep pushing."}</h2><p>You finished {track} in {elapsed.toFixed(2)} seconds.</p><div className="race-reward"><strong>+{lastReward}</strong><span>virtual credits</span></div><p>Your race result is saved locally. Results are not server-verified or part of a public online leaderboard.</p><button className="vula-button primary" onClick={()=>setPhase("garage")}>Back to garage</button><button className="vula-button secondary" onClick={startRace}>Race again</button></div>}
      </div>
    </section>
    <section className="vula-section race-history"><div className="section-title"><p className="vula-eyebrow">CAREER RECORD</p><h2>Your personal bests.</h2><p>Results are stored on this device and are not visible to other players yet.</p></div><div className="race-record-grid"><article><h3>Track records</h3>{active&&Object.keys(active.best).length?Object.entries(active.best).sort((a,b)=>a[1]-b[1]).map(([name,time])=><p key={name}><strong>{name}</strong><span>{time.toFixed(2)}s</span></p>):<p className="race-empty">Complete a race to set your first personal best.</p>}</article><article><h3>Recent races</h3>{active?.history.length?active.history.slice(0,8).map(r=><p key={r.id}><strong>{r.track}</strong><span>P{r.place} · {r.time.toFixed(2)}s · +{r.credits}</span></p>):<p className="race-empty">Your race history will appear here.</p>}</article><article><h3>Local leaderboard</h3>{leaderboard.length?leaderboard.map((r,i)=><p key={r.id}><strong>#{i+1} {r.alias}</strong><span>{r.track} · {r.time.toFixed(2)}s</span></p>):<p className="race-empty">Finish a race to appear on this device's board.</p>}</article></div></section>
    <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>Vula's Car Wash<small>Wash. Care. Go.</small></span></Link><Link href="/#request">Book a wash</Link><Link href="/admin">Staff sign in</Link></footer>
  </main>;
}
