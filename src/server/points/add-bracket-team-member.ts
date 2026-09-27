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

/** Ajoute un joueur (inscrit ou invité) au roster d'une équipe de bracket —
 * purement informatif, n'affecte pas les matchs (référencés par nom
 * d'équipe). Verrouillé une fois le tournoi démarré. */
export async function addBracketTeamMember(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const bracketTeamId = String(formData.get("bracketTeamId") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const guestName = String(formData.get("guestName") ?? "").trim();

  if (!bracketTeamId || !tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  if (!userId && !guestName) redirect(`${backTo}?error=validation`);

  try {
    const team = await db.scoreBracketTeam.findUnique({
      where: { id: bracketTeamId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        tournament: { select: { startedAt: true, maxMembersPerTeam: true } },
        members: { select: { userId: true } },
      },
    });

    if (!team || team.tournamentId !== tournamentId) redirect(`${backTo}?error=server`);
    if (team.tournament.startedAt) redirect(`${backTo}?error=locked`);

    if (
      team.tournament.maxMembersPerTeam &&
      team.members.length >= team.tournament.maxMembersPerTeam
    ) {
      redirect(`${backTo}?error=team_full`);
    }

    if (userId) {
      if (team.members.some((m) => m.userId === userId)) {
        redirect(`${backTo}?error=already_in_team`);
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, registrationStatus: true },
      });

      if (!user || user.status !== "ACTIVE" || user.registrationStatus !== "APPROVED") {
        redirect(`${backTo}?error=server`);
      }

      await db.scoreBracketTeamMember.create({ data: { bracketTeamId, userId } });
    } else {
      await db.scoreBracketTeamMember.create({ data: { bracketTeamId, guestName } });
    }

    await logActivity({
      action: "SCORE_BRACKET_TEAM_MEMBER_ADDED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: team.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADD_BRACKET_TEAM_MEMBER_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?member_added=1`);
}
