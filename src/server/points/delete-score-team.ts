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

export async function deleteScoreTeam(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();

  const backTo = `/admin/points/${gameModeId}?board=${boardId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}&error=forbidden`);
  }

  if (!gameModeId || !boardId || !teamId) {
    redirect(`${backTo}&error=validation`);
  }

  try {
    const team = await db.scoreTeam.findUnique({
      where: { id: teamId },
      select: { name: true, board: { select: { gameModeId: true, id: true } } },
    });

    if (!team || team.board.gameModeId !== gameModeId || team.board.id !== boardId) {
      redirect(`${backTo}&error=server`);
    }

    // onDelete: Cascade sur ScoreTeamMember/ScoreEntry => les scores de
    // cette équipe disparaissent avec elle.
    await db.scoreTeam.delete({ where: { id: teamId } });

    await logActivity({
      action: "SCORE_TEAM_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: team.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_SCORE_TEAM_ERROR", error);
    redirect(`${backTo}&error=server`);
  }

  redirect(`${backTo}&success=1`);
}
