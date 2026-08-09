"use client";

import { useMemo } from "react";

const STAR_COUNT = 45;
const DISTANT_BAT_COUNT = 4;
const NEAR_BAT_COUNT = 4;
const TOMBSTONE_COUNT = 7;

type Star = { id: number; left: number; top: number; size: number; duration: number; delay: number };
type Bat = { id: number; y1: number; y2: number; duration: number; delay: number; size: number; flap: number };
type Tombstone = { id: number; left: number; width: number; height: number; tilt: number };

function buildStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 55,
    size: 1 + Math.random() * 2,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 4,
  }));
}

function buildBats(count: number, distant: boolean): Bat[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    y1: distant ? 5 + Math.random() * 30 : 15 + Math.random() * 45,
    y2: distant ? 5 + Math.random() * 30 : 15 + Math.random() * 45,
    duration: distant ? 22 + Math.random() * 14 : 13 + Math.random() * 10,
    delay: Math.random() * 20,
    size: distant ? 12 + Math.random() * 6 : 22 + Math.random() * 12,
    flap: 0.3 + Math.random() * 0.2,
  }));
}

function buildTombstones(count: number): Tombstone[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: (i / count) * 100 + Math.random() * (100 / count) * 0.4,
    width: 16 + Math.random() * 14,
    height: 22 + Math.random() * 20,
    tilt: Math.random() * 10 - 5,
  }));
}

/**
 * 🎃 Thème Halloween — scène en couches avec perspective CSS pour un vrai
 * effet de profondeur : ciel étoilé, lune qui pulse, chauves-souris sur
 * deux plans (lointaines/proches, ailes qui battent), silhouette de
 * cimetière, brume qui dérive, éclair occasionnel, citrouille 3D qui
 * tourne sur elle-même. Purement décoratif (pointer-events-none).
 */
export function HalloweenOverlay() {
  const stars = useMemo(() => buildStars(STAR_COUNT), []);
  const distantBats = useMemo(() => buildBats(DISTANT_BAT_COUNT, true), []);
  const nearBats = useMemo(() => buildBats(NEAR_BAT_COUNT, false), []);
  const tombstones = useMemo(() => buildTombstones(TOMBSTONE_COUNT), []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-90 overflow-hidden"
      style={{ perspective: 1400 }}
      aria-hidden="true"
    >
      {/* Étoiles qui scintillent */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="theme-star absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animation: `theme-star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Lune, tout au fond (translateZ négatif = plus loin dans la perspective) */}
      <div
        className="theme-moon absolute rounded-full"
        style={{
          top: "9%",
          right: "13%",
          width: 100,
          height: 100,
          background: "radial-gradient(circle at 35% 32%, #fffaf0, #ffe9a8 55%, #f2d27a 100%)",
          animation: "theme-moon-glow 6s ease-in-out infinite",
          transform: "translateZ(-420px) scale(1.3)",
        }}
      />

      {/* Chauves-souris lointaines : plus petites, plus lentes, plus transparentes */}
      {distantBats.map((bat) => (
        <span
          key={`far-${bat.id}`}
          className="theme-bat absolute left-0 top-0"
          style={
            {
              fontSize: bat.size,
              opacity: 0.45,
              animation: `theme-bat-fly ${bat.duration}s ease-in-out ${bat.delay}s infinite`,
              "--bat-y1": `${bat.y1}vh`,
              "--bat-y2": `${bat.y2}vh`,
              transform: "translateZ(-280px)",
            } as React.CSSProperties
          }
        >
          <span
            className="theme-bat-wing inline-block"
            style={{ animation: `theme-bat-flap ${bat.flap}s ease-in-out infinite` }}
          >
            🦇
          </span>
        </span>
      ))}

      {/* Silhouette de cimetière au sol, en dégradé vers le noir — cantonné
          à une fine bande tout en bas pour ne jamais gêner la lecture du
          contenu réel du site. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "10vh",
          background: "linear-gradient(transparent, rgba(4,2,7,0.55) 70%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0" style={{ height: "9vh" }}>
        {tombstones.map((t) => (
          <div
            key={t.id}
            className="absolute bottom-0"
            style={{
              left: `${t.left}%`,
              width: t.width,
              height: t.height,
              background: "#0c0710",
              borderRadius: "8px 8px 2px 2px",
              transform: `rotate(${t.tilt}deg)`,
              boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            }}
          />
        ))}
        {/* Arbre mort simple : tronc + deux branches obliques */}
        <div
          className="absolute bottom-0"
          style={{ left: "4%", width: 6, height: "8vh", background: "#0a060d", borderRadius: 2 }}
        />
        <div
          className="absolute bottom-[6vh]"
          style={{
            left: "1%",
            width: 34,
            height: 3,
            background: "#0a060d",
            transform: "rotate(-28deg)",
            transformOrigin: "right center",
          }}
        />
        <div
          className="absolute bottom-[5vh]"
          style={{
            left: "3%",
            width: 26,
            height: 3,
            background: "#0a060d",
            transform: "rotate(24deg)",
            transformOrigin: "left center",
          }}
        />
      </div>

      {/* Chauves-souris proches : plus grandes, plus rapides, devant le cimetière */}
      {nearBats.map((bat) => (
        <span
          key={`near-${bat.id}`}
          className="theme-bat absolute left-0 top-0"
          style={
            {
              fontSize: bat.size,
              opacity: 0.9,
              animation: `theme-bat-fly ${bat.duration}s ease-in-out ${bat.delay}s infinite`,
              "--bat-y1": `${bat.y1}vh`,
              "--bat-y2": `${bat.y2}vh`,
              transform: "translateZ(-40px)",
              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
            } as React.CSSProperties
          }
        >
          <span
            className="theme-bat-wing inline-block"
            style={{ animation: `theme-bat-flap ${bat.flap}s ease-in-out infinite` }}
          >
            🦇
          </span>
        </span>
      ))}

      {/* Brume qui dérive sur deux calques */}
      <div
        className="theme-fog absolute inset-x-0 bottom-0"
        style={{
          height: "14vh",
          background: "linear-gradient(0deg, rgba(180,180,205,0.16), transparent)",
          filter: "blur(6px)",
          animation: "theme-fog-drift-a 16s ease-in-out infinite alternate",
        }}
      />
      <div
        className="theme-fog absolute inset-x-0 bottom-0"
        style={{
          height: "9vh",
          background: "linear-gradient(0deg, rgba(180,180,205,0.22), transparent)",
          filter: "blur(4px)",
          animation: "theme-fog-drift-b 21s ease-in-out infinite alternate",
        }}
      />

      {/* Éclair occasionnel — opacity: 0 posée en dur en plus de l'animation :
          si jamais l'animation ne s'applique pas pour une raison ou une
          autre, ce calque doit rester invisible plutôt que de finir en
          plein écran blanc opaque par défaut. */}
      <div
        className="theme-lightning absolute inset-0 bg-white opacity-0"
        style={{ animation: "theme-lightning-flash 13s linear infinite" }}
      />

      {/* Filet de sang qui suinte en haut de l'écran */}
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
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "rgba(90,0,6,0.9)" }} />

      {/* Citrouille signature qui tourne en 3D */}
      <div
        className="theme-pumpkin absolute"
        style={{
          bottom: "7%",
          left: "6%",
          fontSize: 60,
          filter: "drop-shadow(0 0 22px rgba(255,140,20,0.55))",
          animation: "theme-pumpkin-spin 7s ease-in-out infinite",
          transformStyle: "preserve-3d",
        }}
      >
        🎃
      </div>
    </div>
  );
}
