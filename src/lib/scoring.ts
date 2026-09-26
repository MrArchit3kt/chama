import type { ScoreConditionMode } from "@/generated/prisma/enums";

export type ConditionTierForScoring = {
  minValue: number;
  maxValue: number | null;
  points: number;
};

export type ConditionForScoring = {
  points: number;
  mode: ScoreConditionMode;
  tiers?: ConditionTierForScoring[];
};

/**
 * Calcule les points rapportés par une entrée (`quantity` saisie par
 * l'admin) pour une condition donnée :
 * - ONE_TIME : `condition.points` si atteinte (quantity > 0), sinon 0.
 * - QUANTITY : `quantity * condition.points` (peut être négatif si
 *   `condition.points` l'est, ex: -1 pt par mort).
 * - TIERED : les points du palier dans lequel `quantity` tombe (borne max
 *   à `null` = palier illimité vers le haut). Aucun palier correspondant
 *   => 0 point.
 */
export function computeEntryPoints(quantity: number, condition: ConditionForScoring): number {
  if (condition.mode === "ONE_TIME") {
    return quantity > 0 ? condition.points : 0;
  }

  if (condition.mode === "TIERED") {
    const tier = (condition.tiers ?? []).find(
      (t) => quantity >= t.minValue && (t.maxValue === null || quantity <= t.maxValue),
    );
    return tier?.points ?? 0;
  }

  return quantity * condition.points;
}
