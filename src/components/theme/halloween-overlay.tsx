"use client";

import { useMemo } from "react";

const BAT_COUNT = 6;

type Bat = {
  id: number;
  y1: number;
  y2: number;
  duration: number;
  delay: number;
  size: number;
};

function buildBats(count: number): Bat[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    y1: 5 + Math.random() * 70,
    y2: 5 + Math.random() * 70,
    duration: 14 + Math.random() * 12,
    delay: Math.random() * 16,
    size: 18 + Math.random() * 14,
  }));
}

/**
 * 🎃 Thème Halloween : chauves-souris qui traversent l'écran en boucle,
 * légère brume rouge sombre et un filet de sang qui suinte en haut de
 * l'écran. Purement décoratif (pointer-events-none), un peu gore mais
 * reste soft (pas d'imagerie choquante, juste l'ambiance).
 */
export function HalloweenOverlay() {
  const bats = useMemo(() => buildBats(BAT_COUNT), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-90 overflow-hidden" aria-hidden="true">
      {/* Vignette rouge sombre */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(120,0,10,0.28) 100%)",
        }}
      />

      {/* Filet de sang qui suinte en haut de l'écran : une ligne pleine +
          des gouttes qui dépassent dessous, en dégradés répétés (pas
          d'image, léger et fiable sur tous les navigateurs). */}
      <div
        className="absolute inset-x-0 top-0 h-12"
        style={{
          backgroundImage:
            "radial-gradient(circle at 11px 0, rgba(120,0,10,0.92) 7px, transparent 7.5px)",
          backgroundRepeat: "repeat-x",
          backgroundSize: "22px 24px",
          backgroundPosition: "0 0",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "rgba(90,0,6,0.9)" }}
      />

      {bats.map((bat) => (
        <span
          key={bat.id}
          className="theme-bat absolute left-0 top-0"
          style={
            {
              fontSize: bat.size,
              animation: `theme-bat-fly ${bat.duration}s ease-in-out ${bat.delay}s infinite`,
              "--bat-y1": `${bat.y1}vh`,
              "--bat-y2": `${bat.y2}vh`,
              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
            } as React.CSSProperties
          }
        >
          🦇
        </span>
      ))}
    </div>
  );
}
