import "server-only";
import { db } from "@/lib/prisma";
import { logServerError } from "@/lib/log-error";
import { sendPushToUsers } from "@/lib/push";
import { tournamentStartingSoonPush } from "@/lib/push-messages";

const REMINDER_WINDOW_MINUTES = 30;

/**
 * Cherche les tournois dont `scheduledAt` tombe dans les 30 prochaines
 * minutes et envoie le rappel push "le tournoi commence bientôt" aux
 * joueurs ayant indiqué être intéressés (sondage de participation) — pas
 * à tout le monde, pour ne pas spammer sur chaque tournoi. `startingSoonNotifiedAt`
 * empêche un double envoi si la vérification tourne plusieurs fois avant
 * le début du tournoi (appelée toutes les 5 min, voir instrumentation.ts).
 */
export async function runTournamentReminderCheck() {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000);

    const tournaments = await db.scoreTournament.findMany({
      where: {
        scheduledAt: { gte: now, lte: windowEnd },
        startingSoonNotifiedAt: null,
      },
      select: {
        id: true,
        name: true,
        scheduledAt: true,
        interests: { select: { userId: true } },
      },
    });

    let notified = 0;

    for (const tournament of tournaments) {
      const userIds = tournament.interests.map((i) => i.userId);

      if (userIds.length > 0 && tournament.scheduledAt) {
        const minutesUntilStart = Math.round(
          (tournament.scheduledAt.getTime() - now.getTime()) / 60_000,
        );

        await sendPushToUsers(userIds, {
          ...tournamentStartingSoonPush(tournament.name, minutesUntilStart),
          url: `/points/${tournament.id}`,
        });

        notified += userIds.length;
      }

      await db.scoreTournament.update({
        where: { id: tournament.id },
        data: { startingSoonNotifiedAt: now },
      });
    }

    return { tournaments: tournaments.length, notified };
  } catch (error) {
    await logServerError("TOURNAMENT_REMINDER_CHECK_ERROR", error);
    return { tournaments: 0, notified: 0 };
  }
}
