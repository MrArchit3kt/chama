"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
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

export async function addScoreTeamMember(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const guestName = String(formData.get("guestName") ?? "").trim();

  const backTo = `/admin/points/${gameModeId}?board=${boardId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}&error=forbidden`);
  }

  if (!gameModeId || !boardId || !teamId || (!userId && !guestName)) {
    redirect(`${backTo}&error=validation`);
  }

  try {
    const team = await db.scoreTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        board: { select: { gameModeId: true } },
        members: { select: { userId: true } },
      },
    });

    if (!team || team.board.gameModeId !== gameModeId) {
      redirect(`${backTo}&error=server`);
    }

    if (userId) {
      if (team.members.some((m) => m.userId === userId)) {
        redirect(`${backTo}&error=already_in_team`);
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, registrationStatus: true },
      });

      if (!user || user.status !== "ACTIVE" || user.registrationStatus !== "APPROVED") {
        redirect(`${backTo}&error=server`);
      }

      await db.scoreTeamMember.create({
        data: { teamId, userId },
      });
    } else {
      await db.scoreTeamMember.create({
        data: { teamId, guestName },
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADD_SCORE_TEAM_MEMBER_ERROR", error);
    redirect(`${backTo}&error=server`);
  }

  redirect(`${backTo}&member_added=1`);
}
