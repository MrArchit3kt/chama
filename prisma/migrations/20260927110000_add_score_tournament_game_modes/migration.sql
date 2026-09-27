-- CreateTable
CREATE TABLE "_ScoreTournamentGameModes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ScoreTournamentGameModes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ScoreTournamentGameModes_B_index" ON "_ScoreTournamentGameModes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreBoard_tournamentId_gameModeId_key" ON "ScoreBoard"("tournamentId", "gameModeId");

-- AddForeignKey
ALTER TABLE "_ScoreTournamentGameModes" ADD CONSTRAINT "_ScoreTournamentGameModes_A_fkey" FOREIGN KEY ("A") REFERENCES "ScoreGameMode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScoreTournamentGameModes" ADD CONSTRAINT "_ScoreTournamentGameModes_B_fkey" FOREIGN KEY ("B") REFERENCES "ScoreTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
