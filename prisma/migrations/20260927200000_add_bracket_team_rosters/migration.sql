-- ActivityAction: nouvelles valeurs pour la journalisation
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BRACKET_TEAM_MEMBER_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BRACKET_TEAM_MEMBER_REMOVED';

-- CreateTable
CREATE TABLE "ScoreBracketTeamMember" (
    "id" TEXT NOT NULL,
    "bracketTeamId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,

    CONSTRAINT "ScoreBracketTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreBracketTeamMember_bracketTeamId_idx" ON "ScoreBracketTeamMember"("bracketTeamId");

-- CreateIndex
CREATE INDEX "ScoreBracketTeamMember_userId_idx" ON "ScoreBracketTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreBracketTeamMember_bracketTeamId_userId_key" ON "ScoreBracketTeamMember"("bracketTeamId", "userId");

-- AddForeignKey
ALTER TABLE "ScoreBracketTeamMember" ADD CONSTRAINT "ScoreBracketTeamMember_bracketTeamId_fkey" FOREIGN KEY ("bracketTeamId") REFERENCES "ScoreBracketTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreBracketTeamMember" ADD CONSTRAINT "ScoreBracketTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
