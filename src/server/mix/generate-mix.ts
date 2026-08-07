"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";

type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE";
type RocketLeagueTeamSize = "TWO" | "THREE";

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

// ✅ Routes joueur (plus les routes admin : sinon un joueur non-admin
// se fait rebondir vers /dashboard après une génération réussie)
function redirectToGame(game: MixGame, qs: string): never {
  const path =
    game === "WARZONE"
      ? "/warzone"
      : game === "WARZONE_RANKED"
        ? "/ranked"
        : game === "BO7"
          ? "/bo7"
          : "/rocket-league";

  redirect(`${path}${qs}`);
}

function gameLabel(game: MixGame) {
  switch (game) {
    case "WARZONE":
      return "Warzone";
    case "WARZONE_RANKED":
      return "Warzone Ranked";
    case "BO7":
      return "BO7";
    case "ROCKET_LEAGUE":
      return "Rocket League";
  }
}

/** Notifie les joueurs (comptes réels uniquement) que leur équipe est prête. */
async function notifyMixReady(game: MixGame, userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;

  await db.notification.createMany({
    data: uniqueIds.map((userId) => ({
      userId,
      type: "INFO",
      channel: "IN_APP",
      status: "PENDING",
      title: "Ton équipe est prête",
      message: `Le mix ${gameLabel(game)} vient d’être généré, va voir ton équipe.`,
    })),
  });
}

function shuffle<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** WARZONE / BO7 : tailles 4/3 */
function getTeamSizesFourThree(total: number): number[] | null {
  if (total < 3) return null;
  if (total === 5) return null;

  for (let teamsOf4 = Math.floor(total / 4); teamsOf4 >= 0; teamsOf4 -= 1) {
    const remainder = total - teamsOf4 * 4;
    if (remainder % 3 === 0) {
      const teamsOf3 = remainder / 3;
      return [...Array(teamsOf4).fill(4), ...Array(teamsOf3).fill(3)];
    }
  }
  return null;
}

/** WARZONE ranked: strict 3v3 */
function getTeamSizesWarzoneRanked(total: number): number[] | null {
  if (total < 3) return null;
  if (total % 3 !== 0) return null;
  return Array(total / 3).fill(3);
}

// =======================
// Rocket League ranks
// =======================
const RL_RANK_ORDER = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "CHAMPION",
  "GRAND_CHAMPION",
  "SSL",
] as const;

type RLRank = (typeof RL_RANK_ORDER)[number];

function rankIndex(rank: string): number {
  const idx = RL_RANK_ORDER.indexOf(rank as RLRank);
  return idx === -1 ? -1 : idx;
}

function isValidTeam(team: { rocketLeagueRank: string }[]): boolean {
  const indices = team
    .map((p) => rankIndex(p.rocketLeagueRank))
    .filter((x) => x >= 0);

  if (indices.length !== team.length) return false;

  const min = Math.min(...indices);
  const max = Math.max(...indices);
  return max - min <= 1;
}

function findPair(players: { key: string; rocketLeagueRank: string }[]) {
  for (let a = 0; a < players.length; a += 1) {
    for (let b = a + 1; b < players.length; b += 1) {
      const team = [players[a], players[b]];
      if (isValidTeam(team)) return team;
    }
  }
  return null;
}

function findTrio(players: { key: string; rocketLeagueRank: string }[]) {
  for (let a = 0; a < players.length; a += 1) {
    for (let b = a + 1; b < players.length; b += 1) {
      for (let c = b + 1; c < players.length; c += 1) {
        const team = [players[a], players[b], players[c]];
        if (isValidTeam(team)) return team;
      }
    }
  }
  return null;
}

/**
 * Build RL teams (strict):
 * - teamSize imposé (2 ou 3) via lock
 * - écart max de 1 tier dans une team
 * - nombre de joueurs divisible par teamSize
 */
