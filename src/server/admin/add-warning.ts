"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

const WARNING_LIMIT_PER_TYPE = 5;

const ALLOWED_WARNING_TYPES = [
  "TOXICITY",
  "ABSENCE",
  "AFK",
  "INSULT",
  "CHEATING_SUSPECT",
  "TEAM_REFUSAL",
  "SPAM",
  "OTHER",
] as const;

type AllowedWarningType = (typeof ALLOWED_WARNING_TYPES)[number];

function isAllowedWarningType(value: string): value is AllowedWarningType {
  return ALLOWED_WARNING_TYPES.includes(value as AllowedWarningType);
}

export async function addWarning(formData: FormData) {
  const admin = await requireAdmin("players");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.warning.manage")) {
    redirect("/admin/players?error=forbidden");
  }

  const targetUserId = String(formData.get("userId") ?? "").trim();
  const rawType = String(formData.get("type") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!targetUserId || !rawType || !message) {
    redirect("/admin/players?error=validation");
  }

  if (!isAllowedWarningType(rawType)) {
    redirect("/admin/players?error=validation");
  }

  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      displayName: true,
      username: true,
      status: true,
    },
  });

  if (!targetUser) {
    redirect("/admin/players?error=player_not_found");
  }

  const targetLabel = `${targetUser.displayName} (@${targetUser.username})`;

  try {
    await db.warning.create({
      data: {
        targetUserId: targetUser.id,
        adminUserId: admin.id,
        type: rawType,
        message,
        status: "ACTIVE",
      },
    });

    await logActivity({
      action: "WARNING_ADDED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: targetUser.id,
      targetLabel,
      metadata: { type: rawType, message },
    });

    const sameTypeActiveWarnings = await db.warning.count({
      where: {
        targetUserId: targetUser.id,
        type: rawType,
        status: "ACTIVE",
      },
    });

    if (sameTypeActiveWarnings >= WARNING_LIMIT_PER_TYPE) {
      const existingActiveBan = await db.ban.findFirst({
        where: {
          targetUserId: targetUser.id,
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (!existingActiveBan) {
        await db.ban.create({
          data: {
            targetUserId: targetUser.id,
            adminUserId: admin.id,
            source: "AUTOMATIC",
            status: "ACTIVE",
            reason: `Ban automatique après ${sameTypeActiveWarnings} avertissements actifs du type ${rawType}.`,
            triggerType: rawType,
            triggeredByCount: sameTypeActiveWarnings,
          },
        });
      }

      await db.user.update({
        where: { id: targetUser.id },
        data: {
          status: "BANNED",
          bannedAt: new Date(),
          banReason: `Ban automatique après ${sameTypeActiveWarnings} avertissements actifs du type ${rawType}.`,
          banTriggerType: rawType,
          isAvailableForMix: false,
          isOnline: false,
        },
      });

      await logActivity({
        action: "PLAYER_BANNED",
        actorId: admin.id,
        actorLabel: `${admin.name} (@${admin.username})`,
        targetId: targetUser.id,
        targetLabel,
        metadata: {
          automatic: true,
          reason: `Ban automatique après ${sameTypeActiveWarnings} avertissements actifs du type ${rawType}.`,
        },
      });

      publishAdminEvent("players");
      redirect("/admin/players?warned=1&banned=1");
    }

    publishAdminEvent("players");
  } catch (error) {
    await logServerError("ADD_WARNING_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?warned=1");
}