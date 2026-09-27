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
  gameModeIds: z.array(z.string().min(1)).min(1, "Au moins un mode de jeu est requis"),
  teamMode: z.enum(["MANUAL", "SELF_JOIN", "RANDOM"]),
  teamCount: z.coerce.number().int().min(2).max(20).optional(),
  maxMembersPerTeam: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Un tournoi déclare dès sa création les modes de jeu qu'il regroupe (ex :
 * Warzone + BO7 + Rocket League) — le site sait ainsi d'avance combien de
 * parties le composent, et une seule partie par mode pourra y être créée
 * (contrainte @@unique([tournamentId, gameModeId]) sur ScoreBoard).
 *
 * `teamMode` détermine comment les équipes se peuplent : MANUAL (l'admin
 * ajoute tout à la main, comme avant), SELF_JOIN (les joueurs choisissent
 * eux-mêmes leur équipe sur /points) ou RANDOM (l'admin tire au sort depuis
 * /admin/tournaments/[id]). `teamCount`/`maxMembersPerTeam` sont optionnels
 * en mode MANUAL, mais utiles pour pré-créer des équipes vides nommées dès
 * la 1ère partie.
 */
export async function createTournament(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect("/admin/tournaments?error=forbidden");
  }

  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawTeamCount = String(formData.get("teamCount") ?? "").trim();
  const rawMaxMembers = String(formData.get("maxMembersPerTeam") ?? "").trim();

  const parsed = createTournamentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: rawDescription || undefined,
    gameModeIds: formData.getAll("gameModeIds").map((v) => String(v)),
    teamMode: String(formData.get("teamMode") ?? "MANUAL"),
    teamCount: rawTeamCount || undefined,
    maxMembersPerTeam: rawMaxMembers || undefined,
  });

  if (!parsed.success) {
    redirect("/admin/tournaments?error=validation");
  }

  if (parsed.data.teamMode !== "MANUAL" && !parsed.data.teamCount) {
    redirect("/admin/tournaments?error=team_count_required");
  }

  try {
    const validModes = await db.scoreGameMode.findMany({
      where: { id: { in: parsed.data.gameModeIds } },
      select: { id: true, name: true },
    });

    if (validModes.length === 0) redirect("/admin/tournaments?error=validation");

    const tournament = await db.scoreTournament.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        createdById: admin.id,
        teamMode: parsed.data.teamMode,
        teamCount: parsed.data.teamCount ?? null,
        maxMembersPerTeam: parsed.data.maxMembersPerTeam ?? null,
        gameModes: { connect: validModes.map((m) => ({ id: m.id })) },
      },
    });

    await logActivity({
      action: "SCORE_TOURNAMENT_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: tournament.name,
      metadata: { modes: validModes.map((m) => m.name), teamMode: parsed.data.teamMode },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_TOURNAMENT_ERROR", error);
    redirect("/admin/tournaments?error=server");
  }

  redirect("/admin/tournaments?success=1");
}
