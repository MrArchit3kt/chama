-- CreateEnum
CREATE TYPE "ScoreTournamentFormat" AS ENUM ('CLASSIC', 'BRACKET');

-- ActivityAction: nouvelles valeurs pour la journalisation
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BRACKET_TEAM_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_MATCH_WINNER_SET';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BRACKET_ROUND_ADVANCED';

-- AlterTable
ALTER TABLE "ScoreTournament" ADD COLUMN     "format" "ScoreTournamentFormat" NOT NULL DEFAULT 'CLASSIC';

-- CreateTable
CREATE TABLE "ScoreBracketTeam" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreBracketTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "teamAName" TEXT,
    "teamBName" TEXT,
    "winnerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreBracketTeam_tournamentId_idx" ON "ScoreBracketTeam"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreBracketTeam_tournamentId_name_key" ON "ScoreBracketTeam"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "ScoreMatch_tournamentId_round_idx" ON "ScoreMatch"("tournamentId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreMatch_tournamentId_round_position_key" ON "ScoreMatch"("tournamentId", "round", "position");

-- AddForeignKey
ALTER TABLE "ScoreBracketTeam" ADD CONSTRAINT "ScoreBracketTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ScoreTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreMatch" ADD CONSTRAINT "ScoreMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ScoreTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
