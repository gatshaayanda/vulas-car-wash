import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const failures = [];
function read(relative) { return fs.readFileSync(path.join(root, relative), "utf8"); }
function exists(relative) { return fs.existsSync(path.join(root, relative)); }

// Next.js src/app/manifest.ts is the single source of /manifest.webmanifest.
// Do not require a duplicate public/manifest.webmanifest file.
const appManifest = read("src/app/manifest.ts");
if (!appManifest.includes("Vula's Car Wash") || !appManifest.includes('short_name: "Vula\'s"') || appManifest.includes("Iteration 13")) failures.push("app manifest identity mismatch");
for (const icon of ["vula-icon-180.png", "vula-icon-192.png", "vula-icon-512.png"]) {
  if (!exists("public/" + icon)) failures.push("Vula PWA icon asset missing: " + icon);
  if (!appManifest.includes("/" + icon)) failures.push("Vula PWA icon missing from app manifest: " + icon);
}
if (!appManifest.includes('form_factor: "wide"') || !appManifest.includes("/pwa-screenshot-wide.svg")) failures.push("wide PWA install screenshot missing from manifest");
if (!appManifest.includes("/pwa-screenshot-mobile.svg")) failures.push("mobile PWA install screenshot missing from manifest");
for (const screenshot of ["pwa-screenshot-wide.svg", "pwa-screenshot-mobile.svg"]) {
  if (!exists("public/" + screenshot)) failures.push("PWA screenshot asset missing: " + screenshot);
}
const layout = read("src/app/layout.tsx");
for (const text of ["Vula's Car Wash", "vula.css", "PwaRegister", 'manifest: "/manifest.webmanifest"']) if (!layout.includes(text)) failures.push("layout missing " + text);
const pwaRegister = read("src/app/pwa-register.tsx");
for (const text of ["beforeinstallprompt", "prompt.prompt()", "vula-install-card", "vula-install-close", "vula-install-action"]) if (!pwaRegister.includes(text)) failures.push("PWA install lifecycle missing " + text);
const sw = read("public/sw.js");
if (!/vula-shell-v\\d+/.test(sw) || !sw.includes("/offline")) failures.push("service worker cache namespace or offline shell missing");
if (sw.includes('icon: "/vula-icon.svg"') || sw.includes('badge: "/vula-icon.svg"')) failures.push("service worker notification still references the failing SVG icon");
if (!sw.includes("const cacheCopy = response.clone();")) failures.push("service worker response cloning fix missing");
const home = read("src/app/page.tsx");
for (const text of ["Vula's Car Wash", "bookings", "queueEntries", "fleetRequests", "syncOfflineRequests"]) if (!home.includes(text)) failures.push("customer app missing " + text);
const data = read("src/lib/firebase/vula-data.ts");
for (const text of ["subscribeBookings", "subscribeQueue", "subscribeFleet", "subscribeServices", "subscribeSettings"]) if (!data.includes(text)) failures.push("Firebase data layer missing " + text);
const rules = read("firestore.rules");
for (const text of ["match /bookings/", "match /queueEntries/", "match /fleetRequests/", "function isAdmin()"]) if (!rules.includes(text)) failures.push("Firestore security rules missing " + text);
if (failures.length) { console.error("IDENTITY / FOUNDATION VERIFICATION FAILED"); failures.forEach(item => console.error(" - " + item)); process.exit(1); }
console.log("VULA FOUNDATION VERIFIED — app identity, canonical PWA manifest, install icons/screenshots, cache isolation, customer data layer and security rules are present.");
