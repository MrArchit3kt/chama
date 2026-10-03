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

/**
 * Une fois la permission refusée, AUCUN site ne peut la redemander par JS
 * (Notification.requestPermission() renvoie direct "denied" sans jamais
 * raffiche le pop-up — restriction du navigateur, pas contournable). Le
 * seul chemin est de rouvrir la permission à la main dans les réglages —
 * on donne donc le trajet exact selon le navigateur détecté.
 */
function getReenableInstructions(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);
  const isSafariOnly = /safari/i.test(ua) && !/chrome|crios|fxios|edg/i.test(ua);

  if (isIOS) {
    return "Réglages iPhone → fais défiler jusqu'à Safari (ou l'appli CHAMA si installée sur l'écran d'accueil) → Notifications → Autoriser.";
  }
  if (isAndroid && isFirefox) {
    return "Appuie sur le cadenas à côté de l'adresse du site → Autorisations → Notifications → Autoriser, puis reviens ici.";
  }
  if (isAndroid) {
    return "Appuie sur le cadenas (ou les ⋮) à côté de l'adresse du site → Autorisations → Notifications → Autoriser, puis reviens ici.";
  }
  if (isSafariOnly) {
    return "Menu Safari → Réglages pour ce site web → Notifications → Autoriser, puis recharge la page.";
  }
  if (isFirefox) {
    return "Clique sur le cadenas à gauche de l'adresse → Autorisations → Notifications → Autoriser, puis recharge la page.";
  }
  return "Clique sur le cadenas à gauche de l'adresse du site → Autorisations du site → Notifications → Autoriser, puis recharge la page.";
}

type Status = "checking" | "unsupported" | "off" | "on" | "denied";

async function readStatus(): Promise<Status> {
  if (
    !VAPID_PUBLIC_KEY ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  if (Notification.permission === "denied") return "denied";

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    return existing ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

export function PushOptIn() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRecheck() {
    setBusy(true);
    const next = await readStatus();
    setStatus(next);
    setBusy(false);
  }

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
      <div className="grid gap-2">
        <p className="neon-text-muted text-xs leading-5">
          Notifications bloquées — une fois refusées, un site ne peut plus
          jamais redemander la permission tout seul, il faut l’autoriser à
          la main :
        </p>
        <p className="neon-text-muted rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-xs leading-5">
          {getReenableInstructions()}
        </p>
        <div>
          <button
            type="button"
            onClick={handleRecheck}
            disabled={busy}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-50"
          >
            {busy ? "..." : "J’ai autorisé, vérifier à nouveau"}
          </button>
        </div>
      </div>
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
