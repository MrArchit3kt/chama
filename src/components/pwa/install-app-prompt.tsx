"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "chama_install_prompt_dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edg/i.test(ua);
  return isIOS && isSafari;
}

/**
 * Bannière proactive d'installation (écran d'accueil), sur le même principe
 * que PushOptInPrompt : on ne demande pas au joueur de penser à aller la
 * chercher dans /profil. Deux cas seulement (Chrome/Edge et iOS Safari
 * couvrent l'essentiel de l'audience mobile) :
 * - Chrome/Edge (PC + Android) : beforeinstallprompt capturé, un clic suffit.
 * - iOS Safari : aucune API ne permet de déclencher l'install (restriction
 *   Apple, pas contournable) — on guide juste visuellement le bon geste.
 * Positionnée au-dessus de PushOptInPrompt (même coin) pour ne jamais se
 * superposer si les deux s'affichent en même temps.
 */
export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true); // true tant qu'on n'a pas vérifié, évite un flash
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (localStorage.getItem(DISMISS_KEY) === "1" || isStandalone()) return;
      setDismissed(false);
      if (isIOSSafari()) setShowIOSGuide(true);
    });

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      dismiss();
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    setBusy(true);

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismiss();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  if (dismissed || (!deferredPrompt && !showIOSGuide)) return null;

  return (
    <div className="fixed inset-x-4 bottom-30 z-60 mx-auto max-w-md md:inset-x-auto md:bottom-28 md:right-6">
      <div className="neon-card flex items-start gap-3 p-4 shadow-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
          <Download className="h-5 w-5 text-cyan-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Installe l’application</p>

          {showIOSGuide ? (
            <p className="neon-text-muted mt-1 flex flex-wrap items-center gap-1 text-xs leading-5">
              Appuie sur <Share className="inline h-3.5 w-3.5 text-cyan-300" /> (Partager) puis
              « Sur l’écran d’accueil ».
            </p>
          ) : (
            <p className="neon-text-muted mt-1 text-xs leading-5">
              Accède à CHAMA direct depuis ton écran d’accueil, comme une vraie
              application.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstall}
                disabled={busy}
                className="neon-button px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {busy ? "..." : "Installer"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.05]"
            >
              {deferredPrompt ? "Plus tard" : "Compris"}
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
