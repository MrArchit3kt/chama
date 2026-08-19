"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";
type RLTeamSize = "TWO" | "THREE";

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
  if (
    g === "WARZONE" ||
    g === "WARZONE_RANKED" ||
    g === "BO7" ||
    g === "ROCKET_LEAGUE" ||
    g === "VERSUS"
  ) {
    return g as MixGame;
  }
  return null;
}

function rlTeamSizeFrom(v: unknown): RLTeamSize | null {
  if (typeof v !== "string") return null;
  const x = v.trim().toUpperCase();
  if (x === "TWO" || x === "THREE") return x as RLTeamSize;
  return null;
}

function redirectTo(game: MixGame, qs: string): never {
  const backTo =
    game === "WARZONE"
      ? "/admin/mix/warzone"
      : game === "WARZONE_RANKED"
        ? "/admin/mix/warzone-ranked"
        : game === "BO7"
          ? "/admin/mix/bo7"
          : game === "VERSUS"
            ? "/admin/mix/versus"
            : "/admin/mix/rocket-league";

  redirect(`${backTo}${qs}`);
}

export async function setMixGenerator(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const game = gameFrom(formData.get("game")) ?? "WARZONE";
  const selectedAdminId = String(formData.get("selectedAdminId") ?? "").trim();

  // RL uniquement
  const rlTeamSize = game === "ROCKET_LEAGUE" ? rlTeamSizeFrom(formData.get("rlTeamSize")) : null;

  try {
    // ✅ CLEAR sélection
    if (!selectedAdminId) {
      await db.mixGenerationLock.upsert({
        where: { game },
        create: {
          game,
          selectedUserId: null,
          rocketLeagueTeamSize: game === "ROCKET_LEAGUE" ? (rlTeamSize ?? null) : null,
        },
        update: {
          selectedUserId: null,
          ...(game === "ROCKET_LEAGUE" ? { rocketLeagueTeamSize: rlTeamSize ?? null } : {}),
        },
      });

      redirectTo(game, "?lock_cleared=1");
    }

    const selectedAdmin = await db.user.findUnique({
      where: { id: selectedAdminId },
      select: { id: true, role: true, status: true, registrationStatus: true },
    });

    if (!selectedAdmin) redirectTo(game, "?error=server");

    const isAllowedRole =
      selectedAdmin.role === "ADMIN" || selectedAdmin.role === "SUPER_ADMIN";

    if (
      !isAllowedRole ||
      selectedAdmin.status !== "ACTIVE" ||
      selectedAdmin.registrationStatus !== "APPROVED"
    ) {
      redirectTo(game, "?error=server");
    }

    // ✅ RL : exige le choix 2v2/3v3 quand on enregistre
    if (game === "ROCKET_LEAGUE" && !rlTeamSize) {
      redirectTo(game, "?error=no_team_size");
    }

    await db.mixGenerationLock.upsert({
      where: { game },
      create: {
        game,
        selectedUserId: selectedAdmin.id,
        rocketLeagueTeamSize: game === "ROCKET_LEAGUE" ? rlTeamSize : null,
      },
      update: {
        selectedUserId: selectedAdmin.id,
        ...(game === "ROCKET_LEAGUE" ? { rocketLeagueTeamSize: rlTeamSize } : {}),
      },
    });

    redirectTo(game, "?lock_set=1");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("SET_MIX_GENERATOR_ERROR", error);
    redirectTo(game, "?error=server");
  }
}