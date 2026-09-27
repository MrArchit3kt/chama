import { shuffle } from "@/server/mix/mix-logic";

export type PairedMatch = {
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
 * Apparie une liste d'équipes deux à deux. Complète avec des "byes" si le
 * nombre n'est pas une puissance de 2 (une équipe seule sur une paire est
 * qualifiée d'office, `winnerName` renseigné immédiatement).
 *
 * `shuffleFirst` mélange l'ordre avant d'apparier (utilisé au 1er tour et
 * à chaque nouveau tour du bracket des perdants, pour ne pas figer de
 * schéma prévisible) ; à `false`, préserve l'ordre reçu (utilisé pour les
 * tours suivants du bracket gagnants, où l'ordre = la progression du
 * bracket doit être conservée).
 */
export function pairTeams(names: string[], shuffleFirst: boolean): PairedMatch[] {
  const list = shuffleFirst ? shuffle(names) : names;
  const size = nextPowerOfTwo(list.length);
  const slots: (string | null)[] = [...list, ...Array(size - list.length).fill(null)];

  const matches: PairedMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    const teamAName = slots[i * 2] ?? null;
    const teamBName = slots[i * 2 + 1] ?? null;
    const winnerName = teamAName && !teamBName ? teamAName : !teamAName && teamBName ? teamBName : null;

    matches.push({ teamAName, teamBName, winnerName });
  }

  return matches;
}

export type MatchLike = {
  id: string;
  bracketType: "WINNERS" | "LOSERS" | "GRAND_FINAL";
  round: number;
  position: number;
  teamAName: string | null;
  teamBName: string | null;
  winnerName: string | null;
  lbSeeded: boolean;
};

/** Regroupe les matchs d'un bracket (WINNERS ou LOSERS) par tour, triés. */
export function groupRounds<T extends MatchLike>(matches: T[], bracketType: "WINNERS" | "LOSERS") {
  const filtered = matches.filter((m) => m.bracketType === bracketType);
  const rounds = [...new Set(filtered.map((m) => m.round))].sort((a, b) => a - b);
  return rounds.map((round) => ({
    round,
    matches: filtered.filter((m) => m.round === round).sort((a, b) => a.position - b.position),
  }));
}

/** État dérivé d'un bracket à double élimination : champion (s'il y en a
 * un), et si un nouveau tour / la grande finale peut être généré·e. */
export function getBracketState<T extends MatchLike>(matches: T[]) {
  const wb = matches.filter((m) => m.bracketType === "WINNERS");
  const lb = matches.filter((m) => m.bracketType === "LOSERS");
  const gf = matches.find((m) => m.bracketType === "GRAND_FINAL") ?? null;

  const latestWBRound = wb.length ? Math.max(...wb.map((m) => m.round)) : 0;
  const latestWBMatches = wb.filter((m) => m.round === latestWBRound);
  const wbDone = latestWBMatches.length === 1;
  const wbChampion = wbDone ? latestWBMatches[0].winnerName : null;

  const lbExists = lb.length > 0;
  const latestLBRound = lbExists ? Math.max(...lb.map((m) => m.round)) : 0;
  const latestLBMatches = lbExists ? lb.filter((m) => m.round === latestLBRound) : [];
  const lbDone = lbExists && latestLBMatches.length === 1;
  const lbChampion = lbDone ? latestLBMatches[0].winnerName : null;

  const unseededCount = wb.filter((m) => m.winnerName && m.teamAName && m.teamBName && !m.lbSeeded).length;

  const champion = gf?.winnerName ?? (wbDone && !lbExists && unseededCount === 0 ? wbChampion : null);

  const canAdvance =
    !gf &&
    latestWBMatches.every((m) => m.winnerName) &&
    (!lbExists || latestLBMatches.every((m) => m.winnerName)) &&
    !(wbDone && !lbExists && unseededCount === 0);

  return { wbChampion, lbChampion, champion, canAdvance, gf, latestWBRound, latestLBRound };
}
