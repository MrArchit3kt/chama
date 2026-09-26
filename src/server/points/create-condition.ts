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

const createConditionSchema = z.object({
  gameModeId: z.string().min(1),
  label: z.string().trim().min(2).max(60),
  // Peut être négatif (ex : -1 pt par mort). Ignoré si mode == TIERED, les
  // points viennent alors des paliers créés ensuite sur la condition.
  points: z.coerce.number().int().min(-1000).max(1000).default(0),
  mode: z.enum(["QUANTITY", "ONE_TIME", "TIERED"]),
  appliesTo: z.enum(["TEAM", "PLAYER"]),
});

export async function createCondition(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const parsed = createConditionSchema.safeParse({
    gameModeId: String(formData.get("gameModeId") ?? ""),
    label: String(formData.get("label") ?? ""),
    points: String(formData.get("points") ?? ""),
    mode: String(formData.get("mode") ?? ""),
    appliesTo: String(formData.get("appliesTo") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/points?error=validation");
  }

  try {
    const gameMode = await db.scoreGameMode.findUnique({
      where: { id: parsed.data.gameModeId },
      select: { id: true, name: true },
    });

    if (!gameMode) redirect("/admin/points?error=server");

    const condition = await db.scoreCondition.create({
      data: {
        gameModeId: gameMode.id,
        label: parsed.data.label,
        points: parsed.data.points,
        mode: parsed.data.mode,
        appliesTo: parsed.data.appliesTo,
      },
    });

    await logActivity({
      action: "SCORE_CONDITION_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `${gameMode.name} — ${condition.label}`,
      metadata: { points: condition.points, mode: condition.mode, appliesTo: condition.appliesTo },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_CONDITION_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?success=1");
}
