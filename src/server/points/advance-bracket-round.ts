"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { pairTeams } from "@/lib/bracket";

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
 * Fait avancer le bracket à double élimination d'un cran :
 * - Génère le tour suivant du bracket WINNERS à partir de ses vainqueurs
 *   (ordre préservé), s'il n'est pas encore terminé.
 * - Récupère tous les perdants WINNERS pas encore "descendus" en LOSERS
 *   (`lbSeeded = false`, sur n'importe quel tour — robuste à plusieurs
 *   appels successifs) et les mélange avec les vainqueurs du tour LOSERS
 *   en cours pour former le tour LOSERS suivant.
 * - Quand les deux brackets n'ont plus qu'un champion chacun et qu'il n'y
 *   a plus de perdant à descendre, génère la grande finale (vainqueur
 *   WINNERS vs vainqueur LOSERS). Pas de "bracket reset" si le finaliste
 *   LOSERS gagne : un seul match de finale désigne le champion.
 */
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
    const allMatches = await db.scoreMatch.findMany({ where: { tournamentId } });

    if (allMatches.some((m) => m.bracketType === "GRAND_FINAL")) {
      redirect(`${backTo}?error=already_final`);
    }

    const wbMatches = allMatches.filter((m) => m.bracketType === "WINNERS");
    const lbMatches = allMatches.filter((m) => m.bracketType === "LOSERS");

    if (wbMatches.length === 0) redirect(`${backTo}?error=server`);

    const latestWBRound = Math.max(...wbMatches.map((m) => m.round));
    const latestWBMatches = wbMatches.filter((m) => m.round === latestWBRound);
    if (latestWBMatches.some((m) => !m.winnerName)) redirect(`${backTo}?error=validation`);
    const wbDone = latestWBMatches.length === 1;

    const lbExists = lbMatches.length > 0;
    const latestLBRound = lbExists ? Math.max(...lbMatches.map((m) => m.round)) : 0;
    const latestLBMatches = lbExists ? lbMatches.filter((m) => m.round === latestLBRound) : [];
    if (latestLBMatches.some((m) => !m.winnerName)) redirect(`${backTo}?error=validation`);
    const lbDone = lbExists && latestLBMatches.length === 1;

    // Perdants WINNERS (n'importe quel tour) pas encore descendus en LOSERS —
    // exclut les "bye" (pas de vrai adversaire, donc pas de perdant).
    const unseeded = wbMatches.filter(
      (m) => m.winnerName && m.teamAName && m.teamBName && !m.lbSeeded,
    );
    const unseededLosers = unseeded.map((m) => (m.winnerName === m.teamAName ? m.teamBName! : m.teamAName!));

    if (wbDone && (!lbExists || lbDone) && unseededLosers.length === 0) {
      if (!lbExists) {
        // Aucun perdant n'a jamais existé (2 équipes au total) : le
        // champion WINNERS est déjà le champion du tournoi, rien à générer.
        redirect(`${backTo}?error=already_final`);
      }

      await db.scoreMatch.create({
        data: {
          tournamentId,
          bracketType: "GRAND_FINAL",
          round: 1,
          position: 0,
          teamAName: latestWBMatches[0].winnerName,
          teamBName: latestLBMatches[0].winnerName,
        },
      });

      await logActivity({
        action: "SCORE_BRACKET_ROUND_ADVANCED",
        actorId: admin.id,
        actorLabel: `${admin.name} (@${admin.username})`,
        targetLabel: `Tournoi ${tournamentId.slice(-6).toUpperCase()} — grande finale`,
      });

      redirect(`${backTo}?success=1`);
    }

    const newMatchesData: {
      tournamentId: string;
      bracketType: "WINNERS" | "LOSERS";
      round: number;
      position: number;
      teamAName: string | null;
      teamBName: string | null;
      winnerName: string | null;
    }[] = [];

    if (!wbDone) {
      const wbWinners = latestWBMatches.map((m) => m.winnerName!);
      const nextWB = pairTeams(wbWinners, false);
      newMatchesData.push(
        ...nextWB.map((m, position) => ({
          tournamentId,
          bracketType: "WINNERS" as const,
          round: latestWBRound + 1,
          position,
          ...m,
        })),
      );
    }

    const lbPool = [...latestLBMatches.map((m) => m.winnerName!), ...unseededLosers];
    const shouldCreateLBRound = lbPool.length > 0 && !(lbDone && unseededLosers.length === 0);

    if (shouldCreateLBRound) {
      const nextLB = pairTeams(lbPool, true);
      newMatchesData.push(
        ...nextLB.map((m, position) => ({
          tournamentId,
          bracketType: "LOSERS" as const,
          round: latestLBRound + 1,
          position,
          ...m,
        })),
      );
    }

    if (newMatchesData.length === 0) redirect(`${backTo}?error=validation`);

    await db.scoreMatch.createMany({ data: newMatchesData });

    if (unseeded.length > 0) {
      await db.scoreMatch.updateMany({
        where: { id: { in: unseeded.map((m) => m.id) } },
        data: { lbSeeded: true },
      });
    }

    await logActivity({
      action: "SCORE_BRACKET_ROUND_ADVANCED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `Tournoi ${tournamentId.slice(-6).toUpperCase()}`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADVANCE_BRACKET_ROUND_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
