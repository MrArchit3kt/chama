import {
  Trophy,
  Star,
  Shield,
  Crown,
  Flame,
  Target,
  Medal,
  Award,
  Zap,
  Heart,
  Gem,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const BADGE_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "trophy", label: "Trophée", icon: Trophy },
  { value: "star", label: "Étoile", icon: Star },
  { value: "shield", label: "Bouclier", icon: Shield },
  { value: "crown", label: "Couronne", icon: Crown },
  { value: "flame", label: "Flamme", icon: Flame },
  { value: "target", label: "Cible", icon: Target },
  { value: "medal", label: "Médaille", icon: Medal },
  { value: "award", label: "Award", icon: Award },
  { value: "zap", label: "Éclair", icon: Zap },
  { value: "heart", label: "Cœur", icon: Heart },
  { value: "gem", label: "Gemme", icon: Gem },
  { value: "sparkles", label: "Étincelles", icon: Sparkles },
];

export function getBadgeIcon(icon: string | null | undefined): LucideIcon {
  return BADGE_ICONS.find((i) => i.value === icon)?.icon ?? Award;
}

export const BADGE_COLORS: { value: string; label: string; classes: string }[] = [
  { value: "cyan", label: "Cyan", classes: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300" },
  { value: "pink", label: "Rose", classes: "border-pink-400/25 bg-pink-400/10 text-pink-300" },
  { value: "emerald", label: "Émeraude", classes: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  { value: "amber", label: "Ambre", classes: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
  { value: "fuchsia", label: "Fuchsia", classes: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300" },
  { value: "indigo", label: "Indigo", classes: "border-indigo-400/25 bg-indigo-400/10 text-indigo-300" },
  { value: "rose", label: "Rouge", classes: "border-rose-400/25 bg-rose-400/10 text-rose-300" },
];

export function getBadgeColorClasses(color: string | null | undefined): string {
  return (
    BADGE_COLORS.find((c) => c.value === color)?.classes ??
    "border-white/15 bg-white/[0.04] text-white/80"
  );
}

export const BADGE_CATEGORY_LABELS: Record<string, string> = {
  MEMBERSHIP: "Appartenance",
  SKILL: "Compétence",
  ACTIVITY: "Activité",
  BEHAVIOR: "Comportement",
  EVENT: "Événement",
  SPECIAL: "Spécial",
};
