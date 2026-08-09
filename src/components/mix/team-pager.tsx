"use client";

import { Children, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TeamPagerProps = {
  /** Une carte d'équipe pré-rendue par élément, déjà triée (la sienne en premier). */
  children: React.ReactNode;
};

const SWIPE_THRESHOLD_PX = 50;

/**
 * N'affiche qu'une équipe à la fois (la sienne en premier, grâce au tri
 * fait par la page appelante) — les autres ne sont visibles qu'en cliquant
 * sur une flèche ou en glissant le doigt (swipe gauche/droite), pour
 * éviter d'imposer le scroll de toutes les équipes.
 */
export function TeamPager({ children }: TeamPagerProps) {
  const items = Children.toArray(children);
  const total = items.length;
  const [index, setIndex] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  if (total === 0) return null;

  const safeIndex = Math.min(index, total - 1);
  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || total <= 1) return;

    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;

    // Ignore les petits mouvements (simple clic/tap) et les gestes surtout
    // verticaux (scroll de la page, pas une intention de swipe).
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) goNext();
    else goPrev();
  };

  return (
    <div className="mt-5">
      {total > 1 ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Équipe précédente"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/70 transition hover:border-cyan-400/30 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            Équipe {safeIndex + 1} / {total}
          </span>

          <button
            type="button"
            onClick={goNext}
            aria-label="Équipe suivante"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/70 transition hover:border-cyan-400/30 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div
        className="touch-pan-y md:max-w-md"
        onPointerDown={total > 1 ? handlePointerDown : undefined}
        onPointerUp={total > 1 ? handlePointerUp : undefined}
      >
        {items[safeIndex]}
      </div>
    </div>
  );
}
