import "server-only";
import { db } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { logServerError } from "@/lib/log-error";
import { computeRanking } from "@/lib/classement";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * `/classement` est glissant sur le mois en cours (voir computeRanking) —
 * il "se remet à zéro" tout seul le 1er de chaque mois sans qu'aucune
 * donnée ne soit jamais supprimée. Cette fonction capture juste, une fois
 * par mois, le classement final du mois qui vient de se terminer dans le
 * journal d'activité (/admin/activity, super admin) pour garder une trace
 * de qui récompenser — appelée périodiquement depuis instrumentation.ts.
 *
 * Idempotent : ne fait rien si un archivage existe déjà pour le mois en
 * cours (on ne réarchive jamais deux fois le même mois précédent).
 */
export async function archiveMonthlyRankingIfNeeded() {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const alreadyArchived = await db.activityLog.findFirst({
      where: { action: "MONTHLY_RANKING_ARCHIVED", createdAt: { gte: currentMonthStart } },
      select: { id: true },
    });
    if (alreadyArchived) return;

    const { winRateRanking, kdRanking } = await computeRanking({
      gte: previousMonthStart,
      lt: currentMonthStart,
    });

    if (winRateRanking.length === 0 && kdRanking.length === 0) return;

    const champion = winRateRanking[0]?.displayName ?? null;
    const kdChampion = kdRanking[0]?.displayName ?? null;

    await logActivity({
      action: "MONTHLY_RANKING_ARCHIVED",
      actorId: null,
      actorLabel: "Système (archivage mensuel automatique)",
      targetLabel:
        champion || kdChampion
          ? `${monthLabel(previousMonthStart)} — 🏆 ${champion ?? "—"} · 🎯 ${kdChampion ?? "—"}`
          : monthLabel(previousMonthStart),
      metadata: {
        month: monthKey(previousMonthStart),
        topWinRate: winRateRanking.slice(0, 5).map((r) => ({
          name: r.displayName,
          username: r.username,
          wins: r.wins,
          losses: r.losses,
          games: r.games,
          rate: r.rate,
        })),
        topKD: kdRanking.slice(0, 5).map((r) => ({
          name: r.displayName,
          username: r.username,
          kills: r.kills,
          deaths: r.deaths,
          games: r.games,
          ratio: r.ratio,
        })),
      },
    });
  } catch (error) {
    await logServerError("MONTHLY_RANKING_ARCHIVE_ERROR", error);
  }
}
