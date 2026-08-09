export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Bug } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { purgeErrorLogs } from "@/server/admin/purge-error-logs";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function oneDayAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; purged?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const hasError = sp.error === "server";
  const isPurged = sp.purged === "1";

  const [errors, last24hCount, totalCount] = await Promise.all([
    db.errorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.errorLog.count({ where: { createdAt: { gte: oneDayAgo() } } }),
    db.errorLog.count(),
  ]);

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-4 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-rose-300" />
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-300/75">
                  Monitoring
                </p>
              </div>
              <h1 className="neon-title neon-gradient-text mt-2 text-xl font-black md:mt-3 md:text-3xl">
                Erreurs serveur
              </h1>
              <p className="neon-text-muted mt-2 hidden max-w-3xl text-sm leading-6 md:mt-4 md:block md:text-base md:leading-7">
                Erreurs inattendues capturées côté serveur (actions, routes
                API). Les 100 plus récentes sont affichées ; nettoyage
                automatique au-delà de 30 jours.
              </p>
            </div>

            <div className="flex gap-2.5">
              <div className="neon-card-soft px-4 py-3 md:px-5 md:py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/75 md:text-xs">
                  Dernières 24h
                </p>
                <p className="mt-1 text-xl font-black text-white md:text-2xl">{last24hCount}</p>
              </div>
              <div className="neon-card-soft px-4 py-3 md:px-5 md:py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 md:text-xs">
                  Total
                </p>
                <p className="mt-1 text-xl font-black text-white md:text-2xl">{totalCount}</p>
              </div>
            </div>
          </div>
        </div>

        {hasError ? (
          <div className="neon-card p-4 md:p-6">
            <p className="text-sm font-medium text-rose-400">
              Erreur pendant la purge de l’historique.
            </p>
          </div>
        ) : null}

        {isPurged ? (
          <div className="neon-card p-4 md:p-6">
            <p className="text-sm font-medium text-emerald-400">
              Historique des erreurs vidé.
            </p>
          </div>
        ) : null}

        {errors.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Aucune erreur journalisée. Tout va bien.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-2 md:gap-2.5">
              {errors.map((item) => (
                <details key={item.id} className="group neon-card relative overflow-hidden p-0">
                  <summary className="list-none cursor-pointer p-3 pr-8 md:p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                        {item.context}
                      </span>
                    </div>

                    <p className="mt-1.5 truncate text-sm font-bold text-white md:text-base">
                      {item.message}
                    </p>

                    <p className="neon-text-muted mt-0.5 truncate text-xs">
                      {formatDate(item.createdAt)}
                      {item.userId ? ` · utilisateur ${item.userId}` : ""}
                    </p>

                    <span className="pointer-events-none absolute right-3 top-3 text-xs text-white/40 transition group-open:rotate-180 md:right-4 md:top-4">
                      ▼
                    </span>
                  </summary>

                  <div className="border-t border-white/8 px-3 pb-3 pt-3 md:px-4 md:pb-4">
                    {item.url ? (
                      <p className="neon-text-muted text-xs">URL : {item.url}</p>
                    ) : null}

                    <div className="thin-scrollbar mt-2.5 max-h-64 overflow-auto rounded-2xl border border-white/8 bg-white/2 p-3 md:p-4">
                      <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs leading-5 text-white/80">
                        {item.stack ?? item.message}
                      </pre>
                    </div>
                  </div>
                </details>
              ))}
            </div>

            <form action={purgeErrorLogs}>
              <button
                type="submit"
                className="neon-button-secondary px-4 py-2.5 text-sm md:px-5 md:py-3"
              >
                Vider l’historique
              </button>
            </form>
          </>
        )}
      </div>
    </SiteShell>
  );
}
