import { shuffle } from "@/server/mix/mix-logic";

export type MatchSeed = {
  round: number;
  position: number;
  teamAName: string | null;
  teamBName: string | null;
  winnerName: string | null;
};

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Premier tour d'un bracket à élimination directe : mélange les équipes
 * puis les apparie. Si le nombre d'équipes n'est pas une puissance de 2,
 * complète avec des "byes" (équipe seule = qualifiée d'office pour ce
 * tour, `winnerName` renseigné immédiatement).
 */
export function generateFirstRound(teamNames: string[]): MatchSeed[] {
  const shuffled = shuffle(teamNames);
  const size = nextPowerOfTwo(shuffled.length);
  const slots: (string | null)[] = [...shuffled, ...Array(size - shuffled.length).fill(null)];

  const matches: MatchSeed[] = [];
  for (let i = 0; i < size / 2; i++) {
    const teamAName = slots[i * 2];
    const teamBName = slots[i * 2 + 1];
    // Un bye (adversaire absent) qualifie l'équipe présente d'office.
    const winnerName = teamAName && !teamBName ? teamAName : !teamAName && teamBName ? teamBName : null;

    matches.push({ round: 1, position: i, teamAName, teamBName, winnerName });
  }

  return matches;
}

/**
 * Tour suivant : apparie les vainqueurs du tour précédent dans l'ordre.
 * Suppose que tous les matchs du tour précédent ont un vainqueur (à
 * vérifier par l'appelant avant d'appeler cette fonction).
 */
export function generateNextRound(
  previousRound: { position: number; winnerName: string | null }[],
  round: number,
): MatchSeed[] {
  const winners = [...previousRound]
    .sort((a, b) => a.position - b.position)
    .map((m) => m.winnerName);

  const matches: MatchSeed[] = [];
  for (let i = 0; i < winners.length / 2; i++) {
    const teamAName = winners[i * 2] ?? null;
    const teamBName = winners[i * 2 + 1] ?? null;
    const winnerName = teamAName && !teamBName ? teamAName : !teamAName && teamBName ? teamBName : null;

    matches.push({ round, position: i, teamAName, teamBName, winnerName });
  }

  return matches;
}
