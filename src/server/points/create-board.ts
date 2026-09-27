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

/** Cible de retour après création — whitelist un préfixe interne pour
 * éviter tout risque d'open redirect via un champ de formulaire. */
function safeReturnTo(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith("/admin/")) return raw;
  return fallback;
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
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  const returnTo = safeReturnTo(
    formData.get("returnTo") ? String(formData.get("returnTo")) : null,
    `/admin/points/${gameModeId}`,
  );

  try {
    const gameMode = await db.scoreGameMode.findUnique({
      where: { id: gameModeId },
      select: { id: true, name: true },
    });

    if (!gameMode) redirect("/admin/points?error=server");

    let tournamentName: string | null = null;
    if (tournamentId) {
      const tournament = await db.scoreTournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          name: true,
          gameModes: { select: { id: true } },
          boards: { where: { gameModeId }, select: { id: true } },
        },
      });

      if (!tournament) redirect(`${returnTo}?error=server`);
      if (!tournament.gameModes.some((m) => m.id === gameModeId)) {
        redirect(`${returnTo}?error=mode_not_in_tournament`);
      }
      if (tournament.boards.length > 0) {
        redirect(`${returnTo}?error=mode_already_used`);
      }

      tournamentName = tournament.name;
    }

    const board = await db.scoreBoard.create({
      data: {
        gameModeId: gameMode.id,
        title: title || null,
        createdById: admin.id,
        tournamentId: tournamentId || null,
      },
    });

    await logActivity({
      action: "SCORE_BOARD_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: title ? `${gameMode.name} — ${title}` : gameMode.name,
      metadata: tournamentName ? { tournament: tournamentName } : undefined,
    });

    if (returnTo.startsWith("/admin/tournaments/")) {
      redirect(`${returnTo}?success=1`);
    }
    redirect(`/admin/points/${gameModeId}?board=${board.id}&success=1`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_BOARD_ERROR", error);
    redirect(`${returnTo}?error=server`);
  }
}
