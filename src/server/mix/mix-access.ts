import "server-only";
import { db } from "@/lib/prisma";

export type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE";

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
