-- ActivityAction: nouvelles valeurs pour la journalisation
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BOARD_FINISHED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BOARD_REOPENED';

-- AlterTable
ALTER TABLE "ScoreBoard" ADD COLUMN     "finishedAt" TIMESTAMP(3);
