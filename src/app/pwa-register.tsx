/* eslint-disable react/no-unescaped-entities */
"use client";

// Keep embedded-browser install enforcement explicit at the top-level PWA boundary.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
type InstallState = "hidden" | "native" | "embedded";

function environment() {
  if (typeof window === "undefined") return { standalone: true, android: false, embedded: false };
  const ua = navigator.userAgent || "";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const android = /Android/i.test(ua);
  const embedded = /WhatsApp|Instagram|FBAN|FBAV|Messenger|Line\/|Twitter|TikTok|Snapchat/i.test(ua) ||
    (/Android/i.test(ua) && /; wv\)/i.test(ua));
  return { standalone, android, embedded };
}

export default function PwaRegister({ initialEmbedded = false, initialAndroid = false }: { initialEmbedded?: boolean; initialAndroid?: boolean }) {
  const [offline, setOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const installPromptRef = useRef<InstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>(initialEmbedded ? "embedded" : "native");
  const [installDismissed, setInstallDismissed] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);
  const [embeddedAndroid, setEmbeddedAndroid] = useState(initialEmbedded && initialAndroid);
  const embeddedActionRef = useRef<HTMLButtonElement | null>(null);
  const reloadForUpdate = useRef(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const env = environment();
    const embedded = initialEmbedded || env.embedded;
    setEmbeddedAndroid((initialEmbedded && initialAndroid) || (env.embedded && env.android));

    const online = () => {
      setOffline(false);
      setReconnecting(true);
      window.setTimeout(() => {
        setReconnecting(false);
      }, 1200);
    };
    const off = () => {
      setReconnecting(false);
      setOffline(true);
    };

    const earlyWindow = window as Window & { __vulaInstallPrompt?: InstallPromptEvent };
    // Consume a genuine install event captured in the document before React hydrates.
    if (earlyWindow.__vulaInstallPrompt) {
      installPromptRef.current = earlyWindow.__vulaInstallPrompt;
      earlyWindow.__vulaInstallPrompt = undefined;
      setInstallState("native");
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const prompt = event as InstallPromptEvent;
      installPromptRef.current = prompt;
      (window as Window & { __vulaInstallPrompt?: InstallPromptEvent }).__vulaInstallPrompt = prompt;
      setInstallDismissed(false);
      setInstallState("native");
    };

    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    // Match Africhiko's proven lifecycle: prevent the browser's automatic prompt,
    // retain its real one-shot event, and reveal the branded card for the user's click.
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (env.standalone && !embedded) {
      setInstallState("hidden");
    } else if (embedded) {
      // Embedded browsers are a compatibility gate, not an install promotion.
      setInstallState("embedded");
    }

    const requestInstall = () => {
      const current = environment();
      if (current.standalone) return;
      if (current.embedded) {
        setInstallState("embedded");
        return;
      }
      if (installPromptRef.current) {
        // Invoke the browser's native prompt directly from the customer's click.
        void install();
        return;
      }
      // Africhiko parity: keep the card hidden without the genuine native event.
      // Never substitute manual Chrome-menu instructions or a fake install prompt.
    };
    const appInstalled = () => {
      installPromptRef.current = null;
      setInstallDismissed(true);
      setInstallState("hidden");
    };
    window.addEventListener("vula-open-install", requestInstall);
    window.addEventListener("appinstalled", appInstalled);

    let registration: ServiceWorkerRegistration | null = null;
    const inspect = () => {
      if (registration?.waiting && navigator.serviceWorker.controller) setUpdateReady(registration.waiting);
    };
    const register = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        registration = await navigator.serviceWorker.register("/sw.js");
        inspect();
        registration.addEventListener("updatefound", () => {
          const worker = registration?.installing;
          if (!worker) return;
          worker.addEventListener("statechange", inspect);
        });
        await registration.update();
        inspect();
      } catch {}
    };

    void register();
    const controllerChange = () => { if (reloadForUpdate.current) window.location.reload(); };
    navigator.serviceWorker?.addEventListener("controllerchange", controllerChange);

    return () => {
      window.removeEventListener("vula-open-install", requestInstall);
      window.removeEventListener("appinstalled", appInstalled);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChange);
    };
  }, [initialEmbedded, initialAndroid]);

  useEffect(() => {
    if (installState !== "embedded" && installState !== "native") return;

    const isEmbeddedGate = installState === "embedded";
    const previousOverflow = document.body.style.overflow;
    if (isEmbeddedGate) document.body.style.overflow = "hidden";
    if (installState === "embedded") embeddedActionRef.current?.focus();
    else document.querySelector<HTMLButtonElement>(".vula-install-action")?.focus();

    const keepDialogFocused = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isEmbeddedGate) {
          event.preventDefault();
          event.stopPropagation();
        } else {
          dismissInstall();
        }
      }
      if (event.key === "Tab" && isEmbeddedGate) {
        event.preventDefault();
        embeddedActionRef.current?.focus();
      }
    };

    window.addEventListener("keydown", keepDialogFocused, true);
    return () => {
      if (isEmbeddedGate) document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keepDialogFocused, true);
    };
  }, [installState]);

  async function install() {
    const prompt = installPromptRef.current;
    if (!prompt) {
      setInstallHelpOpen(true);
      return;
    }
    // Call the captured native browser prompt directly from the Install button.
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // The browser owns the native prompt and may dismiss it.
    } finally {
      installPromptRef.current = null;
      setInstallState("hidden");
    }
  }

  function dismissInstall() {
    setInstallDismissed(true);
    setInstallHelpOpen(false);
    setInstallState("hidden");
  }

  function openBrowser() {
    const url = window.location.href;
    const env = environment();
    if (env.android) {
      window.location.href = "intent://" + url.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end";
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function applyUpdate() {
    // Always provide a visible outcome. Normally controllerchange reloads as soon
    // as the waiting worker activates; the timeout covers a stale/nonresponsive worker.
    reloadForUpdate.current = true;
    if (updateReady) {
      try {
        updateReady.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // The full navigation below remains the recovery path.
      }
    }
    window.setTimeout(() => {
      if (reloadForUpdate.current) window.location.reload();
    }, 1800);
  }

  const embeddedInstallStyle: CSSProperties = { position: "fixed", inset: 0, zIndex: 2147483647, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,.82)", backdropFilter: "blur(4px)", overscrollBehavior: "contain" };
  const envForCard = environment();
  const installCard = installState === "native" && !installDismissed ? (
    <aside className="vula-install-card" aria-label="Install Vula's Car Wash">
      <div className="vula-install-brand"><span className="vula-install-mark" aria-hidden="true">V</span><span><strong>VULA'S CAR WASH</strong><small>WASH · CARE · GO</small></span></div>
      <button className="vula-install-close" type="button" aria-label="Dismiss install prompt" onClick={dismissInstall}>×</button>
      <button className="vula-install-action" type="button" onClick={() => void install()}>{installHelpOpen ? "Installation help" : "Install Vula's Car Wash"} <span aria-hidden="true">↗</span></button>
      {installHelpOpen && <p className="vula-install-message">To install, use your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong> if offered. On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.</p>}
    </aside>
  ) : installState === "embedded" ? (
    <div style={embeddedInstallStyle} role="alertdialog" aria-modal="true" aria-labelledby="vula-embedded-title" aria-describedby="vula-embedded-message">
      <div className="pwaInstallInfo" style={{position:"relative",left:"auto",right:"auto",bottom:"auto",width:"100%",maxWidth:520,margin:0}}>
        <div>
          <strong id="vula-embedded-title"><span aria-hidden="true">🌐 </span>OPEN VULA'S CAR WASH IN YOUR BROWSER</strong>
          <span id="vula-embedded-message">{embeddedAndroid ? <>Tap below to open Vula's Car Wash in Chrome.</> : <>Vula's Car Wash opened inside another app. Open this page in your browser to continue.</>}</span>
        </div>
        <div className="pwaInstallActions" style={{display:"flex",justifyContent:"flex-end"}}>
          <button ref={embeddedActionRef} type="button" style={{background:"#14221e",color:"#fff"}} onClick={openBrowser}>{embeddedAndroid ? "OPEN IN CHROME" : "OPEN IN BROWSER"}</button>
        </div>
      </div>
    </div>
  ) : null;

  return <>
    {offline && <div className="offlineBanner" role="status" aria-live="polite"><span aria-hidden="true">⚡</span> Offline · The service demo saves orders and admin edits locally on this device. Firebase-backed routes need a connection.</div>}
    {!offline && reconnecting && <div className="offlineBanner reconnectingBanner" role="status" aria-live="polite"><span aria-hidden="true">↻</span> Reconnected · Vula's Car Wash can reach the network again. Saved requests remain on this device until synced.</div>}
    {installCard}
    {updateReady && <div className="pwaUpdate" role="status" aria-live="polite"><div><strong>Vula's Car Wash update is ready</strong><span>Refresh when you are ready.</span></div><button type="button" className="button buttonPrimary" onClick={applyUpdate}>Refresh</button></div>}
  </>;
}
