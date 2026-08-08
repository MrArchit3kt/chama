import "server-only";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

function getSiteUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function getDiscordRedirectUri(): string {
  return `${getSiteUrl()}/api/discord/callback`;
}

export function isDiscordOAuthConfigured(): boolean {
  return Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
}

export function isDiscordBotConfigured(): boolean {
  return Boolean(DISCORD_BOT_TOKEN && DISCORD_GUILD_ID);
}

export function getDiscordAuthorizeUrl(state: string): string | null {
  if (!DISCORD_CLIENT_ID) return null;

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: getDiscordRedirectUri(),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
};

/**
 * Échange le code OAuth reçu sur /api/discord/callback contre l'identité
 * Discord de l'utilisateur (id + pseudo), pour la lier à son compte CHAMA.
 * Renvoie null si la config n'est pas prête ou si l'échange échoue.
 */
export async function exchangeDiscordCode(code: string): Promise<DiscordUser | null> {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) return null;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: getDiscordRedirectUri(),
      }),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      console.error("DISCORD_TOKEN_EXCHANGE_ERROR", tokenRes.status, await tokenRes.text());
      return null;
    }

    const token = (await tokenRes.json()) as DiscordTokenResponse;

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `${token.token_type} ${token.access_token}` },
      cache: "no-store",
    });

    if (!userRes.ok) {
      console.error("DISCORD_FETCH_USER_ERROR", userRes.status, await userRes.text());
      return null;
    }

    return (await userRes.json()) as DiscordUser;
  } catch (error) {
    console.error("DISCORD_OAUTH_ERROR", error);
    return null;
  }
}

/**
 * Déplace un membre du serveur Discord configuré vers un salon vocal.
 * ⚠️ Discord n'autorise ça que si le membre est déjà connecté à UN salon
 * vocal du serveur — impossible de le faire rejoindre depuis rien.
 * Renvoie true si le déplacement a réussi.
 */
export async function moveGuildMemberToVoiceChannel(
  discordUserId: string,
  channelId: string,
): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) return false;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel_id: channelId }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      // Cas fréquents et attendus, pas la peine de crier : membre pas sur
      // le serveur, ou pas connecté à un vocal (Discord renvoie 404/400).
      console.error(
        "DISCORD_MOVE_MEMBER_ERROR",
        discordUserId,
        "->",
        channelId,
        res.status,
        await res.text(),
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("DISCORD_MOVE_MEMBER_FETCH_ERROR", error);
    return false;
  }
}
