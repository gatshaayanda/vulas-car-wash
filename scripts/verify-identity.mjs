import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const failures = [];
function read(relative) { return fs.readFileSync(path.join(root, relative), "utf8"); }
const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.name !== "Vula's Car Wash" || manifest.short_name !== "Vula's") failures.push("web manifest does not use Vula identity");
if (!manifest.icons?.some(icon => icon.src === "/vula-icon.svg") || !manifest.icons?.some(icon => icon.src === "/vula-icon-192.png") || !manifest.icons?.some(icon => icon.src === "/vula-icon-512.png")) failures.push("Vula icon missing from web manifest");
if (!fs.existsSync(path.join(root, "public/vula-icon.svg"))) failures.push("Vula SVG icon asset missing");
for (const icon of ["vula-icon-180.png", "vula-icon-192.png", "vula-icon-512.png"]) if (!fs.existsSync(path.join(root, "public", icon))) failures.push("Vula PWA icon asset missing: " + icon);
const appManifest = read("src/app/manifest.ts");
if (!appManifest.includes("Vula's Car Wash") || appManifest.includes("Iteration 13")) failures.push("app manifest identity mismatch");
const layout = read("src/app/layout.tsx");
for (const text of ["Vula's Car Wash", "vula-early-install-capture", "__vulaInstallPrompt", "vula.css"]) if (!layout.includes(text)) failures.push("layout missing " + text);
const sw = read("public/sw.js");
if (!/vula-shell-v\d+/.test(sw) || !sw.includes("/vula-icon.svg") || !sw.includes("/offline")) failures.push("service worker cache namespace, icon or offline shell missing");
const home = read("src/app/page.tsx");
for (const text of ["Vula's Car Wash", "bookings", "queueEntries", "fleetRequests", "syncOfflineRequests"]) if (!home.includes(text)) failures.push("customer app missing " + text);
const data = read("src/lib/firebase/vula-data.ts");
for (const text of ["subscribeBookings", "subscribeQueue", "subscribeFleet", "subscribeServices", "subscribeSettings"]) if (!data.includes(text)) failures.push("Firebase data layer missing " + text);
const rules = read("firestore.rules");
for (const text of ["match /bookings/", "match /queueEntries/", "match /fleetRequests/", "function isAdmin()"]) if (!rules.includes(text)) failures.push("Firestore security rules missing " + text);
if (failures.length) { console.error("IDENTITY / FOUNDATION VERIFICATION FAILED"); failures.forEach(item => console.error(" - " + item)); process.exit(1); }
console.log("VULA FOUNDATION VERIFIED — app identity, PWA cache isolation, customer data layer and security rules are present.");
