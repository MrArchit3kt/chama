-- Add BO7 as a new mix game
ALTER TYPE "MixGame" ADD VALUE 'BO7';

-- Per-user BO7 queue flag
ALTER TABLE "User" ADD COLUMN "isAvailableForBO7Mix" BOOLEAN NOT NULL DEFAULT false;

-- Index for BO7 queue lookups
CREATE INDEX "User_isAvailableForBO7Mix_idx" ON "User"("isAvailableForBO7Mix");
