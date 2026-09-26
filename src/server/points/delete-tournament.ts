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

export async function deleteTournament(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect("/admin/tournaments?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/tournaments?error=validation");

  try {
    const tournament = await db.scoreTournament.findUnique({ where: { id }, select: { name: true } });

    // onDelete: SetNull sur ScoreBoard.tournamentId => les tableaux et
    // leurs scores restent intacts, seul le rattachement au tournoi
    // disparaît (un tournoi est un regroupement, pas les données elles-mêmes).
    await db.scoreTournament.delete({ where: { id } });

    await logActivity({
      action: "SCORE_TOURNAMENT_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: tournament?.name ?? id,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_TOURNAMENT_ERROR", error);
    redirect("/admin/tournaments?error=server");
  }

  redirect("/admin/tournaments?deleted=1");
}
