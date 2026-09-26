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

export async function revokeBadge(formData: FormData) {
  const admin = await requireAdmin("players");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.badge.manage")) {
    redirect("/admin/players?error=forbidden");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const badgeId = String(formData.get("badgeId") ?? "").trim();

  if (!userId || !badgeId) {
    redirect("/admin/players?error=validation");
  }

  try {
    const [targetUser, badge] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } }),
      db.badge.findUnique({ where: { id: badgeId }, select: { name: true } }),
    ]);

    await db.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });

    await logActivity({
      action: "BADGE_REVOKED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: userId,
      targetLabel: targetUser ? `${targetUser.displayName} (@${targetUser.username})` : userId,
      metadata: { badge: badge?.name ?? badgeId },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REVOKE_BADGE_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?badge_revoked=1");
}
