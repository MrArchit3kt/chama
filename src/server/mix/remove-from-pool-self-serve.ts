"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { canSelfServeMix, type MixGame } from "@/server/mix/mix-access";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function gameFrom(v: unknown): MixGame | null {
  if (typeof v !== "string") return null;
  const g = v.trim().toUpperCase();
  if (g === "WARZONE" || g === "WARZONE_RANKED" || g === "BO7" || g === "ROCKET_LEAGUE") {
    return g as MixGame;
  }
  return null;
}

function backTo(game: MixGame) {
  if (game === "WARZONE") return "/warzone";
  if (game === "WARZONE_RANKED") return "/ranked";
  if (game === "BO7") return "/bo7";
  return "/rocket-league";
}

function availabilityField(game: MixGame) {
  if (game === "WARZONE") return "isAvailableForWarzoneMix" as const;
  if (game === "WARZONE_RANKED") return "isAvailableForWarzoneRankedMix" as const;
  if (game === "BO7") return "isAvailableForBO7Mix" as const;
  return "isAvailableForRocketLeagueMix" as const;
}

/**
 * Permet à un joueur de la file de retirer un autre joueur (ou un invité)
 * bloqué dans le pool, uniquement quand aucun admin ne gère la génération
 * (mêmes conditions que le bouton "Générer" côté joueur).
 */
export async function removePlayerFromPoolSelfServe(formData: FormData) {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const game = gameFrom(formData.get("game"));
  if (!game) redirect("/dashboard");

  const allowed = await canSelfServeMix(game, user.id);
  if (!allowed) redirect(`${backTo(game)}?error=pool_forbidden`);

  const userId = String(formData.get("userId") ?? "").trim();
  const tempPlayerId = String(formData.get("tempPlayerId") ?? "").trim();

  if (!userId && !tempPlayerId) redirect(`${backTo(game)}?error=server`);

  try {
    if (userId) {
      const field = availabilityField(game);
      await db.user.update({
        where: { id: userId },
        data: { [field]: false },
      });
    } else {
      const res = await db.tempPlayer.updateMany({
        where: { id: tempPlayerId, game },
        data: { isAvailableForMix: false },
      });

      if (res.count === 0) redirect(`${backTo(game)}?error=server`);
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("REMOVE_FROM_POOL_SELF_SERVE_ERROR", error);
    redirect(`${backTo(game)}?error=server`);
  }

  redirect(`${backTo(game)}?removed=1`);
}
