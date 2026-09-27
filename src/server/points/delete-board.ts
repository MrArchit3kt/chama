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

export async function deleteBoard(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`/admin/points/${gameModeId}?error=forbidden`);
  }

  if (!gameModeId || !boardId) {
    redirect("/admin/points?error=validation");
  }

  try {
    const board = await db.scoreBoard.findUnique({
      where: { id: boardId },
      select: { gameModeId: true, title: true, createdAt: true, gameMode: { select: { name: true } } },
    });

    if (!board || board.gameModeId !== gameModeId) {
      redirect(`/admin/points/${gameModeId}?error=server`);
    }

    // onDelete: Cascade sur ScoreTeam/ScoreTeamMember/ScoreEntry => tout
    // ce qui a été saisi sur ce tableau disparaît avec lui (voulu : un
    // tableau supprimé, c'est une partie qui ne doit plus compter).
    await db.scoreBoard.delete({ where: { id: boardId } });

    await logActivity({
      action: "SCORE_BOARD_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: board.title ? `${board.gameMode.name} — ${board.title}` : board.gameMode.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_BOARD_ERROR", error);
    redirect(`/admin/points/${gameModeId}?error=server`);
  }

  redirect(`/admin/points/${gameModeId}?success=1`);
}
