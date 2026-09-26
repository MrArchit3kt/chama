"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

export async function revokeWarning(formData: FormData) {
  const admin = await requireAdmin("players");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.warning.manage")) {
    redirect("/admin/players?error=forbidden");
  }

  const warningId = String(formData.get("warningId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!warningId) {
    redirect("/admin/players?error=validation");
  }

  try {
    const warning = await db.warning.findUnique({
      where: { id: warningId },
      select: {
        id: true,
        status: true,
        targetUser: { select: { id: true, displayName: true, username: true } },
      },
    });

    if (!warning) {
      redirect("/admin/players?error=player_not_found");
    }

    if (warning.status !== "ACTIVE") {
      redirect("/admin/players?revoked=1");
    }

    await db.warning.update({
      where: { id: warning.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: reason || "Révocation manuelle par un admin.",
        revokedByAdminId: admin.id,
      },
    });

    publishAdminEvent("players");

    await logActivity({
      action: "WARNING_REVOKED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: warning.targetUser.id,
      targetLabel: `${warning.targetUser.displayName} (@${warning.targetUser.username})`,
      metadata: reason ? { reason } : undefined,
    });
  } catch (error) {
    await logServerError("REVOKE_WARNING_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?revoked=1");
}