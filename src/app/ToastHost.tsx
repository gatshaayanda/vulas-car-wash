"use client";

import { useEffect, useState } from "react";
import type { VulaToastDetail, VulaToastKind } from "@/lib/vula-toast";

type Toast = VulaToastDetail & { id: number; kind: VulaToastKind };
const titles: Record<VulaToastKind, string> = { success: "All good", error: "Needs attention", pending: "In progress", info: "Vula update" };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let nextId = 0;
    const timers = new Map<number, number>();
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<VulaToastDetail>).detail;
      if (!detail?.message?.trim()) return;
      const id = ++nextId;
      const kind = detail.kind && detail.kind in titles ? detail.kind : "info";
      setToasts(current => [...current.slice(-2), { id, message: detail.message.trim(), kind }]);
      timers.set(id, window.setTimeout(() => {
        setToasts(current => current.filter(toast => toast.id !== id));
        timers.delete(id);
      }, kind === "error" ? 6500 : 4200));
    };
    window.addEventListener("vula:toast", receive);
    return () => { window.removeEventListener("vula:toast", receive); timers.forEach(window.clearTimeout); };
  }, []);
  if (!toasts.length) return null;
  return <div className="vula-toast-stack" aria-label="Notifications" aria-live="polite" aria-relevant="additions text">
    {toasts.map(toast => <article className={"vula-toast " + toast.kind} key={toast.id} role={toast.kind === "error" ? "alert" : "status"}>
      <span className="vula-toast-mark" aria-hidden="true">{toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : toast.kind === "pending" ? "…" : "i"}</span>
      <div><strong>{titles[toast.kind]}</strong><p>{toast.message}</p></div>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}>×</button>
    </article>)}
  </div>;
}
