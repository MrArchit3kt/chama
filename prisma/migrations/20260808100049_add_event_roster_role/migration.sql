-- CreateEnum
CREATE TYPE "EventRosterRole" AS ENUM ('TITULAIRE', 'REMPLACANT');

-- AlterTable
ALTER TABLE "EventParticipant" ADD COLUMN     "rosterRole" "EventRosterRole";
