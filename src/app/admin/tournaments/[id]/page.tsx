export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createBoard } from "@/server/points/create-board";
import { deleteBoard } from "@/server/points/delete-board";
import { addScoreTeam } from "@/server/points/add-score-team";
import { deleteScoreTeam } from "@/server/points/delete-score-team";
import { addScoreTeamMember } from "@/server/points/add-score-team-member";
import { removeScoreTeamMember } from "@/server/points/remove-score-team-member";
import { saveScoreEntries } from "@/server/points/save-score-entries";
import { deleteTournament } from "@/server/points/delete-tournament";
import { startTournament } from "@/server/points/start-tournament";
import { generateRandomTeams } from "@/server/points/generate-random-teams";
import { addBracketTeam } from "@/server/points/add-bracket-team";
import { removeBracketTeam } from "@/server/points/remove-bracket-team";
import { setMatchWinner } from "@/server/points/set-match-winner";
import { advanceBracketRound } from "@/server/points/advance-bracket-round";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { computeEntryPoints, type ConditionForScoring } from "@/lib/scoring";
import {
  computeTournamentStandings,
  findLikelyDuplicateTeamNames,
} from "@/lib/tournament-standings";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Tu n’as pas les droits pour effectuer cette action.";
    case "validation":
      return "Formulaire invalide. Vérifie les champs.";
    case "already_in_team":
      return "Ce joueur est déjà dans cette équipe.";
    case "mode_not_in_tournament":
      return "Ce mode de jeu ne fait pas partie de ce tournoi.";
    case "mode_already_used":
      return "Ce tournoi a déjà une partie pour ce mode de jeu.";
    case "no_board":
      return "Crée d’abord une partie (pour n’importe quel mode) avant de tirer les équipes au sort.";
    case "pool_too_large":
      return "Trop de joueurs sélectionnés pour la capacité configurée (nombre d’équipes × joueurs max).";
    case "locked":
      return "Le tournoi a démarré, la composition des équipes est verrouillée.";
    case "not_enough_teams":
      return "Il faut au moins 2 équipes pour démarrer un bracket.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

