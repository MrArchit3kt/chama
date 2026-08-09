"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type HeaderActionsCarouselProps = {
  children: ReactNode;
};

const SCROLL_SPEED_PX_PER_SEC = 36;
const RESUME_DELAY_MS = 10000;

/**
 * Carrousel horizontal pour les boutons de la bannière :
 * - défilement automatique CONTINU (bandeau défilant, sans à-coups ni pause
 *   entre chaque étape) uniquement si les boutons dépassent la largeur
 *   visible ; le contenu n'est alors dupliqué qu'une fois pour reboucler
 *   sans saut visible (sinon pas de duplication, pas de défilement)
 * - glisser au doigt / molette / flèches pour naviguer manuellement, ce qui
 *   met le défilement auto en pause pendant 10s après le dernier geste
 * - dégradé + flèches sur les bords tant qu'il reste du contenu caché
 * - respecte prefers-reduced-motion (pas d'auto-scroll dans ce cas)
 */
export function HeaderActionsCarousel({ children }: HeaderActionsCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // ✅ Le contenu n'est dupliqué (pour le rebouclage sans saut) que si les
  // boutons dépassent réellement la largeur visible. Sinon tout tient déjà
  // à l'écran et dupliquer donnerait l'impression que chaque bouton
  // apparaît deux fois.
  const [needsLoop, setNeedsLoop] = useState(false);
  const pausedRef = useRef(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopWidthRef = useRef(0);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const updateLoopWidth = useCallback(() => {
    const el = scrollerRef.current;
    const firstSet = firstSetRef.current;
    if (!el || !firstSet) return;
    const gap = parseFloat(window.getComputedStyle(el).columnGap || "0") || 0;
    loopWidthRef.current = firstSet.offsetWidth + gap;
    setNeedsLoop(firstSet.offsetWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    const firstSet = firstSetRef.current;
    if (!el || !firstSet) return;

    updateArrows();
    updateLoopWidth();
    el.addEventListener("scroll", updateArrows, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateArrows();
      updateLoopWidth();
    });
    resizeObserver.observe(el);
    resizeObserver.observe(firstSet);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      resizeObserver.disconnect();
    };
  }, [updateArrows, updateLoopWidth]);

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

    let frameId: number;
    let lastTime: number | null = null;

    const step = (time: number) => {
      frameId = requestAnimationFrame(step);

      if (lastTime === null) {
        lastTime = time;
        return;
      }
      const dt = time - lastTime;
      lastTime = time;

      const el = scrollerRef.current;
      const loopWidth = loopWidthRef.current;
      if (!el || pausedRef.current || loopWidth <= el.clientWidth) return;

      el.scrollLeft += (SCROLL_SPEED_PX_PER_SEC * dt) / 1000;
      if (el.scrollLeft >= loopWidth) {
        el.scrollLeft -= loopWidth;
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
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
        onPointerMove={pauseAutoScroll}
        onWheel={pauseAutoScroll}
        onTouchStart={pauseAutoScroll}
        className="thin-scrollbar flex items-center gap-2 overflow-x-auto"
      >
        <div ref={firstSetRef} className="flex shrink-0 items-center gap-2">
          {children}
        </div>
        {needsLoop ? (
          <div aria-hidden="true" inert className="flex shrink-0 items-center gap-2">
            {children}
          </div>
        ) : null}
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
