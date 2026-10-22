import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PwaRegister from "@/app/pwa-register";
import "./globals.css";
import "./pwa.css";
import "./vula.css";

const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Vula's Car Wash", template: "%s | Vula's Car Wash" },
  description: "Book a car wash, request mobile service, and follow requests online or offline.",
  applicationName: "Vula's Car Wash",
  keywords: ["Vula's Car Wash", "PWA", "mobile app", "offline", "installation"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: siteUrl, siteName: "Vula's Car Wash", title: "Vula's Car Wash", description: "Car wash bookings, mobile-service requests and live staff operations." },
  twitter: { card: "summary", title: "Vula's Car Wash", description: "Car wash bookings, mobile-service requests and live staff operations." },
  icons: {
    icon: [
      { url: "/vula-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/vula-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/vula-icon.svg", type: "image/svg+xml" }
    ],
    apple: { url: "/vula-icon-180.png", sizes: "180x180", type: "image/png" }
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Vula's Car Wash", statusBarStyle: "default" }
};

export const viewport: Viewport = { themeColor: "#c6f36b", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><script dangerouslySetInnerHTML={{ __html: "window.addEventListener(\u0027beforeinstallprompt\u0027,function(event){event.preventDefault();window.__vulaInstallPrompt=event;});" }} /><PwaRegister />{children}<Analytics /><SpeedInsights /></body></html>;
}
