import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const clock = (value: number) => String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
function app() {
  const existing = getApps().find(item => item.name === "vula-operations");
  if (existing) return existing;
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) throw new Error("Live appointment availability is not configured on the server.");
  return initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]), projectId: "vulas-car-wash" }, "vula-operations");
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00+02:00");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  const mode = url.searchParams.get("mode") === "mobile" ? "mobile" : "site";
  const duration = Math.max(15, Math.min(240, Number(url.searchParams.get("duration") || 30)));
  if (!validDate(date)) return NextResponse.json({ error: "Choose a valid appointment date." }, { status: 400 });
  try {
    const db = getFirestore(app());
    const settingsSnapshot = await db.doc("businessSettings/main").get();
    const settings = settingsSnapshot.data() ?? {};
    const dateAtNoon = new Date(date + "T12:00:00+02:00");
    const closedDays = Array.isArray(settings.closedDays) ? settings.closedDays.map(String) : [];
    const dayName = dayNames[dateAtNoon.getUTCDay()];
    const open = String(settings.openingTime || "08:00");
    const close = String(settings.closingTime || "17:00");
    const today = new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 10);
    const distance = Math.floor((new Date(date + "T12:00:00+02:00").getTime() - new Date(today + "T12:00:00+02:00").getTime()) / 86400000);
    if (date < today) return NextResponse.json({ slots: [], hours: open + "–" + close, note: "Choose today or a future date." });
    if (closedDays.includes(dayName)) return NextResponse.json({ slots: [], hours: open + "–" + close, note: "The wash is marked closed on " + dayName + ". Choose another day." });
    if (minutes(open) >= minutes(close)) return NextResponse.json({ error: "Staff need to set valid opening and closing times." }, { status: 503 });
    const startIso = new Date(date + "T00:00:00+02:00").toISOString();
    const endIso = new Date(new Date(date + "T00:00:00+02:00").getTime() + 86400000).toISOString();
    const snapshot = await db.collection("bookings").where("scheduledFor", ">=", startIso).where("scheduledFor", "<", endIso).get();
    const capacityKey = mode === "mobile" ? "mobileCapacityPerSlot" : "siteCapacityPerSlot";
    const capacity = Math.max(1, Math.min(100, Number(settings[capacityKey] || 1)));
    const active = snapshot.docs.map(doc => doc.data()).filter(item =>
      item.serviceMode === mode && !["cancelled", "completed", "declined"].includes(String(item.status || "").toLowerCase())
    ).map(item => {
      const start = new Date(String(item.scheduledFor)).getTime();
      const occupiedMinutes = Math.max(15, Math.min(240, Number(item.durationMinutes || 30)));
      return { start, end: start + occupiedMinutes * 60000 };
    }).filter(item => Number.isFinite(item.start));
    const interval = Math.max(15, Math.min(60, Number(settings.slotIntervalMinutes || 30)));
    const buffer = Math.max(0, Math.min(120, Number(settings.bufferMinutes || 0)));
    const slots: string[] = [];
    for (let start = minutes(open); start + duration <= minutes(close); start += interval) {
      const slotTime = new Date(date + "T" + clock(start) + ":00+02:00");
      if (slotTime.getTime() <= Date.now()) continue;
      const slotStart = slotTime.getTime();
      const slotEnd = slotStart + (duration + buffer) * 60000;
      const overlaps = active.filter(item => item.start < slotEnd && item.end > slotStart).length;
      if (overlaps < capacity) slots.push(clock(start));
    }
    return NextResponse.json({ slots, hours: open + "–" + close, note: distance > 90 ? "This date is beyond the usual 90-day planning window; staff will need to confirm it." : "", capacity }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Vula] live availability lookup failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Live availability is temporarily unavailable. We will not show unverified times as available." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
