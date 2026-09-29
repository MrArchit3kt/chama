import "server-only";
import { db } from "@/lib/prisma";
import { logServerError } from "@/lib/log-error";
import { sendPushToUsers } from "@/lib/push";

const GAME_LABELS: Record<string, string> = {
  WARZONE: "Warzone",
  WARZONE_RANKED: "Warzone Ranked",
  BO7: "BO7",
  ROCKET_LEAGUE: "Rocket League",
  VERSUS: "Versus",
};

const GAME_URLS: Record<string, string> = {
  WARZONE: "/warzone",
  WARZONE_RANKED: "/ranked",
  BO7: "/bo7",
  ROCKET_LEAGUE: "/rocket-league",
  VERSUS: "/versus",
};

/**
 * Notifie (push + in-app) chaque joueur inscrit placé dans une équipe par
 * un mix généré, avec la liste de ses coéquipiers — joueurs inscrits ET
 * invités (`teamsTempIds`, même indexation que `teamsUserIds` : l'équipe à
 * l'index N de l'un correspond à celle à l'index N de l'autre). Seuls les
 * comptes inscrits reçoivent la notification (un invité n'a pas de compte
 * pour ça), mais son pseudo apparaît dans le message des autres. Best-effort
 * total : ne doit jamais faire échouer la génération d'un mix si l'envoi rate.
 */
export async function notifyMixTeamsGenerated(
  game: string,
  teamsUserIds: string[][],
  teamsTempIds: string[][] = [],
) {
  try {
    const allUserIds = [...new Set(teamsUserIds.flat())];
    if (allUserIds.length === 0) return;

    const allTempIds = [...new Set(teamsTempIds.flat())];

    const [users, tempPlayers] = await Promise.all([
      db.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, displayName: true },
      }),
      allTempIds.length > 0
        ? db.tempPlayer.findMany({
            where: { id: { in: allTempIds } },
            select: { id: true, nickname: true },
          })
        : Promise.resolve([]),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));
    const nicknameById = new Map(tempPlayers.map((t) => [t.id, t.nickname]));

    const gameLabel = GAME_LABELS[game] ?? game;
    const url = GAME_URLS[game] ?? "/dashboard";

    const notifications: { userId: string; message: string }[] = [];

    for (let i = 0; i < teamsUserIds.length; i += 1) {
      const userIds = teamsUserIds[i];
      if (userIds.length === 0) continue;

      const guestNames = (teamsTempIds[i] ?? [])
        .map((id) => nicknameById.get(id))
        .filter((n): n is string => Boolean(n));

      for (const userId of userIds) {
        const teammateNames = userIds
          .filter((id) => id !== userId)
          .map((id) => nameById.get(id))
          .filter((n): n is string => Boolean(n))
          .concat(guestNames);

        const message =
          teammateNames.length > 0
            ? `Tu es avec ${teammateNames.join(", ")} sur ${gameLabel}.`
            : `Ton équipe ${gameLabel} est prête.`;

        notifications.push({ userId, message });
      }
    }

    if (notifications.length === 0) return;

    await db.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: "INFO",
        channel: "IN_APP",
        status: "PENDING",
        title: "Nouvelle équipe formée",
        message: n.message,
      })),
    });

    await Promise.all(
      notifications.map((n) =>
        sendPushToUsers([n.userId], { title: "Nouvelle équipe formée", body: n.message, url }),
      ),
    );
  } catch (error) {
    await logServerError("NOTIFY_MIX_TEAMS_ERROR", error);
  }
}
