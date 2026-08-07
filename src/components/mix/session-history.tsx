import Link from "next/link";

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
 * Petite frise de sessions précédentes (chips cliquables) pour pouvoir
 * revoir un mix généré plus tôt, pas seulement le dernier.
 */
export function SessionHistory({ sessions, basePath, currentSessionId }: SessionHistoryProps) {
  if (sessions.length <= 1) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        Sessions précédentes
      </span>

      {sessions.map((s) => {
        const isActive = s.id === currentSessionId;

        return (
          <Link
            key={s.id}
            href={`${basePath}?session=${s.id}`}
            className={
              isActive
                ? "rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-300"
                : "rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[11px] text-white/60 transition hover:border-white/20 hover:text-white"
            }
          >
            {formatDate(s.createdAt)}
          </Link>
        );
      })}
    </div>
  );
}
