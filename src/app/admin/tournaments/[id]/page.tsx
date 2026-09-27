export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createBoard } from "@/server/points/create-board";
import { deleteTournament } from "@/server/points/delete-tournament";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { computeEntryPoints } from "@/lib/scoring";
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
    case "mode_not_in_tournament":
      return "Ce mode de jeu ne fait pas partie de ce tournoi.";
    case "mode_already_used":
      return "Ce tournoi a déjà une partie pour ce mode de jeu.";
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

export default async function AdminTournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const canManage = hasAdminPermission(admin.role, admin.adminPermissions, "points.board");

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";

  const tournament = await db.scoreTournament.findUnique({
    where: { id },
    include: {
      gameModes: { orderBy: { createdAt: "asc" } },
      boards: {
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

  if (!tournament) redirect("/admin/tournaments?error=server");

  const standings = computeTournamentStandings(tournament.boards);
  const duplicateWarnings = findLikelyDuplicateTeamNames(standings);
  const returnTo = `/admin/tournaments/${tournament.id}`;

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

          <div className="mt-4 flex flex-wrap gap-2">
            {tournament.boards.length > 0 ? (
              <a
                href={`/admin/tournaments/export?id=${tournament.id}`}
                className="neon-button-secondary px-4 py-2 text-sm"
              >
                Exporter CSV
              </a>
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
                      <input type="hidden" name="returnTo" value={returnTo} />
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

            const teamTotals = board.teams
              .map((team) => ({
                name: team.name,
                total:
                  team.entries.reduce((sum, e) => sum + computeEntryPoints(e.quantity, e.condition), 0) +
                  team.members.reduce(
                    (sum, m) =>
                      sum + m.entries.reduce((s, e) => s + computeEntryPoints(e.quantity, e.condition), 0),
                    0,
                  ),
              }))
              .sort((a, b) => b.total - a.total);

            return (
              <div key={mode.id} className="neon-card p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white md:text-xl">{mode.name}</h3>
                    <p className="neon-text-muted mt-1 text-xs">
                      {board.title || `Partie du ${formatDate(board.createdAt)}`}
                    </p>
                  </div>
                  <Link
                    href={`/admin/points/${mode.id}?board=${board.id}`}
                    className="neon-button px-4 py-2 text-sm"
                  >
                    Gérer cette partie
                  </Link>
                </div>

                {teamTotals.length === 0 ? (
                  <p className="neon-text-muted mt-3 text-sm">
                    Aucune équipe pour l’instant sur cette partie.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-1.5">
                    {teamTotals.map((t) => (
                      <div
                        key={t.name}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-sm"
                      >
                        <span className="truncate text-white/85">{t.name}</span>
                        <span className="neon-badge shrink-0 text-[10px]">
                          {t.total} pt{Math.abs(t.total) > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
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
      </div>
    </SiteShell>
  );
}
