"use client";

import { useRouter } from "next/navigation";

type SessionHistoryProps = {
  sessions: { id: string; createdAt: Date }[];
  basePath: string;
  currentSessionId?: string;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/**
 * Sélecteur des sessions générées aujourd'hui (menu déroulant) pour revoir
 * un mix précédent sans avoir à afficher toutes les dates les unes à côté
 * des autres. L'historique est nettoyé chaque jour (voir cleanup-old-sessions),
 * donc cette liste ne contient jamais que les sessions du jour.
 */
export function SessionHistory({ sessions, basePath, currentSessionId }: SessionHistoryProps) {
  const router = useRouter();

  if (sessions.length <= 1) return null;

  const activeId = currentSessionId ?? sessions[0]?.id ?? "";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label
        htmlFor="session-history-select"
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40"
      >
        Sessions du jour
      </label>

      <select
        id="session-history-select"
        value={activeId}
        onChange={(e) => router.push(`${basePath}?session=${e.target.value}`)}
        className="rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/20 focus:border-cyan-400/40 focus:outline-none"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id} className="bg-[#0b0f1e] text-white">
            {formatDate(s.createdAt)}
          </option>
        ))}
      </select>
    </div>
  );
}
