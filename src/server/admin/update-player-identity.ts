"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
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

const updateIdentitySchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().trim().min(2).max(40),
  // Mêmes règles que le pseudo généré à l'inscription (register.ts) : lettres
  // minuscules, chiffres, underscore.
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
});

/**
 * Permet à un admin de corriger le pseudo (displayName) et/ou le @ affiché
 * (username) d'un joueur — ex. faute de frappe à l'inscription, changement
 * de nom demandé par le joueur. Le joueur peut déjà changer son displayName
 * lui-même depuis /profil, mais pas son @ (fixé à l'inscription) — cette
 * action admin couvre les deux.
 */
export async function updatePlayerIdentity(formData: FormData) {
  const admin = await requireAdmin("players");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.identity.edit")) {
    redirect("/admin/players?error=forbidden");
  }

  const parsed = updateIdentitySchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    username: String(formData.get("username") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/players?error=identity_validation");
  }

  const { userId, displayName, username } = parsed.data;

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, role: true },
    });

    if (!targetUser) redirect("/admin/players?error=player_not_found");

    if (targetUser.role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
      redirect("/admin/players?error=forbidden");
    }

    if (username !== targetUser.username) {
      const usernameTaken = await db.user.findFirst({
        where: { username, id: { not: userId } },
        select: { id: true },
      });
      if (usernameTaken) redirect("/admin/players?error=username_taken");
    }

    const previousLabel = `${targetUser.displayName} (@${targetUser.username})`;

    await db.user.update({
      where: { id: userId },
      data: { displayName, username },
    });

    publishAdminEvent("players");

    await logActivity({
      action: "PLAYER_IDENTITY_UPDATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: targetUser.id,
      targetLabel: `${previousLabel} → ${displayName} (@${username})`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("UPDATE_PLAYER_IDENTITY_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?identity_updated=1");
}
