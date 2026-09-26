-- Nouvelles actions du journal d'activité pour le système de points
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_GAME_MODE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_CONDITION_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_CONDITION_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BOARD_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_ENTRY_UPDATED';

-- CreateEnum
CREATE TYPE "ScoreConditionMode" AS ENUM ('QUANTITY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "ScoreConditionTarget" AS ENUM ('TEAM', 'PLAYER');

-- CreateTable
CREATE TABLE "ScoreGameMode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreGameMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreCondition" (
    "id" TEXT NOT NULL,
    "gameModeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "mode" "ScoreConditionMode" NOT NULL DEFAULT 'ONE_TIME',
    "appliesTo" "ScoreConditionTarget" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreBoard" (
    "id" TEXT NOT NULL,
    "gameModeId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ScoreBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreTeam" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ScoreTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,

    CONSTRAINT "ScoreTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEntry" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "teamId" TEXT,
    "teamMemberId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreGameMode_name_key" ON "ScoreGameMode"("name");

-- CreateIndex
CREATE INDEX "ScoreGameMode_isActive_idx" ON "ScoreGameMode"("isActive");

-- CreateIndex
CREATE INDEX "ScoreCondition_gameModeId_idx" ON "ScoreCondition"("gameModeId");

-- CreateIndex
CREATE INDEX "ScoreBoard_gameModeId_createdAt_idx" ON "ScoreBoard"("gameModeId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreTeam_boardId_idx" ON "ScoreTeam"("boardId");

-- CreateIndex
CREATE INDEX "ScoreTeamMember_teamId_idx" ON "ScoreTeamMember"("teamId");

-- CreateIndex
CREATE INDEX "ScoreTeamMember_userId_idx" ON "ScoreTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_conditionId_teamId_key" ON "ScoreEntry"("conditionId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_conditionId_teamMemberId_key" ON "ScoreEntry"("conditionId", "teamMemberId");

-- CreateIndex
CREATE INDEX "ScoreEntry_conditionId_idx" ON "ScoreEntry"("conditionId");

-- AddForeignKey
ALTER TABLE "ScoreCondition" ADD CONSTRAINT "ScoreCondition_gameModeId_fkey" FOREIGN KEY ("gameModeId") REFERENCES "ScoreGameMode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreBoard" ADD CONSTRAINT "ScoreBoard_gameModeId_fkey" FOREIGN KEY ("gameModeId") REFERENCES "ScoreGameMode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreBoard" ADD CONSTRAINT "ScoreBoard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreTeam" ADD CONSTRAINT "ScoreTeam_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ScoreBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreTeamMember" ADD CONSTRAINT "ScoreTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ScoreTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreTeamMember" ADD CONSTRAINT "ScoreTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ScoreCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ScoreTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "ScoreTeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
