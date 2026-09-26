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

const createTournamentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

export async function createTournament(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect("/admin/tournaments?error=forbidden");
  }

  const rawDescription = String(formData.get("description") ?? "").trim();

  const parsed = createTournamentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: rawDescription || undefined,
  });

  if (!parsed.success) {
    redirect("/admin/tournaments?error=validation");
  }

  try {
    const tournament = await db.scoreTournament.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        createdById: admin.id,
      },
    });

    await logActivity({
      action: "SCORE_TOURNAMENT_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: tournament.name,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_TOURNAMENT_ERROR", error);
    redirect("/admin/tournaments?error=server");
  }

  redirect("/admin/tournaments?success=1");
}
