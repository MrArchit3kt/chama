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
 * Enregistre les kills/morts d'un membre d'équipe. Facultatif, auto-déclaré :
 * n'importe quel joueur connecté peut renseigner les stats de n'importe
 * quel membre de n'importe quelle équipe (utile si tout le monde ne pense
 * pas à le faire pour lui-même). Sert au classement K/D (/classement).
 */
export async function setPlayerStats(formData: FormData) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const teamMemberId = String(formData.get("teamMemberId") ?? "").trim();
  if (!teamMemberId) redirect("/dashboard");

  const member = await db.teamMember.findUnique({
    where: { id: teamMemberId },
    select: {
      id: true,
      team: {
        select: {
          session: { select: { id: true, game: true } },
        },
      },
    },
  });

  if (!member) redirect("/dashboard");

  const backPath = GAME_TO_PATH[member.team.session.game] ?? "/dashboard";
  const backUrl = `${backPath}?session=${member.team.session.id}`;

  const killsRaw = String(formData.get("kills") ?? "").trim();
  const deathsRaw = String(formData.get("deaths") ?? "").trim();

  const kills = killsRaw === "" ? null : Number(killsRaw);
  const deaths = deathsRaw === "" ? null : Number(deathsRaw);

  const isValid =
    (kills === null || (Number.isInteger(kills) && kills >= 0 && kills <= 999)) &&
    (deaths === null || (Number.isInteger(deaths) && deaths >= 0 && deaths <= 999));

  if (!isValid) {
    redirect(`${backUrl}&error=stats_invalid`);
  }

  try {
    await db.teamMember.update({
      where: { id: teamMemberId },
      data: { kills, deaths },
    });
  } catch (error) {
    await logServerError("SET_PLAYER_STATS_ERROR", error, { userId: sessionUser.id });
    redirect(`${backUrl}&error=server`);
  }

  redirect(backUrl);
}
