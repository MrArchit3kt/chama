"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshProps = {
  intervalMs?: number;
};

/**
 * Rafraîchit silencieusement les Server Components de la page à intervalle
 * régulier (utile pour voir apparaître un mix généré par un admin sans
 * recharger la page à la main). Se met en pause si l'onglet n'est pas visible.
 */
export function AutoRefresh({ intervalMs = 5000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let timer: number | undefined;

    const start = () => {
      stop();
      timer = window.setInterval(() => {
        router.refresh();
      }, intervalMs);
    };

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    router.refresh();

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [router, intervalMs]);

  return null;
}
