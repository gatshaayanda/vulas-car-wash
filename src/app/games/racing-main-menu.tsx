"use client";

import { useState } from "react";
import Link from "next/link";
import RacingWarmup from "./racing-warmup";
import "./racing-main-menu.css";

type Session = "bot" | null;

const options = [
  { eyebrow: "PRACTICE / RACE", title: "Quick warm-up with Kago", description: "Launch the current 3D circuit session. Kago is on track as the offline rival; choose Easy, Normal or Hard in the session controls.", action: "Get on track", kind: "bot" as const, tag: "READY TO PLAY" },
];

export default function RacingMainMenu() {
  const [session, setSession] = useState<Session>(null);
  if (session) return <main className="racing-menu-game">
    <div className="racing-menu-gamebar">
      <button type="button" onClick={() => setSession(null)}>← Racing menu</button>
      <span>QUICK WARM-UP · KAGO OFFLINE AI</span>
    </div>
    <RacingWarmup />
  </main>;

  return <main className="racing-main-menu">
    <div className="racing-menu-topline"><Link href="/" className="racing-menu-brand"><span className="racing-menu-mark">V</span><span>VULA RACING<small>CAR WASH · MOTORSPORT</small></span></Link><span className="racing-menu-status"><i /> OFFLINE PLAY AVAILABLE</span></div>
    <section className="racing-menu-hero">
      <div className="racing-menu-copy">
        <p className="racing-menu-kicker">THE CIRCUIT IS YOURS</p>
        <h1>Find your<br/><em>racing line.</em></h1>
        <p className="racing-menu-lede">A proper place to race, practise and build your reputation. Pick a session and get on track.</p>
        <div className="racing-menu-meta"><span>01 <b>3D CIRCUIT</b></span><span>02 <b>OFFLINE RACING</b></span><span>03 <b>KAGO AI</b></span></div>
      </div>
      <div className="racing-menu-art" aria-label="Racing circuit illustration">
        <div className="racing-menu-art-glow"/><div className="racing-menu-track"><span/><span/><span/></div>
        <div className="racing-menu-car"><i/><i/><b/></div>
        <div className="racing-menu-art-label"><strong>V / R</strong><small>GABORONE<br/>RACING SERIES</small></div>
      </div>
    </section>
    <section className="racing-menu-sessions">
      <div className="racing-menu-sectionhead"><div><p className="racing-menu-kicker">CHOOSE YOUR SESSION</p><h2>Get on the grid.</h2></div><span>01 / AVAILABLE</span></div>
      <div className="racing-menu-cards">{options.map((item,index)=><article className="racing-menu-card" key={item.kind}>
        <div className="racing-menu-cardtop"><span>0{index+1} / {item.eyebrow}</span><b>{item.tag}</b></div>
        <h3>{item.title}</h3><p>{item.description}</p>
        <button type="button" onClick={() => setSession(item.kind)}>{item.action}<span>↗</span></button>
      </article>)}</div>
    </section>
    <section className="racing-menu-next">
      <div><p className="racing-menu-kicker">COMING THROUGH THE GARAGE</p><h2>More ways to compete.</h2><p>The next build separates solo racing from VS Bot, then adds saved game slots and completed race records. Online racing will follow only after local sessions and persistence are proven.</p></div>
      <div className="racing-menu-roadmap"><span><b>02</b> Solo / VS Bot setup <small>UP NEXT</small></span><span><b>03</b> Save & continue <small>UP NEXT</small></span><span><b>04</b> Race records <small>UP NEXT</small></span><span><b>05</b> Online race <small>FUTURE</small></span></div>
    </section>
    <footer className="racing-menu-footer"><span>VULA RACING</span><span>BUILT TO DRIVE · DESIGNED TO COMPETE</span><Link href="/">Back to Vula&apos;s Car Wash ↗</Link></footer>
  </main>;
}
