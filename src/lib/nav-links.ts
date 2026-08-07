import {
  Home,
  Settings,
  UserCircle2,
  Users,
  Mail,
  Crosshair,
  Trophy,
  Swords,
  Rocket,
  Award,
  Car,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Source unique pour la navigation principale et admin, utilisée à la fois
 * par la sidebar desktop et le menu mobile — évite qu'un lien ajouté d'un
 * côté soit oublié de l'autre.
 */
export const mainLinks: NavLink[] = [
  { href: "/acceuil", label: "Accueil", icon: Home },
  { href: "/profil", label: "Profil", icon: UserCircle2 },
  { href: "/warzone", label: "Warzone", icon: Crosshair },
  { href: "/ranked", label: "Ranked", icon: Trophy },
  { href: "/bo7", label: "BO7", icon: Swords },
  { href: "/rocket-league", label: "Rocket League", icon: Rocket },
  { href: "/gta6", label: "GTA 6", icon: Car },
];

export const adminLinks: NavLink[] = [
  { href: "/admin", label: "Admin", icon: Settings },
  { href: "/admin/players", label: "Admin Players", icon: Users },
  { href: "/admin/registrations", label: "Admin Inscriptions", icon: Users },
  { href: "/admin/contact", label: "Admin Contact", icon: Mail },
  { href: "/admin/badges", label: "Admin Badges", icon: Award },
];

export const adminMixLinks: NavLink[] = [
  { href: "/admin/mix/warzone", label: "Mix Warzone", icon: Crosshair },
  { href: "/admin/mix/warzone-ranked", label: "Mix Ranked", icon: Trophy },
  { href: "/admin/mix/bo7", label: "Mix BO7", icon: Swords },
  { href: "/admin/mix/rocket-league", label: "Mix Rocket League", icon: Rocket },
];
