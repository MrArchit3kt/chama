export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";

function medalColor(rank: number) {
  if (rank === 0) return "text-amber-300";
  if (rank === 1) return "text-white/70";
  if (rank === 2) return "text-orange-400";
  return "text-white/30";
}

type RankingRow = { key: string; label: string; sub: string; points: number };

/** Un invité est identifié par son nom (pas de compte) : les mêmes noms
 * saisis sur des tableaux différents sont regroupés ensemble. */
function memberKey(member: { userId: string | null; guestName: string | null }) {
  if (member.userId) return `user:${member.userId}`;
  return `guest:${(member.guestName ?? "Invité").trim().toLowerCase()}`;
}

async function getRanking(gameModeId: string): Promise<RankingRow[]> {
  const entries = await db.scoreEntry.findMany({
    where: { condition: { gameModeId } },
    select: {
      quantity: true,
      condition: { select: { points: true, appliesTo: true } },
      team: {
        select: {
          members: {
            select: {
              id: true,
              userId: true,
              guestName: true,
              user: { select: { displayName: true, username: true } },
            },
          },
        },
      },
      teamMember: {
        select: {
          id: true,
          userId: true,
          guestName: true,
          user: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  const totals = new Map<string, RankingRow>();

  function credit(member: {
    userId: string | null;
    guestName: string | null;
    user: { displayName: string; username: string } | null;
  }, points: number) {
    const key = memberKey(member);
    const current = totals.get(key) ?? {
      key,
      label: member.user?.displayName ?? member.guestName ?? "Invité",
      sub: member.user ? `@${member.user.username}` : "Invité",
      points: 0,
    };
    current.points += points;
    totals.set(key, current);
  }

  for (const entry of entries) {
    const points = entry.quantity * entry.condition.points;

    if (entry.condition.appliesTo === "TEAM" && entry.team) {
      for (const member of entry.team.members) {
        credit(member, points);
      }
    } else if (entry.teamMember) {
      credit(entry.teamMember, points);
    }
  }

  return [...totals.values()].sort((a, b) => b.points - a.points);
}

export default async function PointsPage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const gameModes = await db.scoreGameMode.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const rankings = await Promise.all(gameModes.map((mode) => getRanking(mode.id)));

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Points
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Classements par mode de jeu
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Points cumulés sur tous les tableaux saisis par les admins, pour
            chaque mode de jeu.
          </p>
        </div>

        {gameModes.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Aucun mode de jeu à points pour le moment.
            </p>
          </div>
        ) : (
          gameModes.map((mode, idx) => {
            const ranking = rankings[idx];

            return (
              <div key={mode.id} className="neon-card p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white md:text-2xl">{mode.name}</h2>
                    {mode.description ? (
                      <p className="neon-text-muted mt-2 max-w-2xl text-sm leading-6">
                        {mode.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="neon-badge">
                    {ranking.length} joueur{ranking.length > 1 ? "s" : ""}
                  </span>
                </div>

                {ranking.length === 0 ? (
                  <p className="neon-text-muted mt-4 text-sm">
                    Aucun score enregistré pour ce mode pour le moment.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2">
                    {ranking.map((row, rank) => {
                      const isMe = row.key === `user:${sessionUser.id}`;

                      return (
                        <div
                          key={row.key}
                          className={
                            isMe
                              ? "flex items-center justify-between gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.06] px-4 py-3"
                              : "flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/2 px-4 py-3"
                          }
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center text-sm font-black ${medalColor(rank)}`}
                            >
                              {rank < 3 ? <Trophy className="h-4 w-4" /> : rank + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">{row.label}</p>
                              <p className="neon-text-muted truncate text-[11px]">{row.sub}</p>
                            </div>
                          </div>

                          <span className="neon-title neon-gradient-text shrink-0 text-lg font-black">
                            {row.points} pt{row.points > 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </SiteShell>
  );
}
