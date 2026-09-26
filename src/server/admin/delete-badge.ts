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

export async function deleteBadge(formData: FormData) {
  const admin = await requireAdmin("badges");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "badges.manage")) {
    redirect("/admin/badges?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/badges?error=server");

  try {
    const badge = await db.badge.findUnique({ where: { id }, select: { name: true } });

    // onDelete: Cascade sur UserBadge => retire aussi le badge des joueurs qui l'avaient
    await db.badge.delete({ where: { id } });

    await logActivity({
      action: "BADGE_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: badge?.name ?? id,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_BADGE_ERROR", error);
    redirect("/admin/badges?error=server");
  }

  redirect("/admin/badges?deleted=1");
}
