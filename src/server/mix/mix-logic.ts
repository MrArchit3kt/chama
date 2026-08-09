/**
 * Logique pure de répartition des équipes de mix : aucun accès DB, aucun
 * import Next/Prisma. Isolée ici pour être testable unitairement (voir
 * mix-logic.test.ts) sans base de données ni requête HTTP — c'est la partie
 * la plus critique de l'app (une régression ici = des équipes déséquilibrées
 * ou une génération qui plante pour tout le monde).
 */

export type RocketLeagueTeamSizeLock = "TWO" | "THREE";

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** WARZONE / BO7 : équipes de 4, complétées par des équipes de 3. */
export function getTeamSizesFourThree(total: number): number[] | null {
  if (total < 3) return null;
  if (total === 5) return null;

  for (let teamsOf4 = Math.floor(total / 4); teamsOf4 >= 0; teamsOf4 -= 1) {
    const remainder = total - teamsOf4 * 4;
    if (remainder % 3 === 0) {
      const teamsOf3 = remainder / 3;
      return [...Array(teamsOf4).fill(4), ...Array(teamsOf3).fill(3)];
    }
  }
  return null;
}

/** WARZONE ranked : strictement des équipes de 3. */
export function getTeamSizesWarzoneRanked(total: number): number[] | null {
  if (total < 3) return null;
  if (total % 3 !== 0) return null;
  return Array(total / 3).fill(3);
}

// =======================
// Rocket League ranks
// =======================
export const RL_RANK_ORDER = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "CHAMPION",
  "GRAND_CHAMPION",
  "SSL",
] as const;

export type RLRank = (typeof RL_RANK_ORDER)[number];

export function rankIndex(rank: string): number {
  const idx = RL_RANK_ORDER.indexOf(rank as RLRank);
  return idx === -1 ? -1 : idx;
}

function isValidTeam(team: { rocketLeagueRank: string }[]): boolean {
  const indices = team
    .map((p) => rankIndex(p.rocketLeagueRank))
    .filter((x) => x >= 0);

  if (indices.length !== team.length) return false;

  const min = Math.min(...indices);
  const max = Math.max(...indices);
  return max - min <= 1;
}

function findPair(players: { key: string; rocketLeagueRank: string }[]) {
  for (let a = 0; a < players.length; a += 1) {
    for (let b = a + 1; b < players.length; b += 1) {
      const team = [players[a], players[b]];
      if (isValidTeam(team)) return team;
    }
  }
  return null;
}

function findTrio(players: { key: string; rocketLeagueRank: string }[]) {
  for (let a = 0; a < players.length; a += 1) {
    for (let b = a + 1; b < players.length; b += 1) {
      for (let c = b + 1; c < players.length; c += 1) {
        const team = [players[a], players[b], players[c]];
        if (isValidTeam(team)) return team;
      }
    }
  }
  return null;
}

/**
 * Construit les équipes Rocket League (strict) :
 * - taille d'équipe imposée (2 ou 3) via le lock admin
 * - écart max de 1 palier de rang dans une équipe
 * - le nombre de joueurs doit être divisible par la taille d'équipe
 */
export function buildRocketLeagueTeams(
  players: { key: string; rocketLeagueRank: string }[],
  teamSize: 2 | 3,
): { key: string; rocketLeagueRank: string }[][] | null {
  const sorted = [...players].sort(
    (a, b) => rankIndex(a.rocketLeagueRank) - rankIndex(b.rocketLeagueRank),
  );

  if (sorted.some((p) => rankIndex(p.rocketLeagueRank) === -1)) return null;
  if (sorted.length % teamSize !== 0) return null;

  const teams: { key: string; rocketLeagueRank: string }[][] = [];

  let i = 0;
  while (i < sorted.length) {
    const slice = sorted.slice(i, i + teamSize);
    if (slice.length < teamSize) return null;

    const min = rankIndex(slice[0].rocketLeagueRank);
    const max = rankIndex(slice[slice.length - 1].rocketLeagueRank);

    if (max - min > 1) {
      const window = sorted.slice(i, i + teamSize + 2);
      const candidates = shuffle(window);

      const pick = teamSize === 2 ? findPair(candidates) : findTrio(candidates);

      if (!pick) return null;

      const pickKeys = new Set(pick.map((p) => p.key));
      const remaining = sorted.filter((p) => !pickKeys.has(p.key));

      sorted.length = 0;
      sorted.push(...remaining);

      i = 0;
      teams.length = 0;
      continue;
    }

    teams.push(slice);
    i += teamSize;
  }

  return teams;
}

export function teamSizeFromLock(
  v: RocketLeagueTeamSizeLock | null | undefined,
): 2 | 3 | null {
  if (v === "TWO") return 2;
  if (v === "THREE") return 3;
  return null;
}
