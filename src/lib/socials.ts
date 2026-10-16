// Normalisation des pseudos TikTok/Instagram — même principe que
// normalizeTwitchUsername (@/lib/twitch) : accepte un pseudo brut, une URL
// complète ou un "@pseudo", renvoie le handle nu (sans @), ou null si invalide.

const TIKTOK_USERNAME_RE = /^[a-zA-Z0-9_.]{2,24}$/;
const INSTAGRAM_USERNAME_RE = /^[a-zA-Z0-9_.]{1,30}$/;

export function normalizeTiktokUsername(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  value = value
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?tiktok\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!TIKTOK_USERNAME_RE.test(value)) return null;
  return value;
}

export function normalizeInstagramUsername(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  value = value
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!INSTAGRAM_USERNAME_RE.test(value)) return null;
  return value;
}
