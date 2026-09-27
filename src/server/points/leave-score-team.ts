"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Quitte l'équipe du joueur pour ce tournoi, sur toutes les parties déjà
 * créées — tant que le tournoi n'a pas démarré. */
export async function leaveScoreTeam(formData: FormData) {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!tournamentId) redirect("/points?error=validation");

  try {
    const tournament = await db.scoreTournament.findUnique({
      where: { id: tournamentId },
      select: { teamMode: true, startedAt: true },
    });

    if (!tournament || tournament.teamMode !== "SELF_JOIN") {
      redirect("/points?error=forbidden");
    }
    if (tournament.startedAt) redirect("/points?error=locked");

    await db.scoreTeamMember.deleteMany({
      where: { userId: user.id, team: { board: { tournamentId } } },
    });

    await logActivity({
      action: "SCORE_TEAM_LEFT",
      actorId: user.id,
      actorLabel: `${user.name} (@${user.username})`,
      targetLabel: `Tournoi ${tournamentId.slice(-6).toUpperCase()}`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("LEAVE_SCORE_TEAM_ERROR", error);
    redirect("/points?error=server");
  }

  redirect("/points?left=1");
}
