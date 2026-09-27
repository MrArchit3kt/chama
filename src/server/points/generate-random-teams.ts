"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { shuffle } from "@/server/mix/mix-logic";
import { syncTeamRosterToOtherBoards } from "@/lib/tournament-team-sync";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

type PoolMember = { userId: string } | { guestName: string };

/**
 * Tirage au sort des équipes d'un tournoi en mode RANDOM : mélange le pool
 * choisi par l'admin (joueurs inscrits + invités saisis) et le répartit à
 * parts égales sur `teamCount` équipes de la partie de référence, puis
 * propage la composition sur les autres parties déjà créées. Écrase la
 * composition précédente (tirage relançable tant que le tournoi n'a pas
 * démarré) — réutilise `shuffle()` du système de Mix pour rester cohérent
 * avec le reste du site.
 */
export async function generateRandomTeams(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  const backTo = `/admin/tournaments/${tournamentId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}?error=forbidden`);
  }

  if (!tournamentId) redirect("/admin/tournaments?error=validation");

  const teamCount = Number(String(formData.get("teamCount") ?? "").trim());
  const rawMax = String(formData.get("maxMembersPerTeam") ?? "").trim();
  const maxMembersPerTeam = rawMax ? Number(rawMax) : null;
  const userIds = formData.getAll("userIds").map((v) => String(v));
  const guestNamesRaw = String(formData.get("guestNames") ?? "");
  const guestNames = [
    ...new Set(
      guestNamesRaw
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];

  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 20) {
    redirect(`${backTo}?error=validation`);
  }
  if (maxMembersPerTeam !== null && (!Number.isInteger(maxMembersPerTeam) || maxMembersPerTeam < 1)) {
    redirect(`${backTo}?error=validation`);
  }

  try {
    const tournament = await db.scoreTournament.findUnique({
      where: { id: tournamentId },
      select: { teamMode: true, startedAt: true },
    });

    if (!tournament) redirect("/admin/tournaments?error=server");
    if (tournament.teamMode !== "RANDOM") redirect(`${backTo}?error=forbidden`);
    if (tournament.startedAt) redirect(`${backTo}?error=locked`);

    const validUsers = await db.user.findMany({
      where: { id: { in: userIds }, status: "ACTIVE", registrationStatus: "APPROVED" },
      select: { id: true },
    });

    const pool: PoolMember[] = [
      ...validUsers.map((u) => ({ userId: u.id }) as PoolMember),
      ...guestNames.map((n) => ({ guestName: n }) as PoolMember),
    ];

    if (pool.length === 0) redirect(`${backTo}?error=validation`);
    if (maxMembersPerTeam && pool.length > teamCount * maxMembersPerTeam) {
      redirect(`${backTo}?error=pool_too_large`);
    }

    const referenceBoard = await db.scoreBoard.findFirst({
      where: { tournamentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, teams: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } } },
    });

    if (!referenceBoard) redirect(`${backTo}?error=no_board`);

    let teams = referenceBoard.teams;
    if (teams.length < teamCount) {
      const missing = teamCount - teams.length;
      await db.scoreTeam.createMany({
        data: Array.from({ length: missing }, (_, i) => ({
          boardId: referenceBoard.id,
          name: `Équipe ${teams.length + i + 1}`,
        })),
      });
      teams = await db.scoreTeam.findMany({
        where: { boardId: referenceBoard.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });
    }

    const drawTeams = teams.slice(0, teamCount);

    // Repart de zéro : un tirage au sort remplace la composition
    // précédente sur TOUTES les parties déjà créées du tournoi.
    await db.scoreTeamMember.deleteMany({ where: { team: { board: { tournamentId } } } });

    const shuffled = shuffle(pool);
    for (let i = 0; i < shuffled.length; i++) {
      const member = shuffled[i];
      const team = drawTeams[i % drawTeams.length];
      await db.scoreTeamMember.create({
        data: "userId" in member ? { teamId: team.id, userId: member.userId } : { teamId: team.id, guestName: member.guestName },
      });
    }

    await syncTeamRosterToOtherBoards(tournamentId, referenceBoard.id);

    await db.scoreTournament.update({
      where: { id: tournamentId },
      data: { teamCount, maxMembersPerTeam },
    });

    await logActivity({
      action: "SCORE_TEAMS_RANDOMIZED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `Tournoi ${tournamentId.slice(-6).toUpperCase()}`,
      metadata: { teamCount, poolSize: pool.length },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("GENERATE_RANDOM_TEAMS_ERROR", error);
    redirect(`${backTo}?error=server`);
  }

  redirect(`${backTo}?success=1`);
}
