"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { provisionBoardTeams } from "@/lib/tournament-team-sync";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Crée une partie (tableau) pour un mode de jeu donné, toujours rattachée à
 * un tournoi — il n'existe plus de partie indépendante : même une session
 * ponctuelle passe par un tournoi (avec un seul mode sélectionné). Appelée
 * exclusivement depuis /admin/tournaments/[id].
 */
export async function createBoard(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();

  if (!gameModeId || !tournamentId) redirect("/admin/tournaments?error=validation");

  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  const title = String(formData.get("title") ?? "").trim();

  try {
    const [gameMode, tournament] = await Promise.all([
      db.scoreGameMode.findUnique({ where: { id: gameModeId }, select: { id: true, name: true } }),
      db.scoreTournament.findUnique({
        where: { id: tournamentId },
        select: {
          name: true,
          gameModes: { select: { id: true } },
          boards: { where: { gameModeId }, select: { id: true } },
        },
      }),
    ]);

    if (!gameMode || !tournament) redirect(`${backTo}?error=server`);
    if (!tournament.gameModes.some((m) => m.id === gameModeId)) {
      redirect(`${backTo}?error=mode_not_in_tournament`);
    }
    if (tournament.boards.length > 0) {
      redirect(`${backTo}?error=mode_already_used`);
    }

    const board = await db.scoreBoard.create({
      data: {
        gameModeId: gameMode.id,
        title: title || null,
        createdById: admin.id,
        tournamentId,
      },
    });

    await provisionBoardTeams(board.id, tournamentId);

    await logActivity({
      action: "SCORE_BOARD_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: title ? `${gameMode.name} — ${title}` : gameMode.name,
      metadata: { tournament: tournament.name },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_BOARD_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
