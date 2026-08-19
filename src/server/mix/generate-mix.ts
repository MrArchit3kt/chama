"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { isDiscordBotConfigured, moveGuildMemberToVoiceChannel } from "@/lib/discord";
import { logServerError } from "@/lib/log-error";
import {
  shuffle,
  getTeamSizesFourThree,
  getTeamSizesWarzoneRanked,
  buildRocketLeagueTeams,
  teamSizeFromLock,
} from "@/server/mix/mix-logic";

type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";

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
          : game === "VERSUS"
            ? "/versus"
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
    case "VERSUS":
      return "Versus";
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

/**
 * Déplace automatiquement les joueurs (comptes réels avec un Discord lié
 * via OAuth) dans le salon vocal configuré pour leur équipe. Best-effort
 * total : jamais bloquant, jamais d'erreur remontée — un mix généré doit
 * toujours réussir même si Discord est down, mal configuré, ou qu'un
 * joueur n'est pas connecté à un vocal du serveur.
 */
async function moveTeamsToDiscordVoice(game: MixGame, teamsUserIds: string[][]) {
  if (!isDiscordBotConfigured()) return;

  try {
    const allUserIds = [...new Set(teamsUserIds.flat())];
    if (allUserIds.length === 0) return;

    const [channels, users] = await Promise.all([
      db.discordVoiceChannel.findMany({
        where: { game },
        orderBy: { createdAt: "asc" },
        select: { channelId: true },
      }),
      db.user.findMany({
        where: { id: { in: allUserIds }, discordUserId: { not: null } },
        select: { id: true, discordUserId: true },
      }),
    ]);

    if (channels.length === 0) return;

    const discordIdByUserId = new Map(users.map((u) => [u.id, u.discordUserId as string]));

    const moves: Promise<boolean>[] = [];

    teamsUserIds.forEach((userIds, teamIndex) => {
      const channel = channels[teamIndex];
      if (!channel) return;

      for (const userId of userIds) {
        const discordUserId = discordIdByUserId.get(userId);
        if (discordUserId) {
          moves.push(moveGuildMemberToVoiceChannel(discordUserId, channel.channelId));
        }
      }
    });

    await Promise.allSettled(moves);
  } catch (error) {
    await logServerError("MOVE_TEAMS_TO_DISCORD_VOICE_ERROR", error);
  }
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
  const teamsUserIds: string[][] = [];

  for (let idx = 0; idx < sizes.length; idx += 1) {
    const size = sizes[idx];
    const chunk = shuffled.slice(cursor, cursor + size);

    const team = await db.team.create({
      data: { sessionId: session.id, teamNumber: idx + 1 },
    });

    if (chunk.length > 0) {
      const hostIdx = Math.floor(Math.random() * chunk.length);

      await db.teamMember.createMany({
        data: chunk.map((p, i) => ({
          teamId: team.id,
          userId: p.kind === "USER" ? p.id : null,
          tempPlayerId: p.kind === "TEMP" ? p.id : null,
          isHost: i === hostIdx,
        })),
      });

      const userIds = chunk.filter((p) => p.kind === "USER").map((p) => p.id);
      const tempIds = chunk.filter((p) => p.kind === "TEMP").map((p) => p.id);
      allUserIds.push(...userIds);
      teamsUserIds.push(userIds);

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
    } else {
      teamsUserIds.push([]);
    }

    cursor += size;
  }

  await notifyMixReady(game, allUserIds);
  await moveTeamsToDiscordVoice(game, teamsUserIds);

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
        isAvailableForVersusMix: true,
      },
    });

    const inQueue =
      game === "WARZONE"
        ? !!me?.isAvailableForWarzoneMix
        : game === "WARZONE_RANKED"
          ? !!me?.isAvailableForWarzoneRankedMix
          : game === "BO7"
            ? !!me?.isAvailableForBO7Mix
            : game === "VERSUS"
              ? !!me?.isAvailableForVersusMix
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
      const teamsUserIds: string[][] = [];

      for (let idx = 0; idx < sizes.length; idx += 1) {
        const chunk = shuffled.slice(cursor, cursor + 3);

        const team = await db.team.create({
          data: { sessionId: session.id, teamNumber: idx + 1 },
        });

        const hostIdx = Math.floor(Math.random() * chunk.length);

        await db.teamMember.createMany({
          data: chunk.map((p, i) => ({
            teamId: team.id,
            userId: p.kind === "USER" ? p.id : null,
            tempPlayerId: p.kind === "TEMP" ? p.id : null,
            isHost: i === hostIdx,
          })),
        });

        const userIds = chunk.filter((p) => p.kind === "USER").map((p) => p.id);
        const tempIds = chunk.filter((p) => p.kind === "TEMP").map((p) => p.id);
        allUserIds.push(...userIds);
        teamsUserIds.push(userIds);

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
      await moveTeamsToDiscordVoice(game, teamsUserIds);

      redirectToGame(game, `?success=1&session=${session.id}`);
    }

    // =========================
    // VERSUS (STRICT 3v3, mêmes règles que Ranked — teams contre une
    // team partenaire, file/lock/historique séparés des autres jeux)
    // =========================
    if (game === "VERSUS") {
      const users = await db.user.findMany({
        where: {
          status: "ACTIVE",
          registrationStatus: "APPROVED",
          isAvailableForVersusMix: true,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      const tempPlayers = await db.tempPlayer.findMany({
        where: { game: "VERSUS", isAvailableForMix: true },
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
      const teamsUserIds: string[][] = [];

      for (let idx = 0; idx < sizes.length; idx += 1) {
        const chunk = shuffled.slice(cursor, cursor + 3);

        const team = await db.team.create({
          data: { sessionId: session.id, teamNumber: idx + 1 },
        });

        const hostIdx = Math.floor(Math.random() * chunk.length);

        await db.teamMember.createMany({
          data: chunk.map((p, i) => ({
            teamId: team.id,
            userId: p.kind === "USER" ? p.id : null,
            tempPlayerId: p.kind === "TEMP" ? p.id : null,
            isHost: i === hostIdx,
          })),
        });

        const userIds = chunk.filter((p) => p.kind === "USER").map((p) => p.id);
        const tempIds = chunk.filter((p) => p.kind === "TEMP").map((p) => p.id);
        allUserIds.push(...userIds);
        teamsUserIds.push(userIds);

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
      await moveTeamsToDiscordVoice(game, teamsUserIds);

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
    const teamsUserIds: string[][] = [];

    for (let idx = 0; idx < teams.length; idx += 1) {
      const team = await db.team.create({
        data: { sessionId: session.id, teamNumber: idx + 1 },
      });

      const keys = teams[idx].map((x) => x.key);
      const members = keys
        .map((k) => pool.find((p) => p.key === k))
        .filter(Boolean) as typeof pool;

      const hostIdx = Math.floor(Math.random() * members.length);

      await db.teamMember.createMany({
        data: members.map((m, i) => ({
          teamId: team.id,
          userId: m.kind === "USER" ? m.id : null,
          tempPlayerId: m.kind === "TEMP" ? m.id : null,
          isHost: i === hostIdx,
        })),
      });

      const userIds = members.filter((m) => m.kind === "USER").map((m) => m.id);
      const tempIds = members.filter((m) => m.kind === "TEMP").map((m) => m.id);
      allUserIds.push(...userIds);
      teamsUserIds.push(userIds);

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
    await moveTeamsToDiscordVoice(game, teamsUserIds);

    redirectToGame(game, `?success=1&session=${session.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("GENERATE_MIX_ERROR", error);
    redirectToGame(game, "?error=server");
  }
}
