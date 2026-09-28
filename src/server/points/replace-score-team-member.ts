"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { syncTeamRosterToOtherBoards } from "@/lib/tournament-team-sync";

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
 * Contrôle unique en haut de chaque partie : ajoute un joueur à une équipe,
 * ou — si `memberId` est fourni — remplace un membre existant par un autre
 * en une seule action (au lieu d'un retrait puis un ajout séparés). Reprend
 * les mêmes vérifications que `add-score-team-member.ts`.
 */
export async function replaceScoreTeamMember(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const guestName = String(formData.get("guestName") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();

  if (!tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  if (!gameModeId || !boardId || !teamId || (!userId && !guestName)) {
    redirect(`${backTo}?error=validation`);
  }

  try {
    const team = await db.scoreTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        board: {
          select: {
            gameModeId: true,
            finishedAt: true,
            teams: { select: { id: true, members: { select: { id: true, userId: true } } } },
          },
        },
      },
    });

    if (!team || team.board.gameModeId !== gameModeId) redirect(`${backTo}?error=server`);
    if (team.board.finishedAt) redirect(`${backTo}?error=board_finished`);

    const targetTeamMembers = team.board.teams.find((t) => t.id === teamId)?.members ?? [];

    if (memberId && !targetTeamMembers.some((m) => m.id === memberId)) {
      redirect(`${backTo}?error=server`);
    }

    // Un joueur ne peut être que dans une seule équipe à la fois sur une
    // même partie — vérifié sur TOUTES les équipes du tableau, pas
    // seulement celle ciblée (sinon rien n'empêchait de l'ajouter deux
    // fois ailleurs).
    if (userId) {
      const alreadyElsewhere = team.board.teams.some((t) =>
        t.members.some((m) => m.userId === userId && m.id !== memberId),
      );
      if (alreadyElsewhere) redirect(`${backTo}?error=already_in_team`);
    }

    // Capacité max par équipe : ne s'applique qu'à un vrai ajout (le
    // nombre de membres ne change pas lors d'un remplacement memberId).
    if (!memberId) {
      const tournament = await db.scoreTournament.findUnique({
        where: { id: tournamentId },
        select: { maxMembersPerTeam: true },
      });

      if (tournament?.maxMembersPerTeam && targetTeamMembers.length >= tournament.maxMembersPerTeam) {
        redirect(`${backTo}?error=team_full`);
      }
    }

    let newPlayerLabel = guestName;

    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, status: true, registrationStatus: true },
      });

      if (!user || user.status !== "ACTIVE" || user.registrationStatus !== "APPROVED") {
        redirect(`${backTo}?error=server`);
      }

      newPlayerLabel = user.displayName;
    }

    let replacedLabel: string | null = null;

    if (memberId) {
      const replaced = await db.scoreTeamMember.findUnique({
        where: { id: memberId },
        select: { guestName: true, user: { select: { displayName: true } } },
      });
      replacedLabel = replaced?.user?.displayName ?? replaced?.guestName ?? null;

      // onDelete: Cascade sur ScoreEntry — le nouveau joueur repart de 0
      // sur cette partie, ses propres scores éventuels sur d'autres parties
      // du tournoi ne sont pas affectés.
      await db.scoreTeamMember.delete({ where: { id: memberId } });
    }

    if (userId) {
      await db.scoreTeamMember.create({ data: { teamId, userId } });
    } else {
      await db.scoreTeamMember.create({ data: { teamId, guestName } });
    }

    // Propage le nouveau joueur aux autres parties du tournoi (comme pour
    // un ajout classique) — ne retire jamais rien sur les autres parties,
    // voir la doc de syncTeamRosterToOtherBoards.
    await syncTeamRosterToOtherBoards(tournamentId, boardId);

    if (replacedLabel) {
      await logActivity({
        action: "SCORE_TEAM_MEMBER_REPLACED",
        actorId: admin.id,
        actorLabel: `${admin.name} (@${admin.username})`,
        targetLabel: `${replacedLabel} → ${newPlayerLabel}`,
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REPLACE_SCORE_TEAM_MEMBER_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?member_added=1`);
}
