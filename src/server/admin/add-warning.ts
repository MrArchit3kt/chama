"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";

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
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
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
      status: true,
    },
  });

  if (!targetUser) {
    redirect("/admin/players?error=player_not_found");
  }

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