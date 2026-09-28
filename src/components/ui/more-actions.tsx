import type { ReactNode } from "react";

/**
 * Regroupe des actions secondaires (export, suppression...) derrière un
 * repli `<details>` natif — pas de JS nécessaire, donc rigoureusement le
 * même comportement sur mobile et sur PC (pas de divergence liée à une
 * media query). Sert à garder une seule action principale toujours
 * visible par bloc (partie, tournoi...) plutôt que 3-4 boutons d'un coup.
 */
export function MoreActions({
  children,
  label = "⋯ Plus d’options",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="mt-2">
      <summary className="inline-block cursor-pointer list-none text-[11px] font-semibold text-white/40 transition hover:text-white/70">
        {label}
      </summary>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </details>
  );
}
