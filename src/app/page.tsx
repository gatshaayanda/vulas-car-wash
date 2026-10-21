/* eslint-disable react/no-unescaped-entities */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, linkWithPopup, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, hasFirebaseWebConfig } from "@/lib/firebase/client";
import { subscribeAnnouncements, subscribeCustomerBookings, subscribeServices, subscribeSettings, type VulaAnnouncement, type VulaBooking, type VulaService } from "@/lib/firebase/vula-data";
import RacingHub from "./games/racing-hub";
import ServiceGuide from "./ServiceGuide";
import { showVulaToast } from "@/lib/vula-toast";
import "./vula.css";

type Notice = { kind: "success" | "error" | "pending"; text: string };
const pendingKey = "vulas-car-wash:offline-requests:v1";
const stamp = () => new Date().toISOString();
const money = (price?: number | null) => typeof price === "number" ? "P" + price.toLocaleString("en-BW", { maximumFractionDigits: 2 }) : "Price confirmed by the team";

export default function Home() {
  const [services, setServices] = useState<VulaService[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [announcements, setAnnouncements] = useState<VulaAnnouncement[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [online, setOnline] = useState(true);
  const [userId, setUserId] = useState("");
  const [isGuest, setIsGuest] = useState(true);
  const [linkNotice, setLinkNotice] = useState("");
  const [customerBookings, setCustomerBookings] = useState<VulaBooking[]>([]);
  const [customerBookingsLoading, setCustomerBookingsLoading] = useState(false);
  const [customerBookingsError, setCustomerBookingsError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode] = useState<"site" | "mobile">("site");
  const [serviceId, setServiceId] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [appointmentHours, setAppointmentHours] = useState("08:00–17:00");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; customerName: string; vehicleType: string; serviceNames: string[]; total?: number; scheduledFor?: string } | null>(null);
  const [tab, setTab] = useState<"book" | "queue">("book");
  const [connectionError, setConnectionError] = useState("");
  const businessName = typeof settings.businessName === "string" && settings.businessName.trim() ? settings.businessName : "Vula's Car Wash";
  useEffect(() => { document.title = businessName; }, [businessName]);
  useEffect(() => { if (notice) showVulaToast(notice.text, notice.kind); }, [notice]);
  const locationName = typeof settings.locationName === "string" && settings.locationName.trim() ? settings.locationName : "G-West";
  const activeServices = useMemo(() => services.filter(service => service.active), [services]);
  const selectedServices = useMemo(() => activeServices.filter(service => selectedServiceIds.includes(service.id)), [activeServices, selectedServiceIds]);
  const basketTotal = selectedServices.length && selectedServices.every(service => typeof service.price === "number") ? selectedServices.reduce((sum, service) => sum + Number(service.price), 0) : undefined;
  const appointmentDuration = Math.max(30, Math.min(240, selectedServices.reduce((sum, service) => sum + Number(service.durationMinutes || 30), 0) || 30));
  const slotGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const time of availableSlots) { const hour = time.slice(0, 2); (groups[hour] ??= []).push(time); }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([hour, times]) => [hour, times.sort((a, b) => a.localeCompare(b))] as [string, string[]]);
  }, [availableSlots]);
  const minAppointmentDate = new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 10);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); void syncOfflineRequests(); };
    const onOffline = () => { setOnline(false); setNotice({ kind: "pending", text: "Offline: requests can be saved on this device, but the team cannot see them until they sync." }); };
    const stopAuth = onAuthStateChanged(auth, user => { setUserId(user?.uid ?? ""); setIsGuest(user?.isAnonymous ?? true); });
    const stops = [subscribeServices(value => { setServices(value); setServicesLoaded(true); }, error => { setConnectionError(error.message); setServicesLoaded(true); }), subscribeAnnouncements(setAnnouncements, () => {}), subscribeSettings(value => setSettings(value ?? {}), () => {})];
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    if (navigator.onLine) void syncOfflineRequests();
    return () => { stopAuth(); stops.forEach(stop => stop()); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (!userId || isGuest) {
      setCustomerBookings([]);
      setCustomerBookingsLoading(false);
      setCustomerBookingsError("");
      return;
    }
    setCustomerBookingsLoading(true);
    const stop = subscribeCustomerBookings(userId, value => {
      setCustomerBookings(value);
      setCustomerBookingsLoading(false);
      setCustomerBookingsError("");
    }, error => {
      setCustomerBookingsLoading(false);
      setCustomerBookingsError(error.message);
    });
    return () => stop();
  }, [userId, isGuest]);

  useEffect(() => {
    if (!showTimePicker) return;
    const dialog = document.querySelector<HTMLElement>(".vula-time-picker-dialog");
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setShowTimePicker(false); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [showTimePicker]);

  useEffect(() => {
    if (!appointmentDate || tab !== "book") { setAvailableSlots([]); setSelectedTime(""); return; }
    const controller = new AbortController();
    setAvailabilityLoading(true); setAvailabilityError(""); setAvailabilityNote(""); setSelectedTime("");
    fetch("/api/availability?date=" + encodeURIComponent(appointmentDate) + "&mode=" + mode + "&duration=" + appointmentDuration, { cache: "no-store", signal: controller.signal })
      .then(async response => { const payload = await response.json().catch(() => ({})) as { slots?: string[]; hours?: string; note?: string; error?: string }; if (!response.ok) throw new Error(payload.error || "Live availability could not be checked."); return payload; })
      .then(payload => { if (controller.signal.aborted) return; setAvailableSlots(Array.isArray(payload.slots) ? payload.slots : []); setAppointmentHours(payload.hours || "08:00–17:00"); setAvailabilityNote(payload.note || ""); })
      .catch(error => { if (!controller.signal.aborted) { setAvailableSlots([]); setAvailabilityError(error instanceof Error ? error.message : "Live availability could not be checked."); } })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [appointmentDate, mode, appointmentDuration, tab, availabilityRetry]);

  async function linkGuestAccount() {
    const user = auth.currentUser;
    if (!user || !user.isAnonymous) { setLinkNotice("This session is already linked to a sign-in method."); return; }
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
      setIsGuest(false);
      setLinkNotice("Your Vula booking history is now linked to this Google account.");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as {code?:unknown}).code) : "";
      setLinkNotice(code === "auth/credential-already-in-use" ? "That Google account is already linked to another Vula account. The two booking histories have not been merged." : error instanceof Error ? error.message : "We could not link this session. Try again while online.");
    }
  }

  async function saveCustomerRecord(uid: string, name: string, phone: string, email: string) {
    const customerRef = doc(db, "customers", uid);
    const existing = await getDoc(customerRef);
    const previous = existing.exists() ? existing.data() : {};
    await setDoc(customerRef, {
      uid,
      name: name.trim() || String(previous.name || ""),
      email: email.trim() || String(previous.email || ""),
      phone: phone.trim() || String(previous.phone || ""),
      vehicleRegistrations: Array.isArray(previous.vehicleRegistrations) ? previous.vehicleRegistrations : [],
      createdAt: typeof previous.createdAt === "string" ? previous.createdAt : stamp(),
      updatedAt: stamp(),
    }, { merge: true });
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
        const id = draft.id || crypto.randomUUID();
        try {
          await saveCustomerRecord(user.uid, String(draft.data.customerName || ""), String(draft.data.phone || ""), String(draft.data.email || user.email || ""));
          if (draft.collection === "bookings") {
            const response = await fetch("/api/bookings", { method: "POST", headers: { Authorization: "Bearer " + await user.getIdToken(), "Content-Type": "application/json" }, body: JSON.stringify({ ...draft.data, requestId: id }) });
            const payload = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(payload.error || "The saved booking could not sync. It may need a new available time.");
          } else {
            await setDoc(doc(db, draft.collection, id), { ...draft.data, customerId: user.uid, updatedAt: stamp() });
          }
        } catch { remaining.push(draft); }
      }
      localStorage.setItem(pendingKey, JSON.stringify(remaining));
      setNotice(remaining.length ? { kind: "pending", text: remaining.length + " saved request(s) still have not synced." } : { kind: "success", text: "Saved requests have synced to the team. Bookings still need staff confirmation." });
    } catch { setNotice({ kind: "pending", text: "Sync is not complete. Your saved requests remain on this device." }); }
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const requestTab = String(form.get("requestType") || tab) as "book" | "queue" | "fleet";
    const customerName = String(form.get("customerName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const vehicleType = String(form.get("vehicleType") ?? "").trim();
    const vehicleRegistration = String(form.get("vehicleRegistration") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const now = stamp();
    if (!customerName || !phone || !vehicleType) { setNotice({ kind: "error", text: "Enter your name, phone number and vehicle type." }); return; }
    setBusy(true); setNotice(null); setReceipt(null);
    try {
      const common: Record<string, unknown> = { customerName, phone, vehicleType, vehicleRegistration, notes, createdAt: now, updatedAt: now };
      let collectionName: string; let data: Record<string, unknown>;
      if (requestTab === "book") {
        const address = String(form.get("address") ?? "").trim();
        if (mode === "mobile" && !address) throw new Error("Enter the area or address for the mobile coverage check.");
        if (!appointmentDate || !selectedTime) throw new Error("Choose an appointment date and one of the currently available times.");
        if (!selectedServices.length) throw new Error("Choose at least one service for your basket.");
        if (navigator.onLine && hasFirebaseWebConfig) {
          if (!availableSlots.includes(selectedTime)) throw new Error("That time is no longer in the current availability list. Choose another time.");
          const availabilityResponse = await fetch("/api/availability?date=" + encodeURIComponent(appointmentDate) + "&mode=" + mode + "&duration=" + appointmentDuration, { cache: "no-store" });
          const liveAvailability = await availabilityResponse.json().catch(() => ({})) as { slots?: string[]; error?: string };
          if (!availabilityResponse.ok) throw new Error(liveAvailability.error || "We could not recheck the live calendar. Please try again.");
          if (!Array.isArray(liveAvailability.slots) || !liveAvailability.slots.includes(selectedTime)) throw new Error("That time has just become unavailable. Choose another available time.");
        }
        const scheduledDate = new Date(appointmentDate + "T" + selectedTime + ":00+02:00");
        if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) throw new Error("Choose a future appointment time.");
        const scheduledFor = scheduledDate.toISOString();
        const basketItems = selectedServices.map(service => ({ serviceId: service.id, name: service.name, price: typeof service.price === "number" ? service.price : null, durationMinutes: Number(service.durationMinutes || 30) }));
        collectionName = "bookings";
        data = { ...common, serviceId: selectedServices[0]?.id || "general-request", serviceName: selectedServices.map(service => service.name).join(" + "), serviceIds: selectedServices.map(service => service.id), serviceNames: selectedServices.map(service => service.name), basketItems, durationMinutes: appointmentDuration, ...(basketTotal === undefined ? {} : { priceQuote: basketTotal }), serviceMode: mode, locationId: mode === "site" ? locationName : "coverage-review", address, scheduledFor, paymentMethod: String(form.get("paymentMethod") || "pay-on-site"), paymentStatus: "unpaid", status: "requested" };
      } else if (requestTab === "queue") {
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
      await saveCustomerRecord(user.uid, customerName, phone, String(form.get("email") || user.email || ""));
      setNotice({ kind: "pending", text: "Sending securely to the team…" });
      if (requestTab === "book") {
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { Authorization: "Bearer " + await user.getIdToken(), "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const payload = await response.json().catch(() => ({})) as { id?: string; serviceNames?: string[]; total?: number; scheduledFor?: string; error?: string };
        if (!response.ok || !payload.id) throw new Error(payload.error || "The booking request could not be saved. Please try again.");
        setReceipt({ id: payload.id, customerName, vehicleType, serviceNames: payload.serviceNames || selectedServices.map(service => service.name), ...(typeof payload.total === "number" ? { total: payload.total } : {}), scheduledFor: payload.scheduledFor || String(data.scheduledFor) });
        setShowTimePicker(false);
      } else {
        const recordRef = doc(collection(db, collectionName));
        await setDoc(recordRef, { ...data, customerId: user.uid });
      }
      formElement.reset();
      setSelectedServiceIds([]); setSelectedTime(""); setAppointmentDate("");
      setNotice({ kind: "success", text: "Request received by the team. Staff still need to confirm the booking, mobile coverage or fleet arrangement." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "We couldn't send this request. Please try again when connected." });
    } finally { setBusy(false); }
  }

  return <main className="vula">
    {!online && <div className="vula-offline-banner" role="status">You’re offline. Requests stay on this device until connection returns.</div>}
    <header className="vula-nav"><a href="#top" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></a><nav><a href="#services">Wash menu</a></nav><a className="vula-cta" href="#request">Book a wash ↗</a></header>
    {announcements.some(item => item.active) && <section className="vula-section" aria-label="Announcements"><div className="announcement-list">{announcements.filter(item => item.active).map(item=><article className="vula-notice pending" key={item.id}><strong>{item.title}</strong><p>{item.body}</p></article>)}</div></section>}
    <section className="vula-hero" id="top"><div className="vula-hero-copy"><p className="vula-eyebrow">YOUR LOCAL CAR WASH</p><h1>A fresh clean.<br/><em>Made simple.</em></h1><p>Choose a wash, request a time, and leave the rest to us.</p><div className="vula-actions"><a className="vula-button primary" href="#services">Choose your wash ↓</a></div><p className="vula-hero-note">Choose a wash and book a time in a few quick steps.</p></div><div className="vula-hero-art"><div className="car-illustration"><div className="car-roof"/><div className="car-body"/><div className="car-window one"/><div className="car-window two"/><div className="car-wheel left"/><div className="car-wheel right"/><span className="shine shine-one">✦</span><span className="shine shine-two">✦</span></div><div className="hero-caption"><span>{businessName.toUpperCase()}</span><strong>Ready when you are.</strong></div></div></section>
    <section className="vula-section" id="services"><div className="section-title"><p className="vula-eyebrow">THE SERVICE MENU</p><h2>Pick your clean.</h2><p>Browse the available washes and extras.</p></div><div className="vula-services">{!servicesLoaded ? <article className="service-empty"><span>01 / SERVICES</span><h3>Loading the wash menu…</h3><p>Checking the current service list.</p></article> : activeServices.length ? activeServices.map(service=><article className="service-card" key={service.id}>{service.imageUrl ? <img className="service-card-image" src={service.imageUrl} alt={service.name} loading="lazy"/> : <div className="service-card-placeholder" aria-hidden="true"><span>VULA</span><strong>{service.category || "CAR WASH"}</strong></div>}<span className="service-category">{service.category || "CAR WASH"}</span><h3>{service.name}</h3><p>{service.description || "Ask the team about this service."}</p><div className="service-card-bottom"><strong>{money(service.price)}</strong><button type="button" onClick={()=>{setServiceId(service.id);setSelectedServiceIds([service.id]);setTab("book");document.getElementById("request")?.scrollIntoView({behavior:"smooth"});}}>Choose wash →</button></div></article>) : <article className="service-empty"><span>01 / SERVICES</span><h3>Service menu is being set up.</h3><p>Send a general request now. Staff can publish confirmed services and prices from the dashboard.</p><a href="#request" className="text-link">Request a wash ↗</a></article>}</div>{connectionError&&<p className="vula-notice pending">We couldn’t load the wash menu. Please try again shortly.</p>}</section>

    <section className="vula-section request-section" id="request"><div className="section-title"><p className="vula-eyebrow">BOOK YOUR WASH</p><h2>Pick a time that works.</h2><p>Choose your wash, pick a time, and send your request.</p></div><div className="request-panel">{receipt ? <article className="wash-confirmation" aria-labelledby="wash-confirmation-title"><p className="vula-eyebrow">REQUEST RECEIVED</p><div className="wash-confirmation-mark" aria-hidden="true">✓</div><h3 id="wash-confirmation-title">Thanks, {receipt.customerName.split(" ")[0] || "your request"}.</h3><p className="wash-confirmation-intro">Your booking request has been received. We’ll contact you to confirm the appointment.</p><div className="wash-confirmation-reference"><span>Booking reference</span><strong>#{receipt.id.slice(0,8).toUpperCase()}</strong></div><dl><div><dt>Vehicle</dt><dd>{receipt.vehicleType}</dd></div><div><dt>Wash</dt><dd>{receipt.serviceNames.join(", ")}</dd></div><div><dt>Requested time</dt><dd>{receipt.scheduledFor ? new Date(receipt.scheduledFor).toLocaleString("en-BW",{dateStyle:"medium",timeStyle:"short"}) : "To be confirmed"}</dd></div><div><dt>Estimated total</dt><dd>{money(receipt.total)}</dd></div></dl><div className="wash-confirmation-actions"><Link className="vula-button primary" href="/account?submitted=1">View my bookings ↗</Link><button type="button" className="vula-button secondary" onClick={() => { setReceipt(null); setNotice(null); document.getElementById("services")?.scrollIntoView({behavior:"smooth"}); }}>Back to washes</button></div><p className="wash-confirmation-note">Your time is a request until the team confirms it. No payment has been taken.</p></article> : <form onSubmit={submitRequest} className="vula-form"><input type="hidden" name="requestType" value={tab}/><div className="form-intro"><strong>Book your wash</strong><span>Choose a service and available time.</span></div>
      
      
      <div className="form-grid"><label>Your name<input name="customerName" required maxLength={120} autoComplete="name" placeholder="Full name"/></label><label>Phone number<input name="phone" required maxLength={40} autoComplete="tel" placeholder="Phone number"/></label><label>Vehicle type<input name="vehicleType" required maxLength={80} placeholder="Sedan, SUV, bakkie…"/></label>
      {tab==="book"&&<><div className="service-choice full-field"><label>Choose your wash<select value={selectedServiceIds[0]||""} onChange={event=>setSelectedServiceIds(event.target.value?[event.target.value]:[])} required><option value="">Choose a service</option>{activeServices.map(service=><option key={service.id} value={service.id}>{service.name} · {money(service.price)} · {service.durationMinutes||30} min</option>)}</select></label>{selectedServices[0]&&<div className="selected-service-summary"><p>{selectedServices[0].description}</p><strong>{money(selectedServices[0].price)} · about {selectedServices[0].durationMinutes||30} minutes</strong></div>}</div><div className="appointment-picker full-field"><div className="appointment-heading"><div><span className="service-category">APPOINTMENT</span><h3>Choose your date</h3></div><span className="hours-pill">Operating hours {appointmentHours}</span></div><label>Appointment date<input name="appointmentDate" type="date" min={minAppointmentDate} value={appointmentDate} onChange={event=>setAppointmentDate(event.target.value)} required/><small>{appointmentDate ? new Date(appointmentDate+"T12:00:00").toLocaleDateString("en-BW",{weekday:"long"})+" · Operating hours "+appointmentHours+". Times below are checked against the live calendar." : "Choose a date to check available times."}</small></label><div className="appointment-time"><strong>Appointment time</strong><p>Choose from available times.</p>{(!online || !hasFirebaseWebConfig)?<><label>Preferred time<input type="time" value={selectedTime} onChange={event=>setSelectedTime(event.target.value)} required/><small>Offline / local-only: this is a requested time, not live availability. The team must check it after sync.</small></label></>:availabilityLoading?<p className="slot-hint">Checking times…</p>:availabilityError?<div className="slot-error" role="alert"><p>{availabilityError}</p><button type="button" className="vula-button secondary" onClick={()=>setAvailabilityRetry(value=>value+1)}>Try checking again</button></div>:!appointmentDate?<p className="slot-hint">Choose a date first.</p>:availableSlots.length===0?<p className="slot-hint">{availabilityNote || "No available times were found. Try another date."}</p>:<><div className="time-selection-summary"><div><strong>{selectedTime || "Choose a time"}</strong><small>{selectedTime ? "Selected appointment time" : availableSlots.length+" available times"}</small></div><button type="button" className="vula-button secondary" onClick={() => setShowTimePicker(true)} aria-haspopup="dialog" aria-expanded={showTimePicker}>{selectedTime ? "Change time" : "Choose time"}</button></div>{showTimePicker && <div className="vula-time-picker-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowTimePicker(false); }}><section className="vula-time-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="vula-time-picker-title" tabIndex={-1}><div className="vula-time-picker-heading"><div><span className="service-category">APPOINTMENT</span><h3 id="vula-time-picker-title">Choose your time</h3><p>{appointmentDate ? new Date(appointmentDate + "T12:00:00").toLocaleDateString("en-BW",{weekday:"long",day:"numeric",month:"long"}) : ""} · Operating hours {appointmentHours}</p></div><button type="button" className="vula-time-picker-close" aria-label="Close time selector" onClick={() => setShowTimePicker(false)}>×</button></div><div className="vula-slot-hour-groups" aria-label="Available appointment times">{slotGroups.map(([hour,times]) => <section className="vula-slot-hour-group" key={hour} aria-labelledby={"vula-slot-hour-"+hour}><h4 id={"vula-slot-hour-"+hour}>{hour}:00 hour</h4><div className="vula-slot-grid" role="group" aria-label={"Times starting at "+hour+":00"}>{times.map(time => <button key={time} type="button" className={selectedTime===time ? "vula-slot-button selected" : "vula-slot-button"} aria-pressed={selectedTime===time} onClick={() => { setSelectedTime(time); setShowTimePicker(false); }}>{time}</button>)}</div></section>)}</div><p className="slot-hint">Choose a time to return to your booking. Availability is checked again when you submit.</p></section></div>}</>}</div></div></>}
      
      
      <label className="full-field">Extra requests / instructions (optional)<textarea name="notes" maxLength={1500} rows={3} placeholder="For example: child seat to be left in place, heavy mud, pet hair, specific areas to avoid, or a preferred finish."/></label></div><button className="vula-button primary submit-button" disabled={busy}>{busy?"Sending…":"Request booking"} ↗</button>{notice&&<p role="status" className={"vula-notice "+notice.kind}>{notice.text}</p>}</form>}</div></section>
    <section className="vula-section racing-section" id="vula-racing" aria-label="Vula Racing"><RacingHub embedded /></section>
    <ServiceGuide view="shop" services={activeServices} requestCount={customerBookings.length} onChooseService={service => { setServiceId(service.id); setSelectedServiceIds([service.id]); setTab("book"); document.getElementById("request")?.scrollIntoView({ behavior: "smooth" }); }} onOpenAccount={() => document.getElementById("request")?.scrollIntoView({ behavior: "smooth" })} onOpenAdmin={() => { window.location.href = "/admin"; }} onOpenStorefront={() => { window.scrollTo({ top: 0, behavior: "smooth" }); }} />
    <footer className="vula-footer"><a href="#top" className="vula-brand"><span className="vula-mark">V</span><span>{businessName}<small>Wash. Care. Go.</small></span></a>{!online && <span>Offline · requests not yet sent</span>}<a href="/admin">Staff sign in</a></footer>
  </main>;
}
