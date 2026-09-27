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

/**
 * Supprime un mode de jeu, avec tout ce qui en dépend en cascade (parties,
 * scores, conditions/paliers). Comme pour la suppression d'un tournoi ou
 * d'une partie ailleurs dans l'admin, on ne bloque pas sur "déjà utilisé" —
 * l'admin est prévenu par l'intitulé du bouton et reste libre de préférer
 * « Désactiver » pour arrêter d'utiliser un mode sans perdre l'historique.
 */
export async function deleteGameMode(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/points?error=validation");

  try {
    const gameMode = await db.scoreGameMode.findUnique({
      where: { id },
      select: {
        name: true,
        _count: { select: { boards: true, tournaments: true } },
      },
    });

    if (!gameMode) redirect("/admin/points?error=server");

    // onDelete: Cascade sur ScoreCondition/ScoreBoard (et donc leurs
    // ScoreConditionTier/ScoreTeam/ScoreEntry) — supprime tout l'historique
    // de ce mode. Les tournois qui le référencent (relation m:n) sont
    // simplement détachés, jamais supprimés.
    await db.scoreGameMode.delete({ where: { id } });

    await logActivity({
      action: "SCORE_GAME_MODE_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: gameMode.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_GAME_MODE_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?deleted=1");
}
