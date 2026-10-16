"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
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

const MIN_DAYS = 1;
const MAX_DAYS = 90;

/**
 * Exclusion temporaire : variante de banPlayer.ts limitée dans le temps
 * (levée automatiquement par resolveSessionUser dans session.ts dès que
 * `expiresAt` est dépassé — pas besoin de cron). Réservée au SUPER_ADMIN
 * et volontairement hors du catalogue `ADMIN_PERMISSIONS` délégable
 * (même précaution que toggle-user-role.ts) : un ADMIN classique ne doit
 * pas pouvoir exclure, quelles que soient ses permissions déléguées.
 */
export async function excludePlayer(formData: FormData) {
  const admin = await requireAdmin("players");

  if (!admin) {
    redirect("/dashboard");
  }

  if (admin.role !== "SUPER_ADMIN") {
    redirect("/admin/players?error=forbidden");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const daysRaw = Number(formData.get("days"));

  if (!userId || !reason || !Number.isFinite(daysRaw)) {
    redirect("/admin/players?error=validation");
  }

  const days = Math.round(daysRaw);

  if (days < MIN_DAYS || days > MAX_DAYS) {
    redirect("/admin/players?error=validation");
  }

  if (userId === admin.id) {
    redirect("/admin/players?error=self_ban");
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, role: true, status: true },
    });

    if (!targetUser) {
      redirect("/admin/players?error=player_not_found");
    }

    if (targetUser.role === "SUPER_ADMIN") {
      redirect("/admin/players?error=forbidden");
    }

    if (targetUser.status === "BANNED") {
      redirect("/admin/players?error=already_banned");
    }

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await db.ban.create({
      data: {
        targetUserId: userId,
        adminUserId: admin.id,
        source: "MANUAL",
        status: "ACTIVE",
        reason,
        expiresAt,
      },
    });

    await db.user.update({
      where: { id: userId },
      data: {
        status: "BANNED",
        bannedAt: new Date(),
        banReason: reason,
        isAvailableForMix: false,
        isAvailableForWarzoneMix: false,
        isAvailableForWarzoneRankedMix: false,
        isAvailableForBO7Mix: false,
        isAvailableForRocketLeagueMix: false,
        isOnline: false,
      },
    });

    publishAdminEvent("players");

    await logActivity({
      action: "PLAYER_EXCLUDED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: targetUser.id,
      targetLabel: `${targetUser.displayName} (@${targetUser.username})`,
      metadata: { reason, days, expiresAt: expiresAt.toLocaleString("fr-FR") },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("EXCLUDE_PLAYER_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?excluded=1");
}
