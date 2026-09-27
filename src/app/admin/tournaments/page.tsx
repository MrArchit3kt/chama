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

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Tu n’as pas les droits pour effectuer cette action.";
    case "validation":
      return "Formulaire invalide. Vérifie les champs.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
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

  const tournaments = await db.scoreTournament.findMany({
    orderBy: { createdAt: "desc" },
    include: {
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
            Regroupe plusieurs tableaux (même mode de jeu ou modes
            différents, ex : 3 parties dans une soirée) pour cumuler les
            points par équipe et désigner un vainqueur final. Rattache un
            tableau à un tournoi depuis la page « Nouveau tableau » d’un
            mode de jeu, en choisissant le tournoi dans la liste déroulante
            — les équipes sont reconnues d’une partie à l’autre par leur
            nom, donc garde le même nom d’équipe sur chaque tableau.
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
                      <h3 className="text-lg font-bold text-white md:text-xl">{tournament.name}</h3>
                      {tournament.description ? (
                        <p className="neon-text-muted mt-1.5 max-w-2xl text-sm leading-6">
                          {tournament.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {tournament.boards.length > 0 ? (
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

                  {duplicateWarnings.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
                      <p className="text-xs font-semibold text-amber-300">
                        ⚠️ Noms d’équipe qui se ressemblent — vérifie qu’il ne s’agit pas d’une
                        faute de frappe (les points ne se cumulent que si le nom est identique
                        d’une partie à l’autre) :
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
                      Parties liées ({tournament.boards.length})
                    </p>

                    {tournament.boards.length === 0 ? (
                      <p className="neon-text-muted mt-2 text-sm">
                        Aucune partie liée. Depuis la page d’un mode de jeu, crée un tableau et
                        sélectionne ce tournoi.
                      </p>
                    ) : (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {tournament.boards.map((board) => (
                          <Link
                            key={board.id}
                            href={`/admin/points/${board.gameMode.id}?board=${board.id}`}
                            className="neon-badge text-[11px] hover:border-cyan-400/40"
                          >
                            {board.gameMode.name}
                            {board.title ? ` — ${board.title}` : ` (${formatDate(board.createdAt)})`}
                          </Link>
                        ))}
                      </div>
                    )}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