function buildRocketLeagueTeams(
  players: { key: string; rocketLeagueRank: string }[],
  teamSize: 2 | 3,
): { key: string; rocketLeagueRank: string }[][] | null {
  const sorted = [...players].sort(
    (a, b) => rankIndex(a.rocketLeagueRank) - rankIndex(b.rocketLeagueRank),
  );

  if (sorted.some((p) => rankIndex(p.rocketLeagueRank) === -1)) return null;
  if (sorted.length % teamSize !== 0) return null;

  const teams: { key: string; rocketLeagueRank: string }[][] = [];

  let i = 0;
  while (i < sorted.length) {
    const slice = sorted.slice(i, i + teamSize);
    if (slice.length < teamSize) return null;

    const min = rankIndex(slice[0].rocketLeagueRank);
    const max = rankIndex(slice[slice.length - 1].rocketLeagueRank);

    if (max - min > 1) {
      const window = sorted.slice(i, i + teamSize + 2);
      const candidates = shuffle(window);

      const pick =
        teamSize === 2 ? findPair(candidates) : findTrio(candidates);

      if (!pick) return null;

      const pickKeys = new Set(pick.map((p) => p.key));
      const remaining = sorted.filter((p) => !pickKeys.has(p.key));

      sorted.length = 0;
      sorted.push(...remaining);

      i = 0;
      teams.length = 0;
      continue;
    }

    teams.push(slice);
    i += teamSize;
  }

  return teams;
}

function teamSizeFromLock(
  v: RocketLeagueTeamSize | null | undefined,
): 2 | 3 | null {
  if (v === "TWO") return 2;
  if (v === "THREE") return 3;
  return null;
}

