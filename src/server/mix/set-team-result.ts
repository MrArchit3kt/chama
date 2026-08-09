"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

const GAME_TO_PATH: Record<string, string> = {
  WARZONE: "/admin/mix/warzone",
  WARZONE_RANKED: "/admin/mix/warzone-ranked",
  BO7: "/admin/mix/bo7",
  ROCKET_LEAGUE: "/admin/mix/rocket-league",
};

/**
 * Enregistre (ou efface) le résultat d'une équipe pour une session donnée.
 * Sert de base au classement des joueurs (/classement) et à l'historique
 * perso sur le Profil.
 */
export async function setTeamResult(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const teamId = String(formData.get("teamId") ?? "").trim();
  const result = String(formData.get("result") ?? "").trim();

  if (!teamId || !["WIN", "LOSS", "CLEAR"].includes(result)) {
    redirect("/admin");
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, session: { select: { id: true, game: true } } },
  });

  if (!team) redirect("/admin");

  const backPath = GAME_TO_PATH[team.session.game] ?? "/admin";
  const backUrl = `${backPath}?session=${team.session.id}`;

  try {
    await db.team.update({
      where: { id: teamId },
      data: { result: result === "CLEAR" ? null : (result as "WIN" | "LOSS") },
    });
  } catch (error) {
    await logServerError("SET_TEAM_RESULT_ERROR", error, { userId: admin.id });
    redirect(`${backUrl}&error=server`);
  }

  redirect(backUrl);
}
