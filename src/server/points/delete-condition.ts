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

export async function deleteCondition(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/points?error=validation");

  try {
    const condition = await db.scoreCondition.findUnique({
      where: { id },
      select: { label: true, gameMode: { select: { name: true } } },
    });

    // onDelete: Cascade sur ScoreEntry => les scores déjà saisis pour cette
    // condition sont retirés du calcul (comportement voulu : la condition
    // n'existe plus, ses points ne doivent plus compter).
    await db.scoreCondition.delete({ where: { id } });

    await logActivity({
      action: "SCORE_CONDITION_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: condition ? `${condition.gameMode.name} — ${condition.label}` : id,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_CONDITION_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?deleted=1");
}
