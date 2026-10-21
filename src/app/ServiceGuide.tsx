"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, Check, ChevronDown, MessageCircle, Send, Sparkles, X } from "lucide-react";
import type { VulaService } from "@/lib/firebase/vula-data";

type GuideService = VulaService;
type View = "shop" | "admin";
type Message = { id: string; from: "guide" | "you"; text: string };

type Props = {
  view: View;
  services: GuideService[];
  requestCount: number;
  onChooseService: (service: GuideService) => void;
  onOpenAccount: () => void;
  onOpenAdmin: (target?: "services" | "requests") => void;
  onOpenStorefront: () => void;
};

const HISTORY_KEY = "vulas-car-wash:guide-history:v1";
const TEASER_KEY = "vulas-car-wash:guide-teaser:v1";

const formatPrice = (price?: number | null) => typeof price === "number" ? "P" + price.toLocaleString("en-BW", { maximumFractionDigits: 2 }) : "Price to confirm";

function createMessage(from: Message["from"], text: string): Message {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, from, text };
}

export default function ServiceGuide({ view, services, requestCount, onChooseService, onOpenAccount, onOpenAdmin, onOpenStorefront }: Props) {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [lastChoice, setLastChoice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const activeServices = useMemo(() => services.filter(service => service.active), [services]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed.filter(item => item && (item.from === "guide" || item.from === "you") && typeof item.text === "string").slice(-20));
      }
    } catch { /* Chat history is optional; the guide still works without storage. */ }
    setHistoryReady(true);
    try {
      if (window.sessionStorage.getItem(TEASER_KEY) !== "dismissed" && window.sessionStorage.getItem(TEASER_KEY) !== "shown") {
        const timer = window.setTimeout(() => {
          if (document.visibilityState === "visible") {
            setTeaser(true);
            try { window.sessionStorage.setItem(TEASER_KEY, "shown"); } catch { /* optional */ }
          }
        }, 9000);
        return () => window.clearTimeout(timer);
      }
    } catch { /* no teaser if session storage is unavailable */ }
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    try { window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-20))); } catch { /* history is optional */ }
  }, [messages, historyReady]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Move focus to the dialog's close control for keyboard accessibility, never to
    // the composer; the mobile keyboard stays closed until the visitor taps the field.
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus(), 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); launcherRef.current?.focus(); return; }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { window.clearTimeout(focusTimer); window.removeEventListener("keydown", handleKey); if (previous?.isConnected) previous.focus(); else launcherRef.current?.focus(); };
  }, [open]);

  function say(text: string) {
    setMessages(current => [...current, createMessage("guide", text)].slice(-20));
  }
  function chooseService(service: GuideService) {
    setLastChoice(service.id);
    say(`${service.name}: ${formatPrice(service.price)}. ${service.description || "See the wash menu for what is included."} Choose “Add this wash to booking” to continue to the booking form. Staff confirm your request.`);
  }
  function runAction(action: string) {
    setTeaser(false);
    switch (action) {
      case "help": say("I can guide you to a wash, your booking form or your booking history. Choose an option below or keep browsing."); break;
      case "browse": say("No problem. Keep browsing; the wash menu and booking form are still available."); setOpen(false); break;
      case "account": say(`Opening your booking area. Your booking receipt and linked booking history are available in the booking section.`); onOpenAccount(); break;
      case "storefront": say("Taking you back to the wash menu."); onOpenStorefront(); break;
      case "admin-services": say("Opening staff tools to manage wash services."); onOpenAdmin("services"); break;
      case "admin-requests": say(requestCount ? `Opening staff booking management.` : "Opening staff booking management."); onOpenAdmin("requests"); break;
      default: {
        const service = activeServices.find(item => item.id === action);
        if (service) {
          chooseService(service);
          return;
        }
      }
    }
  }
  function continueWithService() {
    const service = activeServices.find(item => item.id === lastChoice);
    if (!service) { say("Choose a wash first, then I’ll take you to the booking form."); return; }
    say(`Taking you to the ${service.name} booking form. Your wash selection will be carried across.`);
    setOpen(false);
    onChooseService(service);
  }
  function sendText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages(current => [...current, createMessage("you", text)].slice(-20));
    setInput("");
    const normalized = text.toLowerCase();
    if (/admin|manage|edit service|add service/.test(normalized)) { runAction("admin-services"); return; }
    if (/announcement|promotion|special|publish/.test(normalized)) { say("Customer notices are managed by staff in the admin area."); onOpenAdmin("requests"); return; }
    if (/request|order|track|status|account/.test(normalized)) { runAction(view === "admin" ? "admin-requests" : "account"); return; }
    if (/price|cost|how much/.test(normalized)) { say("The wash menu shows the listed price for each option. Choose a wash that matches your vehicle and cleaning needs."); return; }
    if (/time|appointment|availability|slot|book/.test(normalized)) { say("Choose your wash, then pick an appointment date and one of the times shown by the live calendar. Submit the request for the team to confirm."); return; }
    if (/interior|vacuum|inside/.test(normalized)) { const service = activeServices.find(item => /interior|inside/i.test(item.name)); if (service) { chooseService(service); return; } }
    if (/premium|shine|polish/.test(normalized)) { const service = activeServices.find(item => /premium|shine|polish/i.test(item.name)); if (service) { chooseService(service); return; } }
    if (/basic|outside|exterior|sedan|car/.test(normalized)) { const service = activeServices.find(item => /basic|car/i.test(item.name)); if (service) { chooseService(service); return; } }
    const match = activeServices.find(item => normalized.includes(item.name.toLowerCase()));
    if (match) { chooseService(match); return; }
    if (/website|web page|site/.test(normalized)) { const service = activeServices.find(item => /website/i.test(item.name)); if (service) { chooseService(service); return; } }
    if (/app|mobile/.test(normalized)) { const service = activeServices.find(item => /^app$/i.test(item.name)); if (service) { chooseService(service); return; } }
    say("I can help with wash choices, listed prices, appointment times and finding your booking. Try asking about a basic wash, interior cleaning, premium wash or booking time.");
  }

  const customerActions = [
    { key: "services", label: "Help me choose", icon: "✳" },
    { key: "account", label: `My bookings (${requestCount})`, icon: "↗" },
    { key: "browse", label: "Just browsing", icon: "↓" },
  ];
  const adminActions = [
    { key: "admin-services", label: "Manage services", icon: "＋" },
    { key: "admin-requests", label: `Review bookings (${requestCount})`, icon: "↗" },
    { key: "storefront", label: "Customer page", icon: "↓" },
  ];

  return <div className="sd-guide-root">
    {!open && teaser && <aside className="sd-guide-teaser" aria-label="Optional wash guide invitation">
      <span className="sd-guide-teaser-spark"><Sparkles size={15}/></span>
      <div><strong>{view === "admin" ? "Need a hand with staff tools?" : "Not sure which wash to choose?"}</strong><p>{view === "admin" ? "Go to bookings, manage washes or return to the customer page." : "Choose a wash or find your booking."}</p><div className="sd-guide-teaser-actions"><button type="button" onClick={() => { setTeaser(false); setOpen(true); if (!messages.length) say("Hi! I’m Vula’s car wash guide. Ask about wash options, prices, appointment times or booking requests."); }}> {view === "admin" ? "Open staff guide" : "Help me choose"} <ArrowRight size={14}/></button><button type="button" className="sd-guide-dismiss" onClick={() => { setTeaser(false); try { window.sessionStorage.setItem(TEASER_KEY, "dismissed"); } catch { /* optional */ } }}>Not now</button></div></div>
      <button type="button" className="sd-guide-teaser-close" aria-label="Dismiss guide invitation" onClick={() => { setTeaser(false); try { window.sessionStorage.setItem(TEASER_KEY, "dismissed"); } catch { /* optional */ } }}><X size={15}/></button>
    </aside>}
    {open && <div className="sd-guide-backdrop" onClick={() => setOpen(false)} aria-hidden="true"/>}
    {open && <section ref={panelRef} className="sd-guide-panel" role="dialog" aria-modal="true" aria-labelledby="sd-guide-title">
      <header className="sd-guide-head"><div className="sd-guide-avatar"><Sparkles size={18}/></div><div><span className="sd-guide-eyebrow">VULA’S CAR WASH · CUSTOMER HELP</span><h2 id="sd-guide-title">{view === "admin" ? "Wash-day helper" : "Plan your car wash"}</h2><p><span/> Quick help · {view === "admin" ? "Staff tools" : "Booking help"}</p></div><button type="button" aria-label="Close help" onClick={() => { setOpen(false); launcherRef.current?.focus(); }}><ChevronDown size={19}/></button></header>
      <div className="sd-guide-intro"><strong>{view === "admin" ? "What do you need help with?" : "What would you like to do?"}</strong><p>{view === "admin" ? "I’ll point you to the right car wash action." : "Choose a wash, check appointment times, or find your booking. You can always continue without me."}</p></div>
      <div className="sd-guide-actions">{(view === "admin" ? adminActions : customerActions).map(item => <button key={item.key} type="button" onClick={() => item.key === "services" ? say("Choose a wash below to see its price and what’s included. I’ll take you to the booking form when you’re ready.") : runAction(item.key)}><span>{item.icon}</span>{item.label}<ArrowRight size={15}/></button>)}</div>
      {view !== "admin" && <div className="sd-guide-services"><span className="sd-guide-section-label">WASH OPTIONS</span>{activeServices.map(service => <button key={service.id} type="button" onClick={() => chooseService(service)} aria-pressed={lastChoice === service.id}><span className="sd-guide-service-thumb" aria-hidden="true">{service.imageUrl ? <img src={service.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }}/> : <span className="sd-guide-service-placeholder" aria-hidden="true">V</span>}</span><span className="sd-guide-service-copy"><strong>{service.name}</strong><small>{service.description || "Choose this wash to see it in your booking basket."}</small></span><b>{formatPrice(service.price)}</b></button>)}</div>}
      {lastChoice && view !== "admin" && <button type="button" className="sd-guide-continue" onClick={continueWithService}>Add this wash to booking <ArrowRight size={16}/></button>}
      <div className="sd-guide-thread" aria-live="polite" aria-relevant="additions text">{messages.slice(-4).map(message => <p key={message.id} className={`sd-guide-message is-${message.from}`}>{message.text}</p>)}</div>
      <form className="sd-guide-composer" onSubmit={sendText}><input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} aria-label="Ask Vula’s car wash guide" aria-describedby="sd-guide-type-hint" placeholder="Tap here to type a question…" maxLength={300}/><button type="submit" disabled={!input.trim()} aria-label="Send message"><Send size={17}/></button></form>
      <p id="sd-guide-type-hint" className="sd-guide-type-hint">Tap the message box above to type. Your keyboard opens only when you choose to type.</p>
      <p className="sd-guide-footnote"><Check size={12}/> Quick help · Booking support</p>
    </section>}
    <button ref={launcherRef} type="button" className={`sd-guide-launcher${open ? " is-open" : ""}`} aria-expanded={open} aria-haspopup="dialog" aria-label={open ? "Close service guide" : "Open Vula car wash help"} onClick={() => { setTeaser(false); setOpen(value => !value); if (!messages.length) say("Hi! I’m Vula’s car wash guide. Ask about wash options, prices, appointment times or booking requests."); }}>
      {open ? <X size={21}/> : <MessageCircle size={22}/>}<span>{open ? "Close" : "Need a hand?"}</span>{!open && requestCount > 0 && view === "admin" && <b>{requestCount}</b>}
    </button>
  </div>;
}
