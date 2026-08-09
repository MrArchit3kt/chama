-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('WIN', 'LOSS');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "result" "MatchResult";

-- CreateIndex
CREATE INDEX "Team_result_idx" ON "Team"("result");
