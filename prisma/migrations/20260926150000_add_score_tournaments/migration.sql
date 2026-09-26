-- ActivityAction: nouvelles valeurs pour la journalisation des tournois
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TOURNAMENT_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TOURNAMENT_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BOARD_TOURNAMENT_SET';

-- CreateTable
CREATE TABLE "ScoreTournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ScoreTournament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreTournament_createdAt_idx" ON "ScoreTournament"("createdAt");

-- AddForeignKey
ALTER TABLE "ScoreTournament" ADD CONSTRAINT "ScoreTournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ScoreBoard" ADD COLUMN "tournamentId" TEXT;

-- CreateIndex
CREATE INDEX "ScoreBoard_tournamentId_idx" ON "ScoreBoard"("tournamentId");

-- AddForeignKey
ALTER TABLE "ScoreBoard" ADD CONSTRAINT "ScoreBoard_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ScoreTournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
