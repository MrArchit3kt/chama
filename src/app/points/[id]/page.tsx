export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, Skull, CalendarDays } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { computeTournamentStandings } from "@/lib/tournament-standings";
import { groupRounds, getBracketState } from "@/lib/bracket";
import { joinScoreTeam } from "@/server/points/join-score-team";
import { leaveScoreTeam } from "@/server/points/leave-score-team";
import { toggleTournamentInterest } from "@/server/points/toggle-tournament-interest";

const conditionForScoringSelect = {
  points: true,
  mode: true,
  tiers: { select: { minValue: true, maxValue: true, points: true } },
} as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatLabel(format: string) {
  return format === "BRACKET" ? "Organigramme" : "Classique";
}

function medalColor(rank: number) {
  if (rank === 0) return "text-amber-300";
  if (rank === 1) return "text-white/70";
  if (rank === 2) return "text-orange-400";
  return "text-white/30";
}

function memberLabel(member: {
  guestName: string | null;
  user: { displayName: string; username: string } | null;
}) {
  return member.user ? member.user.displayName : member.guestName ?? "Invité";
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Ce tournoi n’est pas en mode « libre choix ».";
    case "locked":
      return "Le tournoi a démarré, la composition/le sondage est verrouillé(e).";
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

type BracketMatch = {
  id: string;
  teamAName: string | null;
  teamBName: string | null;
  winnerName: string | null;
};

function BracketMatchCard({ match, accent }: { match: BracketMatch; accent: "emerald" | "rose" | "amber" }) {
  const winnerBg = {
    emerald: "bg-emerald-400/10 text-emerald-300",
    rose: "bg-rose-400/10 text-rose-300",
    amber: "bg-amber-400/10 text-amber-300",
  }[accent];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 p-3">
      {[match.teamAName, match.teamBName].map((teamName, i) =>
        teamName ? (
          <p
            key={i}
            className={
              match.winnerName === teamName
                ? `truncate rounded-lg px-2 py-1.5 text-sm font-bold ${winnerBg}`
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
  );
}

function BracketRoundColumn({
  label,
  matches,
  accent,
}: {
  label: string;
  matches: BracketMatch[];
  accent: "emerald" | "rose";
}) {
  return (
    <div className="grid content-center gap-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      {matches.map((match) => (
        <BracketMatchCard key={match.id} match={match} accent={accent} />
      ))}
    </div>
  );
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; joined?: string; left?: string }>;
}) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isJoined = sp.joined === "1";
  const isLeft = sp.left === "1";

  const tournament = await db.scoreTournament.findUnique({
    where: { id },
    include: {
      gameModes: { select: { id: true, name: true } },
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
                  user: { select: { id: true, displayName: true, username: true } },
                  entries: { include: { condition: { select: conditionForScoringSelect } } },
                },
              },
            },
          },
        },
      },
      bracketTeams: {
        orderBy: { createdAt: "asc" },
        include: { members: { include: { user: { select: { displayName: true, username: true } } } } },
      },
      matches: { orderBy: [{ round: "asc" }, { position: "asc" }] },
      interests: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { displayName: true, username: true } } },
      },
    },
  });

  if (!tournament) redirect("/points");

  const isInterested = tournament.interests.some((i) => i.userId === sessionUser.id);

  const standings = tournament.format === "CLASSIC" ? computeTournamentStandings(tournament.boards) : [];
  const gameModeNames = tournament.gameModes.map((m) => m.name);

  const referenceBoardTeams =
    tournament.format === "CLASSIC" && tournament.boards.length > 0
      ? tournament.boards[0].teams.map((team) => ({
          id: team.id,
          name: team.name,
          members: team.members.map((m) => ({ userId: m.userId, label: memberLabel(m) })),
        }))
      : [];
  const myTeam = referenceBoardTeams.find((t) => t.members.some((m) => m.userId === sessionUser.id));

  const winnersRounds = groupRounds(tournament.matches, "WINNERS");
  const losersRounds = groupRounds(tournament.matches, "LOSERS");
  const grandFinal = tournament.matches.find((m) => m.bracketType === "GRAND_FINAL") ?? null;
  const { champion } = getBracketState(tournament.matches);

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            <Link href="/points" className="hover:text-white">
              Points
            </Link>
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            {tournament.name}
          </h1>
          {tournament.description ? (
            <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:text-base md:leading-7">
              {tournament.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="neon-badge text-[10px]">{formatLabel(tournament.format)}</span>
            <span className="neon-badge flex items-center gap-1.5 text-[10px]">
              <CalendarDays className="h-3 w-3" />
              {tournament.scheduledAt ? formatDate(tournament.scheduledAt) : "Date à définir"}
            </span>
            {champion ? (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <Trophy className="h-3 w-3" /> Champion : {champion}
              </span>
            ) : tournament.startedAt ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                En cours
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                À venir
              </span>
            )}
          </div>
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

        <div className="neon-card p-5 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Participation
          </p>
          {!tournament.startedAt ? (
            <form action={toggleTournamentInterest} className="mt-3">
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <button
                type="submit"
                className={isInterested ? "neon-button-secondary px-4 py-2 text-sm" : "neon-button px-4 py-2 text-sm"}
              >
                {isInterested ? "Je ne participe plus" : "Je participe"}
              </button>
            </form>
          ) : (
            <p className="neon-text-muted mt-2 text-xs">Le sondage est fermé, le tournoi a démarré.</p>
          )}
          <p className="neon-text-muted mt-3 text-xs">
            {tournament.interests.length === 0
              ? "Personne n’a encore indiqué vouloir participer."
              : tournament.interests
                  .map((i) => i.user.displayName)
                  .join(", ")}
          </p>
        </div>

        {tournament.format === "CLASSIC" ? (
          <>
            {referenceBoardTeams.length > 0 ? (
              <div className="neon-card p-5 md:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Équipes
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {referenceBoardTeams.map((team) => {
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

                          {tournament.teamMode === "SELF_JOIN" && !tournament.startedAt ? (
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

            <div className="neon-card overflow-hidden p-5 md:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/75">
                Points par partie &amp; total
              </p>
              {standings.length === 0 ? (
                <p className="neon-text-muted mt-4 text-sm">
                  Aucun score enregistré pour ce tournoi pour le moment.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.1em] text-white/40">
                        <th className="py-2 pr-3">Équipe</th>
                        {gameModeNames.map((name) => (
                          <th key={name} className="px-3 py-2 text-right">
                            {name}
                          </th>
                        ))}
                        <th className="py-2 pl-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, rank) => (
                        <tr key={row.key} className={rank === 0 ? "bg-amber-400/[0.06]" : undefined}>
                          <td className="flex items-center gap-2 py-2 pr-3">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${medalColor(rank)}`}>
                              {rank < 3 ? <Trophy className="h-3.5 w-3.5" /> : rank + 1}
                            </span>
                            <span className="truncate font-bold text-white">{row.name}</span>
                          </td>
                          {gameModeNames.map((name) => {
                            const entry = row.breakdown.find((b) => b.gameModeName === name);
                            return (
                              <td key={name} className="px-3 py-2 text-right text-white/70">
                                {entry ? `${entry.points > 0 ? "+" : ""}${entry.points}` : "–"}
                              </td>
                            );
                          })}
                          <td className="py-2 pl-3 text-right font-black text-white">
                            {row.total} pt{Math.abs(row.total) > 1 ? "s" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {tournament.bracketTeams.length > 0 ? (
              <div className="neon-card p-5 md:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Équipes
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {tournament.bracketTeams.map((team) => (
                    <div key={team.id} className="rounded-xl border border-white/8 bg-white/2 p-3">
                      <span className="truncate text-sm font-bold text-white">{team.name}</span>
                      <p className="neon-text-muted mt-1.5 truncate text-[11px]">
                        {team.members.length > 0
                          ? team.members.map(memberLabel).join(", ")
                          : "Aucun joueur"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="neon-card overflow-hidden p-5 md:p-8">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                <Trophy className="h-3.5 w-3.5" /> Bracket Gagnants
              </p>
              <div className="mt-4 grid gap-6 overflow-x-auto pb-2 md:grid-flow-col md:auto-cols-[minmax(190px,1fr)]">
                {winnersRounds.map(({ round, matches }) => (
                  <BracketRoundColumn
                    key={`wb-${round}`}
                    label={matches.length === 1 ? "Finale Gagnants" : `Tour ${round}`}
                    matches={matches}
                    accent="emerald"
                  />
                ))}
              </div>
            </div>

            {losersRounds.length > 0 ? (
              <div className="neon-card overflow-hidden p-5 md:p-8">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-300">
                  <Skull className="h-3.5 w-3.5" /> Bracket Perdants
                </p>
                <div className="mt-4 grid gap-6 overflow-x-auto pb-2 md:grid-flow-col md:auto-cols-[minmax(190px,1fr)]">
                  {losersRounds.map(({ round, matches }) => (
                    <BracketRoundColumn
                      key={`lb-${round}`}
                      label={matches.length === 1 ? "Finale Perdants" : `Tour ${round}`}
                      matches={matches}
                      accent="rose"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {grandFinal ? (
              <div className="neon-card border-amber-400/25 p-5 md:p-8">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                  <Trophy className="h-3.5 w-3.5" /> Grande finale
                </p>
                <div className="mx-auto mt-4 max-w-sm">
                  <BracketMatchCard match={grandFinal} accent="amber" />
                </div>
              </div>
            ) : null}

            {winnersRounds.length === 0 ? (
              <div className="neon-card p-5 md:p-8">
                <p className="neon-text-muted text-sm">Le bracket n’a pas encore démarré.</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </SiteShell>
  );
}
