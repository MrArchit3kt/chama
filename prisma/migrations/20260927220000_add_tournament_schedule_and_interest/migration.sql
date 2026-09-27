-- ActivityAction: nouvelles valeurs pour la journalisation
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TOURNAMENT_INTEREST_JOINED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TOURNAMENT_INTEREST_LEFT';

-- AlterTable
ALTER TABLE "ScoreTournament" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScoreTournamentInterest" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreTournamentInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreTournamentInterest_tournamentId_idx" ON "ScoreTournamentInterest"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreTournamentInterest_tournamentId_userId_key" ON "ScoreTournamentInterest"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "ScoreTournamentInterest" ADD CONSTRAINT "ScoreTournamentInterest_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ScoreTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreTournamentInterest" ADD CONSTRAINT "ScoreTournamentInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
