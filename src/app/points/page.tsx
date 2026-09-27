export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { computeEntryPoints } from "@/lib/scoring";
import { computeTournamentStandings } from "@/lib/tournament-standings";
import { joinScoreTeam } from "@/server/points/join-score-team";
import { leaveScoreTeam } from "@/server/points/leave-score-team";

const conditionForScoringSelect = {
  points: true,
  mode: true,
  tiers: { select: { minValue: true, maxValue: true, points: true } },
} as const;

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Ce tournoi n’est pas en mode « libre choix ».";
    case "locked":
      return "Le tournoi a démarré, la composition des équipes est verrouillée.";
    case "team_full":
      return "Cette équipe est déjà complète.";
    case "validation":
      return "Action invalide.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

async function getTournaments() {
  const tournaments = await db.scoreTournament.findMany({
    where: { format: "CLASSIC" },
    orderBy: { createdAt: "desc" },
    include: {
      boards: {
        orderBy: { createdAt: "asc" },
        include: {
          gameMode: { select: { name: true } },
          teams: {
            orderBy: { createdAt: "asc" },
            include: {
              entries: { include: { condition: { select: conditionForScoringSelect } } },
              members: {
                include: {
                  user: { select: { displayName: true, username: true } },
                  entries: { include: { condition: { select: conditionForScoringSelect } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return tournaments
    .filter((t) => t.boards.length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      teamMode: t.teamMode,
      startedAt: t.startedAt,
      maxMembersPerTeam: t.maxMembersPerTeam,
      // Partie de référence : la composition d'équipes est la même sur
      // toutes les parties du tournoi, on peut donc se baser sur la
      // première pour l'affichage "rejoindre une équipe".
      referenceBoardTeams: t.boards[0].teams.map((team) => ({
        id: team.id,
        name: team.name,
        members: team.members.map((m) => ({
          userId: m.userId,
          label: m.user ? m.user.displayName : m.guestName ?? "Invité",
        })),
      })),
      standings: computeTournamentStandings(t.boards),
    }));
}

async function getBracketTournaments() {
  const tournaments = await db.scoreTournament.findMany({
    where: { format: "BRACKET" },
    orderBy: { createdAt: "desc" },
    include: {
      matches: { orderBy: [{ round: "asc" }, { position: "asc" }] },
    },
  });

  return tournaments
    .filter((t) => t.matches.length > 0)
    .map((t) => {
      const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
      const latestRound = rounds[rounds.length - 1];
      const latestMatches = t.matches.filter((m) => m.round === latestRound);
      const champion = latestMatches.length === 1 ? latestMatches[0].winnerName : null;

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        champion,
        rounds: rounds.map((round) => ({
          round,
          isFinal: t.matches.filter((m) => m.round === round).length === 1,
          matches: t.matches.filter((m) => m.round === round),
        })),
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

export default async function PointsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; joined?: string; left?: string }>;
}) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isJoined = sp.joined === "1";
  const isLeft = sp.left === "1";

  const gameModes = await db.scoreGameMode.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const rankings = await Promise.all(gameModes.map((mode) => getRanking(mode.id)));
  const tournaments = await getTournaments();
  const bracketTournaments = await getBracketTournaments();

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

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isJoined ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">Tu as rejoint l’équipe.</p>
          </div>
        ) : null}

        {isLeft ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">Tu as quitté l’équipe.</p>
          </div>
        ) : null}

        {bracketTournaments.map((tournament) => (
          <div key={tournament.id} className="neon-card p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/75">
                  Tournoi — Organigramme
                </p>
                <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">{tournament.name}</h2>
                {tournament.description ? (
                  <p className="neon-text-muted mt-2 max-w-2xl text-sm leading-6">
                    {tournament.description}
                  </p>
                ) : null}
              </div>
              {tournament.champion ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-black uppercase tracking-widest text-amber-300">
                  🏆 Champion : {tournament.champion}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-5 overflow-x-auto pb-2 md:grid-flow-col md:auto-cols-[minmax(200px,1fr)]">
              {tournament.rounds.map(({ round, isFinal, matches }) => (
                <div key={round} className="grid gap-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                    {isFinal ? "Finale" : `Tour ${round}`}
                  </p>
                  {matches.map((match) => (
                    <div key={match.id} className="rounded-2xl border border-white/8 bg-white/2 p-3">
                      {[match.teamAName, match.teamBName].map((teamName, i) =>
                        teamName ? (
                          <p
                            key={i}
                            className={
                              match.winnerName === teamName
                                ? "truncate rounded-lg bg-emerald-400/10 px-2 py-1.5 text-sm font-bold text-emerald-300"
                                : "truncate px-2 py-1.5 text-sm text-white/80"
                            }
                          >
                            {teamName}
                          </p>
                        ) : (
                          <p key={i} className="px-2 py-1.5 text-sm italic text-white/30">
                            (bye)
                          </p>
                        ),
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}

        {tournaments.map((tournament) => {
          const myTeam = tournament.referenceBoardTeams.find((t) =>
            t.members.some((m) => m.userId === sessionUser.id),
          );

          return (
          <div key={tournament.id} className="neon-card p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/75">
                  Tournoi
                </p>
                <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">
                  {tournament.name}
                </h2>
                {tournament.description ? (
                  <p className="neon-text-muted mt-2 max-w-2xl text-sm leading-6">
                    {tournament.description}
                  </p>
                ) : null}
              </div>
            </div>

            {tournament.teamMode === "SELF_JOIN" ? (
              <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/4 p-3.5 md:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Équipes
                </p>

                {tournament.startedAt ? (
                  <p className="neon-text-muted mt-2 text-xs">
                    Le tournoi a démarré, la composition des équipes est verrouillée.
                  </p>
                ) : null}

                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {tournament.referenceBoardTeams.map((team) => {
                    const isMine = team.id === myTeam?.id;
                    const isFull = Boolean(
                      tournament.maxMembersPerTeam &&
                        team.members.length >= tournament.maxMembersPerTeam &&
                        !isMine,
                    );

                    return (
                      <div
                        key={team.id}
                        className={
                          isMine
                            ? "rounded-xl border border-cyan-400/30 bg-cyan-400/[0.08] p-3"
                            : "rounded-xl border border-white/8 bg-white/2 p-3"
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold text-white">
                            {team.name}
                            {tournament.maxMembersPerTeam ? (
                              <span className="neon-text-muted ml-1.5 text-[11px] font-normal">
                                ({team.members.length}/{tournament.maxMembersPerTeam})
                              </span>
                            ) : null}
                          </span>

                          {!tournament.startedAt ? (
                            isMine ? (
                              <form action={leaveScoreTeam}>
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <button
                                  type="submit"
                                  className="shrink-0 rounded-lg border border-rose-400/20 px-2.5 py-1 text-[11px] font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                                >
                                  Quitter
                                </button>
                              </form>
                            ) : (
                              <form action={joinScoreTeam}>
                                <input type="hidden" name="teamId" value={team.id} />
                                <button
                                  type="submit"
                                  disabled={isFull}
                                  className="neon-button-secondary shrink-0 px-2.5 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {isFull ? "Complet" : "Rejoindre"}
                                </button>
                              </form>
                            )
                          ) : null}
                        </div>
                        <p className="neon-text-muted mt-1.5 truncate text-[11px]">
                          {team.members.length > 0
                            ? team.members.map((m) => m.label).join(", ")
                            : "Aucun joueur"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {tournament.standings.length === 0 ? (
              <p className="neon-text-muted mt-4 text-sm">
                Aucun score enregistré pour ce tournoi pour le moment.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {tournament.standings.map((row, rank) => (
                  <div
                    key={row.key}
                    className={
                      rank === 0
                        ? "flex items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3"
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
                        <p className="truncate text-sm font-bold text-white">
                          {row.name}
                          {rank === 0 ? (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                              Vainqueur
                            </span>
                          ) : null}
                        </p>
                        <p className="neon-text-muted truncate text-[11px]">
                          {row.breakdown
                            .map(
                              (b) =>
                                `${b.gameModeName} : ${b.points > 0 ? "+" : ""}${b.points} pt${Math.abs(b.points) > 1 ? "s" : ""}`,
                            )
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    <span className="neon-title neon-gradient-text shrink-0 text-lg font-black">
                      {row.total} pt{Math.abs(row.total) > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}

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
