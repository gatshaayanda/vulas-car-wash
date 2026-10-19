/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
export default function OfflinePage() {
  return <main className="vula"><div className="vula-status"><span className="status-dot"/>Offline mode</div><section className="vula-section"><p className="vula-eyebrow">CONNECTION PAUSED</p><h1 style={{fontSize:"clamp(40px,7vw,72px)"}}>Still here.<br/>Not yet synced.</h1><p>Your previously loaded app shell remains available. Requests saved while offline stay on this device until a connection returns. They are not visible to Vula's team and are not confirmed bookings until the server accepts them.</p><p><Link className="vula-button primary" href="/">Return to Vula's Car Wash ↗</Link></p></section></main>;
}
