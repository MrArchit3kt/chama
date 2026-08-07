import "server-only";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Limiteur simple en mémoire (process unique) : autorise au plus `limit`
 * appels par fenêtre de `windowMs` millisecondes pour une clé donnée.
 * Suffisant pour un déploiement mono-instance ; à remplacer par un store
 * partagé (Redis) si l'app tourne un jour sur plusieurs instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Nettoyage occasionnel pour éviter une croissance illimitée de la map.
  if (Math.random() < 0.01) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

/** Récupère l'IP du client depuis les headers (proxy-aware). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const real = h.get("x-real-ip");
  if (real) return real.trim();

  return "unknown";
}
