export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createTournament } from "@/server/points/create-tournament";
import { deleteTournament } from "@/server/points/delete-tournament";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { computeTournamentStandings, findLikelyDuplicateTeamNames } from "@/lib/tournament-standings";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Tu n’as pas les droits pour effectuer cette action.";
    case "validation":
      return "Formulaire invalide. Vérifie les champs.";
    case "team_count_required":
      return "Indique un nombre d’équipes (requis pour Organigramme, ou pour Classique en « Libre choix » / « Aléatoire »).";
    case "modes_required":
      return "Choisis au moins un mode de jeu pour un tournoi au format « Classique ».";
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

const conditionForScoringSelect = {
  points: true,
  mode: true,
  tiers: { select: { minValue: true, maxValue: true, points: true } },
} as const;

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; deleted?: string }>;
}) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const canManage = hasAdminPermission(admin.role, admin.adminPermissions, "points.board");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isDeleted = sp.deleted === "1";

  const activeGameModes = await db.scoreGameMode.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const tournaments = await db.scoreTournament.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      gameModes: { select: { id: true, name: true } },
      boards: {
        orderBy: { createdAt: "asc" },
        include: {
          gameMode: { select: { id: true, name: true } },
          teams: {
            include: {
              entries: { include: { condition: { select: conditionForScoringSelect } } },
              members: {
                include: { entries: { include: { condition: { select: conditionForScoringSelect } } } },
              },
            },
          },
        },
      },
      bracketTeams: { select: { id: true } },
      matches: { orderBy: { round: "desc" }, select: { round: true, winnerName: true } },
      _count: { select: { interests: true } },
    },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Admin Tournois
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Tournois multi-parties
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            C’est ici que tout se passe pour lancer une session de jeu —
            même une seule partie ponctuelle sur un seul mode. Choisis le ou
            les modes de jeu concernés (ex : Warzone + BO7 + Rocket League),
            comment les équipes se composent, puis ouvre le tournoi pour
            créer chaque partie, gérer les équipes et saisir les scores.
            Une seule partie par mode ; les équipes sont reconnues d’une
            partie à l’autre par leur nom, donc garde le même nom d’équipe
            sur chaque partie.
          </p>
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

        {isDeleted ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">Tournoi supprimé.</p>
          </div>
        ) : null}

        {canManage ? (
          <div className="neon-card p-5 md:p-8">
            <h2 className="text-xl font-bold text-white md:text-2xl">Créer un tournoi</h2>

            <form action={createTournament} className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Nom</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ex : Tournoi de la rentrée"
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Description (optionnel)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Ex : 3 manches — Warzone, BO7, Rocket League."
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Date prévue (optionnel)
                </label>
                <input name="scheduledAt" type="datetime-local" className="w-full px-4 py-3" />
                <p className="neon-text-muted mt-1.5 text-xs">
                  Affichée aux joueurs sur /points — utile pour le sondage de participation.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Format</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-sm text-white/80">
                    <input
                      type="radio"
                      name="format"
                      value="CLASSIC"
                      defaultChecked
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="font-semibold text-white">Classique</span> — cumul de
                      points sur une partie par mode de jeu, classement final.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-sm text-white/80">
                    <input type="radio" name="format" value="BRACKET" className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="font-semibold text-white">Organigramme</span> — élimination
                      directe, équipe 1 vs équipe 2, etc., le vainqueur avance jusqu’au champion.
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Modes de jeu du tournoi (une partie sera créée pour chacun — requis en format
                  Classique, ignoré en Organigramme)
                </label>
                {activeGameModes.length === 0 ? (
                  <p className="neon-text-muted text-sm">
                    Aucun mode de jeu actif — crée-en un d’abord ci-dessous.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {activeGameModes.map((mode) => (
                      <label
                        key={mode.id}
                        className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-sm text-white/80"
                      >
                        <input type="checkbox" name="gameModeIds" value={mode.id} className="h-4 w-4" />
                        {mode.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Composition des équipes (format Classique uniquement)
                </label>
                <div className="grid gap-2">
                  <label className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-sm text-white/80">
                    <input
                      type="radio"
                      name="teamMode"
                      value="MANUAL"
                      defaultChecked
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="font-semibold text-white">Manuel</span> — tu crées les
                      équipes et ajoutes les joueurs toi-même sur chaque partie (comme avant).
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-sm text-white/80">
                    <input type="radio" name="teamMode" value="SELF_JOIN" className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="font-semibold text-white">Libre choix</span> — les joueurs
                      choisissent eux-mêmes leur équipe depuis la page Points (boutons « Rejoindre
                      Équipe 1 », etc.).
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-sm text-white/80">
                    <input type="radio" name="teamMode" value="RANDOM" className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="font-semibold text-white">Aléatoire</span> — tu choisis un
                      pool de joueurs et le site tire les équipes au sort.
                    </span>
                  </label>
                </div>

                <p className="neon-text-muted mt-3 text-xs leading-5">
                  En format Organigramme, ce choix ne s’applique pas : les équipes ci-dessous
                  (nombre requis) sont créées immédiatement avec un nom par défaut (« Équipe 1 »,
                  « Équipe 2 »...) et prêtes à recevoir des joueurs dès l’ouverture du tournoi.
                </p>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-white/70">
                      Nombre d’équipes (requis pour Organigramme, ou pour Classique en Libre
                      choix/Aléatoire)
                    </label>
                    <input
                      name="teamCount"
                      type="number"
                      min={2}
                      max={20}
                      placeholder="Ex : 4"
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
                      placeholder="Ex : 4"
                      className="w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <button type="submit" className="neon-button px-5 py-2.5">
                  Créer le tournoi
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {tournaments.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">Aucun tournoi créé pour le moment.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tournaments.map((tournament) => {
              const standings = computeTournamentStandings(tournament.boards);
              const duplicateWarnings = findLikelyDuplicateTeamNames(standings);

              return (
                <div key={tournament.id} className="neon-card p-5 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white md:text-xl">{tournament.name}</h3>
                        <span className="neon-badge text-[10px]">{formatLabel(tournament.format)}</span>
                        {tournament.format === "CLASSIC" ? (
                          <span className="neon-badge text-[10px]">{teamModeLabel(tournament.teamMode)}</span>
                        ) : null}
                        {tournament.startedAt ? (
                          <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                            Démarré
                          </span>
                        ) : null}
                        {tournament.scheduledAt ? (
                          <span className="neon-badge text-[10px]">
                            Prévu le {formatDateTime(tournament.scheduledAt)}
                          </span>
                        ) : null}
                        {tournament._count.interests > 0 ? (
                          <span className="neon-badge text-[10px]">
                            🙋 {tournament._count.interests} intéressé
                            {tournament._count.interests > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                      {tournament.description ? (
                        <p className="neon-text-muted mt-1.5 max-w-2xl text-sm leading-6">
                          {tournament.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/tournaments/${tournament.id}`}
                        className="neon-button px-3 py-1.5 text-xs"
                      >
                        Ouvrir le tournoi
                      </Link>
                      {tournament.format === "CLASSIC" && tournament.boards.length > 0 ? (
                        <a
                          href={`/admin/tournaments/export?id=${tournament.id}`}
                          className="neon-button-secondary px-3 py-1.5 text-xs"
                        >
                          Exporter CSV
                        </a>
                      ) : null}
                      {canManage ? (
                        <form action={deleteTournament}>
                          <input type="hidden" name="id" value={tournament.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-rose-400/20 px-3 py-1.5 text-xs font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                          >
                            Supprimer le tournoi
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  {tournament.format === "CLASSIC" ? (
                    <>
                      {duplicateWarnings.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
                          <p className="text-xs font-semibold text-amber-300">
                            ⚠️ Noms d’équipe qui se ressemblent — vérifie qu’il ne s’agit pas
                            d’une faute de frappe (les points ne se cumulent que si le nom est
                            identique d’une partie à l’autre) :
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

                      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                          Parties ({tournament.boards.length}/{tournament.gameModes.length} modes joués)
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {tournament.gameModes.map((mode) => {
                            const board = tournament.boards.find((b) => b.gameModeId === mode.id);

                            return board ? (
                              <Link
                                key={mode.id}
                                href={`/admin/tournaments/${tournament.id}`}
                                className="neon-badge text-[11px] hover:border-cyan-400/40"
                              >
                                {mode.name}
                                {board.title ? ` — ${board.title}` : ` (${formatDate(board.createdAt)})`}
                              </Link>
                            ) : (
                              <span
                                key={mode.id}
                                className="rounded-full border border-dashed border-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/40"
                              >
                                {mode.name} — pas encore jouée
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {standings.length > 0 ? (
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
                                      .map((b) => `${b.gameModeName} : ${b.points > 0 ? "+" : ""}${b.points} pt${Math.abs(b.points) > 1 ? "s" : ""}`)
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
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        {tournament.bracketTeams.length} équipe{tournament.bracketTeams.length > 1 ? "s" : ""}
                      </p>
                      {tournament.matches.length === 0 ? (
                        <p className="neon-text-muted mt-2 text-sm">
                          {tournament.startedAt
                            ? "Bracket démarré sans match généré (erreur ?)."
                            : "Bracket pas encore démarré."}
                        </p>
                      ) : (
                        (() => {
                          const latestRound = tournament.matches[0].round;
                          const latestMatches = tournament.matches.filter((m) => m.round === latestRound);
                          const champion =
                            latestMatches.length === 1 ? latestMatches[0].winnerName : null;

                          return (
                            <p className="neon-text-muted mt-2 text-sm">
                              {champion
                                ? `🏆 Champion : ${champion}`
                                : `Tour ${latestRound} en cours (${latestMatches.filter((m) => m.winnerName).length}/${latestMatches.length} décidés)`}
                            </p>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
