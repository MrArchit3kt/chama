"use client";

import { useEffect, useState } from "react";

// Pas de type standard dans lib.dom.d.ts pour cet évènement non standardisé
// (Chrome/Edge/Android uniquement).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari : pas de display-mode standalone fiable, propriété dédiée.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Un clic "Installer l'application" n'est possible que là où le navigateur
 * expose beforeinstallprompt (Chrome/Edge desktop & Android) — ailleurs
 * (Safari iOS/macOS, Firefox...) il n'existe aucune API pour déclencher
 * l'install par JS, on ne peut qu'indiquer le chemin manuel exact.
 */
function getManualInstructions(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edg/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);

  if (isIOS && isSafari) {
    return "Appuie sur le bouton Partager (le carré avec une flèche vers le haut), puis « Sur l'écran d'accueil ».";
  }
  if (isIOS) {
    return "Ouvre cette page dans Safari (obligatoire sur iPhone/iPad pour installer), bouton Partager → « Sur l'écran d'accueil ».";
  }
  if (isFirefox) {
    return "Menu ⋮ du navigateur → « Installer » (ou « Ajouter à l'écran d'accueil » sur mobile).";
  }
  return "Cherche l'icône d'installation dans la barre d'adresse (⊕ ou écran avec une flèche), ou le menu ⋮ → « Installer l'application ».";
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Valeur dépendante de window/navigator (indisponibles au rendu serveur)
    // — appliquée via un micro-task plutôt que directement dans le corps de
    // l'effet, pour rester dans le rendu "checking" le temps de l'hydratation
    // et éviter un mismatch serveur/client.
    Promise.resolve().then(() => setInstalled(isStandalone()));

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setBusy(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } catch {
      // ignore — l'utilisateur a simplement fermé le pop-up système
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <p className="neon-text-muted text-xs leading-5">
        ✅ Application déjà installée sur cet appareil.
      </p>
    );
  }

  if (deferredPrompt) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="neon-text-muted flex-1 text-xs leading-5">
          Installe CHAMA sur ton écran d’accueil pour y accéder comme une
          vraie application.
        </p>
        <button
          type="button"
          onClick={handleInstall}
          disabled={busy}
          className="neon-button px-4 py-2 text-xs disabled:opacity-50"
        >
          {busy ? "..." : "📲 Installer l’application"}
        </button>
      </div>
    );
  }

  return (
    <p className="neon-text-muted text-xs leading-5">
      Ce navigateur ne propose pas d’installation en un clic — {getManualInstructions()}
    </p>
  );
}
