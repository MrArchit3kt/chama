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

const createTierSchema = z
  .object({
    conditionId: z.string().min(1),
    minValue: z.coerce.number().int().min(0).max(100000),
    // Vide => palier illimité vers le haut (ex : "10 kills et plus").
    maxValue: z.coerce.number().int().min(0).max(100000).optional(),
    points: z.coerce.number().int().min(-1000).max(1000),
  })
  .refine((v) => v.maxValue === undefined || v.maxValue >= v.minValue, {
    message: "maxValue must be >= minValue",
  });

export async function createTier(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const rawMax = String(formData.get("maxValue") ?? "").trim();

  const parsed = createTierSchema.safeParse({
    conditionId: String(formData.get("conditionId") ?? ""),
    minValue: String(formData.get("minValue") ?? ""),
    maxValue: rawMax === "" ? undefined : rawMax,
    points: String(formData.get("points") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/points?error=validation");
  }

  try {
    const condition = await db.scoreCondition.findUnique({
      where: { id: parsed.data.conditionId },
      select: { id: true, label: true, mode: true, gameMode: { select: { name: true } } },
    });

    if (!condition || condition.mode !== "TIERED") {
      redirect("/admin/points?error=server");
    }

    await db.scoreConditionTier.create({
      data: {
        conditionId: parsed.data.conditionId,
        minValue: parsed.data.minValue,
        maxValue: parsed.data.maxValue ?? null,
        points: parsed.data.points,
      },
    });

    await logActivity({
      action: "SCORE_TIER_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `${condition.gameMode.name} — ${condition.label}`,
      metadata: {
        minValue: parsed.data.minValue,
        maxValue: parsed.data.maxValue ?? null,
        points: parsed.data.points,
      },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_TIER_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?success=1");
}
