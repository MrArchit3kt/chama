export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createBoard } from "@/server/points/create-board";
import { addScoreTeam } from "@/server/points/add-score-team";
import { addScoreTeamMember } from "@/server/points/add-score-team-member";
import { saveScoreEntries } from "@/server/points/save-score-entries";
import { BoardHistory } from "@/components/points/board-history";
import { hasAdminPermission } from "@/lib/admin-permissions";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Tu n’as pas les droits pour effectuer cette action.";
    case "validation":
      return "Formulaire invalide. Vérifie les champs.";
    case "already_in_team":
      return "Ce joueur est déjà dans cette équipe.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

type EntryWithCondition = {
  quantity: number;
  conditionId: string;
  condition: { points: number };
};

function sumEntries(entries: EntryWithCondition[]) {
  return entries.reduce((sum, e) => sum + e.quantity * e.condition.points, 0);
}

function findEntry(entries: EntryWithCondition[], conditionId: string) {
  return entries.find((e) => e.conditionId === conditionId);
}

export default async function AdminPointsModePage({
  params,
  searchParams,
}: {
  params: Promise<{ modeId: string }>;
  searchParams: Promise<{
    board?: string;
    error?: string;
    success?: string;
    team_added?: string;
    member_added?: string;
  }>;
}) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const { modeId } = await params;
  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isTeamAdded = sp.team_added === "1";
  const isMemberAdded = sp.member_added === "1";

  const canBoard = hasAdminPermission(admin.role, admin.adminPermissions, "points.board");

  const gameMode = await db.scoreGameMode.findUnique({
    where: { id: modeId },
    include: { conditions: { orderBy: { createdAt: "asc" } } },
  });

  if (!gameMode) redirect("/admin/points?error=server");

  const teamConditions = gameMode.conditions.filter((c) => c.appliesTo === "TEAM");
  const playerConditions = gameMode.conditions.filter((c) => c.appliesTo === "PLAYER");

  const boardsInclude = {
    teams: {
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
            entries: { include: { condition: { select: { points: true } } } },
          },
        },
        entries: { include: { condition: { select: { points: true } } } },
      },
    },
  };

  const latestBoard = sp.board
    ? await db.scoreBoard.findUnique({ where: { id: sp.board }, include: boardsInclude })
    : await db.scoreBoard.findFirst({
        where: { gameModeId: modeId },
        orderBy: { createdAt: "desc" },
        include: boardsInclude,
      });

  const pastBoards = await db.scoreBoard.findMany({
    where: { gameModeId: modeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, title: true },
  });

  const eligibleUsers = await db.user.findMany({
    where: { status: "ACTIVE", registrationStatus: "APPROVED" },
    select: { id: true, displayName: true, username: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            <Link href="/admin/points" className="hover:text-white">
              Admin Points
            </Link>
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            {gameMode.name}
          </h1>
          {gameMode.description ? (
            <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:text-base md:leading-7">
              {gameMode.description}
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
            <p className="text-sm font-medium text-emerald-400">Scores enregistrés avec succès.</p>
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

        {canBoard ? (
          <div className="neon-card p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Tableaux
                </p>
                <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">
                  {latestBoard
                    ? latestBoard.title || `Tableau du ${formatDate(latestBoard.createdAt)}`
                    : "Aucun tableau pour le moment"}
                </h2>
              </div>

              <form action={createBoard} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="gameModeId" value={gameMode.id} />
                <input
                  name="title"
                  type="text"
                  placeholder="Titre du tableau (optionnel)"
                  className="w-full px-3 py-2.5 text-sm sm:min-w-[220px]"
                />
                <button type="submit" className="neon-button px-4 py-2.5 text-sm">
                  Nouveau tableau
                </button>
              </form>
            </div>

            <BoardHistory
              boards={pastBoards}
              basePath={`/admin/points/${gameMode.id}`}
              currentBoardId={latestBoard?.id}
            />
          </div>
        ) : null}

        {!latestBoard ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Crée un tableau pour pouvoir ajouter des équipes et saisir des scores.
            </p>
          </div>
        ) : (
          <>
            {canBoard ? (
              <div className="neon-card p-5 md:p-8">
                <h3 className="text-lg font-bold text-white md:text-xl">Ajouter une équipe</h3>
                <form
                  action={addScoreTeam}
                  className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto]"
                >
                  <input type="hidden" name="gameModeId" value={gameMode.id} />
                  <input type="hidden" name="boardId" value={latestBoard.id} />
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Nom de l’équipe"
                    className="w-full px-4 py-2.5 text-sm"
                  />
                  <button type="submit" className="neon-button px-4 py-2.5 text-sm">
                    Ajouter
                  </button>
                </form>
              </div>
            ) : null}

            {latestBoard.teams.length === 0 ? (
              <div className="neon-card p-5 md:p-8">
                <p className="neon-text-muted text-sm">Aucune équipe sur ce tableau pour le moment.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {latestBoard.teams.map((team) => {
                  const teamTotal =
                    sumEntries(team.entries) +
                    team.members.reduce((sum, m) => sum + sumEntries(m.entries), 0);

                  return (
                    <div key={team.id} className="neon-card p-5 md:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-lg font-bold text-white md:text-xl">{team.name}</h4>
                        <span className="neon-badge">
                          {teamTotal} pt{teamTotal > 1 ? "s" : ""}
                        </span>
                      </div>

                      {canBoard ? (
                        <form action={saveScoreEntries} className="mt-4 grid gap-4">
                          <input type="hidden" name="gameModeId" value={gameMode.id} />
                          <input type="hidden" name="boardId" value={latestBoard.id} />
                          <input type="hidden" name="teamId" value={team.id} />

                          {teamConditions.length > 0 ? (
                            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/4 p-3.5 md:p-4">
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
                                        <span className="text-white/40">({condition.points} pt{condition.points > 1 ? "s" : ""})</span>
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
                                const label = member.user
                                  ? member.user.displayName
                                  : member.guestName ?? "Invité";
                                const sub = member.user ? `@${member.user.username}` : "Invité";

                                return (
                                  <div
                                    key={member.id}
                                    className="rounded-2xl border border-white/8 bg-white/2 p-3.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-white">{label}</p>
                                        <p className="neon-text-muted truncate text-[11px]">{sub}</p>
                                      </div>
                                      <span className="neon-badge shrink-0 text-[10px]">
                                        {memberTotal} pt{memberTotal > 1 ? "s" : ""}
                                      </span>
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
                                                  ({condition.points} pt{condition.points > 1 ? "s" : ""})
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

                      {canBoard ? (
                        <form
                          action={addScoreTeamMember}
                          className="mt-4 grid gap-2.5 border-t border-white/8 pt-4 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <input type="hidden" name="gameModeId" value={gameMode.id} />
                          <input type="hidden" name="boardId" value={latestBoard.id} />
                          <input type="hidden" name="teamId" value={team.id} />

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
          </>
        )}
      </div>
    </SiteShell>
  );
}
