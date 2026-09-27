-- CreateEnum
CREATE TYPE "ScoreMatchBracketType" AS ENUM ('WINNERS', 'LOSERS', 'GRAND_FINAL');

-- DropIndex
DROP INDEX "ScoreMatch_tournamentId_round_idx";

-- DropIndex
DROP INDEX "ScoreMatch_tournamentId_round_position_key";

-- AlterTable
ALTER TABLE "ScoreMatch" ADD COLUMN     "bracketType" "ScoreMatchBracketType" NOT NULL DEFAULT 'WINNERS',
ADD COLUMN     "lbSeeded" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ScoreMatch_tournamentId_bracketType_round_idx" ON "ScoreMatch"("tournamentId", "bracketType", "round");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreMatch_tournamentId_bracketType_round_position_key" ON "ScoreMatch"("tournamentId", "bracketType", "round", "position");
