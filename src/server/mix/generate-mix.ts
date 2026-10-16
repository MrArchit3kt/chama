"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { isDiscordBotConfigured, moveGuildMemberToVoiceChannel } from "@/lib/discord";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { notifyMixTeamsGenerated, GAME_LABELS } from "@/lib/mix-notifications";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { sendPushToUsers } from "@/lib/push";
import {
  shuffle,
  getTeamSizesFourThree,
  getTeamSizesWarzoneRanked,
  getTeamSizesVersus,
  buildRocketLeagueTeams,
  teamSizeFromLock,
  versusTeamSizeFromLock,
} from "@/server/mix/mix-logic";

type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";

// ✅ Anti "reroll" : empêche de régénérer un mix en boucle jusqu'à tomber
// sur la répartition voulue. Un SUPER_ADMIN n'est jamais concerné (voir
// generateMix) — un simple ADMIN l'est comme n'importe quel joueur. Durée
// réglable dans /admin/settings (SiteConfig.mixRegenerateCooldownMinutes),
// repli sur 20 min si la config n'existe pas encore.
const DEFAULT_REGENERATE_COOLDOWN_MINUTES = 20;

// ✅ Seuil (fixe, pas réglable) pour l'alerte super admin "régénération
// rapprochée" — distinct du délai anti-reroll lui-même : ne peut se
// produire que si ce délai a été contourné (SUPER_ADMIN, ou ADMIN avec
// mix.regenerate_bypass + nouveau joueur), donc toujours potentiellement
// à examiner, même si légitime.
const RAPID_REGENERATION_ALERT_MINUTES = 5;

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

/** Pool actuellement en file (inscrits + invités) pour un jeu donné. */
async function getCurrentPoolIds(game: MixGame): Promise<{ userIds: string[]; tempIds: string[] }> {
  const userWhere =
    game === "WARZONE"
      ? { isAvailableForWarzoneMix: true }
      : game === "WARZONE_RANKED"
        ? { isAvailableForWarzoneRankedMix: true }
        : game === "BO7"
          ? { isAvailableForBO7Mix: true }
          : game === "ROCKET_LEAGUE"
            ? { isAvailableForRocketLeagueMix: true }
            : { isAvailableForVersusMix: true };

  const [users, tempPlayers] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED", ...userWhere },
      select: { id: true },
    }),
    db.tempPlayer.findMany({ where: { game, isAvailableForMix: true }, select: { id: true } }),
  ]);

  return { userIds: users.map((u) => u.id), tempIds: tempPlayers.map((t) => t.id) };
}

/**
 * True si au moins un joueur (inscrit ou invité) actuellement en file ne
 * faisait PAS partie du mix généré par `sessionId` — condition du bypass
 * mix.regenerate_bypass : seul un vrai nouvel arrivant justifie de
 * regénérer avant la fin du délai anti-reroll, pas juste retenter sa
 * chance avec le même groupe.
 */
async function hasNewPlayerSinceSession(game: MixGame, sessionId: string): Promise<boolean> {
  const [{ userIds, tempIds }, sessionPlayers] = await Promise.all([
    getCurrentPoolIds(game),
    db.mixSessionPlayer.findMany({
      where: { sessionId },
      select: { userId: true, tempPlayerId: true },
    }),
  ]);

  const pastUserIds = new Set(
    sessionPlayers.map((p) => p.userId).filter((id): id is string => Boolean(id)),
  );
  const pastTempIds = new Set(
    sessionPlayers.map((p) => p.tempPlayerId).filter((id): id is string => Boolean(id)),
  );

  return userIds.some((id) => !pastUserIds.has(id)) || tempIds.some((id) => !pastTempIds.has(id));
}

/**
 * Alerte (push + in-app) tous les SUPER_ADMIN quand un mix est régénéré
 * moins de RAPID_REGENERATION_ALERT_MINUTES après le précédent — ne peut
 * arriver que si le délai anti-reroll a été contourné, donc toujours
 * potentiellement à examiner. Best-effort : ne doit jamais faire échouer
 * la génération elle-même.
 */
