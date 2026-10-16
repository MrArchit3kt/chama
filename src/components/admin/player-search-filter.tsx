"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type PlayerSearchFilterProps = {
  /** Rendu serveur des cartes à filtrer — chaque carte à filtrer doit porter
   * un attribut data-player-search="<nom en minuscules>" (voir les pages
   * admin/mix/*). Pure manipulation DOM côté client, le contenu de chaque
   * carte (badges, champs spécifiques au jeu...) reste rendu côté serveur
   * tel quel, pas dupliqué ici. */
  children: ReactNode;
};

/**
 * Barre de recherche + raccourcis alphabétiques pour retrouver vite un
 * joueur dans une longue liste de candidats (admin/mix/*). Cliquer une
 * lettre filtre sur les noms qui commencent par elle, comme taper cette
 * lettre dans la recherche — un seul état partagé entre les deux.
 */
export function PlayerSearchFilter({ children }: PlayerSearchFilterProps) {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const normalized = query.trim().toLowerCase();
    const cards = containerRef.current?.querySelectorAll<HTMLElement>("[data-player-search]");
    if (!cards) return;

    let visibleCount = 0;
    cards.forEach((card) => {
      const name = card.dataset.playerSearch ?? "";
      const matches = !normalized || name.startsWith(normalized);
      card.style.display = matches ? "" : "none";
      if (matches) visibleCount += 1;
    });

    if (emptyRef.current) {
      emptyRef.current.style.display = normalized && visibleCount === 0 ? "" : "none";
    }
  }, [query]);

  function toggleLetter(letter: string) {
    setQuery((prev) => (prev.toLowerCase() === letter.toLowerCase() ? "" : letter));
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un joueur par nom..."
          className="w-full px-4 py-2.5 text-sm sm:max-w-xs"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.05]"
          >
            Effacer
          </button>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {ALPHABET.map((letter) => {
          const active = query.toLowerCase() === letter.toLowerCase();
          return (
            <button
              key={letter}
              type="button"
              onClick={() => toggleLetter(letter)}
              className={
                active
                  ? "flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-400/15 text-xs font-bold text-cyan-200"
                  : "flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-xs font-semibold text-white/60 transition hover:border-cyan-400/25 hover:text-white"
              }
            >
              {letter}
            </button>
          );
        })}
      </div>

      <p ref={emptyRef} className="neon-text-muted mt-3 text-sm" style={{ display: "none" }}>
        Aucun joueur ne correspond à « {query} ».
      </p>

      <div ref={containerRef} className="contents">
        {children}
      </div>
    </div>
  );
}
