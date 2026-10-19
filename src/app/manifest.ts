import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Vula's Car Wash", short_name: "Vula's",
    description: "Book a car wash, request mobile service, and follow requests online or offline.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#f5f6f1", theme_color: "#c6f36b", orientation: "portrait-primary", lang: "en",
    categories: ["business", "lifestyle"], prefer_related_applications: false,
    icons: [{ src: "/vula-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
  };
}
