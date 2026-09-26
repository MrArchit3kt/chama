"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

export async function liftBan(formData: FormData) {
  const admin = await requireAdmin("players");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.unban")) {
    redirect("/admin/players?error=forbidden");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!userId) {
    redirect("/admin/players?error=validation");
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        username: true,
      },
    });

    if (!targetUser) {
      redirect("/admin/players?error=player_not_found");
    }

    const activeBan = await db.ban.findFirst({
      where: {
        targetUserId: userId,
        status: "ACTIVE",
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
      },
    });

    if (activeBan) {
      await db.ban.update({
        where: { id: activeBan.id },
        data: {
          status: "LIFTED",
          liftedAt: new Date(),
          liftReason: reason || "Déban manuel par un admin.",
        },
      });
    }

    await db.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        bannedAt: null,
        banReason: null,
        banTriggerType: null,
      },
    });

    publishAdminEvent("players");

    await logActivity({
      action: "PLAYER_UNBANNED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: targetUser.id,
      targetLabel: `${targetUser.displayName} (@${targetUser.username})`,
      metadata: reason ? { reason } : undefined,
    });
  } catch (error) {
    await logServerError("LIFT_BAN_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?unbanned=1");
}