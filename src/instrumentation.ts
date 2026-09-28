/**
 * Next.js appelle `register()` une fois au démarrage du serveur. Le site
 * tourne en process persistant sous PM2 (une seule instance, voir
 * ecosystem.config.js) — un simple `setInterval` suffit donc pour les
 * tâches périodiques légères, pas besoin de crontab externe ni de worker
 * séparé. Si le site passait un jour en plusieurs instances PM2 (mode
 * cluster) ou en serverless, cette vérification tournerait en double —
 * pas grave ici (l'action est idempotente via `startingSoonNotifiedAt`),
 * mais à garder en tête.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runTournamentReminderCheck } = await import("@/lib/tournament-reminders");

  // Une vérification immédiate au démarrage (couvre le cas d'un redémarrage
  // du site juste avant un tournoi), puis toutes les 5 minutes.
  void runTournamentReminderCheck();
  setInterval(() => {
    void runTournamentReminderCheck();
  }, 5 * 60_000);

  // Archivage du classement mensuel (/classement, glissant sur le mois en
  // cours) — pas besoin d'une granularité fine, une vérification par heure
  // suffit largement pour ne pas rater le passage au mois suivant.
  const { archiveMonthlyRankingIfNeeded } = await import("@/lib/monthly-ranking-archive");
  void archiveMonthlyRankingIfNeeded();
  setInterval(
    () => {
      void archiveMonthlyRankingIfNeeded();
    },
    60 * 60_000,
  );
}
