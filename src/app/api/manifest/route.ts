import { NextResponse } from "next/server";
import { getPublicBusinessName } from "@/lib/server/vula-public-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_BUSINESS_NAME = "Vula's Car Wash";

export async function GET() {
  const name = (await getPublicBusinessName()) || FALLBACK_BUSINESS_NAME;
  const shortName = name.length > 12 ? name.slice(0, 12).trim() : name;
  return NextResponse.json({
    id: "/", name, short_name: shortName,
    description: "Book a car wash, request mobile service, and follow requests online or offline.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#f5f6f1", theme_color: "#c6f36b",
    categories: ["business", "lifestyle"],
    icons: [
      { src: "/vula-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/vula-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/vula-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ]
  }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" } });
}
