import "server-only";
import { db } from "@/lib/prisma";

export type MixVisibility = {
  WARZONE: boolean;
  WARZONE_RANKED: boolean;
  BO7: boolean;
  ROCKET_LEAGUE: boolean;
  VERSUS: boolean;
};

/**
 * Visibilité par jeu des onglets mix côté joueur (SiteConfig), indépendante
 * de la file d'attente/génération elle-même — sert juste à masquer un jeu
 * qu'un admin ne veut pas proposer pour l'instant (nav + accès direct à la
 * page). Les pages admin/mix/* restent toujours accessibles, désactivé ou
 * non : un admin doit pouvoir préparer un jeu avant de le réactiver.
 */
export async function getMixVisibility(): Promise<MixVisibility> {
  const config = await db.siteConfig.findUnique({
    where: { id: "main" },
    select: {
      warzoneMixEnabled: true,
      warzoneRankedMixEnabled: true,
      bo7MixEnabled: true,
      rocketLeagueMixEnabled: true,
      versusMixEnabled: true,
    },
  });

  return {
    WARZONE: config?.warzoneMixEnabled ?? true,
    WARZONE_RANKED: config?.warzoneRankedMixEnabled ?? true,
    BO7: config?.bo7MixEnabled ?? true,
    ROCKET_LEAGUE: config?.rocketLeagueMixEnabled ?? true,
    VERSUS: config?.versusMixEnabled ?? true,
  };
}

/** Associe chaque route joueur à sa clé de visibilité, pour filtrer la nav. */
export const MIX_PATH_VISIBILITY_KEY: Record<string, keyof MixVisibility> = {
  "/warzone": "WARZONE",
  "/ranked": "WARZONE_RANKED",
  "/bo7": "BO7",
  "/rocket-league": "ROCKET_LEAGUE",
  "/versus": "VERSUS",
};
