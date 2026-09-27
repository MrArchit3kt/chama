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
  format: z.enum(["CLASSIC", "BRACKET"]),
  gameModeIds: z.array(z.string().min(1)),
  teamMode: z.enum(["MANUAL", "SELF_JOIN", "RANDOM"]),
  teamCount: z.coerce.number().int().min(2).max(20).optional(),
  maxMembersPerTeam: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Un tournoi déclare dès sa création son format : CLASSIC (cumul de points
 * sur une partie par mode de jeu, comportement historique) ou BRACKET
 * (élimination directe — équipes appariées, le vainqueur avance, jusqu'au
 * champion). Les modes de jeu (`gameModeIds`) ne sont requis qu'en CLASSIC
 * — un bracket n'a pas besoin de tableau/conditions de points.
 *
 * En BRACKET, `teamCount` est requis : les équipes ("Équipe 1".."Équipe N")
 * sont créées immédiatement, prêtes à recevoir des joueurs (voir
 * add-bracket-team-member.ts), sans attendre une étape séparée.
 * `teamMode`/`maxMembersPerTeam` restent propres au format CLASSIC.
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
    format: String(formData.get("format") ?? "CLASSIC"),
    gameModeIds: formData.getAll("gameModeIds").map((v) => String(v)),
    teamMode: String(formData.get("teamMode") ?? "MANUAL"),
    teamCount: rawTeamCount || undefined,
    maxMembersPerTeam: rawMaxMembers || undefined,
  });

  if (!parsed.success) {
    redirect("/admin/tournaments?error=validation");
  }

  if (parsed.data.format === "CLASSIC" && parsed.data.gameModeIds.length === 0) {
    redirect("/admin/tournaments?error=modes_required");
  }

  if (parsed.data.format === "CLASSIC" && parsed.data.teamMode !== "MANUAL" && !parsed.data.teamCount) {
    redirect("/admin/tournaments?error=team_count_required");
  }

  if (parsed.data.format === "BRACKET" && !parsed.data.teamCount) {
    redirect("/admin/tournaments?error=team_count_required");
  }

  try {
    const validModes =
      parsed.data.gameModeIds.length > 0
        ? await db.scoreGameMode.findMany({
            where: { id: { in: parsed.data.gameModeIds } },
            select: { id: true, name: true },
          })
        : [];

    if (parsed.data.format === "CLASSIC" && validModes.length === 0) {
      redirect("/admin/tournaments?error=validation");
    }

    const tournament = await db.scoreTournament.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        createdById: admin.id,
        format: parsed.data.format,
        teamMode: parsed.data.teamMode,
        teamCount: parsed.data.teamCount ?? null,
        maxMembersPerTeam: parsed.data.maxMembersPerTeam ?? null,
        gameModes: { connect: validModes.map((m) => ({ id: m.id })) },
      },
    });

    if (parsed.data.format === "BRACKET" && parsed.data.teamCount) {
      await db.scoreBracketTeam.createMany({
        data: Array.from({ length: parsed.data.teamCount }, (_, i) => ({
          tournamentId: tournament.id,
          name: `Équipe ${i + 1}`,
        })),
      });
    }

    await logActivity({
      action: "SCORE_TOURNAMENT_CREATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: tournament.name,
      metadata: { format: parsed.data.format, modes: validModes.map((m) => m.name), teamMode: parsed.data.teamMode },
    });

    redirect(`/admin/tournaments/${tournament.id}?success=1`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_TOURNAMENT_ERROR", error);
    redirect("/admin/tournaments?error=server");
  }
}
