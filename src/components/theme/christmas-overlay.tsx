"use client";

import { useMemo } from "react";

const SNOWFLAKE_COUNT = 40;
const SNOW_CHARS = ["❄", "❅", "❆"];
const GIFT_KEYFRAMES = [
  "theme-gift-fall-1",
  "theme-gift-fall-2",
  "theme-gift-fall-3",
  "theme-gift-fall-4",
  "theme-gift-fall-5",
];
// Positions approximatives du père Noël (left %) à chaque fenêtre de largage.
const GIFT_LEFT_PERCENT = [14, 32, 50, 68, 86];

type Snowflake = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
  char: string;
};

function buildSnowflakes(count: number): Snowflake[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 10 + Math.random() * 16,
    duration: 8 + Math.random() * 10,
    delay: Math.random() * 14,
    drift: Math.random() * 120 - 60,
    opacity: 0.5 + Math.random() * 0.45,
    char: SNOW_CHARS[Math.floor(Math.random() * SNOW_CHARS.length)],
  }));
}

/**
 * ❄️ Thème Noël : neige qui tombe en continu + le père Noël qui traverse
 * l'écran de temps en temps en lâchant des cadeaux. Purement décoratif
 * (pointer-events-none), au-dessus de tout le contenu du site.
 */
export function ChristmasOverlay() {
  const snowflakes = useMemo(() => buildSnowflakes(SNOWFLAKE_COUNT), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-90 overflow-hidden" aria-hidden="true">
      {snowflakes.map((flake) => (
        <span
          key={flake.id}
          className="theme-snowflake absolute top-0 text-white"
          style={
            {
              left: `${flake.left}%`,
              fontSize: flake.size,
              animation: `theme-snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
              "--snow-drift": `${flake.drift}px`,
              "--snow-opacity": flake.opacity,
              textShadow: "0 0 6px rgba(255,255,255,0.5)",
            } as React.CSSProperties
          }
        >
          {flake.char}
        </span>
      ))}

      <span
        className="theme-santa absolute text-4xl md:text-5xl"
        style={{
          top: "8%",
          animation: "theme-santa-fly 42s ease-in-out infinite",
        }}
      >
        🎅🛷
      </span>

      {GIFT_KEYFRAMES.map((keyframe, i) => (
        <span
          key={keyframe}
          className="theme-gift absolute text-2xl"
          style={{
            top: "10%",
            left: `${GIFT_LEFT_PERCENT[i]}%`,
            animation: `${keyframe} 42s ease-in infinite`,
          }}
        >
          🎁
        </span>
      ))}
    </div>
  );
}
