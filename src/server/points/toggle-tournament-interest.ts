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

/**
 * Sondage de participation : un joueur indique (ou retire) son intérêt
 * pour un tournoi avant que les équipes ne soient formées — comme la
 * queue des mix Warzone/BO7/... Sert à pré-remplir le pool du tirage au
 * sort côté admin (voir generate-random-teams.ts). Fermé une fois le
 * tournoi démarré.
 */
export async function toggleTournamentInterest(formData: FormData) {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!tournamentId) redirect("/points?error=validation");
  const backTo = `/points/${tournamentId}`;

  try {
    const tournament = await db.scoreTournament.findUnique({
      where: { id: tournamentId },
      select: { startedAt: true, name: true },
    });

    if (!tournament) redirect("/points?error=server");
    if (tournament.startedAt) redirect(`${backTo}?error=locked`);

    const existing = await db.scoreTournamentInterest.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
    });

    if (existing) {
      await db.scoreTournamentInterest.delete({ where: { id: existing.id } });
      await logActivity({
        action: "SCORE_TOURNAMENT_INTEREST_LEFT",
        actorId: user.id,
        actorLabel: `${user.name} (@${user.username})`,
        targetLabel: tournament.name,
      });
    } else {
      await db.scoreTournamentInterest.create({ data: { tournamentId, userId: user.id } });
      await logActivity({
        action: "SCORE_TOURNAMENT_INTEREST_JOINED",
        actorId: user.id,
        actorLabel: `${user.name} (@${user.username})`,
        targetLabel: tournament.name,
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("TOGGLE_TOURNAMENT_INTEREST_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(backTo);
}
