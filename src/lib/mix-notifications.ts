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
 * un mix généré, avec la liste de ses coéquipiers — seulement les comptes
 * inscrits (`userIds`), les invités temporaires n'ont pas de compte pour
 * recevoir quoi que ce soit. Best-effort total : ne doit jamais faire
 * échouer la génération d'un mix si l'envoi rate.
 */
export async function notifyMixTeamsGenerated(game: string, teamsUserIds: string[][]) {
  try {
    const allUserIds = [...new Set(teamsUserIds.flat())];
    if (allUserIds.length === 0) return;

    const users = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));

    const gameLabel = GAME_LABELS[game] ?? game;
    const url = GAME_URLS[game] ?? "/dashboard";

    const notifications: { userId: string; message: string }[] = [];

    for (const userIds of teamsUserIds) {
      if (userIds.length === 0) continue;

      for (const userId of userIds) {
        const teammates = userIds
          .filter((id) => id !== userId)
          .map((id) => nameById.get(id))
          .filter((n): n is string => Boolean(n));

        const message =
          teammates.length > 0
            ? `Tu es avec ${teammates.join(", ")} sur ${gameLabel}.`
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
