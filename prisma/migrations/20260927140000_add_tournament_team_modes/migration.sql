-- CreateEnum
CREATE TYPE "ScoreTournamentTeamMode" AS ENUM ('MANUAL', 'SELF_JOIN', 'RANDOM');

-- ActivityAction: nouvelles valeurs pour la journalisation
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TOURNAMENT_STARTED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TEAM_JOINED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TEAM_LEFT';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TEAMS_RANDOMIZED';

-- AlterTable
ALTER TABLE "ScoreTournament" ADD COLUMN     "maxMembersPerTeam" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "teamCount" INTEGER,
ADD COLUMN     "teamMode" "ScoreTournamentTeamMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "ScoreTeam" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "ScoreTeamMember_teamId_userId_key" ON "ScoreTeamMember"("teamId", "userId");
