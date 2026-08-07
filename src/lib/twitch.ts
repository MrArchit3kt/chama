import "server-only";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const TWITCH_USERNAME_RE = /^[a-zA-Z0-9_]{3,25}$/;

/**
 * Accepte un pseudo brut, une URL complète (https://twitch.tv/pseudo) ou un
 * "@pseudo" et renvoie le login Twitch normalisé (minuscules), ou null si
 * invalide.
 */
export function normalizeTwitchUsername(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  value = value
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?twitch\.tv\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!TWITCH_USERNAME_RE.test(value)) return null;
  return value.toLowerCase();
}

export function isTwitchConfigured(): boolean {
  return Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
}

type CachedToken = { accessToken: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

async function getAppAccessToken(): Promise<string | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("TWITCH_TOKEN_ERROR", res.status, await res.text());
      return null;
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return cachedToken.accessToken;
  } catch (error) {
    console.error("TWITCH_TOKEN_FETCH_ERROR", error);
    return null;
  }
}

export type TwitchLiveStream = {
  username: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  startedAt: string;
};

type StreamsCache = { logins: string; data: Map<string, TwitchLiveStream>; expiresAt: number };
let streamsCache: StreamsCache | null = null;
const STREAMS_CACHE_TTL_MS = 20_000;

/**
 * Renvoie les streams Twitch actuellement en live parmi les logins donnés
 * (un seul appel API batché, quel que soit le nombre de streamers). Le
 * résultat est mis en cache 20s en mémoire : le site se rafraîchit
 * automatiquement toutes les 4s, inutile de re-solliciter l'API Twitch à
 * chaque fois. Si TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ne sont pas
 * configurés, renvoie une Map vide sans planter.
 */
export async function getLiveTwitchStreams(
  logins: string[],
): Promise<Map<string, TwitchLiveStream>> {
  const uniqueLogins = [...new Set(logins.map((l) => l.toLowerCase().trim()).filter(Boolean))];
  if (uniqueLogins.length === 0) return new Map();

  const cacheKey = uniqueLogins.slice().sort().join(",");
  if (streamsCache && streamsCache.logins === cacheKey && streamsCache.expiresAt > Date.now()) {
    return streamsCache.data;
  }

  const token = await getAppAccessToken();
  if (!token || !TWITCH_CLIENT_ID) return new Map();

  try {
    const params = new URLSearchParams();
    uniqueLogins.slice(0, 100).forEach((login) => params.append("user_login", login));

    const res = await fetch(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
      headers: {
        "Client-Id": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("TWITCH_STREAMS_ERROR", res.status, await res.text());
      return new Map();
    }

    const json = (await res.json()) as {
      data: Array<{
        user_login: string;
        title: string;
        viewer_count: number;
        thumbnail_url: string;
        started_at: string;
      }>;
    };

    const result = new Map<string, TwitchLiveStream>();
    for (const stream of json.data) {
      const login = stream.user_login.toLowerCase();
      result.set(login, {
        username: login,
        title: stream.title,
        viewerCount: stream.viewer_count,
        thumbnailUrl: stream.thumbnail_url.replace("{width}", "440").replace("{height}", "248"),
        startedAt: stream.started_at,
      });
    }

    streamsCache = { logins: cacheKey, data: result, expiresAt: Date.now() + STREAMS_CACHE_TTL_MS };
    return result;
  } catch (error) {
    console.error("TWITCH_STREAMS_FETCH_ERROR", error);
    return new Map();
  }
}
