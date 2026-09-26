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

export async function deleteTier(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/points?error=validation");

  try {
    const tier = await db.scoreConditionTier.findUnique({
      where: { id },
      select: {
        minValue: true,
        maxValue: true,
        points: true,
        condition: { select: { label: true, gameMode: { select: { name: true } } } },
      },
    });

    await db.scoreConditionTier.delete({ where: { id } });

    await logActivity({
      action: "SCORE_TIER_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: tier ? `${tier.condition.gameMode.name} — ${tier.condition.label}` : id,
      metadata: tier ? { minValue: tier.minValue, maxValue: tier.maxValue, points: tier.points } : undefined,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_TIER_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?deleted=1");
}
