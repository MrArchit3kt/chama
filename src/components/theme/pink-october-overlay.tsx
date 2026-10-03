"use client";

import { useMemo } from "react";
import { Ribbon } from "lucide-react";

// ✅ Compte volontairement modeste, un seul plan de profondeur (contrairement
// à la neige de Noël) : Octobre Rose reste un thème sobre, pas une scène à
// plusieurs couches — et ça limite le coût GPU sur mobile.
const RIBBON_COUNT = 10;

type RibbonParticle = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
};

function buildRibbons(count: number): RibbonParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 16 + Math.random() * 14,
    duration: 16 + Math.random() * 14,
    delay: Math.random() * 18,
    drift: Math.random() * 90 - 45,
    opacity: 0.35 + Math.random() * 0.35,
  }));
}

/**
 * 🎗️ Octobre Rose (sensibilisation au cancer du sein) — thème sobre :
 * quelques rubans roses qui descendent lentement (réutilise le keyframe
 * theme-snow-fall, générique malgré son nom) + un ruban fixe discret dans
 * un coin. Purement décoratif (pointer-events-none).
 */
export function PinkOctoberOverlay() {
  const ribbons = useMemo(() => buildRibbons(RIBBON_COUNT), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-90 overflow-hidden" aria-hidden="true">
      {ribbons.map((ribbon) => (
        <span
          key={ribbon.id}
          className="theme-ribbon absolute top-0 text-pink-300"
          style={
            {
              left: `${ribbon.left}%`,
              opacity: ribbon.opacity,
              animation: `theme-snow-fall ${ribbon.duration}s linear ${ribbon.delay}s infinite`,
              "--snow-drift": `${ribbon.drift}px`,
              "--snow-opacity": ribbon.opacity,
              filter: "drop-shadow(0 0 5px rgba(244, 114, 182, 0.5))",
            } as React.CSSProperties
          }
        >
          <Ribbon size={ribbon.size} strokeWidth={1.5} />
        </span>
      ))}

      {/* Ruban fixe discret, coin bas-droit, avec un léger halo */}
      <div
        className="absolute bottom-[6%] right-[4%] text-pink-300/70"
        style={{ filter: "drop-shadow(0 0 18px rgba(244,114,182,0.35))" }}
      >
        <Ribbon size={72} strokeWidth={1.25} />
      </div>
    </div>
  );
}
