"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type HeaderActionsCarouselProps = {
  children: ReactNode;
};

const AUTO_SCROLL_INTERVAL_MS = 3000;
const RESUME_DELAY_MS = 4000;

/**
 * Carrousel horizontal pour les boutons de la bannière :
 * - défilement automatique en boucle toutes les 3s
 * - glisser au doigt / molette / flèches pour naviguer manuellement,
 *   ce qui met le défilement auto en pause quelques secondes
 * - dégradé + flèches sur les bords tant qu'il reste du contenu caché
 * - respecte prefers-reduced-motion (pas d'auto-scroll dans ce cas)
 */
export function HeaderActionsCarousel({ children }: HeaderActionsCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const pausedRef = useRef(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });

    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      resizeObserver.disconnect();
    };
  }, [updateArrows]);

  const pauseAutoScroll = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, RESUME_DELAY_MS);
  }, []);

  const scrollByPage = useCallback(
    (direction: 1 | -1) => {
      const el = scrollerRef.current;
      if (!el) return;
      pauseAutoScroll();
      el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
    },
    [pauseAutoScroll],
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = setInterval(() => {
      const el = scrollerRef.current;
      if (!el || pausedRef.current) return;

      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;

      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: el.clientWidth * 0.4, behavior: "smooth" });
      }
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {canScrollLeft ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-[#0b0f1e] to-transparent" />
          <button
            type="button"
            aria-label="Précédent"
            onClick={() => scrollByPage(-1)}
            className="absolute left-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/80 backdrop-blur transition hover:border-cyan-400/30 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      ) : null}

      <div
        ref={scrollerRef}
        onPointerDown={pauseAutoScroll}
        onWheel={pauseAutoScroll}
        onTouchStart={pauseAutoScroll}
        className="thin-scrollbar flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth"
      >
        {children}
      </div>

      {canScrollRight ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-[#0b0f1e] to-transparent" />
          <button
            type="button"
            aria-label="Suivant"
            onClick={() => scrollByPage(1)}
            className="absolute right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/80 backdrop-blur transition hover:border-cyan-400/30 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
