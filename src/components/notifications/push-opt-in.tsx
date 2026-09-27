"use client";

import { useEffect, useState } from "react";
import { subscribeToPush } from "@/server/notifications/subscribe-push";
import { unsubscribeFromPush } from "@/server/notifications/unsubscribe-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "off" | "on" | "denied";

export function PushOptIn() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (
        !VAPID_PUBLIC_KEY ||
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const result = await subscribeToPush(subscription.toJSON(), navigator.userAgent);

      setStatus(result.ok ? "on" : "off");
    } catch {
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setStatus("off");
    } catch {
      // ignore, on reste sur l'état courant
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return (
      <p className="neon-text-muted text-xs leading-5">
        Les notifications push ne sont pas disponibles sur ce navigateur.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="neon-text-muted text-xs leading-5">
        Notifications bloquées par le navigateur — autorise-les dans les
        réglages du site pour les activer ici.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="neon-text-muted flex-1 text-xs leading-5">
        {status === "on"
          ? "Tu reçois une notification push quand un tournoi ou un événement est publié."
          : "Reçois une notification push quand un tournoi ou un événement est publié."}
      </p>
      <button
        type="button"
        onClick={status === "on" ? handleDisable : handleEnable}
        disabled={busy}
        className={
          status === "on"
            ? "rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-50"
            : "neon-button px-4 py-2 text-xs disabled:opacity-50"
        }
      >
        {busy ? "..." : status === "on" ? "Désactiver" : "Activer les notifications"}
      </button>
    </div>
  );
}
