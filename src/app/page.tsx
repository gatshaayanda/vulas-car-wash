/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";
import { auth, db, hasFirebaseWebConfig } from "@/lib/firebase/client";
import { saveReminderPreferences, subscribeCustomerBookings, subscribeGallery, subscribeLoyaltyAccount, subscribeReminderPreferences, subscribeServices, subscribeSettings, type VulaBooking, type VulaGalleryItem, type VulaService } from "@/lib/firebase/vula-data";
import "./vula.css";

type Notice = { kind: "success" | "error" | "pending"; text: string };
const pendingKey = "vulas-car-wash:offline-requests:v1";
const stamp = () => new Date().toISOString();
const money = (price?: number) => typeof price === "number" ? "P" + price.toLocaleString("en-BW", { maximumFractionDigits: 2 }) : "Price confirmed by the team";

export default function Home() {
  const [services, setServices] = useState<VulaService[]>([]);
  const [gallery, setGallery] = useState<VulaGalleryItem[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [online, setOnline] = useState(true);
  const [userId, setUserId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"site" | "mobile">("site");
  const [serviceId, setServiceId] = useState("");
  const [tab, setTab] = useState<"book" | "queue" | "fleet">("book");
  const [connectionError, setConnectionError] = useState("");\n  const [myBookings, setMyBookings] = useState<VulaBooking[]>([]);\n  const [loyaltyPoints, setLoyaltyPoints] = useState(0);\n  const [remindersEnabled, setRemindersEnabled] = useState(false);\n  const [reminderNotice, setReminderNotice] = useState("");
  const mobileCoverage = Array.isArray(settings.mobileCoverage) ? settings.mobileCoverage as string[] : [];
  const businessName = typeof settings.businessName === "string" && settings.businessName.trim() ? settings.businessName : "Vula's Car Wash";
  const locationName = typeof settings.locationName === "string" && settings.locationName.trim() ? settings.locationName : "G-West";
  const activeServices = useMemo(() => services.filter(s => s.active), [services]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); void syncOfflineRequests(); };
    const onOffline = () => { setOnline(false); setNotice({ kind: "pending", text: "Offline: requests can be saved on this device, but the team cannot see them until they sync." }); };
    const stopAuth = onAuthStateChanged(auth, user => setUserId(user?.uid ?? ""));
    const stops = [subscribeServices(setServices, error => setConnectionError(error.message)), subscribeGallery(setGallery, () => {}), subscribeSettings(value => setSettings(value ?? {}), () => {})];
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { stopAuth(); stops.forEach(stop => stop()); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (!userId) { setMyBookings([]); setLoyaltyPoints(0); setRemindersEnabled(false); return; }
    const fail = () => {};
    const stops = [
      subscribeCustomerBookings(userId, setMyBookings, fail),
      subscribeLoyaltyAccount(userId, value => setLoyaltyPoints(Number(value?.pointsBalance ?? 0)), fail),
      subscribeReminderPreferences(userId, value => setRemindersEnabled(Boolean(value?.enabled)), fail),
    ];
    return () => stops.forEach(stop => stop());
  }, [userId]);

  async function saveReminderChoice() {
    if (!userId || !navigator.onLine) { setReminderNotice("Connect to the internet and submit a request first to save this preference."); return; }
    try { await saveReminderPreferences(userId, remindersEnabled); setReminderNotice("Your in-app reminder preference is saved. Push, SMS or email delivery still needs a notification channel to be configured."); }
    catch (error) { setReminderNotice(error instanceof Error ? error.message : "Reminder preference could not be saved."); }
  }

  async function ensureUser() {
    if (auth.currentUser) return auth.currentUser;
    if (!navigator.onLine || !hasFirebaseWebConfig) return null;
    return (await signInAnonymously(auth)).user;
  }
  async function syncOfflineRequests() {
    if (!navigator.onLine || !hasFirebaseWebConfig) return;
    let drafts: Array<{ id?: string; collection: string; data: Record<string, unknown> }> = [];
    try { drafts = JSON.parse(localStorage.getItem(pendingKey) || "[]") as typeof drafts; } catch {}
    if (!drafts.length) return;
    try {
      const user = await ensureUser(); if (!user) return;
      const remaining: typeof drafts = [];
      for (const draft of drafts) {
        try { const id = draft.id || crypto.randomUUID(); await setDoc(doc(db, draft.collection, id), { ...draft.data, customerId: user.uid, updatedAt: stamp() }); }
        catch { remaining.push(draft); }
      }
      localStorage.setItem(pendingKey, JSON.stringify(remaining));
      setNotice(remaining.length ? { kind: "pending", text: remaining.length + " saved request(s) still have not synced." } : { kind: "success", text: "Saved requests have synced to Vula's system. Bookings still need staff confirmation." });
    } catch { setNotice({ kind: "pending", text: "Sync is not complete. Your saved requests remain on this device." }); }
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const customerName = String(form.get("customerName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const vehicleType = String(form.get("vehicleType") ?? "").trim();
    const vehicleRegistration = String(form.get("vehicleRegistration") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const now = stamp();
    if (!customerName || !phone || !vehicleType) { setNotice({ kind: "error", text: "Enter your name, phone number and vehicle type." }); return; }
    setBusy(true); setNotice(null);
    try {
      const common: Record<string, unknown> = { customerName, phone, vehicleType, vehicleRegistration, notes, createdAt: now, updatedAt: now };
      let collectionName: string; let data: Record<string, unknown>;
      if (tab === "book") {
        const address = String(form.get("address") ?? "").trim(); const scheduledFor = String(form.get("scheduledFor") ?? "");
        if (mode === "mobile" && !address) throw new Error("Enter the area or address for the mobile coverage check.");
        if (!scheduledFor) throw new Error("Choose your preferred date and time.");
        collectionName = "bookings";
        data = { ...common, serviceId: serviceId || "general-request", serviceName: activeServices.find(s => s.id === serviceId)?.name || "General car wash request", serviceMode: mode, locationId: mode === "site" ? locationName : "coverage-review", address, scheduledFor, paymentMethod: String(form.get("paymentMethod") || "pay-on-site"), paymentStatus: "unpaid", status: "requested" };
      } else if (tab === "queue") {
        collectionName = "queueEntries";
        data = { ...common, serviceId: serviceId || "walk-in", serviceName: activeServices.find(s => s.id === serviceId)?.name || "Walk-in service", locationId: locationName, status: "waiting" };
      } else {
        collectionName = "fleetRequests";
        data = { ...common, businessName: String(form.get("businessName") ?? "").trim(), contactName: customerName, email: String(form.get("email") ?? "").trim(), vehicleCount: Number(form.get("vehicleCount") || 1), vehicleTypes: [vehicleType], serviceNeeds: [String(form.get("fleetNeeds") || "Regular cleaning")], preferredLocation: String(form.get("preferredLocation") || locationName), preferredSchedule: String(form.get("preferredSchedule") ?? ""), status: "new" };
        if (!data.businessName) throw new Error("Enter the business or fleet name.");
      }
      if (!navigator.onLine || !hasFirebaseWebConfig) {
        const saved = JSON.parse(localStorage.getItem(pendingKey) || "[]") as Array<unknown>;
        saved.push({ id: crypto.randomUUID(), collection: collectionName, data }); localStorage.setItem(pendingKey, JSON.stringify(saved)); formElement.reset();
        setNotice({ kind: "pending", text: "Saved on this device only. It is not visible to the team or a confirmed booking until it syncs." }); return;
      }
      const user = await ensureUser();
      if (!user) throw new Error("Online service is not configured yet. Your request has not been sent.");
      const writePromise = setDoc(doc(collection(db, collectionName)), { ...data, customerId: user.uid });
      formElement.reset(); setNotice({ kind: "pending", text: "Sending securely to Vula's system…" });
      await writePromise;
      setNotice({ kind: "success", text: "Request received by Vula's system. Staff still need to confirm the booking, mobile coverage or fleet arrangement." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "We couldn't send this request. Please try again when connected." });
    } finally { setBusy(false); }
  }

  return <main className="vula">
    <div className="vula-status"><span className={"status-dot " + (online ? "online" : "")}/>{online ? "Connected" : "Offline mode"} <span>·</span> {online ? "Requests sync with the team" : "Saved requests wait on this device"}</div>
    <header className="vula-nav"><a href="#top" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></a><nav><a href="#services">Services</a><a href="#locations">Locations</a><a href="#gallery">Gallery</a><a href="/admin">Staff</a></nav><a className="vula-cta" href="#request">Book a wash ↗</a></header>
    <section className="vula-hero" id="top"><div className="vula-hero-copy"><p className="vula-eyebrow">CAR CARE, MADE SIMPLE</p><h1>A cleaner car.<br/><em>One less thing.</em></h1><p>Book at the wash, request mobile service, or join the walk-in queue. The team sees your request once it syncs—and confirms it before it's booked.</p><div className="vula-actions"><a className="vula-button primary" href="#request">Book or request service ↗</a><a className="vula-button secondary" href="#locations">Find the wash</a></div><div className="vula-trust"><span>✓ Live request sync</span><span>✓ Offline-aware</span><span>✓ Guest booking</span></div></div><div className="vula-hero-art"><div className="car-illustration"><div className="car-roof"/><div className="car-body"/><div className="car-window one"/><div className="car-window two"/><div className="car-wheel left"/><div className="car-wheel right"/><span className="shine shine-one">✦</span><span className="shine shine-two">✦</span></div><div className="hero-caption"><span>VULA / CAR CARE</span><strong>Ready when you are.</strong></div></div></section>
    <section className="vula-section" id="services"><div className="section-title"><p className="vula-eyebrow">THE SERVICE MENU</p><h2>Pick your clean.</h2><p>Services and prices are managed by the team. No unverified prices are assumed.</p></div><div className="vula-services">{activeServices.length ? activeServices.map(service=><article className="service-card" key={service.id}><span className="service-category">{service.category || "CAR WASH"}</span><h3>{service.name}</h3><p>{service.description || "Ask the team about this service."}</p><div className="service-card-bottom"><strong>{money(service.price)}</strong><button type="button" onClick={()=>{setServiceId(service.id);setTab("book");document.getElementById("request")?.scrollIntoView({behavior:"smooth"});}}>Choose service ↗</button></div></article>) : <article className="service-empty"><span>01 / SERVICES</span><h3>Service menu is being set up.</h3><p>Send a general request now. Staff can publish confirmed services and prices from the dashboard.</p><a href="#request" className="text-link">Request a wash ↗</a></article>}</div>{connectionError&&<p className="vula-notice pending">Live catalogue unavailable: {connectionError}</p>}</section>
    <section className="vula-section locations-section" id="locations"><div className="section-title"><p className="vula-eyebrow">COME THROUGH OR CALL US OUT</p><h2>Two ways to get clean.</h2></div><div className="location-cards"><article><span className="location-number">01</span><h3>Visit the wash</h3><p>{locationName} · {String(settings.address || "Exact address to be confirmed")} · {String(settings.openingHours || "Opening hours to be confirmed")}</p><a href="#request" onClick={()=>setMode("site")} className="text-link">Book at the wash ↗</a></article><article><span className="location-number">02</span><h3>Mobile service</h3><p>{mobileCoverage.length ? "Published coverage: " + mobileCoverage.join(", ") : "Coverage has not yet been confirmed. Send an area request and staff will check before accepting."}</p><a href="#request" onClick={()=>setMode("mobile")} className="text-link">Check my area ↗</a></article></div></section>
    <section className="vula-section request-section" id="request"><div className="section-title"><p className="vula-eyebrow">START HERE</p><h2>Make it happen.</h2><p>Submit a booking request, join the walk-in queue, or ask about fleet care.</p><p className="vula-notice pending">A request is not a confirmed appointment. Staff confirmation is required.</p></div><div className="request-panel"><div className="request-tabs">{(["book","queue","fleet"] as const).map(value=><button type="button" key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{value==="book"?"Book a wash":value==="queue"?"Walk-in queue":"Fleet care"}</button>)}</div><form onSubmit={submitRequest} className="vula-form"><div className="form-intro"><strong>{tab==="book"?"Request a booking":tab==="queue"?"Join the walk-in queue":"Fleet and business enquiries"}</strong><span>{tab==="book"?"Staff check and confirm your preferred slot.":tab==="queue"?"Staff manage queue order and wait times.":"Tell us what your vehicles need."}</span></div>
      {tab==="book"&&<><div className="mode-switch"><button type="button" className={mode==="site"?"selected":""} onClick={()=>setMode("site")}>At the wash</button><button type="button" className={mode==="mobile"?"selected":""} onClick={()=>setMode("mobile")}>Mobile service</button></div>{mode==="mobile"&&<p className="coverage-note">{mobileCoverage.length?"Coverage will be checked against: "+mobileCoverage.join(", "):"Mobile coverage is not yet published. This is a request for review, not a confirmed mobile booking."}</p>}</>}
      {tab==="fleet"&&<label>Business / fleet name<input name="businessName" required maxLength={160} placeholder="Business name"/></label>}
      <div className="form-grid"><label>Your name<input name="customerName" required maxLength={120} autoComplete="name" placeholder="Full name"/></label><label>Phone number<input name="phone" required maxLength={40} autoComplete="tel" placeholder="Phone number"/></label><label>Vehicle type<input name="vehicleType" required maxLength={80} placeholder="Sedan, SUV, bakkie…"/></label><label>Registration (optional)<input name="vehicleRegistration" maxLength={30} placeholder="Vehicle registration"/></label>
      {tab==="book"&&<><label>Service<select value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">General car wash request</option>{activeServices.map(s=><option key={s.id} value={s.id}>{s.name}{typeof s.price==="number"?" · "+money(s.price):""}</option>)}</select></label><label>Preferred date and time<input name="scheduledFor" type="datetime-local" required/></label><label>Area / address<input name="address" maxLength={500} required={mode==="mobile"} placeholder={mode==="mobile"?"Area, street or landmark":"Optional site note"}/></label><label>Payment preference<select name="paymentMethod" defaultValue="pay-on-site"><option value="pay-on-site">Pay at the wash / on completion</option><option value="online-payment-request">Request online payment instructions</option></select></label></>}
      {tab==="queue"&&<label>Service<select value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">General walk-in service</option>{activeServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      {tab==="fleet"&&<><label>Number of vehicles<input name="vehicleCount" type="number" min="1" max="10000" defaultValue="2" required/></label><label>Email (optional)<input name="email" type="email" maxLength={254} placeholder="you@company.com"/></label><label>Service needs<input name="fleetNeeds" maxLength={200} placeholder="e.g. regular cleaning"/></label><label>Preferred schedule<input name="preferredSchedule" maxLength={200} placeholder="Days / frequency"/></label><label>Preferred location<input name="preferredLocation" maxLength={200} defaultValue={locationName}/></label></>}
      <label className="full-field">Notes (optional)<textarea name="notes" maxLength={1500} rows={3} placeholder="Anything the team should know?"/></label></div><button className="vula-button primary submit-button" disabled={busy}>{busy?"Sending…":tab==="book"?"Send booking request":tab==="queue"?"Join the queue":"Send fleet enquiry"} ↗</button>{notice&&<p role="status" className={"vula-notice "+notice.kind}>{notice.text}</p>}</form></div></section>
    <section className="vula-section account-section" id="my-wash"><div className="section-title"><p className="vula-eyebrow">YOUR WASH SPACE</p><h2>My requests & loyalty.</h2><p>Booking updates are shared live when online. Points are maintained by staff using the business's confirmed loyalty policy.</p></div><div className="account-grid"><article className="account-card loyalty-card"><span className="service-category">LOYALTY BALANCE</span><strong className="loyalty-points">{loyaltyPoints}</strong><span>points</span><p>Points are not automatically awarded until Vula confirms the earning rules. Ask staff if you need help linking this guest session to another device.</p><label className="reminder-toggle"><input type="checkbox" checked={remindersEnabled} onChange={e=>setRemindersEnabled(e.target.checked)}/> Save in-app booking reminder preference</label><button type="button" className="vula-button secondary" onClick={()=>void saveReminderChoice()} disabled={!userId || !online}>Save preference</button>{reminderNotice&&<p className="vula-notice pending">{reminderNotice}</p>}</article><article className="account-card"><span className="service-category">MY BOOKINGS</span>{myBookings.length?myBookings.slice(0,5).map(item=><div className="customer-booking" key={item.id}><strong>{item.serviceName}</strong><span>{item.status} · {item.scheduledFor||"Time to be agreed"}</span><small>{item.serviceMode==="mobile"?"Mobile request":"At the wash"} · {item.phone}</small></div>):<p className="account-empty">{userId?"No booking requests are linked to this guest session yet.":"Your requests will appear here after you submit your first online request."}</p>}</article></div></section>
    <section className="vula-section gallery-section" id="gallery"><div className="section-title"><p className="vula-eyebrow">THE RESULTS</p><h2>Care in every detail.</h2><p>Gallery photos are managed by staff. Only published images appear here.</p></div><div className="vula-gallery">{gallery.length?gallery.map(item=><figure key={item.id}><img src={item.imageUrl} alt={item.title} loading="lazy"/><figcaption><strong>{item.title}</strong><span>{item.description}</span></figcaption></figure>):<div className="gallery-empty">Vula's real work photos will appear here when staff publish them.</div>}</div></section>
    <section className="vula-bottom"><p className="vula-eyebrow">READY WHEN YOU ARE</p><h2>Your car called.</h2><p>Let's get it clean. Every booking is confirmed by the team.</p><a href="#request" className="vula-button primary">Book or enquire ↗</a></section>
    <footer className="vula-footer"><a href="#top" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></a><span>{userId ? "Customer session active" : "Guest booking available"} · Shared when synced</span><a href="/admin">Staff sign in</a></footer>
  </main>;
}