/** WARZONE et BO7 partagent exactement la même logique de génération (4/3). */
async function runFourThreeMix(game: "WARZONE" | "BO7", sessionUserId: string) {
  const availabilityField =
    game === "WARZONE" ? "isAvailableForWarzoneMix" : "isAvailableForBO7Mix";

  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      [availabilityField]: true,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const tempPlayers = await db.tempPlayer.findMany({
    where: { game, isAvailableForMix: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const pool = [
    ...users.map((u) => ({ kind: "USER" as const, id: u.id })),
    ...tempPlayers.map((t) => ({ kind: "TEMP" as const, id: t.id })),
  ];

  const sizes = getTeamSizesFourThree(pool.length);
  if (!sizes) redirectToGame(game, "?error=invalid_count");

  const shuffled = shuffle(pool);

  const session = await db.mixSession.create({
    data: {
      game,
      status: "GENERATED",
      allowTeamsOfThree: true,
      keepRemainderAsBench: false,
      createdById: sessionUserId,
    },
  });

  if (shuffled.length > 0) {
    await db.mixSessionPlayer.createMany({
      data: shuffled.map((p) => ({
        sessionId: session.id,
        userId: p.kind === "USER" ? p.id : null,
        tempPlayerId: p.kind === "TEMP" ? p.id : null,
        status: "WAITING",
      })),
    });
  }

  let cursor = 0;
  const allUserIds: string[] = [];

  for (let idx = 0; idx < sizes.length; idx += 1) {
    const size = sizes[idx];
    const chunk = shuffled.slice(cursor, cursor + size);

    const team = await db.team.create({
      data: { sessionId: session.id, teamNumber: idx + 1 },
    });

    if (chunk.length > 0) {
      await db.teamMember.createMany({
        data: chunk.map((p) => ({
          teamId: team.id,
          userId: p.kind === "USER" ? p.id : null,
          tempPlayerId: p.kind === "TEMP" ? p.id : null,
        })),
      });

      const userIds = chunk.filter((p) => p.kind === "USER").map((p) => p.id);
      const tempIds = chunk.filter((p) => p.kind === "TEMP").map((p) => p.id);
      allUserIds.push(...userIds);

      if (userIds.length > 0) {
        await db.mixSessionPlayer.updateMany({
          where: { sessionId: session.id, userId: { in: userIds } },
          data: { status: "ASSIGNED", assignedAt: new Date() },
        });
      }

      if (tempIds.length > 0) {
        await db.mixSessionPlayer.updateMany({
          where: { sessionId: session.id, tempPlayerId: { in: tempIds } },
          data: { status: "ASSIGNED", assignedAt: new Date() },
        });
      }
    }

    cursor += size;
  }

  await notifyMixReady(game, allUserIds);

  redirectToGame(game, `?success=1&session=${session.id}`);
}

export async function generateMix(formData: FormData) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const game = gameFrom(formData.get("game"));
  if (!game) redirect("/dashboard");

  const onlineAdminsCount = await db.user.count({
    where: {
      isOnline: true,
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
    },
  });

  const lock = await db.mixGenerationLock.findUnique({
    where: { game },
    select: { selectedUserId: true, rocketLeagueTeamSize: true },
  });

  // Auth rules
  if (lock?.selectedUserId) {
    if (lock.selectedUserId !== sessionUser.id) {
      redirectToGame(game, "?error=locked");
    }
  } else {
    if (onlineAdminsCount > 0) {
      redirectToGame(game, "?error=no_mix_admin");
    }

    const me = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        isAvailableForWarzoneMix: true,
        isAvailableForWarzoneRankedMix: true,
        isAvailableForBO7Mix: true,
        isAvailableForRocketLeagueMix: true,
      },
    });

    const inQueue =
      game === "WARZONE"
        ? !!me?.isAvailableForWarzoneMix
        : game === "WARZONE_RANKED"
          ? !!me?.isAvailableForWarzoneRankedMix
          : game === "BO7"
            ? !!me?.isAvailableForBO7Mix
            : !!me?.isAvailableForRocketLeagueMix;

    if (!inQueue) {
      redirectToGame(game, "?error=forbidden");
    }
  }

  try {
    // =========================
    // WARZONE NORMAL & BO7 (mêmes règles 4/3)
    // =========================
    if (game === "WARZONE" || game === "BO7") {
      await runFourThreeMix(game, sessionUser.id);
    }

    // =========================
    // WARZONE RANKED (STRICT 3v3)
    // =========================
    if (game === "WARZONE_RANKED") {
      const users = await db.user.findMany({
        where: {
          status: "ACTIVE",
          registrationStatus: "APPROVED",
          isAvailableForWarzoneRankedMix: true,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      const tempPlayers = await db.tempPlayer.findMany({
        where: { game: "WARZONE_RANKED", isAvailableForMix: true },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      const pool = [
        ...users.map((u) => ({ kind: "USER" as const, id: u.id })),
        ...tempPlayers.map((t) => ({ kind: "TEMP" as const, id: t.id })),
      ];

      const sizes = getTeamSizesWarzoneRanked(pool.length);
      if (!sizes) redirectToGame(game, "?error=invalid_count"); // => pas divisible par 3

      const shuffled = shuffle(pool);

      const session = await db.mixSession.create({
        data: {
          game,
          status: "GENERATED",
          allowTeamsOfThree: true,
          keepRemainderAsBench: false,
          createdById: sessionUser.id,
        },
      });

      if (shuffled.length > 0) {
        await db.mixSessionPlayer.createMany({
          data: shuffled.map((p) => ({
            sessionId: session.id,
            userId: p.kind === "USER" ? p.id : null,
            tempPlayerId: p.kind === "TEMP" ? p.id : null,
            status: "WAITING",
          })),
        });
      }

      let cursor = 0;
      const allUserIds: string[] = [];

      for (let idx = 0; idx < sizes.length; idx += 1) {
        const chunk = shuffled.slice(cursor, cursor + 3);

        const team = await db.team.create({
          data: { sessionId: session.id, teamNumber: idx + 1 },
        });

        await db.teamMember.createMany({
          data: chunk.map((p) => ({
            teamId: team.id,
            userId: p.kind === "USER" ? p.id : null,
            tempPlayerId: p.kind === "TEMP" ? p.id : null,
          })),
        });

        const userIds = chunk.filter((p) => p.kind === "USER").map((p) => p.id);
        const tempIds = chunk.filter((p) => p.kind === "TEMP").map((p) => p.id);
        allUserIds.push(...userIds);

        if (userIds.length > 0) {
          await db.mixSessionPlayer.updateMany({
            where: { sessionId: session.id, userId: { in: userIds } },
            data: { status: "ASSIGNED", assignedAt: new Date() },
          });
        }
        if (tempIds.length > 0) {
          await db.mixSessionPlayer.updateMany({
            where: { sessionId: session.id, tempPlayerId: { in: tempIds } },
            data: { status: "ASSIGNED", assignedAt: new Date() },
          });
        }

        cursor += 3;
      }

      await notifyMixReady(game, allUserIds);

      redirectToGame(game, `?success=1&session=${session.id}`);
    }

    if (game !== "ROCKET_LEAGUE") return;

    // =========================
    // ROCKET LEAGUE (strict + invités RL inclus)
    // =========================
    const requiredTeamSize = teamSizeFromLock(lock?.rocketLeagueTeamSize);
    if (!requiredTeamSize) redirectToGame(game, "?error=no_team_size");
    const rlTeamSize = requiredTeamSize;

    const users = await db.user.findMany({
      where: {
        status: "ACTIVE",
        registrationStatus: "APPROVED",
        isAvailableForRocketLeagueMix: true,
      },
      select: { id: true, rocketLeagueRank: true },
      orderBy: { createdAt: "asc" },
    });

    const tempPlayers = await db.tempPlayer.findMany({
      where: { game: "ROCKET_LEAGUE", isAvailableForMix: true },
      select: { id: true, rocketLeagueRank: true },
      orderBy: { createdAt: "asc" },
    });

    const pool = [
      ...users.map((u) => ({
        kind: "USER" as const,
        id: u.id,
        key: `USER:${u.id}`,
        rocketLeagueRank: u.rocketLeagueRank,
      })),
      ...tempPlayers.map((t) => ({
        kind: "TEMP" as const,
        id: t.id,
        key: `TEMP:${t.id}`,
        rocketLeagueRank: t.rocketLeagueRank,
      })),
    ];

    if (pool.length < rlTeamSize) redirectToGame(game, "?error=invalid_count");
    if (pool.some((p) => !p.rocketLeagueRank)) redirectToGame(game, "?error=rank_missing");
    if (pool.length % rlTeamSize !== 0) redirectToGame(game, "?error=invalid_count");

    const teams = buildRocketLeagueTeams(
      pool.map((p) => ({ key: p.key, rocketLeagueRank: p.rocketLeagueRank! })),
      rlTeamSize,
    );
    if (!teams) redirectToGame(game, "?error=rank_gap");

    const session = await db.mixSession.create({
      data: {
        game,
        rocketLeagueTeamSize: rlTeamSize === 2 ? "TWO" : "THREE",
        status: "GENERATED",
        allowTeamsOfThree: rlTeamSize === 3,
        keepRemainderAsBench: false,
        createdById: sessionUser.id,
      },
    });

    await db.mixSessionPlayer.createMany({
      data: pool.map((p) => ({
        sessionId: session.id,
        userId: p.kind === "USER" ? p.id : null,
        tempPlayerId: p.kind === "TEMP" ? p.id : null,
        status: "WAITING",
      })),
    });

    const allUserIds: string[] = [];

    for (let idx = 0; idx < teams.length; idx += 1) {
      const team = await db.team.create({
        data: { sessionId: session.id, teamNumber: idx + 1 },
      });

      const keys = teams[idx].map((x) => x.key);
      const members = keys
        .map((k) => pool.find((p) => p.key === k))
        .filter(Boolean) as typeof pool;

      await db.teamMember.createMany({
        data: members.map((m) => ({
          teamId: team.id,
          userId: m.kind === "USER" ? m.id : null,
          tempPlayerId: m.kind === "TEMP" ? m.id : null,
        })),
      });

      const userIds = members.filter((m) => m.kind === "USER").map((m) => m.id);
      const tempIds = members.filter((m) => m.kind === "TEMP").map((m) => m.id);
      allUserIds.push(...userIds);

      if (userIds.length > 0) {
        await db.mixSessionPlayer.updateMany({
          where: { sessionId: session.id, userId: { in: userIds } },
          data: { status: "ASSIGNED", assignedAt: new Date() },
        });
      }
      if (tempIds.length > 0) {
        await db.mixSessionPlayer.updateMany({
          where: { sessionId: session.id, tempPlayerId: { in: tempIds } },
          data: { status: "ASSIGNED", assignedAt: new Date() },
        });
      }
    }

    await notifyMixReady(game, allUserIds);

    redirectToGame(game, `?success=1&session=${session.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("GENERATE_MIX_ERROR", error);
    redirectToGame(game, "?error=server");
  }
}
