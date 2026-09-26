"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
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

export async function toggleGameMode(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/points?error=validation");

  try {
    const gameMode = await db.scoreGameMode.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!gameMode) redirect("/admin/points?error=server");

    await db.scoreGameMode.update({
      where: { id },
      data: { isActive: !gameMode.isActive },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("TOGGLE_GAME_MODE_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?toggled=1");
}
