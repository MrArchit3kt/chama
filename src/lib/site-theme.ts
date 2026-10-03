/** DB (SiteTheme enum) -> attribut data-theme utilisé par globals.css pour
 * recolorer cartes/boutons/badges/fond (voir la section "THÈMES
 * ÉVÉNEMENTIELS" dans globals.css). DEFAULT => pas d'attribut, :root
 * s'applique tel quel (thème Or CHAMA). Pas de "server-only" ici : pure
 * fonction de mapping, importable depuis n'importe quel composant. */
export function themeDataAttr(theme: string | undefined | null) {
  if (theme === "CHRISTMAS") return "christmas";
  if (theme === "HALLOWEEN") return "halloween";
  if (theme === "PINK_OCTOBER") return "pink-october";
  return undefined;
}
