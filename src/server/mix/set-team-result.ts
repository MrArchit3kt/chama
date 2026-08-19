"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

const GAME_TO_PATH: Record<string, string> = {
  WARZONE: "/warzone",
  WARZONE_RANKED: "/ranked",
  BO7: "/bo7",
  ROCKET_LEAGUE: "/rocket-league",
  VERSUS: "/versus",
};

/**
 * Enregistre (ou efface) le résultat d'une équipe pour une session donnée.
 * Auto-déclaré par les joueurs eux-mêmes : n'importe quel joueur connecté
 * peut renseigner le résultat de n'importe quelle équipe générée (pas
 * besoin d'un admin, ni d'en faire partie — les équipes se forment et se
 * dissolvent trop vite pour restreindre ça, la communauté reste petite
 * et de confiance). Sert de base au classement (/classement) et à
 * l'historique perso sur le Profil.
 */
export async function setTeamResult(formData: FormData) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const teamId = String(formData.get("teamId") ?? "").trim();
  const result = String(formData.get("result") ?? "").trim();

  if (!teamId || !["WIN", "LOSS", "CLEAR"].includes(result)) {
    redirect("/dashboard");
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      session: { select: { id: true, game: true } },
    },
  });

  if (!team) redirect("/dashboard");

  const backPath = GAME_TO_PATH[team.session.game] ?? "/dashboard";
  const backUrl = `${backPath}?session=${team.session.id}`;

  try {
    await db.team.update({
      where: { id: teamId },
      data: { result: result === "CLEAR" ? null : (result as "WIN" | "LOSS") },
    });
  } catch (error) {
    await logServerError("SET_TEAM_RESULT_ERROR", error, { userId: sessionUser.id });
    redirect(`${backUrl}&error=server`);
  }

  redirect(backUrl);
}
