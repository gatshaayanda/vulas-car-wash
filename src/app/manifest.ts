import type { MetadataRoute } from "next";
import { getPublicBusinessName } from "@/lib/server/vula-public-settings";

const FALLBACK_BUSINESS_NAME = "Vula's Car Wash";
export const revalidate = 300;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const businessName = await getPublicBusinessName() || FALLBACK_BUSINESS_NAME;
  const shortName = businessName.length > 12 ? businessName.slice(0, 12).trim() : businessName;
  return {
    id: "/", name: businessName, short_name: shortName,
    description: "Book a car wash, request mobile service, and follow requests online or offline.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#f5f6f1", theme_color: "#c6f36b", orientation: "portrait-primary", lang: "en",
    categories: ["business", "lifestyle"], prefer_related_applications: false,
    icons: [{ src: "/vula-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/vula-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/vula-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }]
  };
}
