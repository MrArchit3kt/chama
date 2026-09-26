"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { isAdminPermissionKey } from "@/lib/admin-permissions";

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
 * Réservé au SUPER_ADMIN (/admin/permissions) : définit la liste exacte
 * des permissions déléguées à un ADMIN. Ne s'applique qu'aux comptes
 * role="ADMIN" — un SUPER_ADMIN a toujours tout, un PLAYER n'a pas de
 * permissions admin à gérer ici.
 */
export async function setAdminPermissions(formData: FormData) {
  const superAdmin = await requireSuperAdmin();

  if (!superAdmin) {
    redirect("/dashboard");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    redirect("/admin/permissions?error=validation");
  }

  const submitted = formData.getAll("permissions").map(String);
  const permissions = [...new Set(submitted.filter(isAdminPermissionKey))];

  try {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, role: true },
    });

    if (!target) {
      redirect("/admin/permissions?error=player_not_found");
    }

    if (target.role !== "ADMIN") {
      redirect("/admin/permissions?error=not_admin");
    }

    await db.user.update({
      where: { id: userId },
      data: { adminPermissions: permissions },
    });

    await logActivity({
      action: "ADMIN_PERMISSIONS_UPDATED",
      actorId: superAdmin.id,
      actorLabel: `${superAdmin.name} (@${superAdmin.username})`,
      targetId: target.id,
      targetLabel: `${target.displayName} (@${target.username})`,
      metadata: { permissions },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("SET_ADMIN_PERMISSIONS_ERROR", error);
    redirect("/admin/permissions?error=server");
  }

  redirect("/admin/permissions?success=1");
}
