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

export async function createBoard(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  if (!gameModeId) redirect("/admin/points?error=validation");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`/admin/points/${gameModeId}?error=forbidden`);
  }

  const title = String(formData.get("title") ?? "").trim();

  try {
    const gameMode = await db.scoreGameMode.findUnique({
      where: { id: gameModeId },
      select: { id: true, name: true },
    });

    if (!gameMode) redirect("/admin/points?error=server");

    const board = await db.scoreBoard.create({
      data: {
        gameModeId: gameMode.id,
        title: title || null,
        createdById: admin.id,
      },
    });

    await logActivity({
      action: "SCORE_BOARD_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: title ? `${gameMode.name} — ${title}` : gameMode.name,
    });

    redirect(`/admin/points/${gameModeId}?board=${board.id}&success=1`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_BOARD_ERROR", error);
    redirect(`/admin/points/${gameModeId}?error=server`);
  }
}
