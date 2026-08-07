-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chamaWelcomeSeenAt" TIMESTAMP(3);

-- DataMigration: les membres CHAMA déjà existants ne doivent pas se prendre
-- le pop-up de bienvenue au prochain login, seuls les nouveaux passages
-- isChamaMember=false -> true après cette migration doivent le déclencher.
UPDATE "User" SET "chamaWelcomeSeenAt" = now() WHERE "isChamaMember" = true;
