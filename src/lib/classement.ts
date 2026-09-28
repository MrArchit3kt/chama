import "server-only";
import { db } from "@/lib/prisma";

export const CLASSEMENT_MIN_GAMES = 3;

type DateWindow = { gte: Date; lt?: Date };

export type WinRateRow = {
  userId: string;
  displayName: string;
  username: string;
  wins: number;
  losses: number;
  games: number;
  rate: number;
};

export type KdRow = {
  userId: string;
  displayName: string;
  username: string;
  kills: number;
  deaths: number;
  games: number;
  ratio: number;
};

/**
 * Calcule le classement taux de victoire + K/D à partir des résultats
 * auto-déclarés par les joueurs (Team.result, TeamMember.kills/deaths),
 * optionnellement borné à une fenêtre de dates (sur `Team.createdAt`,
 * date de la partie). Partagé entre `/classement` (fenêtre = mois en
 * cours) et l'archivage mensuel (fenêtre = mois précédent) pour ne pas
 * dupliquer la logique d'agrégation.
 */
export async function computeRanking(window?: DateWindow) {
  const teamDateFilter = window ? { createdAt: window } : undefined;

  const [wins, losses, kdStats] = await Promise.all([
    db.teamMember.groupBy({
      by: ["userId"],
      where: { userId: { not: null }, team: { result: "WIN", ...teamDateFilter } },
      _count: { _all: true },
    }),
    db.teamMember.groupBy({
      by: ["userId"],
      where: { userId: { not: null }, team: { result: "LOSS", ...teamDateFilter } },
      _count: { _all: true },
    }),
    db.teamMember.groupBy({
      by: ["userId"],
      where: {
        userId: { not: null },
        OR: [{ kills: { not: null } }, { deaths: { not: null } }],
        ...(teamDateFilter ? { team: teamDateFilter } : {}),
      },
      _sum: { kills: true, deaths: true },
      _count: { _all: true },
    }),
  ]);

  const byUser = new Map<string, { wins: number; losses: number }>();

  for (const row of wins) {
    if (!row.userId) continue;
    byUser.set(row.userId, { wins: row._count._all, losses: 0 });
  }
  for (const row of losses) {
    if (!row.userId) continue;
    const current = byUser.get(row.userId) ?? { wins: 0, losses: 0 };
    current.losses = row._count._all;
    byUser.set(row.userId, current);
  }

  const userIds = [...byUser.keys()];
  const kdUserIds = kdStats.filter((r) => r.userId).map((r) => r.userId!);
  const allUserIds = [...new Set([...userIds, ...kdUserIds])];

  const users = allUserIds.length
    ? await db.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, displayName: true, username: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const winRateRanking: WinRateRow[] = userIds
    .map((id) => {
      const stats = byUser.get(id)!;
      const games = stats.wins + stats.losses;
      const rate = games > 0 ? Math.round((stats.wins / games) * 100) : 0;
      const user = userById.get(id);
      return user ? { userId: id, displayName: user.displayName, username: user.username, ...stats, games, rate } : null;
    })
    .filter((row): row is WinRateRow => row !== null && row.games >= CLASSEMENT_MIN_GAMES)
    .sort((a, b) => b.rate - a.rate || b.games - a.games);

  const kdRanking: KdRow[] = kdStats
    .filter((row) => row.userId && row._count._all >= CLASSEMENT_MIN_GAMES)
    .map((row) => {
      const user = userById.get(row.userId!);
      if (!user) return null;
      const kills = row._sum.kills ?? 0;
      const deaths = row._sum.deaths ?? 0;
      const ratio = deaths > 0 ? kills / deaths : kills;
      return {
        userId: row.userId!,
        displayName: user.displayName,
        username: user.username,
        kills,
        deaths,
        games: row._count._all,
        ratio: Math.round(ratio * 100) / 100,
      };
    })
    .filter((row): row is KdRow => row !== null)
    .sort((a, b) => b.ratio - a.ratio || b.kills - a.kills);

  return { winRateRanking, kdRanking };
}
