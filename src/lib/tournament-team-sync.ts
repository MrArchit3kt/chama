import "server-only";
import { db } from "@/lib/prisma";

/**
 * Recrée sur toutes les autres parties (tableaux) d'un tournoi la
 * composition actuelle des équipes d'une partie de référence — équipes
 * (identifiées par leur nom) et membres (joueurs inscrits + invités).
 * Utilisé après un tirage au sort, un rejoindre/quitter en libre-service,
 * ou à la création d'une nouvelle partie pour un tournoi qui a déjà des
 * équipes ailleurs.
 *
 * N'écrase et ne supprime jamais rien sur les autres parties (une
 * composition déjà ajustée à la main pour un jeu précis n'est pas
 * remise à zéro) : ne fait qu'ajouter les équipes/membres manquants.
 */
export async function syncTeamRosterToOtherBoards(tournamentId: string, sourceBoardId: string) {
  const sourceTeams = await db.scoreTeam.findMany({
    where: { boardId: sourceBoardId },
    select: {
      name: true,
      members: { select: { userId: true, guestName: true } },
    },
  });

  if (sourceTeams.length === 0) return;

  const otherBoards = await db.scoreBoard.findMany({
    where: { tournamentId, id: { not: sourceBoardId } },
    select: { id: true, teams: { select: { id: true, name: true } } },
  });

  for (const board of otherBoards) {
    for (const sourceTeam of sourceTeams) {
      let targetTeam = board.teams.find((t) => t.name === sourceTeam.name);
      if (!targetTeam) {
        targetTeam = await db.scoreTeam.create({ data: { boardId: board.id, name: sourceTeam.name } });
      }

      for (const member of sourceTeam.members) {
        if (member.userId) {
          await db.scoreTeamMember.upsert({
            where: { teamId_userId: { teamId: targetTeam.id, userId: member.userId } },
            update: {},
            create: { teamId: targetTeam.id, userId: member.userId },
          });
        } else if (member.guestName) {
          const exists = await db.scoreTeamMember.findFirst({
            where: { teamId: targetTeam.id, guestName: member.guestName },
            select: { id: true },
          });
          if (!exists) {
            await db.scoreTeamMember.create({
              data: { teamId: targetTeam.id, guestName: member.guestName },
            });
          }
        }
      }
    }
  }
}

/**
 * À la création d'une partie pour un tournoi : si une autre partie du
 * tournoi a déjà des équipes, en recopie la composition telle quelle sur
 * la nouvelle partie ; sinon, si `teamCount` est configuré, crée des
 * équipes vides nommées "Équipe 1".."Équipe N".
 */
export async function provisionBoardTeams(boardId: string, tournamentId: string) {
  const tournament = await db.scoreTournament.findUnique({
    where: { id: tournamentId },
    select: { teamCount: true },
  });
  if (!tournament) return;

  const referenceBoard = await db.scoreBoard.findFirst({
    where: { tournamentId, id: { not: boardId } },
    orderBy: { createdAt: "asc" },
    select: { id: true, teams: { select: { id: true } } },
  });

  if (referenceBoard && referenceBoard.teams.length > 0) {
    // `boardId` (tout neuf, sans équipe) fait partie des "autres parties"
    // du point de vue de referenceBoard : il se retrouve peuplé ici.
    await syncTeamRosterToOtherBoards(tournamentId, referenceBoard.id);
    return;
  }

  if (tournament.teamCount && tournament.teamCount > 0) {
    await db.scoreTeam.createMany({
      data: Array.from({ length: tournament.teamCount }, (_, i) => ({
        boardId,
        name: `Équipe ${i + 1}`,
      })),
    });
  }
}
