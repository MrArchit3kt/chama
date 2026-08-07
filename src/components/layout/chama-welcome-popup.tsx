"use client";

import { useEffect, useState, useTransition } from "react";
import { PartyPopper, X } from "lucide-react";
import { markChamaWelcomeSeen } from "@/server/profil/mark-chama-welcome-seen";

type Particle = {
  id: number;
  left: number;
  top: number;
  x: number;
  y: number;
  rot: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  radius: string;
};

const COLORS = [
  "#39f0ff",
  "#ff4fd8",
  "#42ffb0",
  "#ffd166",
  "#1ea7ff",
  "#c084fc",
];

function buildParticles(): Particle[] {
  return Array.from({ length: 70 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 140 + Math.random() * 260;

    return {
      id: i,
      left: 50 + (Math.random() * 10 - 5),
      top: 50 + (Math.random() * 10 - 5),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      rot: Math.random() * 720 - 360,
      delay: Math.random() * 150,
      duration: 900 + Math.random() * 700,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
      radius: Math.random() > 0.5 ? "9999px" : "3px",
    };
  });
}

export function ChamaWelcomePopup() {
  const [visible, setVisible] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Généré côté client uniquement (Math.random) : évite tout mismatch
    // d'hydratation avec le rendu serveur. Volontairement post-mount plutôt
    // qu'un lazy initializer useState, qui s'exécuterait aussi côté serveur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(buildParticles());
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function close() {
    setVisible(false);
    startTransition(() => {
      markChamaWelcomeSeen();
    });
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fermer"
        onClick={close}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="chama-confetti-particle absolute"
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.radius,
                animation: `chama-confetti-burst ${p.duration}ms cubic-bezier(0.2, 0.8, 0.3, 1) ${p.delay}ms both`,
                "--chama-confetti-x": `${p.x}px`,
                "--chama-confetti-y": `${p.y}px`,
                "--chama-confetti-rot": `${p.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="chama-welcome-card neon-card relative w-full max-w-md p-6 text-center md:p-8"
        style={{ animation: "chama-welcome-pop-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/60 transition hover:border-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10">
          <PartyPopper className="h-8 w-8 text-cyan-300" />
        </span>

        <h2 className="neon-title neon-gradient-text mt-4 text-2xl font-black">
          Bienvenue dans la Team CHAMA ! 🎉
        </h2>

        <p className="neon-text-muted mt-3 text-sm leading-6 md:text-base">
          T’es officiellement membre CHAMA maintenant, GG ! Toute l’équipe est
          hyper contente de t’avoir avec nous — à très vite sur les games. 🚀
        </p>

        <button
          type="button"
          onClick={close}
          className="neon-button mt-6 w-full px-6 py-3"
        >
          C’est parti !
        </button>
      </div>
    </div>
  );
}
