"use client";

import { useRouter } from "next/navigation";

type BoardHistoryProps = {
  boards: { id: string; createdAt: Date; title: string | null }[];
  basePath: string;
  currentBoardId?: string;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/**
 * Calque de src/components/mix/session-history.tsx, pour les tableaux de
 * points plutôt que les sessions de mix (paramètre `board` au lieu de
 * `session`, pas de purge quotidienne donc l'historique peut être long).
 */
export function BoardHistory({ boards, basePath, currentBoardId }: BoardHistoryProps) {
  const router = useRouter();

  if (boards.length <= 1) return null;

  const activeId = currentBoardId ?? boards[0]?.id ?? "";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label
        htmlFor="board-history-select"
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40"
      >
        Tableaux précédents
      </label>

      <select
        id="board-history-select"
        value={activeId}
        onChange={(e) => router.push(`${basePath}?board=${e.target.value}`)}
        className="rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/20 focus:border-cyan-400/40 focus:outline-none"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id} className="bg-[#0b0f1e] text-white">
            {b.title || formatDate(b.createdAt)}
          </option>
        ))}
      </select>
    </div>
  );
}
