import "server-only";
import { db } from "@/lib/prisma";
import type { MixVisibility } from "@/lib/nav-links";

export type { MixVisibility };

/**
 * Visibilité par jeu des onglets mix côté joueur (SiteConfig), indépendante
 * de la file d'attente/génération elle-même — sert juste à masquer un jeu
 * qu'un admin ne veut pas proposer pour l'instant (nav + accès direct à la
 * page). Les pages admin/mix/* restent toujours accessibles, désactivé ou
 * non : un admin doit pouvoir préparer un jeu avant de le réactiver.
 *
 * ⚠️ Ce module est "server-only" (accès DB) — la map de routes
 * MIX_PATH_VISIBILITY_KEY vit dans nav-links.ts (pas de restriction) pour
 * rester importable depuis MobileNav, qui est un composant client.
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
