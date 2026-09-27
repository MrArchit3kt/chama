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
 * Déclare (ou corrige) le vainqueur d'un match. Seuls les matchs du tour
 * le plus récent restent modifiables — une fois le tour suivant généré à
 * partir de ses vainqueurs, revenir en arrière créerait une incohérence.
 */
export async function setMatchWinner(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const matchId = String(formData.get("matchId") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  const winnerName = String(formData.get("winnerName") ?? "").trim();

  if (!matchId || !tournamentId || !winnerName) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  try {
    const match = await db.scoreMatch.findUnique({
      where: { id: matchId },
      select: { tournamentId: true, bracketType: true, round: true, teamAName: true, teamBName: true },
    });

    if (!match || match.tournamentId !== tournamentId) redirect(`${backTo}?error=server`);
    if (winnerName !== match.teamAName && winnerName !== match.teamBName) {
      redirect(`${backTo}?error=validation`);
    }

    // Un tour n'est modifiable que s'il est le plus récent de SON propre
    // bracket (WINNERS et LOSERS avancent indépendamment). La grande
    // finale n'a qu'un seul tour, toujours modifiable.
    const latestRound = await db.scoreMatch.aggregate({
      where: { tournamentId, bracketType: match.bracketType },
      _max: { round: true },
    });

    if (match.round !== latestRound._max.round) {
      redirect(`${backTo}?error=locked`);
    }

    await db.scoreMatch.update({ where: { id: matchId }, data: { winnerName } });

    await logActivity({
      action: "SCORE_MATCH_WINNER_SET",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `${match.teamAName} vs ${match.teamBName} → ${winnerName}`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("SET_MATCH_WINNER_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
