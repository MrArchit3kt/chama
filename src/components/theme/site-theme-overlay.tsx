import { ChristmasOverlay } from "@/components/theme/christmas-overlay";
import { HalloweenOverlay } from "@/components/theme/halloween-overlay";
import { PinkOctoberOverlay } from "@/components/theme/pink-october-overlay";

type SiteThemeOverlayProps = {
  theme: string;
};

/**
 * Affiche le décor animé dédié d'un thème événementiel, s'il y en a un.
 * La plupart des thèmes (voir /admin/settings) sont une couleur pure sans
 * décor particulier (gérée par data-theme dans globals.css) — seuls
 * Noël/Halloween/Octobre Rose ont une scène animée en plus.
 */
export function SiteThemeOverlay({ theme }: SiteThemeOverlayProps) {
  if (theme === "CHRISTMAS") return <ChristmasOverlay />;
  if (theme === "HALLOWEEN") return <HalloweenOverlay />;
  if (theme === "PINK_OCTOBER") return <PinkOctoberOverlay />;
  return null;
}
