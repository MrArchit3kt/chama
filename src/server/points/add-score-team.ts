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

export async function addScoreTeam(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  const backTo = `/admin/points/${gameModeId}?board=${boardId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}&error=forbidden`);
  }

  if (!gameModeId || !boardId || !name) {
    redirect(`${backTo}&error=validation`);
  }

  try {
    const board = await db.scoreBoard.findUnique({
      where: { id: boardId },
      select: { id: true, gameModeId: true },
    });

    if (!board || board.gameModeId !== gameModeId) {
      redirect(`${backTo}&error=server`);
    }

    await db.scoreTeam.create({
      data: { boardId, name },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADD_SCORE_TEAM_ERROR", error);
    redirect(`${backTo}&error=server`);
  }

  redirect(`${backTo}&team_added=1`);
}
