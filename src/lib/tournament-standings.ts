import { computeEntryPoints, type ConditionForScoring } from "@/lib/scoring";

type EntryLike = { quantity: number; condition: ConditionForScoring };

type TeamLike = {
  id: string;
  name: string;
  entries: EntryLike[];
  members: { entries: EntryLike[] }[];
};

type BoardLike = {
  id: string;
  title: string | null;
  createdAt: Date;
  gameMode: { name: string };
  teams: TeamLike[];
};

export type TournamentBoardBreakdown = {
  boardId: string;
  gameModeName: string;
  title: string | null;
  createdAt: Date;
  points: number;
};

export type TournamentTeamStanding = {
  key: string;
  name: string;
  total: number;
  breakdown: TournamentBoardBreakdown[];
};

/** Une équipe est réconciliée entre tableaux par son nom (normalisé, comme
 * les joueurs invités le sont par le leur) : pas de roster persistant. */
function teamKey(name: string) {
  return name.trim().toLowerCase();
}

function teamTotal(team: TeamLike): number {
  const own = team.entries.reduce((sum, e) => sum + computeEntryPoints(e.quantity, e.condition), 0);
  const fromMembers = team.members.reduce(
    (sum, m) => sum + m.entries.reduce((s, e) => s + computeEntryPoints(e.quantity, e.condition), 0),
    0,
  );
  return own + fromMembers;
}

/**
 * Cumule les points de chaque équipe sur l'ensemble des tableaux d'un
 * tournoi (potentiellement des modes de jeu différents), triés du plus
 * haut score au plus bas — le premier de la liste est l'équipe gagnante.
 */
export function computeTournamentStandings(boards: BoardLike[]): TournamentTeamStanding[] {
  const standings = new Map<string, TournamentTeamStanding>();

  for (const board of boards) {
    for (const team of board.teams) {
      const key = teamKey(team.name);
      const points = teamTotal(team);
      const current = standings.get(key) ?? { key, name: team.name, total: 0, breakdown: [] };
      current.total += points;
      current.breakdown.push({
        boardId: board.id,
        gameModeName: board.gameMode.name,
        title: board.title,
        createdAt: board.createdAt,
        points,
      });
      standings.set(key, current);
    }
  }

  return [...standings.values()].sort((a, b) => b.total - a.total);
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[rows - 1][cols - 1];
}

/**
 * Repère les paires de noms d'équipe qui se ressemblent fortement sans être
 * identiques (les identiques sont déjà fusionnées par `teamKey`) — le signe
 * typique d'une faute de frappe qui empêche silencieusement de cumuler les
 * points d'une même équipe entre deux parties du tournoi.
 */
export function findLikelyDuplicateTeamNames(
  standings: Pick<TournamentTeamStanding, "key" | "name">[],
): [string, string][] {
  const pairs: [string, string][] = [];

  for (let i = 0; i < standings.length; i++) {
    for (let j = i + 1; j < standings.length; j++) {
      const a = standings[i].key;
      const b = standings[j].key;
      const maxLen = Math.max(a.length, b.length);
      if (maxLen < 4) continue; // trop court pour que la distance soit fiable

      const distance = levenshtein(a, b);
      if (distance > 0 && distance <= 2) {
        pairs.push([standings[i].name, standings[j].name]);
      }
    }
  }

  return pairs;
}
