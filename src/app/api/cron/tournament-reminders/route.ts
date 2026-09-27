import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { logServerError } from "@/lib/log-error";
import { sendPushToUsers } from "@/lib/push";
import { tournamentStartingSoonPush } from "@/lib/push-messages";

export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MINUTES = 60;

/**
 * À appeler périodiquement (ex : crontab VPS toutes les 5 min) pour
 * envoyer le rappel push "le tournoi commence bientôt". Protégé par un
 * secret partagé (`CRON_SECRET`) plutôt que par une session admin — ce
 * n'est pas un humain qui appelle cette route.
 *
 * Fenêtre : tournois dont `scheduledAt` tombe dans l'heure à venir et qui
 * n'ont pas encore été rappelés (`startingSoonNotifiedAt`). Ciblage : les
 * joueurs ayant indiqué être intéressés (sondage de participation) — pas
 * tout le monde, pour ne pas spammer sur chaque tournoi.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 501 });
  }

  const provided =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");

  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

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

    return NextResponse.json({ ok: true, tournaments: tournaments.length, notified });
  } catch (error) {
    await logServerError("TOURNAMENT_REMINDER_CRON_ERROR", error);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