async function notifyRapidRegeneration(
  game: MixGame,
  actor: { name: string; username: string; role: string },
  minutesSincePrevious: number,
) {
  try {
    const superAdmins = await db.user.findMany({
      where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    if (superAdmins.length === 0) return;

    const gameLabel = GAME_LABELS[game] ?? game;
    const roleLabel = actor.role === "SUPER_ADMIN" ? "Super admin" : "Admin";
    const whenLabel = minutesSincePrevious <= 0 ? "moins d’1 min" : `${minutesSincePrevious} min`;
    const message = `${roleLabel} ${actor.name} (@${actor.username}) a regénéré le mix ${gameLabel} ${whenLabel} après la précédente génération — vérifie si c’est légitime.`;

    await db.notification.createMany({
      data: superAdmins.map((sa) => ({
        userId: sa.id,
        type: "INFO",
        channel: "IN_APP",
        status: "PENDING",
        title: "⚠️ Régénération de mix rapprochée",
        message,
      })),
    });

    await sendPushToUsers(
      superAdmins.map((sa) => sa.id),
      { title: "⚠️ Régénération de mix rapprochée", body: message, url: "/admin/activity" },
    );
  } catch (error) {
    await logServerError("MIX_RAPID_REGEN_ALERT_ERROR", error);
  }
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
async function runFourThreeMix(
  game: "WARZONE" | "BO7",
  sessionUser: { id: string; name: string; username: string; role: string },
  isRapidRegeneration: boolean,
  minutesSincePrevious: number,
) {
  const sessionUserId = sessionUser.id;
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
  const teamsUserIds: string[][] = [];
  const teamsTempIds: string[][] = [];

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
      teamsUserIds.push(userIds);
      teamsTempIds.push(tempIds);

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
      teamsTempIds.push([]);
    }

    cursor += size;
  }

  await moveTeamsToDiscordVoice(game, teamsUserIds);
  await notifyMixTeamsGenerated(game, teamsUserIds, teamsTempIds);
  if (isRapidRegeneration) {
    await notifyRapidRegeneration(game, sessionUser, minutesSincePrevious);
  }

  await logActivity({
    action: "MIX_GENERATED",
    actorId: sessionUser.id,
    actorLabel: `${sessionUser.name} (@${sessionUser.username})`,
    metadata: { game, sessionId: session.id, teamCount: teamsUserIds.length },
  });

  redirectToGame(game, `?success=1&session=${session.id}`);
}

export async function generateMix(formData: FormData) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const game = gameFrom(formData.get("game"));
  if (!game) redirect("/dashboard");

  // ✅ Lu pour TOUT le monde, SUPER_ADMIN compris : sert à la fois à
  // l'application du délai (non-SUPER_ADMIN seulement, voir plus bas) et
  // à l'alerte de régénération rapprochée ci-dessous, qui elle doit au
  // contraire surveiller en priorité les cas qui CONTOURNENT le délai
  // (SUPER_ADMIN toujours, ADMIN avec permission + nouveau joueur).
  const lastSession = await db.mixSession.findFirst({
    where: { game },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  const elapsedSinceLastMs = lastSession ? Date.now() - lastSession.createdAt.getTime() : null;

  if (sessionUser.role !== "SUPER_ADMIN" && lastSession && elapsedSinceLastMs !== null) {
    const siteConfig = await db.siteConfig.findUnique({
      where: { id: "main" },
      select: { mixRegenerateCooldownMinutes: true },
    });
    const cooldownMinutes =
      siteConfig?.mixRegenerateCooldownMinutes ?? DEFAULT_REGENERATE_COOLDOWN_MINUTES;
    const cooldownMs = cooldownMinutes * 60_000;

    if (elapsedSinceLastMs < cooldownMs) {
      // ✅ Un ADMIN avec la permission mix.regenerate_bypass peut quand
      // même regénérer avant la fin du délai, mais UNIQUEMENT si un
      // joueur a rejoint la file depuis la dernière génération — sinon
      // ça reviendrait à autoriser un reroll pour le même groupe.
      const hasBypassPermission = hasAdminPermission(
        sessionUser.role,
        sessionUser.adminPermissions,
        "mix.regenerate_bypass",
      );
      const canBypass =
        hasBypassPermission && (await hasNewPlayerSinceSession(game, lastSession.id));

      if (!canBypass) {
        const minutesLeft = Math.ceil((cooldownMs - elapsedSinceLastMs) / 60_000);
        redirectToGame(game, `?error=cooldown&wait=${minutesLeft}`);
      }
    }
  }

  // ✅ Alerte super admin : une régénération a quand même eu lieu (délai
  // contourné ou désactivé) moins de 5 min après la précédente — à
  // examiner après coup, voir notifyRapidRegeneration plus bas.
  const isRapidRegeneration =
    elapsedSinceLastMs !== null && elapsedSinceLastMs < RAPID_REGENERATION_ALERT_MINUTES * 60_000;
  const minutesSincePrevious = elapsedSinceLastMs !== null ? Math.floor(elapsedSinceLastMs / 60_000) : 0;

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
    select: { selectedUserId: true, rocketLeagueTeamSize: true, versusTeamSize: true },
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
      await runFourThreeMix(game, sessionUser, isRapidRegeneration, minutesSincePrevious);
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
      const teamsUserIds: string[][] = [];
      const teamsTempIds: string[][] = [];

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
        teamsUserIds.push(userIds);
        teamsTempIds.push(tempIds);

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

      await moveTeamsToDiscordVoice(game, teamsUserIds);
      await notifyMixTeamsGenerated(game, teamsUserIds, teamsTempIds);
      if (isRapidRegeneration) {
        await notifyRapidRegeneration(game, sessionUser, minutesSincePrevious);
      }

      await logActivity({
        action: "MIX_GENERATED",
        actorId: sessionUser.id,
        actorLabel: `${sessionUser.name} (@${sessionUser.username})`,
        metadata: { game, sessionId: session.id, teamCount: teamsUserIds.length },
      });

      redirectToGame(game, `?success=1&session=${session.id}`);
    }

    // =========================
    // VERSUS (STRICT, format 2v2/3v3/4v4 choisi par un admin — teams
    // contre une team partenaire, file/lock/historique séparés des
    // autres jeux)
    // =========================
    if (game === "VERSUS") {
      const versusTeamSize = versusTeamSizeFromLock(lock?.versusTeamSize);
      if (!versusTeamSize) redirectToGame(game, "?error=no_team_size");

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

      const sizes = getTeamSizesVersus(pool.length, versusTeamSize);
      if (!sizes) redirectToGame(game, "?error=invalid_count"); // => pas divisible par le format choisi

      const shuffled = shuffle(pool);

      const session = await db.mixSession.create({
        data: {
          game,
          status: "GENERATED",
          allowTeamsOfThree: false,
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
      const teamsUserIds: string[][] = [];
      const teamsTempIds: string[][] = [];

      for (let idx = 0; idx < sizes.length; idx += 1) {
        const chunk = shuffled.slice(cursor, cursor + versusTeamSize);

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
        teamsUserIds.push(userIds);
        teamsTempIds.push(tempIds);

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

        cursor += versusTeamSize;
      }

      await moveTeamsToDiscordVoice(game, teamsUserIds);
      await notifyMixTeamsGenerated(game, teamsUserIds, teamsTempIds);
      if (isRapidRegeneration) {
        await notifyRapidRegeneration(game, sessionUser, minutesSincePrevious);
      }

      await logActivity({
        action: "MIX_GENERATED",
        actorId: sessionUser.id,
        actorLabel: `${sessionUser.name} (@${sessionUser.username})`,
        metadata: { game, sessionId: session.id, teamCount: teamsUserIds.length },
      });

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

    const teamsUserIds: string[][] = [];
    const teamsTempIds: string[][] = [];

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
      teamsUserIds.push(userIds);
      teamsTempIds.push(tempIds);

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

    await moveTeamsToDiscordVoice(game, teamsUserIds);
    await notifyMixTeamsGenerated(game, teamsUserIds, teamsTempIds);
    if (isRapidRegeneration) {
      await notifyRapidRegeneration(game, sessionUser, minutesSincePrevious);
    }

    await logActivity({
      action: "MIX_GENERATED",
      actorId: sessionUser.id,
      actorLabel: `${sessionUser.name} (@${sessionUser.username})`,
      metadata: { game, sessionId: session.id, teamCount: teamsUserIds.length },
    });

    redirectToGame(game, `?success=1&session=${session.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("GENERATE_MIX_ERROR", error);
    redirectToGame(game, "?error=server");
  }
}
