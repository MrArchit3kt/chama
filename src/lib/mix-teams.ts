type TeamWithMembers = {
  members: { userId: string | null }[];
};

/**
 * Trie une liste d'équipes en mettant en premier celle(s) où figure
 * l'utilisateur courant, sans changer l'ordre relatif du reste.
 */
export function sortTeamsMineFirst<T extends TeamWithMembers>(
  teams: T[],
  userId: string,
): T[] {
  const mine: T[] = [];
  const others: T[] = [];

  for (const team of teams) {
    const isMine = team.members.some((m) => m.userId === userId);
    if (isMine) mine.push(team);
    else others.push(team);
  }

  return [...mine, ...others];
}
