"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
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

export async function removeBracketTeam(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const id = String(formData.get("id") ?? "").trim();
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!id || !tournamentId) redirect("/admin/tournaments?error=validation");
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  try {
    const tournament = await db.scoreTournament.findUnique({
      where: { id: tournamentId },
      select: { startedAt: true },
    });

    if (!tournament) redirect(`${backTo}?error=server`);
    if (tournament.startedAt) redirect(`${backTo}?error=locked`);

    await db.scoreBracketTeam.deleteMany({ where: { id, tournamentId } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REMOVE_BRACKET_TEAM_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
