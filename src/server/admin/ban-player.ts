"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";

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
 * Bannissement manuel (par opposition au ban automatique déclenché par
 * add-warning.ts après 5 avertissements du même type). Remplace la
 * suppression de compte dans /admin/players : réversible via liftBan, et
 * le joueur voit le motif + peut s'expliquer sur /banni.
 */
export async function banPlayer(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!userId || !reason) {
    redirect("/admin/players?error=validation");
  }

  if (userId === admin.id) {
    redirect("/admin/players?error=self_ban");
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
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

    await db.ban.create({
      data: {
        targetUserId: userId,
        adminUserId: admin.id,
        source: "MANUAL",
        status: "ACTIVE",
        reason,
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
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("BAN_PLAYER_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?manual_banned=1");
}
