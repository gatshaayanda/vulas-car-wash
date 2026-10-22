/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaRegister() {
  const [offline, setOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installCardDismissed, setInstallCardDismissed] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);
  const reloadForUpdate = useRef(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const online = () => {
      setOffline(false);
      setReconnecting(true);
      window.setTimeout(() => setReconnecting(false), 1200);
    };
    const offlineNow = () => {
      setReconnecting(false);
      setOffline(true);
    };
    const installPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallCardDismissed(false);
      setInstallable(true);
    };

    window.addEventListener("online", online);
    window.addEventListener("offline", offlineNow);
    // This is the same native install-event lifecycle used by Africhiko.
    window.addEventListener("beforeinstallprompt", installPrompt);

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
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineNow);
      window.removeEventListener("beforeinstallprompt", installPrompt);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChange);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallable(false);
  }

  function applyUpdate() {
    reloadForUpdate.current = true;
    if (updateReady) {
      try {
        updateReady.postMessage({ type: "SKIP_WAITING" });
      } catch {}
    }
    window.setTimeout(() => {
      if (reloadForUpdate.current) window.location.reload();
    }, 1800);
  }

  return <>
    {offline && <div className="offlineBanner" role="status" aria-live="polite"><span aria-hidden="true">⚡</span> Offline · The service demo saves orders and admin edits locally on this device. Firebase-backed routes need a connection.</div>}
    {!offline && reconnecting && <div className="offlineBanner reconnectingBanner" role="status" aria-live="polite"><span aria-hidden="true">↻</span> Reconnected · Vula's Car Wash can reach the network again. Saved requests remain on this device until synced.</div>}
    {installable && !installCardDismissed && <aside className="vula-install-card" aria-label="Install Vula's Car Wash">
      <div className="vula-install-brand"><span className="vula-install-mark" aria-hidden="true">V</span><span><strong>VULA'S CAR WASH</strong><small>WASH · CARE · GO</small></span></div>
      <button className="vula-install-close" type="button" aria-label="Dismiss install prompt" onClick={() => setInstallCardDismissed(true)}>×</button>
      <button className="vula-install-action" type="button" onClick={() => void install()}>Install Vula's Car Wash <span aria-hidden="true">↗</span></button>
    </aside>}
    {updateReady && <div className="pwaUpdate" role="status" aria-live="polite"><div><strong>Vula's Car Wash update is ready</strong><span>Refresh when you are ready.</span></div><button type="button" className="button buttonPrimary" onClick={applyUpdate}>Refresh</button></div>}
  </>;
}

declare global {
  interface Window {}
}
