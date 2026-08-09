"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshProps = {
  intervalMs?: number;
};

// Écart minimal entre deux refresh() effectifs, même si plusieurs
// déclencheurs se chevauchent (l'intervalle ET un visibilitychange, par
// exemple). Les navigateurs mobiles déclenchent visibilitychange bien plus
// souvent que sur desktop (barre d'adresse qui se cache/affiche,
// notification qui glisse, changement d'app...) — sans ce garde-fou, ça
// peut déclencher des rafraîchissements en rafale qui se voient comme du
// clignotement.
const MIN_GAP_MS = 3000;

/**
 * Rafraîchit silencieusement les Server Components de la page à intervalle
 * régulier (utile pour voir apparaître un mix généré par un admin sans
 * recharger la page à la main). Se met en pause si l'onglet n'est pas visible.
 */
export function AutoRefresh({ intervalMs = 8000 }: AutoRefreshProps) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    let timer: number | undefined;

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_GAP_MS) return;
      lastRefreshRef.current = now;
      router.refresh();
    };

    const start = () => {
      stop();
      timer = window.setInterval(refresh, intervalMs);
    };

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    refresh();

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [router, intervalMs]);

  return null;
}
