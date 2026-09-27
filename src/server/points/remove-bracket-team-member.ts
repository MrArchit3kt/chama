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

export async function removeBracketTeamMember(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const memberId = String(formData.get("memberId") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!memberId || !tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  try {
    const member = await db.scoreBracketTeamMember.findUnique({
      where: { id: memberId },
      select: {
        guestName: true,
        user: { select: { displayName: true } },
        bracketTeam: {
          select: { name: true, tournamentId: true, tournament: { select: { startedAt: true } } },
        },
      },
    });

    if (!member || member.bracketTeam.tournamentId !== tournamentId) redirect(`${backTo}?error=server`);
    if (member.bracketTeam.tournament.startedAt) redirect(`${backTo}?error=locked`);

    await db.scoreBracketTeamMember.delete({ where: { id: memberId } });

    await logActivity({
      action: "SCORE_BRACKET_TEAM_MEMBER_REMOVED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `${member.bracketTeam.name} — ${member.user?.displayName ?? member.guestName ?? "Invité"}`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REMOVE_BRACKET_TEAM_MEMBER_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
