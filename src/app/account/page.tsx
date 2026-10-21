"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GoogleAuthProvider, linkWithPopup, onAuthStateChanged, type User } from "firebase/auth";
import { auth, hasFirebaseWebConfig } from "@/lib/firebase/client";
import { subscribeCustomerBookings, type VulaBooking } from "@/lib/firebase/vula-data";
import "../vula.css";

const formatDate = (value?: string) => {
  if (!value) return "Time to be confirmed";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-BW", { dateStyle: "medium", timeStyle: "short" }) : "Time to be confirmed";
};
const money = (value?: number) => typeof value === "number" ? "P" + value.toLocaleString("en-BW", { maximumFractionDigits: 2 }) : "To be confirmed";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<VulaBooking[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("submitted")) setMessage("Your booking request has been received. The team will contact you to confirm the appointment.");
    let stopBookings = () => {};
    const stopAuth = onAuthStateChanged(auth, next => {
      stopBookings();
      stopBookings = () => {};
      setUser(next);
      setAuthReady(true);
      setBookings([]);
      setBookingsError("");
      if (!next) { setLoadingBookings(false); return; }
      setLoadingBookings(true);
      stopBookings = subscribeCustomerBookings(next.uid, items => {
        setBookings(items);
        setLoadingBookings(false);
        setBookingsError("");
      }, error => {
        setLoadingBookings(false);
        setBookingsError(error.message || "Your booking history could not be loaded.");
      });
    });
    return () => { stopAuth(); stopBookings(); };
  }, []);

  async function connectGoogle() {
    if (!user?.isAnonymous || busy) return;
    if (!hasFirebaseWebConfig) {
      setMessage("Google sign-in is not configured for this app yet. Your existing booking request is unchanged.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
      setMessage("Your Vula booking history is now linked to your Google account.");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
      setMessage(code === "auth/credential-already-in-use"
        ? "That Google account is already linked to a separate Vula account. The two booking histories have not been merged; your current booking remains in this session."
        : error instanceof Error ? error.message : "We could not link your account. Your booking request is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="vula vula-account">
    <header className="vula-nav">
      <Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>Vula’s Car Wash<small>Wash. Care. Go.</small></span></Link>
      <nav><Link href="/#services">Wash menu</Link><Link href="/#request">Book a wash</Link></nav>
      <Link className="vula-cta" href="/">Back to Vula ↗</Link>
    </header>
    <section className="vula-account-hero">
      <p className="vula-eyebrow">MY VULA</p>
      <h1>Your bookings.<br/><em>All in one place.</em></h1>
      <p>Check your wash requests and their latest status. The team will confirm your appointment with you.</p>
    </section>
    <section className="vula-account-content">
      {message && <p className="vula-notice success" role="status">{message}</p>}
      {!authReady ? <p className="vula-account-state">Opening your booking history…</p> :
        !user ? <article className="vula-account-empty"><h2>Use the same browser</h2><p>Bookings are connected to the browser session used when you requested them. Return on that device and browser to see your history.</p><Link className="vula-button primary" href="/">Back to Vula</Link></article> :
        <>
          {user.isAnonymous && <article className="vula-account-link-card"><div><strong>Keep your bookings with you</strong><p>Optionally link Google to this session so you can return to your Vula booking history. Your existing request stays attached to this account.</p></div><button className="vula-button primary" type="button" onClick={() => void connectGoogle()} disabled={busy}>{busy ? "Connecting…" : "Connect Google"}</button></article>}
          {!user.isAnonymous && <p className="vula-account-connected">Google account connected · Your bookings are linked to this account.</p>}
          <div className="vula-account-list-heading"><div><p className="vula-eyebrow">BOOKING HISTORY</p><h2>Your wash requests</h2></div><span>{bookings.length} {bookings.length === 1 ? "request" : "requests"}</span></div>
          {loadingBookings ? <p className="vula-account-state">Loading your bookings…</p> :
            bookingsError ? <p className="vula-notice error" role="alert">We couldn’t load your booking history. Check your connection and try again.</p> :
            bookings.length === 0 ? <article className="vula-account-empty"><h3>No bookings to show yet.</h3><p>Once a booking request has been saved, it will appear here.</p><Link className="vula-button primary" href="/#services">Choose a wash ↗</Link></article> :
            <div className="vula-account-bookings">{bookings.map(booking => <article className="vula-account-booking" key={booking.id}><div className="vula-account-booking-top"><span>BOOKING · #{booking.id.slice(0, 8).toUpperCase()}</span><b>{String(booking.status || "requested").replace(/[-_]/g, " ")}</b></div><h3>{booking.serviceName || "Car wash request"}</h3><dl><div><dt>Appointment</dt><dd>{formatDate(booking.scheduledFor)}</dd></div><div><dt>Vehicle</dt><dd>{booking.vehicleType || "Not specified"}{booking.vehicleRegistration ? " · " + booking.vehicleRegistration : ""}</dd></div><div><dt>Location</dt><dd>{booking.locationId || "G-West"}</dd></div><div><dt>Estimated total</dt><dd>{money(booking.priceQuote)}</dd></div></dl><p>The team will contact you to confirm the appointment. No payment is taken through this request.</p></article>)}</div>
          }
        </>
      }
      <div className="vula-account-footer"><Link href="/#services">Browse washes</Link><Link href="/#request">Make another booking</Link></div>
    </section>
    <footer className="vula-footer"><Link href="/" className="vula-brand"><span className="vula-mark">V</span><span>Vula’s Car Wash<small>Wash. Care. Go.</small></span></Link><Link href="/admin">Staff sign in</Link></footer>
  </main>;
}