function teamModeLabel(mode: string) {
  if (mode === "SELF_JOIN") return "Libre choix";
  if (mode === "RANDOM") return "Aléatoire";
  return "Manuel";
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

function formatTierRange(tier: { minValue: number; maxValue: number | null }) {
  return tier.maxValue === null ? `${tier.minValue}+` : `${tier.minValue}–${tier.maxValue}`;
}

/** Petit indice à côté du label de la condition dans le formulaire de
 * saisie : points fixes pour QUANTITY/ONE_TIME, liste des paliers pour
 * TIERED. */
function conditionHint(
  condition: ConditionForScoring & { tiers: { minValue: number; maxValue: number | null; points: number }[] },
) {
  if (condition.mode !== "TIERED") {
    return `${condition.points} pt${Math.abs(condition.points) > 1 ? "s" : ""}`;
  }
  if (condition.tiers.length === 0) return "aucun palier";
  return condition.tiers
    .map((t) => `${formatTierRange(t)}:${t.points > 0 ? "+" : ""}${t.points}`)
    .join(" · ");
}

const conditionForScoringSelect = {
  points: true,
  mode: true,
  tiers: { select: { minValue: true, maxValue: true, points: true } },
} as const;

type EntryWithCondition = {
  quantity: number;
  conditionId: string;
  condition: ConditionForScoring;
};

function sumEntries(entries: EntryWithCondition[]) {
  return entries.reduce((sum, e) => sum + computeEntryPoints(e.quantity, e.condition), 0);
}

function findEntry(entries: EntryWithCondition[], conditionId: string) {
  return entries.find((e) => e.conditionId === conditionId);
}

export default async function AdminTournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    team_added?: string;
    member_added?: string;
  }>;
}) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const canManage = hasAdminPermission(admin.role, admin.adminPermissions, "points.board");

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isTeamAdded = sp.team_added === "1";
  const isMemberAdded = sp.member_added === "1";

  const tournament = await db.scoreTournament.findUnique({
    where: { id },
    include: {
      gameModes: {
        orderBy: { createdAt: "asc" },
        include: { conditions: { orderBy: { createdAt: "asc" }, include: { tiers: true } } },
      },
      boards: {
        include: {
          gameMode: { select: { id: true, name: true } },
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
      bracketTeams: { orderBy: { createdAt: "asc" } },
      matches: { orderBy: [{ round: "asc" }, { position: "asc" }] },
    },
  });

  if (!tournament) redirect("/admin/tournaments?error=server");

  const standings = computeTournamentStandings(tournament.boards);
  const duplicateWarnings = findLikelyDuplicateTeamNames(standings);

  const eligibleUsers = await db.user.findMany({
    where: { status: "ACTIVE", registrationStatus: "APPROVED" },
    select: { id: true, displayName: true, username: true },
    orderBy: { displayName: "asc" },
  });

  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort((a, b) => a - b);
  const latestRound = rounds[rounds.length - 1];
  const latestRoundMatches = tournament.matches.filter((m) => m.round === latestRound);
  const isChampionDecided = latestRoundMatches.length === 1 && Boolean(latestRoundMatches[0]?.winnerName);
  const champion = isChampionDecided ? latestRoundMatches[0].winnerName : null;
  const canAdvanceRound =
    latestRoundMatches.length > 1 && latestRoundMatches.every((m) => Boolean(m.winnerName));

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            <Link href="/admin/tournaments" className="hover:text-white">
              Admin Tournois
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
            {tournament.format === "CLASSIC" ? (
              <>
                <span className="neon-badge text-[10px]">{teamModeLabel(tournament.teamMode)}</span>
                {tournament.teamCount ? (
                  <span className="neon-badge text-[10px]">{tournament.teamCount} équipes</span>
                ) : null}
                {tournament.maxMembersPerTeam ? (
                  <span className="neon-badge text-[10px]">
                    Max {tournament.maxMembersPerTeam} joueur{tournament.maxMembersPerTeam > 1 ? "s" : ""}/équipe
                  </span>
                ) : null}
              </>
            ) : (
              <span className="neon-badge text-[10px]">
                {tournament.bracketTeams.length} équipe{tournament.bracketTeams.length > 1 ? "s" : ""}
              </span>
            )}
            {tournament.startedAt ? (
              <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                Démarré le {formatDate(tournament.startedAt)}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                Composition ouverte
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canManage && !tournament.startedAt ? (
              <form action={startTournament}>
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <button type="submit" className="neon-button px-4 py-2 text-sm">
                  Démarrer le tournoi
                </button>
              </form>
            ) : null}
            {canManage ? (
              <form action={deleteTournament}>
                <input type="hidden" name="id" value={tournament.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-rose-400/20 px-4 py-2 text-sm font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                >
                  Supprimer le tournoi
                </button>
              </form>
            ) : null}
          </div>

          {canManage && !tournament.startedAt && tournament.format === "CLASSIC" && tournament.teamMode !== "MANUAL" ? (
            <p className="neon-text-muted mt-3 text-xs">
              « Démarrer le tournoi » verrouille la composition des équipes (plus de
              changement d’équipe par les joueurs, plus de nouveau tirage au sort). Fais-le
              une fois les équipes définitives.
            </p>
          ) : null}
          {canManage && !tournament.startedAt && tournament.format === "BRACKET" ? (
            <p className="neon-text-muted mt-3 text-xs">
              « Démarrer le tournoi » génère le 1er tour à partir des équipes déclarées
              ci-dessous et verrouille la liste (plus d’ajout/retrait d’équipe ensuite).
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">Enregistré avec succès.</p>
          </div>
        ) : null}

        {isTeamAdded ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">Équipe ajoutée avec succès.</p>
          </div>
        ) : null}

        {isMemberAdded ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">Joueur ajouté à l’équipe.</p>
          </div>
        ) : null}

        {tournament.format === "CLASSIC" && tournament.teamMode === "SELF_JOIN" && !tournament.startedAt ? (
          <div className="neon-card p-5 md:p-8">
            <p className="text-sm font-medium text-cyan-300">
              Mode « Libre choix » : les joueurs choisissent eux-mêmes leur équipe depuis la
              page <Link href="/points" className="underline hover:text-white">Points</Link>,
              une fois qu’au moins une partie a été créée ci-dessous.
            </p>
          </div>
        ) : null}

        {canManage && tournament.format === "CLASSIC" && tournament.teamMode === "RANDOM" && !tournament.startedAt ? (
          <div className="neon-card p-5 md:p-8">
            <h2 className="text-xl font-bold text-white md:text-2xl">
              Tirage au sort des équipes
            </h2>
            <p className="neon-text-muted mt-2 text-sm leading-6">
              Sélectionne les joueurs (et/ou ajoute des invités) à répartir, puis lance le
              tirage — refaisable tant que le tournoi n’a pas démarré. La composition est
              reprise automatiquement sur les autres parties déjà créées.
            </p>

            <form action={generateRandomTeams} className="mt-4 grid gap-4">
              <input type="hidden" name="tournamentId" value={tournament.id} />

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white/70">
                    Nombre d’équipes
                  </label>
                  <input
                    name="teamCount"
                    type="number"
                    min={2}
                    max={20}
                    required
                    defaultValue={tournament.teamCount ?? undefined}
                    className="w-full px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white/70">
                    Joueurs max par équipe (optionnel)
                  </label>
                  <input
                    name="maxMembersPerTeam"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={tournament.maxMembersPerTeam ?? undefined}
                    className="w-full px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Joueurs inscrits à inclure dans le tirage
                </label>
                {eligibleUsers.length === 0 ? (
                  <p className="neon-text-muted text-sm">Aucun joueur éligible.</p>
                ) : (
                  <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-2xl border border-white/8 bg-white/2 p-3 sm:grid-cols-2 md:grid-cols-3">
                    {eligibleUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm text-white/80">
                        <input type="checkbox" name="userIds" value={u.id} className="h-4 w-4" />
                        {u.displayName} (@{u.username})
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Joueurs invités à inclure (optionnel, un nom par ligne)
                </label>
                <textarea
                  name="guestNames"
                  rows={3}
                  placeholder={"Kevin\nSarah\n..."}
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <button type="submit" className="neon-button px-5 py-2.5">
                  Générer les équipes
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {tournament.format === "CLASSIC" ? (
        <>
        <div className="grid gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Parties du tournoi ({tournament.boards.length}/{tournament.gameModes.length})
          </p>

          {tournament.gameModes.map((mode) => {
            const board = tournament.boards.find((b) => b.gameModeId === mode.id);

            if (!board) {
              return (
                <div key={mode.id} className="neon-card p-5 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-white md:text-xl">{mode.name}</h3>
                    <span className="rounded-full border border-dashed border-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                      Pas encore jouée
                    </span>
                  </div>

                  {canManage ? (
                    <form action={createBoard} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="gameModeId" value={mode.id} />
                      <input type="hidden" name="tournamentId" value={tournament.id} />
                      <input
                        name="title"
                        type="text"
                        placeholder="Titre de la partie (optionnel)"
                        className="w-full px-3 py-2.5 text-sm"
                      />
                      <button type="submit" className="neon-button px-4 py-2.5 text-sm">
                        Créer la partie
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            }

            const teamConditions = mode.conditions.filter((c) => c.appliesTo === "TEAM");
            const playerConditions = mode.conditions.filter((c) => c.appliesTo === "PLAYER");

            return (
              <div key={mode.id} className="neon-card p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white md:text-xl">{mode.name}</h3>
                    <p className="neon-text-muted mt-1 text-xs">
                      {board.title || `Partie du ${formatDate(board.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/admin/tournaments/board-export?board=${board.id}`}
                      className="neon-badge text-[11px] hover:border-cyan-400/40"
                    >
                      Exporter CSV
                    </a>
                    {canManage ? (
                      <form action={deleteBoard}>
                        <input type="hidden" name="gameModeId" value={mode.id} />
                        <input type="hidden" name="boardId" value={board.id} />
                        <input type="hidden" name="tournamentId" value={tournament.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-400/20 px-2.5 py-1 text-[11px] font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                          title="Supprimer cette partie et tous ses scores"
                        >
                          Supprimer cette partie
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                {canManage ? (
                  <form
                    action={addScoreTeam}
                    className="mt-4 grid gap-2.5 border-t border-white/8 pt-4 sm:grid-cols-[1fr_auto]"
                  >
                    <input type="hidden" name="gameModeId" value={mode.id} />
                    <input type="hidden" name="boardId" value={board.id} />
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="Nom de l’équipe"
                      className="w-full px-4 py-2.5 text-sm"
                    />
                    <button type="submit" className="neon-button-secondary px-4 py-2.5 text-sm">
                      Ajouter une équipe
                    </button>
                  </form>
                ) : null}

                {board.teams.length === 0 ? (
                  <p className="neon-text-muted mt-3 text-sm">Aucune équipe sur cette partie pour le moment.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {board.teams.map((team) => {
                      const teamTotal =
                        sumEntries(team.entries) +
                        team.members.reduce((sum, m) => sum + sumEntries(m.entries), 0);

                      return (
                        <div key={team.id} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h4 className="font-bold text-white">{team.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="neon-badge">
                                {teamTotal} pt{Math.abs(teamTotal) > 1 ? "s" : ""}
                              </span>
                              {canManage ? (
                                <form action={deleteScoreTeam}>
                                  <input type="hidden" name="gameModeId" value={mode.id} />
                                  <input type="hidden" name="boardId" value={board.id} />
                                  <input type="hidden" name="teamId" value={team.id} />
                                  <input type="hidden" name="tournamentId" value={tournament.id} />
                                  <button
                                    type="submit"
                                    className="rounded-lg border border-rose-400/20 px-2 py-1 text-[11px] font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                                  >
                                    Supprimer l’équipe
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>

                          {canManage ? (
                            <form action={saveScoreEntries} className="mt-3 grid gap-4">
                              <input type="hidden" name="gameModeId" value={mode.id} />
                              <input type="hidden" name="boardId" value={board.id} />
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="tournamentId" value={tournament.id} />

                              {teamConditions.length > 0 ? (
                                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/4 p-3.5">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/75">
                                    Conditions d’équipe
                                  </p>
                                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                                    {teamConditions.map((condition) => {
                                      const existing = findEntry(team.entries, condition.id);
                                      const fieldName = `team_condition_${condition.id}`;

                                      return (
                                        <label
                                          key={condition.id}
                                          className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-xs text-white/80"
                                        >
                                          <span>
                                            {condition.label}{" "}
                                            <span className="text-white/40">({conditionHint(condition)})</span>
                                          </span>
                                          {condition.mode === "ONE_TIME" ? (
                                            <input
                                              type="checkbox"
                                              name={fieldName}
                                              defaultChecked={Boolean(existing)}
                                              className="h-4 w-4 shrink-0"
                                            />
                                          ) : (
                                            <input
                                              type="number"
                                              name={fieldName}
                                              min={0}
                                              max={999}
                                              defaultValue={existing?.quantity ?? ""}
                                              placeholder="0"
                                              className="w-16 shrink-0 px-2 py-1 text-center text-xs"
                                            />
                                          )}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              {team.members.length > 0 ? (
                                <div className="grid gap-2.5 sm:grid-cols-2">
                                  {team.members.map((member) => {
                                    const memberTotal = sumEntries(member.entries);
                                    const label = memberLabel(member);
                                    const sub = member.user ? `@${member.user.username}` : "Invité";

                                    return (
                                      <div
                                        key={member.id}
                                        className="rounded-2xl border border-white/8 bg-black/20 p-3.5"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-white">{label}</p>
                                            <p className="neon-text-muted truncate text-[11px]">{sub}</p>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-1.5">
                                            <span className="neon-badge text-[10px]">
                                              {memberTotal} pt{Math.abs(memberTotal) > 1 ? "s" : ""}
                                            </span>
                                            {canManage ? (
                                              // formAction : soumet ce même formulaire
                                              // (saveScoreEntries) vers une autre action pour ce
                                              // seul bouton — évite d'imbriquer un <form>.
                                              <button
                                                type="submit"
                                                formAction={removeScoreTeamMember}
                                                name="memberId"
                                                value={member.id}
                                                className="rounded-lg border border-rose-400/20 px-1.5 py-1 text-[10px] font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                                                title="Retirer ce joueur de l’équipe"
                                              >
                                                ✕
                                              </button>
                                            ) : null}
                                          </div>
                                        </div>

                                        {playerConditions.length > 0 ? (
                                          <div className="mt-2.5 grid gap-1.5">
                                            {playerConditions.map((condition) => {
                                              const existing = findEntry(member.entries, condition.id);
                                              const fieldName = `member_condition_${member.id}_${condition.id}`;

                                              return (
                                                <label
                                                  key={condition.id}
                                                  className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-1.5 text-xs text-white/80"
                                                >
                                                  <span>
                                                    {condition.label}{" "}
                                                    <span className="text-white/40">
                                                      ({conditionHint(condition)})
                                                    </span>
                                                  </span>
                                                  {condition.mode === "ONE_TIME" ? (
                                                    <input
                                                      type="checkbox"
                                                      name={fieldName}
                                                      defaultChecked={Boolean(existing)}
                                                      className="h-4 w-4 shrink-0"
                                                    />
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      name={fieldName}
                                                      min={0}
                                                      max={999}
                                                      defaultValue={existing?.quantity ?? ""}
                                                      placeholder="0"
                                                      className="w-16 shrink-0 px-2 py-1 text-center text-xs"
                                                    />
                                                  )}
                                                </label>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              <div>
                                <button type="submit" className="neon-button px-5 py-2.5 text-sm">
                                  Enregistrer les scores
                                </button>
                              </div>
                            </form>
                          ) : null}

                          {canManage ? (
                            <form
                              action={addScoreTeamMember}
                              className="mt-4 grid gap-2.5 border-t border-white/8 pt-4 sm:grid-cols-[1fr_1fr_auto]"
                            >
                              <input type="hidden" name="gameModeId" value={mode.id} />
                              <input type="hidden" name="boardId" value={board.id} />
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="tournamentId" value={tournament.id} />

                              <select name="userId" defaultValue="" className="w-full px-3 py-2.5 text-sm">
                                <option value="">Joueur inscrit (optionnel)</option>
                                {eligibleUsers.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.displayName} (@{u.username})
                                  </option>
                                ))}
                              </select>

                              <input
                                name="guestName"
                                type="text"
                                placeholder="Ou nom d’un joueur invité"
                                className="w-full px-3 py-2.5 text-sm"
                              />

                              <button type="submit" className="neon-button-secondary px-4 py-2.5 text-sm">
                                Ajouter à l’équipe
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/75">
            Classement combiné du tournoi
          </p>

          {duplicateWarnings.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
              <p className="text-xs font-semibold text-amber-300">
                ⚠️ Noms d’équipe qui se ressemblent — vérifie qu’il ne s’agit pas d’une faute de
                frappe (les points ne se cumulent que si le nom est identique d’une partie à
                l’autre) :
              </p>
              <ul className="mt-1.5 text-xs text-amber-200/80">
                {duplicateWarnings.map(([a, b]) => (
                  <li key={`${a}-${b}`}>
                    « {a} » et « {b} »
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {standings.length === 0 ? (
            <p className="neon-text-muted mt-4 text-sm">
              Aucun score enregistré pour ce tournoi pour le moment.
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {standings.map((row, rank) => (
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
        </>
        ) : (
          <>
            {!tournament.startedAt ? (
              <div className="neon-card p-5 md:p-8">
                <h2 className="text-xl font-bold text-white md:text-2xl">Équipes du bracket</h2>
                <p className="neon-text-muted mt-2 text-sm leading-6">
                  Déclare les équipes qui participent — le tirage au sort du 1er tour se fait
                  automatiquement au clic sur « Démarrer le tournoi » ci-dessus.
                </p>

                {canManage ? (
                  <form action={addBracketTeam} className="mt-4 grid gap-2.5">
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <textarea
                      name="names"
                      rows={4}
                      placeholder={"Les Loups\nLes Renards\n..."}
                      className="w-full px-4 py-3"
                    />
                    <div>
                      <button type="submit" className="neon-button px-4 py-2.5 text-sm">
                        Ajouter
                      </button>
                    </div>
                  </form>
                ) : null}

                {tournament.bracketTeams.length === 0 ? (
                  <p className="neon-text-muted mt-4 text-sm">Aucune équipe déclarée pour le moment.</p>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {tournament.bracketTeams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-sm"
                      >
                        <span className="truncate text-white/85">{team.name}</span>
                        {canManage ? (
                          <form action={removeBracketTeam}>
                            <input type="hidden" name="id" value={team.id} />
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <button
                              type="submit"
                              className="shrink-0 rounded-lg border border-rose-400/20 px-1.5 py-1 text-[10px] font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                            >
                              ✕
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="neon-card p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-white md:text-2xl">Bracket</h2>
                  {champion ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-black uppercase tracking-widest text-amber-300">
                      🏆 Champion : {champion}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-5 overflow-x-auto pb-2 md:grid-flow-col md:auto-cols-[minmax(220px,1fr)]">
                  {rounds.map((round) => {
                    const roundMatches = tournament.matches.filter((m) => m.round === round);
                    const isLatest = round === latestRound;

                    return (
                      <div key={round} className="grid gap-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                          {roundMatches.length === 1 ? "Finale" : `Tour ${round}`}
                        </p>

                        {roundMatches.map((match) => {
                          const isBye = !match.teamAName || !match.teamBName;
                          const canDeclare = canManage && isLatest && !isBye && !match.winnerName;

                          return (
                            <div
                              key={match.id}
                              className="rounded-2xl border border-white/8 bg-white/2 p-3"
                            >
                              {[match.teamAName, match.teamBName].map((teamName, i) =>
                                teamName ? (
                                  <div
                                    key={i}
                                    className={
                                      match.winnerName === teamName
                                        ? "flex items-center justify-between gap-2 rounded-lg bg-emerald-400/10 px-2 py-1.5 text-sm font-bold text-emerald-300"
                                        : "flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-white/80"
                                    }
                                  >
                                    <span className="truncate">{teamName}</span>
                                    {canDeclare ? (
                                      <form action={setMatchWinner}>
                                        <input type="hidden" name="matchId" value={match.id} />
                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                        <input type="hidden" name="winnerName" value={teamName} />
                                        <button
                                          type="submit"
                                          className="shrink-0 rounded-lg border border-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300/80 transition hover:border-emerald-400/40 hover:bg-emerald-400/10"
                                        >
                                          Gagne
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div key={i} className="px-2 py-1.5 text-sm text-white/30 italic">
                                    (bye)
                                  </div>
                                ),
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {canManage && canAdvanceRound ? (
                  <form action={advanceBracketRound} className="mt-5">
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <button type="submit" className="neon-button px-5 py-2.5 text-sm">
                      Générer le tour suivant
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </SiteShell>
  );
}
