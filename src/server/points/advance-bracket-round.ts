"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { generateNextRound } from "@/lib/bracket";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Génère le tour suivant à partir des vainqueurs du tour le plus récent —
 * seulement si celui-ci est entièrement décidé et compte plus d'un match
 * (sinon il n'y a rien à faire : un seul match décidé = le tournoi a son
 * champion). */
export async function advanceBracketRound(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  try {
    const latest = await db.scoreMatch.aggregate({ where: { tournamentId }, _max: { round: true } });
    const currentRound = latest._max.round;
    if (!currentRound) redirect(`${backTo}?error=no_board`);

    const matches = await db.scoreMatch.findMany({
      where: { tournamentId, round: currentRound },
      orderBy: { position: "asc" },
      select: { position: true, winnerName: true },
    });

    if (matches.length <= 1) redirect(`${backTo}?error=validation`);
    if (matches.some((m) => !m.winnerName)) redirect(`${backTo}?error=validation`);

    const nextRoundMatches = generateNextRound(matches, currentRound + 1);

    await db.scoreMatch.createMany({
      data: nextRoundMatches.map((m) => ({
        tournamentId,
        round: m.round,
        position: m.position,
        teamAName: m.teamAName,
        teamBName: m.teamBName,
        winnerName: m.winnerName,
      })),
    });

    await logActivity({
      action: "SCORE_BRACKET_ROUND_ADVANCED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `Tournoi ${tournamentId.slice(-6).toUpperCase()} — tour ${currentRound + 1}`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADVANCE_BRACKET_ROUND_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
