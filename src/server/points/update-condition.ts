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

const updateConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(2).max(60),
  // Peut être négatif. Ignoré si mode == TIERED (inchangé par cette action).
  points: z.coerce.number().int().min(-1000).max(1000).default(0),
});

/**
 * Corrige le label/les points d'une condition existante sans passer par
 * supprimer + recréer — ce qui effacerait en cascade tout l'historique de
 * scores déjà saisis pour elle. Le type (Quantité/Ponctuelle/Paliers) et la
 * cible (équipe/joueur) ne sont volontairement pas modifiables ici : les
 * changer rendrait les entrées déjà saisies incohérentes avec le nouveau
 * réglage (ex: un ONE_TIME devenu QUANTITY change le sens de "quantity=1").
 */
export async function updateCondition(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.config")) {
    redirect("/admin/points?error=forbidden");
  }

  const parsed = updateConditionSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    label: String(formData.get("label") ?? ""),
    points: String(formData.get("points") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/points?error=validation");
  }

  try {
    const condition = await db.scoreCondition.findUnique({
      where: { id: parsed.data.id },
      select: { gameMode: { select: { name: true } } },
    });

    if (!condition) redirect("/admin/points?error=server");

    await db.scoreCondition.update({
      where: { id: parsed.data.id },
      data: { label: parsed.data.label, points: parsed.data.points },
    });

    await logActivity({
      action: "SCORE_CONDITION_UPDATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `${condition.gameMode.name} — ${parsed.data.label}`,
      metadata: { points: parsed.data.points },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("UPDATE_CONDITION_ERROR", error);
    redirect("/admin/points?error=server");
  }

  redirect("/admin/points?success=1");
}
