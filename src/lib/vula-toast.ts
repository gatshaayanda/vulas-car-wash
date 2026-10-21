"use client";

export type VulaToastKind = "success" | "error" | "pending" | "info";
export type VulaToastDetail = { message: string; kind?: VulaToastKind };

export function showVulaToast(message: string, kind: VulaToastKind = "info") {
  if (typeof window === "undefined" || !message.trim()) return;
  window.dispatchEvent(new CustomEvent<VulaToastDetail>("vula:toast", { detail: { message: message.trim(), kind } }));
}
