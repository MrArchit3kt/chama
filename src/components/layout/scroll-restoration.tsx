"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_KEY = "chama:scroll-pos";

/**
 * Next.js remonte tout en haut de la page à chaque redirection déclenchée
 * par une Server Action (comportement par défaut des transitions
 * client-side) — gênant vu que la plupart de nos formulaires redirigent
 * juste vers la même page avec un paramètre de statut (?success=1 etc).
 *
 * On mémorise la position de scroll juste avant chaque soumission de
 * formulaire (sessionStorage, survit à la navigation), puis on la
 * restaure une fois la nouvelle page montée si on est resté sur le même
 * chemin. Le `requestAnimationFrame` laisse le scroll-to-top de Next
 * s'exécuter d'abord, pour être sûr de restaurer après lui.
 */
export function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() !== "post") return;

      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ path: window.location.pathname, y: window.scrollY }),
        );
      } catch {
        // stockage indisponible (navigation privée...) : tant pis
      }
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  useLayoutEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }

    if (!raw) return;

    try {
      const { path, y } = JSON.parse(raw) as { path: string; y: number };
      if (path !== pathname) return;

      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    } catch {
      // JSON invalide : on ignore
    }
  }, [pathname, searchParams]);

  return null;
}
