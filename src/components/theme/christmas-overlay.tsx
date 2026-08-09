"use client";

import { useMemo } from "react";
import { Snowflake, Sparkles, Gift, TreePine } from "lucide-react";

const FAR_SNOWFLAKE_COUNT = 22;
const NEAR_SNOWFLAKE_COUNT = 16;
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

      {/* Étoile filante qui traverse l'écran en boucle, avec une traînée scintillante */}
      <div className="theme-santa absolute" style={{ top: "10%", animation: "theme-santa-fly 42s ease-in-out infinite" }}>
        <div className="relative">
          {/* traînée : dégradé flouté derrière l'étoile */}
          <div
            className="absolute right-full top-1/2 h-0.75 w-28 -translate-y-1/2"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,214,120,0.7))",
              filter: "blur(1px)",
            }}
          />
          <Sparkles
            size={34}
            className="text-amber-200"
            style={{ filter: "drop-shadow(0 0 14px rgba(255,214,120,0.85)) drop-shadow(0 0 28px rgba(255,180,80,0.5))" }}
          />
        </div>
      </div>

      {/* Cadeaux lâchés au passage de l'étoile filante */}
      {GIFT_KEYFRAMES.map((keyframe, i) => (
        <span
          key={keyframe}
          className="theme-gift absolute text-rose-300"
          style={{
            top: "10%",
            left: `${GIFT_LEFT_PERCENT[i]}%`,
            animation: `${keyframe} 42s ease-in infinite`,
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
