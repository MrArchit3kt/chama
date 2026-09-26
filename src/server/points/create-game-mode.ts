"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

const createGameModeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
});

export async function createGameMode(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const parsed = createGameModeSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/points?error=validation");
  }

  try {
    const existing = await db.scoreGameMode.findUnique({
      where: { name: parsed.data.name },
      select: { id: true },
    });

    if (existing) {
      redirect("/admin/points?error=name_taken");
    }

    const gameMode = await db.scoreGameMode.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
      },
    });

    await logActivity({
      action: "SCORE_GAME_MODE_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: gameMode.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_GAME_MODE_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?success=1");
}
