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

/** Ajoute une ou plusieurs équipes (un nom par ligne) à un tournoi en
 * format BRACKET, tant qu'il n'a pas démarré (bracket pas encore généré). */
export async function addBracketTeam(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  const names = [
    ...new Set(
      String(formData.get("names") ?? "")
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];

  if (names.length === 0) redirect(`${backTo}?error=validation`);

  try {
    const tournament = await db.scoreTournament.findUnique({
      where: { id: tournamentId },
      select: { format: true, startedAt: true },
    });

    if (!tournament || tournament.format !== "BRACKET") redirect(`${backTo}?error=forbidden`);
    if (tournament.startedAt) redirect(`${backTo}?error=locked`);

    for (const name of names) {
      await db.scoreBracketTeam.upsert({
        where: { tournamentId_name: { tournamentId, name } },
        update: {},
        create: { tournamentId, name },
      });
    }

    await logActivity({
      action: "SCORE_BRACKET_TEAM_ADDED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `Tournoi ${tournamentId.slice(-6).toUpperCase()}`,
      metadata: { names },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADD_BRACKET_TEAM_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
