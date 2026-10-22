import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vula's Car Wash",
    short_name: "Vula's",
    description: "Book a car wash, request mobile service, and follow requests online or offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f1",
    theme_color: "#c6f36b",
    orientation: "portrait-primary",
    lang: "en",
    categories: ["business", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/vula-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/vula-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/vula-icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" }
    ],
    screenshots: [
      { src: "/pwa-screenshot-wide.svg", sizes: "1280x720", type: "image/svg+xml", form_factor: "wide", label: "Vula's Car Wash desktop booking screen" },
      { src: "/pwa-screenshot-mobile.svg", sizes: "720x1280", type: "image/svg+xml", label: "Vula's Car Wash mobile booking screen" }
    ]
  };
}
