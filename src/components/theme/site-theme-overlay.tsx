import { ChristmasOverlay } from "@/components/theme/christmas-overlay";
import { HalloweenOverlay } from "@/components/theme/halloween-overlay";
import { PinkOctoberOverlay } from "@/components/theme/pink-october-overlay";

type SiteThemeOverlayProps = {
  theme: "DEFAULT" | "HALLOWEEN" | "CHRISTMAS" | "PINK_OCTOBER";
};

/** Affiche la décoration événementielle active sur tout le site, ou rien en thème par défaut. */
export function SiteThemeOverlay({ theme }: SiteThemeOverlayProps) {
  if (theme === "CHRISTMAS") return <ChristmasOverlay />;
  if (theme === "HALLOWEEN") return <HalloweenOverlay />;
  if (theme === "PINK_OCTOBER") return <PinkOctoberOverlay />;
  return null;
}
