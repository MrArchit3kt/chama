import "server-only";
import { db } from "@/lib/prisma";

export type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";

/**
 * Un joueur peut gérer la file (générer, retirer un autre joueur bloqué)
 * dans exactement les mêmes conditions que le bouton "Générer" :
 * - un admin s'est désigné comme générateur -> seul lui peut agir
 * - sinon, si au moins un admin est en ligne -> personne (les admins gèrent)
 * - sinon (aucun admin en ligne, aucune désignation) -> tout joueur en file peut agir
 */
export async function canSelfServeMix(game: MixGame, userId: string): Promise<boolean> {
  const lock = await db.mixGenerationLock.findUnique({
    where: { game },
    select: { selectedUserId: true },
  });

  if (lock?.selectedUserId) {
    return lock.selectedUserId === userId;
  }

  const onlineAdminsCount = await db.user.count({
    where: {
      isOnline: true,
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
    },
  });

  return onlineAdminsCount === 0;
}

/**
 * Nom de l'admin actuellement désigné pour générer ce jeu (s'il y en a
 * un), pour personnaliser le message "un admin gère la file" affiché aux
 * joueurs. Renvoie null s'il n'y a pas de désignation explicite (aucun
 * admin en ligne, ou plusieurs admins en ligne sans sélection).
 */
export async function getMixManagingAdminName(game: MixGame): Promise<string | null> {
  const lock = await db.mixGenerationLock.findUnique({
    where: { game },
    select: { selectedUser: { select: { displayName: true } } },
  });

  return lock?.selectedUser?.displayName ?? null;
}
