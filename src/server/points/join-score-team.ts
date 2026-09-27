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
 * Un joueur rejoint (ou change vers) une équipe d'un tournoi en mode
 * SELF_JOIN, tant qu'il n'a pas démarré. Rejoindre une équipe retire
 * d'abord toute appartenance existante du joueur dans ce même tournoi
 * (permet de changer d'avis en un clic) puis l'ajoute sur TOUTES les
 * parties déjà créées du tournoi qui ont une équipe du même nom — la
 * composition doit rester la même équipe sur toute la durée du tournoi.
 */
export async function joinScoreTeam(formData: FormData) {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!teamId) redirect("/points?error=validation");

  try {
    const team = await db.scoreTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        board: {
          select: {
            tournamentId: true,
            tournament: {
              select: { teamMode: true, startedAt: true, maxMembersPerTeam: true },
            },
          },
        },
      },
    });

    if (!team || !team.board.tournamentId || !team.board.tournament) {
      redirect("/points?error=server");
    }

    const tournamentId = team.board.tournamentId;
    const tournament = team.board.tournament;

    if (tournament.teamMode !== "SELF_JOIN") redirect("/points?error=forbidden");
    if (tournament.startedAt) redirect("/points?error=locked");

    // Permet de "changer" d'équipe en un clic : on retire d'abord toute
    // appartenance existante du joueur dans ce tournoi (tous tableaux).
    await db.scoreTeamMember.deleteMany({
      where: { userId: user.id, team: { board: { tournamentId } } },
    });

    if (tournament.maxMembersPerTeam) {
      const currentCount = await db.scoreTeamMember.count({ where: { teamId } });
      if (currentCount >= tournament.maxMembersPerTeam) {
        redirect("/points?error=team_full");
      }
    }

    const boardsWithTeam = await db.scoreBoard.findMany({
      where: { tournamentId },
      select: { teams: { where: { name: team.name }, select: { id: true } } },
    });

    for (const board of boardsWithTeam) {
      const matchingTeam = board.teams[0];
      if (!matchingTeam) continue;
      await db.scoreTeamMember.upsert({
        where: { teamId_userId: { teamId: matchingTeam.id, userId: user.id } },
        update: {},
        create: { teamId: matchingTeam.id, userId: user.id },
      });
    }

    await logActivity({
      action: "SCORE_TEAM_JOINED",
      actorId: user.id,
      actorLabel: `${user.name} (@${user.username})`,
      targetLabel: team.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("JOIN_SCORE_TEAM_ERROR", error);
    redirect("/points?error=server");
  }

  redirect("/points?joined=1");
}
