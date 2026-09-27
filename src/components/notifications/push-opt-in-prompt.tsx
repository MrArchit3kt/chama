"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { subscribeToPush } from "@/server/notifications/subscribe-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "chama_push_prompt_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Bannière proactive qui propose d'activer les notifications push, plutôt
 * que d'attendre que le joueur pense à aller la chercher dans /profil (voir
 * PushOptIn). Un navigateur ne permet jamais un abonnement 100% silencieux
 * — il faut toujours un clic + l'autorisation du système — donc l'objectif
 * ici est juste de maximiser les chances que ce clic ait lieu.
 *
 * Ne s'affiche qu'une fois par appareil/navigateur (mémorisé en
 * localStorage, pas côté compte : l'abonnement lui-même est propre à
 * chaque appareil, ça n'aurait pas de sens de cesser de le proposer
 * partout juste parce qu'il a été activé — ou refusé — ailleurs).
 */
export function PushOptInPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (
        !VAPID_PUBLIC_KEY ||
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        localStorage.getItem(DISMISS_KEY) === "1" ||
        Notification.permission === "denied"
      ) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        if (!existing && !cancelled) setVisible(true);
      } catch {
        // Navigateur mal supporté ou erreur d'enregistrement : on ne
        // propose simplement rien plutôt que de faire échouer la page.
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await subscribeToPush(subscription.toJSON(), navigator.userAgent);
      dismiss();
    } catch {
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-60 mx-auto max-w-md md:inset-x-auto md:right-6">
      <div className="neon-card flex items-start gap-3 p-4 shadow-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
          <Bell className="h-5 w-5 text-cyan-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Active les notifications</p>
          <p className="neon-text-muted mt-1 text-xs leading-5">
            Sois prévenu direct quand un tournoi ou un événement est publié.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="neon-button px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {busy ? "..." : "Activer"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.05]"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="shrink-0 text-white/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
