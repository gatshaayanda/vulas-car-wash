import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { vulaServiceSeed } from "@/lib/vula/service-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
function adminApp() {
  const existing = getApps().find(item => item.name === "vula-operations");
  if (existing) return existing;
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) throw new Error("Online booking is not configured on the server.");
  return initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]), projectId: "vulas-car-wash" }, "vula-operations");
}
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Booking request could not be saved.";
  const status = /sign in|token|authorization/i.test(message) ? 401 : /unavailable|not configured/i.test(message) ? 503 : /no longer available|closed|opening hours|service is no longer published|choose a future/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Sign in to send an online booking request." }, { status: 401 });
    const app = adminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    const body = await request.json() as Record<string, unknown>;
    const customerName = clean(body.customerName, 120), phone = clean(body.phone, 40), vehicleType = clean(body.vehicleType, 80);
    const vehicleRegistration = clean(body.vehicleRegistration, 30), notes = clean(body.notes, 1500);
    const address = clean(body.address, 500), mode = body.serviceMode === "mobile" ? "mobile" : "site";
    const scheduledFor = clean(body.scheduledFor, 40);
    const requestId = clean(body.requestId, 120);
    if (requestId && !/^[a-zA-Z0-9_-]{1,120}$/.test(requestId)) return NextResponse.json({ error: "Invalid booking request ID." }, { status: 400 });
    if (!customerName || !phone || !vehicleType) return NextResponse.json({ error: "Enter your name, phone number and vehicle type." }, { status: 400 });
    if (mode === "mobile" && !address) return NextResponse.json({ error: "Enter the area or address for the mobile service request." }, { status: 400 });
    const scheduledDate = new Date(scheduledFor);
    if (!scheduledFor || !Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future appointment time." }, { status: 400 });
    const localDate = new Date(scheduledDate.getTime() + 2 * 3600000);
    const date = localDate.toISOString().slice(0, 10);
    const time = localDate.toISOString().slice(11, 16);
    if (new Date(date + "T12:00:00+02:00").toISOString().slice(0, 10) !== date) return NextResponse.json({ error: "Choose a valid appointment date." }, { status: 400 });
    const rawIds = Array.isArray(body.serviceIds) ? body.serviceIds : (typeof body.serviceId === "string" && body.serviceId !== "general-request" ? [body.serviceId] : []);
    const serviceIds = Array.from(new Set(rawIds.filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(id)))).slice(0, 20);
    if (rawIds.length > 20 || (rawIds.length && !serviceIds.length)) return NextResponse.json({ error: "Choose valid services from the published menu." }, { status: 400 });
    const db = getFirestore(app);
    const settingsRef = db.doc("businessSettings/main");
    const bookingRef = requestId ? db.collection("bookings").doc(requestId) : db.collection("bookings").doc();
    const serviceRefs = serviceIds.map(id => db.collection("services").doc(id));
    const result = await db.runTransaction(async transaction => {
      const existingRequest = await transaction.get(bookingRef);
      if (existingRequest.exists) {
        const existing = existingRequest.data() || {};
        if (existing.customerId !== decoded.uid) throw new Error("This booking request ID has already been used.");
        return {
          id: bookingRef.id,
          serviceNames: Array.isArray(existing.serviceNames) ? existing.serviceNames.map(String) : [clean(existing.serviceName, 240) || "General car wash request"],
          ...(typeof existing.priceQuote === "number" ? { total: existing.priceQuote } : {}),
          scheduledFor: clean(existing.scheduledFor, 40),
          alreadySaved: true,
        };
      }
      const settingsSnapshot = await transaction.get(settingsRef);
      const settings = settingsSnapshot.data() ?? {};
      const open = clean(settings.openingTime, 5) || "08:00";
      const close = clean(settings.closingTime, 5) || "17:00";
      const closedDays = Array.isArray(settings.closedDays) ? settings.closedDays.map(String) : [];
      const dayName = dayNames[new Date(date + "T12:00:00+02:00").getUTCDay()];
      if (closedDays.includes(dayName)) throw new Error("The wash is closed on " + dayName + ". Choose another appointment date.");
      if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || minutes(open) >= minutes(close)) throw new Error("Staff need to configure valid opening hours before online bookings can be confirmed.");
      const interval = Math.max(15, Math.min(60, Number(settings.slotIntervalMinutes || 30)));
      const startMinutes = minutes(time);
      if (startMinutes < minutes(open) || startMinutes + interval > minutes(close) || (startMinutes - minutes(open)) % interval !== 0) throw new Error("Choose a time within operating hours from the live calendar.");
      const serviceSnapshots = await Promise.all(serviceRefs.map(ref => transaction.get(ref)));
      let services: Array<{ id: string; name: string; category: string; price: number | null; durationMinutes: number }>;
      if (serviceSnapshots.every(snapshot => snapshot.exists && snapshot.data()?.active === true)) {
        services = serviceSnapshots.map((snapshot, index) => {
          const data = snapshot.data()!;
          return { id: serviceIds[index], name: clean(data.name, 120), category: clean(data.category, 80), price: typeof data.price === "number" && Number.isFinite(data.price) && data.price >= 0 ? data.price : null, durationMinutes: Math.max(15, Math.min(240, Number(data.durationMinutes || 30))) };
        });
      } else {
        const catalogueCheck = await transaction.get(db.collection("services").limit(1));
        if (!catalogueCheck.empty) throw new Error("A selected service is no longer published. Refresh the menu and try again.");
        const starterById = new Map(vulaServiceSeed.map(item => [item.id, item]));
        services = serviceIds.map(id => {
          const item = starterById.get(id);
          if (!item) throw new Error("Choose valid services from the published menu.");
          return { id: item.id, name: item.name, category: item.category, price: item.price > 0 ? item.price : null, durationMinutes: item.durationMinutes };
        });
      }
      const durationMinutes = Math.max(30, Math.min(240, services.reduce((sum, service) => sum + service.durationMinutes, 0) || 30));
      if (startMinutes + durationMinutes > minutes(close)) throw new Error("This service basket finishes outside operating hours. Choose an earlier time or a shorter basket.");
      const startIso = new Date(date + "T00:00:00+02:00").toISOString();
      const endIso = new Date(new Date(date + "T00:00:00+02:00").getTime() + 86400000).toISOString();
      const query = db.collection("bookings").where("scheduledFor", ">=", startIso).where("scheduledFor", "<", endIso);
      const bookingsSnapshot = await transaction.get(query);
      const capacityKey = mode === "mobile" ? "mobileCapacityPerSlot" : "siteCapacityPerSlot";
      const capacity = Math.max(1, Math.min(100, Number(settings[capacityKey] || 1)));
      const proposedStart = scheduledDate.getTime();
      const proposedEnd = proposedStart + (durationMinutes + Math.max(0, Number(settings.bufferMinutes || 0))) * 60000;
      const active = bookingsSnapshot.docs.map(doc => doc.data()).filter(item =>
        item.serviceMode === mode && !["cancelled", "completed", "declined"].includes(String(item.status || "").toLowerCase())
      ).filter(item => {
        const existingStart = new Date(String(item.scheduledFor)).getTime();
        const existingDuration = Math.max(15, Math.min(240, Number(item.durationMinutes || 30)));
        return Number.isFinite(existingStart) && existingStart < proposedEnd && existingStart + existingDuration * 60000 > proposedStart;
      });
      if (active.length >= capacity) throw new Error("That time is no longer available. Choose another time from the live calendar.");
      const serviceNames = services.length ? services.map(service => service.name) : ["General car wash request"];
      const total = services.length && services.every(service => typeof service.price === "number") ? services.reduce((sum, service) => sum + Number(service.price), 0) : undefined;
      const now = new Date().toISOString();
      const booking = {
        customerId: decoded.uid, customerName, phone, vehicleType, vehicleRegistration,
        serviceId: services[0]?.id || "general-request", serviceName: serviceNames.join(" + "),
        ...(services.length ? { serviceIds: services.map(service => service.id), serviceNames, basketItems: services, } : {}),
        durationMinutes, serviceMode: mode, locationId: mode === "site" ? clean(settings.locationName, 120) || "G-West" : "coverage-review",
        address, scheduledFor, notes, paymentMethod: clean(body.paymentMethod, 60) || "pay-on-site",
        paymentStatus: "unpaid", status: "requested", createdAt: now, updatedAt: now,
        ...(total === undefined ? {} : { priceQuote: total }),
      };
      transaction.create(bookingRef, booking);
      return { id: bookingRef.id, serviceNames, total, scheduledFor, durationMinutes };
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Vula] online booking failed", error instanceof Error ? error.message : "unknown");
    return failure(error);
  }
}
