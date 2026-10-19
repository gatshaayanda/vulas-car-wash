import { createHash, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const APP_NAME = "vula-operations";
const PROJECT_ID = "vulas-car-wash";
const OWNER_UID = "vula-operations-owner";

function getAdminApp() {
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) {
    if (existing.options.projectId && existing.options.projectId !== PROJECT_ID) {
      throw new Error(`Firebase Admin app is connected to unexpected project: ${existing.options.projectId}`);
    }
    return existing;
  }

  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) throw new Error("Missing FIREBASE_ADMIN_KEY environment variable.");
  let account: { project_id?: string; client_email?: string; private_key?: string };
  try {
    account = JSON.parse(raw) as typeof account;
  } catch {
    throw new Error("FIREBASE_ADMIN_KEY must contain valid service-account JSON.");
  }
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error("FIREBASE_ADMIN_KEY is missing project_id, client_email, or private_key.");
  }
  if (account.project_id !== PROJECT_ID) {
    throw new Error(`FIREBASE_ADMIN_KEY belongs to ${account.project_id}, not ${PROJECT_ID}.`);
  }

  return initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: account.project_id,
  }, APP_NAME);
}

function matchesWord(input: string, expected: string) {
  const actual = createHash("sha256").update(input).digest();
  const target = createHash("sha256").update(expected).digest();
  return input.length > 0 && timingSafeEqual(actual, target);
}

export async function POST(request: Request) {
  try {
    const expected = process.env.VULA_OPERATIONS_WORD;
    if (!expected) {
      return NextResponse.json(
        { error: "Staff sign-in is not configured. Set VULA_OPERATIONS_WORD in the server environment." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await request.json().catch(() => null) as { word?: unknown } | null;
    const word = typeof body?.word === "string" ? body.word : "";
    if (!matchesWord(word, expected)) {
      return NextResponse.json(
        { error: "Access denied. Check the staff access word and try again." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const auth = getAuth(app);
    const adminRef = db.collection("admins").doc(OWNER_UID);
    const existing = await adminRef.get();

    // Match the proven Tripple S provisioning pattern: create the owner record
    // only when absent, and never silently restore a deliberately disabled role.
    if (!existing.exists) {
      await adminRef.create({
        role: "owner",
        temporaryAccess: true,
        accessMethod: "one-word-operations",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (!["owner", "staff"].includes(String(existing.data()?.role ?? ""))) {
      return NextResponse.json(
        { error: "This access account is not enabled for Vula staff operations. Contact the project owner." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const token = await auth.createCustomToken(OWNER_UID);
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Keep credentials and key material out of client responses. The server log
    // retains the actionable configuration cause for deployment troubleshooting.
    console.error("Vula staff login failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Staff sign-in could not reach Vula's Firebase Admin service. Verify FIREBASE_ADMIN_KEY is the Vula service-account JSON and its private key is intact." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
