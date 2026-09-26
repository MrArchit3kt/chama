/**
 * Catalogue des permissions fines déléguables par un SUPER_ADMIN à un
 * ADMIN (voir /admin/permissions). Un SUPER_ADMIN a toujours tout, quelle
 * que soit cette liste — elle ne s'applique qu'aux comptes role="ADMIN".
 *
 * ⚠️ Le passage admin/retrait admin (toggle-user-role.ts) est
 * volontairement absent de ce catalogue : il reste SUPER_ADMIN-only en
 * dur, pour éviter qu'un admin délégué puisse créer d'autres admins.
 */

export type AdminSection =
  | "players"
  | "registrations"
  | "badges"
  | "discord"
  | "events"
  | "contact"
  | "settings"
  | "mix";

export const ADMIN_SECTIONS: { key: AdminSection; label: string }[] = [
  { key: "players", label: "Joueurs" },
  { key: "registrations", label: "Inscriptions" },
  { key: "badges", label: "Badges (catalogue)" },
  { key: "discord", label: "Discord" },
  { key: "events", label: "Événements" },
  { key: "contact", label: "Contact" },
  { key: "settings", label: "Paramètres du site" },
  { key: "mix", label: "Mix (génération d'équipes)" },
];

export const ADMIN_PERMISSIONS = {
  "players.ban": { section: "players", label: "Bannir un joueur" },
  "players.unban": { section: "players", label: "Débannir un joueur" },
  "players.warning.manage": { section: "players", label: "Ajouter/retirer un avertissement" },
  "players.password.reset": { section: "players", label: "Réinitialiser un mot de passe" },
  "players.chama.toggle": { section: "players", label: "Statut membre CHAMA" },
  "players.aura.toggle": { section: "players", label: "Statut membre AURA" },
  "players.badge.manage": { section: "players", label: "Attribuer/retirer un badge" },
  "players.delete": { section: "players", label: "Supprimer un compte joueur" },
  "registrations.approve": { section: "registrations", label: "Accepter une inscription" },
  "registrations.reject": { section: "registrations", label: "Refuser une inscription" },
  "badges.manage": { section: "badges", label: "Créer/supprimer un badge du catalogue" },
  "discord.manage": { section: "discord", label: "Gérer les salons vocaux" },
  "events.manage": { section: "events", label: "Créer/modifier/supprimer un événement" },
  "events.roster": { section: "events", label: "Gérer la composition d'équipe" },
  "contact.manage": { section: "contact", label: "Traiter les demandes de contact" },
  "settings.manage": { section: "settings", label: "Modifier la configuration du site" },
  "mix.manage": {
    section: "mix",
    label: "Gérer tous les mix (Warzone/Ranked/BO7/Rocket League/Versus)",
  },
} as const satisfies Record<string, { section: AdminSection; label: string }>;

export type AdminPermissionKey = keyof typeof ADMIN_PERMISSIONS;

export const ALL_ADMIN_PERMISSION_KEYS = Object.keys(
  ADMIN_PERMISSIONS,
) as AdminPermissionKey[];

export function isAdminPermissionKey(value: string): value is AdminPermissionKey {
  return Object.prototype.hasOwnProperty.call(ADMIN_PERMISSIONS, value);
}

export function permissionsForSection(section: AdminSection): AdminPermissionKey[] {
  return ALL_ADMIN_PERMISSION_KEYS.filter((key) => ADMIN_PERMISSIONS[key].section === section);
}

/** True si `role` est SUPER_ADMIN, ou si `permissions` contient `key`. */
export function hasAdminPermission(
  role: string | null | undefined,
  permissions: readonly string[] | null | undefined,
  key: AdminPermissionKey,
): boolean {
  if (role === "SUPER_ADMIN") return true;
  return Boolean(permissions?.includes(key));
}

/** True si `role` est SUPER_ADMIN, ou si `permissions` contient AU MOINS UNE clé de `section`. */
export function hasAdminSectionAccess(
  role: string | null | undefined,
  permissions: readonly string[] | null | undefined,
  section: AdminSection,
): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (!permissions || permissions.length === 0) return false;
  return permissionsForSection(section).some((key) => permissions.includes(key));
}
