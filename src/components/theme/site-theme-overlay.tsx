import { ChristmasOverlay } from "@/components/theme/christmas-overlay";
import { HalloweenOverlay } from "@/components/theme/halloween-overlay";

type SiteThemeOverlayProps = {
  theme: "DEFAULT" | "HALLOWEEN" | "CHRISTMAS";
};

/** Affiche la décoration événementielle active sur tout le site, ou rien en thème par défaut. */
export function SiteThemeOverlay({ theme }: SiteThemeOverlayProps) {
  if (theme === "CHRISTMAS") return <ChristmasOverlay />;
  if (theme === "HALLOWEEN") return <HalloweenOverlay />;
  return null;
}
