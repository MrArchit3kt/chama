"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Rattache (ou détache si tournamentId est vide) un tableau existant à un
 * tournoi — utile quand la partie a été créée avant de savoir qu'elle
 * ferait partie d'un tournoi. */
export async function setBoardTournament(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();

  const backTo = `/admin/points/${gameModeId}?board=${boardId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}&error=forbidden`);
  }

  if (!gameModeId || !boardId) {
    redirect("/admin/points?error=validation");
  }

  try {
    const board = await db.scoreBoard.findUnique({
      where: { id: boardId },
      select: { id: true, gameModeId: true },
    });

    if (!board || board.gameModeId !== gameModeId) {
      redirect(`${backTo}&error=server`);
    }

    if (tournamentId) {
      const tournament = await db.scoreTournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          name: true,
          gameModes: { select: { id: true } },
          boards: { where: { gameModeId, id: { not: boardId } }, select: { id: true } },
        },
      });

      if (!tournament) redirect(`${backTo}&error=server`);
      if (!tournament.gameModes.some((m) => m.id === gameModeId)) {
        redirect(`${backTo}&error=mode_not_in_tournament`);
      }
      if (tournament.boards.length > 0) {
        redirect(`${backTo}&error=mode_already_used`);
      }

      await db.scoreBoard.update({ where: { id: boardId }, data: { tournamentId: tournament.id } });

      await logActivity({
        action: "SCORE_BOARD_TOURNAMENT_SET",
        actorId: admin.id,
        actorLabel: `${admin.name} (@${admin.username})`,
        targetLabel: `Tableau ${boardId.slice(-6).toUpperCase()} → ${tournament.name}`,
      });
    } else {
      await db.scoreBoard.update({ where: { id: boardId }, data: { tournamentId: null } });

      await logActivity({
        action: "SCORE_BOARD_TOURNAMENT_SET",
        actorId: admin.id,
        actorLabel: `${admin.name} (@${admin.username})`,
        targetLabel: `Tableau ${boardId.slice(-6).toUpperCase()} détaché`,
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("SET_BOARD_TOURNAMENT_ERROR", error);
    redirect(`${backTo}&error=server`);
  }

  redirect(`${backTo}&success=1`);
}
