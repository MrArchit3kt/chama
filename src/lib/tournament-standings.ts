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
