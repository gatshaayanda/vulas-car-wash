import type {Metadata,Viewport} from "next";
import {headers} from "next/headers";
import {Analytics} from "@vercel/analytics/next";
import {SpeedInsights} from "@vercel/speed-insights/next";
import PwaRegister from "@/app/pwa-register";
import Script from "next/script";
import "./globals.css"; import "./pwa.css"; import "./vula.css";
const siteUrl=process.env.NEXT_PUBLIC_BASE_URL||"https://vulas-car-wash.vercel.app";
const EMBEDDED_BROWSER_PATTERN=/WhatsApp|Instagram|FBAN|FBAV|Messenger|Line[/]|Twitter|TikTok|Snapchat/i;
export const metadata:Metadata={metadataBase:new URL(siteUrl),title:{default:"Vula's Car Wash",template:"%s | Vula's Car Wash"},description:"Book a car wash, request mobile service, and follow requests online or offline.",applicationName:"Vula's Car Wash",keywords:["Vula's Car Wash","PWA","mobile app","offline","installation"],alternates:{canonical:"/"},openGraph:{type:"website",url:siteUrl,siteName:"Vula's Car Wash",title:"Vula's Car Wash",description:"Car wash bookings, mobile-service requests and live staff operations."},twitter:{card:"summary",title:"Vula's Car Wash",description:"Car wash bookings, mobile-service requests and live staff operations."},icons:{icon:[{url:"/vula-icon.svg",sizes:"192x192",type:"image/png"},{url:"/vula-icon.svg",sizes:"512x512",type:"image/png"},{url:"/vula-icon.svg",type:"image/svg+xml"}],apple:{url:"/vula-icon.svg",sizes:"180x180",type:"image/png"}},manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:"Vula's Car Wash",statusBarStyle:"default"}};
export const viewport:Viewport={themeColor:"#155eef",colorScheme:"light"};
export default async function RootLayout({children}:{children:React.ReactNode}){
 const requestHeaders=await headers();
 const userAgent=requestHeaders.get("user-agent")||"";
 const requestedWith=requestHeaders.get("x-requested-with")||"";
 // A social referrer does not prove this browser is embedded: Chrome opened from WhatsApp
 // must not be trapped in the in-app-browser install gate.
 const embedded=EMBEDDED_BROWSER_PATTERN.test(userAgent)
   || (/Android/i.test(userAgent)&&/\bwv\b/i.test(userAgent))
   || /^(com\.whatsapp|com\.instagram\.android|com\.facebook\.katana|com\.facebook\.lite|com\.facebook\.orca)$/i.test(requestedWith);
 const android=/Android/i.test(userAgent);
 return <html lang="en"><body style={embedded?{overflow:"hidden"}:undefined}><Script id="vula-early-install-capture" strategy="beforeInteractive">{`
(function () {
  window.addEventListener("beforeinstallprompt", function (event) {
    var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (standalone || window.__vulaPwaListenerReady === true) return;
    event.preventDefault();
    window.__vulaInstallPrompt = event;
  });
})();
`}</Script><PwaRegister initialEmbedded={embedded} initialAndroid={android}/>{children}<Analytics/><SpeedInsights/></body></html>
}
