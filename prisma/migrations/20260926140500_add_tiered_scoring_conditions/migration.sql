-- ActivityAction: nouvelles valeurs pour la journalisation des paliers
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TIER_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TIER_DELETED';

-- ScoreConditionMode: nouveau mode "par paliers"
ALTER TYPE "ScoreConditionMode" ADD VALUE 'TIERED';

-- CreateTable
CREATE TABLE "ScoreConditionTier" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL,
    "maxValue" INTEGER,
    "points" INTEGER NOT NULL,

    CONSTRAINT "ScoreConditionTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreConditionTier_conditionId_idx" ON "ScoreConditionTier"("conditionId");

-- AddForeignKey
ALTER TABLE "ScoreConditionTier" ADD CONSTRAINT "ScoreConditionTier_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ScoreCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
