import { NextResponse } from "next/server";
import { runTournamentReminderCheck } from "@/lib/tournament-reminders";

export const dynamic = "force-dynamic";

/**
 * Déclenchement manuel/externe du rappel "le tournoi commence bientôt" —
 * en temps normal ce n'est PAS nécessaire : instrumentation.ts fait
 * tourner la même vérification toutes les 5 min directement dans le
 * process du site (PM2 le garde en vie). Cette route reste utile pour
 * forcer une vérification immédiate, ou si le site est un jour déployé
 * dans un environnement qui ne garde pas de process persistant.
 *
 * Protégée par un secret partagé (`CRON_SECRET`) plutôt qu'une session
 * admin — ce n'est pas un humain qui appelle cette route.
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

  const result = await runTournamentReminderCheck();
  return NextResponse.json({ ok: true, ...result });
}
