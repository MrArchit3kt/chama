"use client";

import { useMemo } from "react";
import { Snowflake, Gift, TreePine } from "lucide-react";

// Cycle complet du passage du traîneau (apparaît, traverse, repart), en
// secondes. Les fenêtres de largage des cadeaux (@keyframes theme-gift-fall-N
// dans globals.css) sont exprimées en % de ce même cycle, donc synchronisées
// automatiquement tant que gifts et traîneau utilisent la même durée.
const SANTA_CYCLE_SECONDS = 30;

// ✅ Comptes volontairement modestes + filtres non empilés : chaque
// drop-shadow/blur force un passage de rendu GPU supplémentaire répété à
// chaque frame d'animation. Trop d'éléments filtrés en même temps sur un
// mobile d'entrée de gamme peut se voir comme des saccades/clignotements.
const FAR_SNOWFLAKE_COUNT = 14;
const NEAR_SNOWFLAKE_COUNT = 10;
const GIFT_KEYFRAMES = [
  "theme-gift-fall-1",
  "theme-gift-fall-2",
  "theme-gift-fall-3",
  "theme-gift-fall-4",
  "theme-gift-fall-5",
];
// Positions approximatives de l'étoile filante (left %) à chaque fenêtre de largage.
const GIFT_LEFT_PERCENT = [14, 32, 50, 68, 86];

type Snowflake = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
  blur: number;
};

function buildSnowflakes(count: number, far: boolean): Snowflake[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: far ? 8 + Math.random() * 8 : 14 + Math.random() * 14,
    duration: far ? 14 + Math.random() * 12 : 8 + Math.random() * 9,
    delay: Math.random() * 16,
    drift: Math.random() * 110 - 55,
    opacity: far ? 0.25 + Math.random() * 0.25 : 0.55 + Math.random() * 0.4,
    blur: far ? 1.5 : 0,
  }));
}

/**
 * ❄️ Thème Noël — entièrement dessiné en formes/icônes vectorielles (aucun
 * emoji), dans le langage visuel néon déjà utilisé sur tout le site : neige
 * en 2 plans de profondeur (parallaxe), une étoile filante scintillante qui
 * traverse l'écran en boucle en laissant tomber des cadeaux, et un sapin
 * qui veille discrètement dans un coin. Purement décoratif
 * (pointer-events-none), jamais de calque opaque plein écran.
 */
export function ChristmasOverlay() {
  const farFlakes = useMemo(() => buildSnowflakes(FAR_SNOWFLAKE_COUNT, true), []);
  const nearFlakes = useMemo(() => buildSnowflakes(NEAR_SNOWFLAKE_COUNT, false), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-90 overflow-hidden" aria-hidden="true">
      {/* Neige lointaine : petite, floue, pâle */}
      {farFlakes.map((flake) => (
        <span
          key={`far-${flake.id}`}
          className="theme-snowflake absolute top-0 text-white"
          style={
            {
              left: `${flake.left}%`,
              opacity: flake.opacity,
              filter: `blur(${flake.blur}px)`,
              animation: `theme-snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
              "--snow-drift": `${flake.drift}px`,
              "--snow-opacity": flake.opacity,
            } as React.CSSProperties
          }
        >
          <Snowflake size={flake.size} strokeWidth={1.5} />
        </span>
      ))}

      {/* Sapin discret dans un coin, avec un léger halo */}
      <div
        className="absolute bottom-[6%] left-[4%] text-emerald-300/70"
        style={{ filter: "drop-shadow(0 0 18px rgba(52,211,153,0.35))" }}
      >
        <TreePine size={72} strokeWidth={1.25} />
      </div>

      {/* Le père Noël sur son traîneau : vraie image (silhouette détaillée,
          traîneau + rennes), pas une icône. Inversée en blanc + halo doré
          pour ressortir sur le fond sombre du site. Traverse l'écran en
          boucle toutes les 30 secondes. */}
      <div
        className="theme-santa absolute"
        style={{ top: "9%", animation: `theme-santa-fly ${SANTA_CYCLE_SECONDS}s ease-in-out infinite` }}
      >
        {/* traînée lumineuse derrière le traîneau */}
        <div
          className="absolute right-full top-1/2 h-1 w-32 -translate-y-1/2"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,214,120,0.55))",
            filter: "blur(1.5px)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG décoratif animé, pas un <Image> layout classique */}
        <img
          src="/images/theme/santa-sleigh.svg"
          alt=""
          className="h-auto w-72 md:w-96"
          style={{
            filter:
              "invert(1) drop-shadow(0 0 12px rgba(255,214,120,0.9)) drop-shadow(0 0 26px rgba(255,180,80,0.55))",
          }}
        />
      </div>

      {/* Cadeaux lâchés au passage du traîneau */}
      {GIFT_KEYFRAMES.map((keyframe, i) => (
        <span
          key={keyframe}
          className="theme-gift absolute text-rose-300"
          style={{
            top: "9%",
            left: `${GIFT_LEFT_PERCENT[i]}%`,
            animation: `${keyframe} ${SANTA_CYCLE_SECONDS}s ease-in infinite`,
            filter: "drop-shadow(0 0 8px rgba(255,120,180,0.55))",
          }}
        >
          <Gift size={22} strokeWidth={1.75} />
        </span>
      ))}

      {/* Neige proche : plus grande, plus nette, plus lumineuse */}
      {nearFlakes.map((flake) => (
        <span
          key={`near-${flake.id}`}
          className="theme-snowflake absolute top-0 text-white"
          style={
            {
              left: `${flake.left}%`,
              opacity: flake.opacity,
              animation: `theme-snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
              "--snow-drift": `${flake.drift}px`,
              "--snow-opacity": flake.opacity,
              filter: "drop-shadow(0 0 4px rgba(255,255,255,0.6))",
            } as React.CSSProperties
          }
        >
          <Snowflake size={flake.size} strokeWidth={1.5} />
        </span>
      ))}
    </div>
  );
}
