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

/** Verrouille la composition des équipes : plus de rejoindre/quitter
 * (SELF_JOIN) ni de nouveau tirage au sort (RANDOM). L'admin garde la main
 * via les outils d'ajout/retrait manuel déjà existants. */
export async function startTournament(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  if (!tournamentId) redirect("/admin/tournaments?error=validation");

  try {
    const tournament = await db.scoreTournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, startedAt: true },
    });

    if (!tournament) redirect("/admin/tournaments?error=server");
    if (!tournament.startedAt) {
      await db.scoreTournament.update({ where: { id: tournamentId }, data: { startedAt: new Date() } });

      await logActivity({
        action: "SCORE_TOURNAMENT_STARTED",
        actorId: admin.id,
        actorLabel: `${admin.name} (@${admin.username})`,
        targetLabel: tournament.name,
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("START_TOURNAMENT_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
