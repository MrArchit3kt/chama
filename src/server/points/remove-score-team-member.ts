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

export async function removeScoreTeamMember(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();

  const backTo = `/admin/points/${gameModeId}?board=${boardId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}&error=forbidden`);
  }

  if (!gameModeId || !boardId || !memberId) {
    redirect(`${backTo}&error=validation`);
  }

  try {
    const member = await db.scoreTeamMember.findUnique({
      where: { id: memberId },
      select: {
        guestName: true,
        user: { select: { displayName: true } },
        team: { select: { board: { select: { gameModeId: true, id: true } } } },
      },
    });

    if (!member || member.team.board.gameModeId !== gameModeId || member.team.board.id !== boardId) {
      redirect(`${backTo}&error=server`);
    }

    // onDelete: Cascade sur ScoreEntry => ses scores individuels disparaissent
    // avec lui (les conditions d'équipe restent inchangées).
    await db.scoreTeamMember.delete({ where: { id: memberId } });

    await logActivity({
      action: "SCORE_TEAM_MEMBER_REMOVED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: member.user?.displayName ?? member.guestName ?? "Invité",
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REMOVE_SCORE_TEAM_MEMBER_ERROR", error);
    redirect(`${backTo}&error=server`);
  }

  redirect(`${backTo}&success=1`);
}
