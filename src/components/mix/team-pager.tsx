"use client";

import { Children, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TeamPagerProps = {
  /** Une carte d'équipe pré-rendue par élément, déjà triée (la sienne en premier). */
  children: React.ReactNode;
};

/**
 * N'affiche qu'une équipe à la fois (la sienne en premier, grâce au tri
 * fait par la page appelante) — les autres ne sont visibles qu'en cliquant
 * sur une flèche, pour éviter d'imposer le scroll de toutes les équipes.
 */
export function TeamPager({ children }: TeamPagerProps) {
  const items = Children.toArray(children);
  const total = items.length;
  const [index, setIndex] = useState(0);

  if (total === 0) return null;

  const safeIndex = Math.min(index, total - 1);

  return (
    <div className="mt-5">
      {total > 1 ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
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
            onClick={() => setIndex((i) => (i + 1) % total)}
            aria-label="Équipe suivante"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/70 transition hover:border-cyan-400/30 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="md:max-w-md">{items[safeIndex]}</div>
    </div>
  );
}
