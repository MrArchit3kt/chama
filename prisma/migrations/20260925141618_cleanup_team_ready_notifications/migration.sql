-- Migration purement de données (pas de changement de schéma) : la
-- notification "Ton équipe est prête" envoyée à chaque génération de mix a
-- été supprimée côté code (generate-mix.ts). On purge aussi les
-- notifications déjà envoyées avant ce changement pour qu'elles
-- n'encombrent plus /notifications.
DELETE FROM "Notification" WHERE "title" = 'Ton équipe est prête';
