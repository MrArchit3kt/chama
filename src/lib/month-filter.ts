/**
 * Filtre "par mois" réutilisé sur les pages admin qui listent beaucoup
 * d'entrées datées (contact, journal d'activité...) : évite de scroller
 * des centaines de lignes en ne montrant que celles du mois choisi.
 */

/** Clé "YYYY-MM" (fuseau local) à partir d'une date. */
export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Libellé lisible ("septembre 2026") à partir d'une clé "YYYY-MM". */
export function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Bornes [début, fin) du mois désigné par une clé "YYYY-MM", ou `null` si invalide. */
export function monthRange(key: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/** Liste triée (plus récent d'abord) des mois distincts présents dans `dates`. */
export function distinctMonths(dates: Date[]): string[] {
  return [...new Set(dates.map(monthKey))].sort().reverse();
}
