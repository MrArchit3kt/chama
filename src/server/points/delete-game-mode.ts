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
 * Supprime un mode de jeu — uniquement s'il n'a jamais été utilisé (aucune
 * partie jouée, aucun tournoi ne le référence). Un mode déjà utilisé ne
 * peut pas être supprimé : le supprimer effacerait en cascade toutes les
 * parties/scores déjà saisis avec lui, potentiellement sur plusieurs
 * tournois passés. « Désactiver » reste le bon outil pour arrêter de
 * l'utiliser sans perdre l'historique.
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

    if (gameMode._count.boards > 0 || gameMode._count.tournaments > 0) {
      redirect("/admin/points?error=mode_in_use");
    }

    // onDelete: Cascade sur ScoreCondition (et donc ScoreConditionTier) —
    // sans risque ici puisqu'un mode jamais utilisé n'a par définition
    // aucune ScoreEntry liée à ses conditions.
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
