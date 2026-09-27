"use client";

import { useEffect } from "react";

/**
 * Synchronise le badge sur l'icône de l'application (onglet / app installée
 * en PWA) avec le nombre de notifications non lues. Purement cosmétique :
 * ignore silencieusement si le navigateur ne supporte pas la Badging API
 * (Safari desktop, Firefox...).
 */
export function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (count > 0) {
      nav.setAppBadge?.(count).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
  }, [count]);

  return null;
}
