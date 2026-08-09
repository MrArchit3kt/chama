export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Trophy, Medal, Crosshair } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";

const MIN_GAMES = 3;

function medalColor(rank: number) {
  if (rank === 0) return "text-amber-300";
  if (rank === 1) return "text-white/70";
  if (rank === 2) return "text-orange-400";
  return "text-white/30";
}

export default async function ClassementPage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const [wins, losses, kdStats] = await Promise.all([
    db.teamMember.groupBy({
      by: ["userId"],
      where: { userId: { not: null }, team: { result: "WIN" } },
      _count: { _all: true },
    }),
    db.teamMember.groupBy({
      by: ["userId"],
      where: { userId: { not: null }, team: { result: "LOSS" } },
      _count: { _all: true },
    }),
    db.teamMember.groupBy({
      by: ["userId"],
      where: {
        userId: { not: null },
        OR: [{ kills: { not: null } }, { deaths: { not: null } }],
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

  const ranking = userIds
    .map((id) => {
      const stats = byUser.get(id)!;
      const games = stats.wins + stats.losses;
      const rate = games > 0 ? Math.round((stats.wins / games) * 100) : 0;
      return { user: userById.get(id), ...stats, games, rate };
    })
    .filter((row) => row.user && row.games >= MIN_GAMES)
    .sort((a, b) => b.rate - a.rate || b.games - a.games);

  const kdRanking = kdStats
    .filter((row) => row.userId && row._count._all >= MIN_GAMES)
    .map((row) => {
      const kills = row._sum.kills ?? 0;
      const deaths = row._sum.deaths ?? 0;
      const ratio = deaths > 0 ? kills / deaths : kills;
      return {
        user: userById.get(row.userId!),
        kills,
        deaths,
        games: row._count._all,
        ratio: Math.round(ratio * 100) / 100,
      };
    })
    .filter((row) => row.user)
    .sort((a, b) => b.ratio - a.ratio || b.kills - a.kills);

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/75">
              Classement
            </p>
          </div>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Classement des joueurs
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Basé sur les résultats et les stats que les joueurs renseignent
            eux-mêmes après chaque partie, tous jeux confondus. Il faut au
            moins {MIN_GAMES} matchs renseignés pour apparaître dans un
            classement.
          </p>
        </div>

        <h2 className="flex items-center gap-2 text-lg font-bold text-white md:text-xl">
          <Trophy className="h-4 w-4 text-amber-300" />
          Meilleurs taux de victoire
        </h2>

        {ranking.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Pas encore assez de résultats renseignés pour établir un
              classement.
            </p>
          </div>
        ) : (
          <div className="neon-card overflow-hidden p-0">
            <div className="thin-scrollbar overflow-x-auto">
              <table className="w-full min-w-120 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.14em] text-white/40">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Joueur</th>
                    <th className="px-4 py-3 text-center">Victoires</th>
                    <th className="px-4 py-3 text-center">Défaites</th>
                    <th className="px-4 py-3 text-center">Matchs</th>
                    <th className="px-4 py-3 text-right">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row, idx) => {
                    const isSelf = row.user!.id === sessionUser.id;
                    return (
                      <tr
                        key={row.user!.id}
                        className={
                          isSelf
                            ? "border-b border-white/5 bg-cyan-400/6"
                            : "border-b border-white/5"
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {idx < 3 ? (
                              <Medal className={`h-4 w-4 ${medalColor(idx)}`} />
                            ) : null}
                            <span className="font-bold text-white/70">{idx + 1}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="truncate font-semibold text-white">
                            {row.user!.displayName}
                            {isSelf ? (
                              <span className="ml-1.5 neon-badge text-[9px]">TOI</span>
                            ) : null}
                          </p>
                          <p className="neon-text-muted truncate text-xs">@{row.user!.username}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-300">
                          {row.wins}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-rose-300">
                          {row.losses}
                        </td>
                        <td className="px-4 py-3 text-center text-white/70">{row.games}</td>
                        <td className="px-4 py-3 text-right text-lg font-black text-cyan-300">
                          {row.rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-white md:text-xl">
          <Crosshair className="h-4 w-4 text-pink-300" />
          Meilleur ratio Kills/Morts
        </h2>

        {kdRanking.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Pas encore assez de stats renseignées pour établir un
              classement K/D.
            </p>
          </div>
        ) : (
          <div className="neon-card overflow-hidden p-0">
            <div className="thin-scrollbar overflow-x-auto">
              <table className="w-full min-w-120 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.14em] text-white/40">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Joueur</th>
                    <th className="px-4 py-3 text-center">Kills</th>
                    <th className="px-4 py-3 text-center">Morts</th>
                    <th className="px-4 py-3 text-center">Matchs</th>
                    <th className="px-4 py-3 text-right">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {kdRanking.map((row, idx) => {
                    const isSelf = row.user!.id === sessionUser.id;
                    return (
                      <tr
                        key={row.user!.id}
                        className={
                          isSelf
                            ? "border-b border-white/5 bg-cyan-400/6"
                            : "border-b border-white/5"
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {idx < 3 ? (
                              <Medal className={`h-4 w-4 ${medalColor(idx)}`} />
                            ) : null}
                            <span className="font-bold text-white/70">{idx + 1}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="truncate font-semibold text-white">
                            {row.user!.displayName}
                            {isSelf ? (
                              <span className="ml-1.5 neon-badge text-[9px]">TOI</span>
                            ) : null}
                          </p>
                          <p className="neon-text-muted truncate text-xs">@{row.user!.username}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-300">
                          {row.kills}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-rose-300">
                          {row.deaths}
                        </td>
                        <td className="px-4 py-3 text-center text-white/70">{row.games}</td>
                        <td className="px-4 py-3 text-right text-lg font-black text-pink-300">
                          {row.ratio}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
