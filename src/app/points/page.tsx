export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, CalendarDays, ChevronRight } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { computeEntryPoints } from "@/lib/scoring";
import { getBracketState } from "@/lib/bracket";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatLabel(format: string) {
  return format === "BRACKET" ? "Organigramme" : "Classique";
}

async function getTournamentSummaries() {
  const tournaments = await db.scoreTournament.findMany({
    orderBy: [{ startedAt: "desc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
    include: {
      matches: {
        select: {
          id: true,
          bracketType: true,
          round: true,
          position: true,
          teamAName: true,
          teamBName: true,
          winnerName: true,
          lbSeeded: true,
        },
      },
      _count: { select: { interests: true } },
    },
  });

  return tournaments.map((t) => {
    let status: "À venir" | "En cours" | "Terminé" = t.startedAt ? "En cours" : "À venir";
    let champion: string | null = null;

    if (t.format === "BRACKET" && t.matches.length > 0) {
      const state = getBracketState(t.matches);
      if (state.champion) {
        status = "Terminé";
        champion = state.champion;
      }
    }

    return {
      id: t.id,
      name: t.name,
      format: t.format,
      scheduledAt: t.scheduledAt,
      status,
      champion,
      interestCount: t._count.interests,
    };
  });
}

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
      condition: {
        select: {
          points: true,
          appliesTo: true,
          mode: true,
          tiers: { select: { minValue: true, maxValue: true, points: true } },
        },
      },
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
    const points = computeEntryPoints(entry.quantity, entry.condition);

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
  const tournaments = await getTournamentSummaries();

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Points
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Tournois &amp; classements
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Points cumulés sur tous les tableaux saisis par les admins, pour
            chaque mode de jeu.
          </p>
        </div>

        {tournaments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/points/${tournament.id}`}
                className="neon-card flex flex-col justify-between gap-3 p-4 transition hover:border-cyan-400/30 md:p-5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="neon-badge text-[10px]">{formatLabel(tournament.format)}</span>
                    <span
                      className={
                        tournament.status === "Terminé"
                          ? "rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300"
                          : tournament.status === "En cours"
                            ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300"
                            : "rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60"
                      }
                    >
                      {tournament.status}
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-lg font-bold text-white">{tournament.name}</h2>
                  <p className="neon-text-muted mt-1 flex items-center gap-1.5 text-xs">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {tournament.scheduledAt ? formatDate(tournament.scheduledAt) : "Date à définir"}
                  </p>
                  {tournament.champion ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Trophy className="h-3.5 w-3.5" /> {tournament.champion}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  {tournament.interestCount > 0 ? (
                    <span className="text-xs text-white/50">
                      🙋 {tournament.interestCount} intéressé{tournament.interestCount > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="flex items-center gap-1 text-xs font-semibold text-cyan-300">
                    Voir <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

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
                            {row.points} pt{Math.abs(row.points) > 1 ? "s" : ""}
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
