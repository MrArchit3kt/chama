-- Add VERSUS as a new mix game (partner-team scrims, same rules as Ranked)
ALTER TYPE "MixGame" ADD VALUE 'VERSUS';

-- Per-user Versus queue flag
ALTER TABLE "User" ADD COLUMN "isAvailableForVersusMix" BOOLEAN NOT NULL DEFAULT false;

-- Index for Versus queue lookups
CREATE INDEX "User_isAvailableForVersusMix_idx" ON "User"("isAvailableForVersusMix");

-- "Compte validé" welcome pop-up: null = not seen yet
ALTER TABLE "User" ADD COLUMN "approvalWelcomeSeenAt" TIMESTAMP(3);

-- Backfill: accounts already approved before this feature shipped should
-- not suddenly see the pop-up on their next login.
UPDATE "User" SET "approvalWelcomeSeenAt" = now() WHERE "registrationStatus" = 'APPROVED';
