import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";

const PROJECT_ID = "vulas-car-wash";
const APP_NAME = "vula-public-settings";
const FALLBACK_NAME = "Vula's Car Wash";

async function readBusinessName(): Promise<string> {
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) return FALLBACK_NAME;
  try {
    const account = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (account.project_id !== PROJECT_ID || !account.client_email || !account.private_key) return FALLBACK_NAME;
    const existing = getApps().find(app => app.name === APP_NAME);
    const app = existing ?? initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: account.project_id,
    }, APP_NAME);
    const snapshot = await getFirestore(app).doc("businessSettings/main").get();
    const name = snapshot.data()?.businessName;
    return typeof name === "string" && name.trim() ? name.trim() : FALLBACK_NAME;
  } catch {
    return FALLBACK_NAME;
  }
}

export const getPublicBusinessName = unstable_cache(readBusinessName, ["vula-public-business-name-v1"], { revalidate: 300 });
