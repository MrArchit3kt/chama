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

/** "Modifier les scores" : déverrouille une partie déjà terminée pour
 * corriger un score ou une composition d'équipe. */
export async function reopenBoard(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const boardId = String(formData.get("boardId") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!boardId || !tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  try {
    const board = await db.scoreBoard.findUnique({
      where: { id: boardId },
      select: {
        tournamentId: true,
        title: true,
        gameMode: { select: { name: true } },
      },
    });

    if (!board || board.tournamentId !== tournamentId) redirect(`${backTo}?error=server`);

    await db.scoreBoard.update({ where: { id: boardId }, data: { finishedAt: null } });

    await logActivity({
      action: "SCORE_BOARD_REOPENED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: board.title ? `${board.gameMode.name} — ${board.title}` : board.gameMode.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REOPEN_BOARD_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
