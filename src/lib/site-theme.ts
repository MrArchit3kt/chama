/** DB (SiteTheme enum) -> attribut data-theme utilisé par globals.css pour
 * recolorer cartes/boutons/badges/fond (voir la section "THÈMES
 * ÉVÉNEMENTIELS" dans globals.css). DEFAULT => pas d'attribut, :root
 * s'applique tel quel (thème Or CHAMA). Pas de "server-only" ici : pure
 * fonction de mapping, importable depuis n'importe quel composant. */
const THEME_DATA_ATTR: Record<string, string> = {
  CHRISTMAS: "christmas",
  HALLOWEEN: "halloween",
  PINK_OCTOBER: "pink-october",
  OCEAN: "ocean",
  EMERALD: "emerald",
  AMETHYST: "amethyst",
  CRIMSON: "crimson",
  ICE: "ice",
  SUNSET: "sunset",
  INDIGO: "indigo",
  SILVER: "silver",
  NEON: "neon",
};

export function themeDataAttr(theme: string | undefined | null) {
  if (!theme) return undefined;
  return THEME_DATA_ATTR[theme];
}
