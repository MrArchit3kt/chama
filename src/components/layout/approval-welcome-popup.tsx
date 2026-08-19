"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PartyPopper, X } from "lucide-react";
import { markApprovalWelcomeSeen } from "@/server/profil/mark-approval-welcome-seen";

type Shape = "rect" | "ribbon" | "circle";

type Particle = {
  id: number;
  kind: "burst" | "rain";
  left: number;
  w: number;
  h: number;
  color: string;
  shape: Shape;
  duration: number;
  delay: number;
  drift: number;
  rot: number;
  burstX: number;
  burstY: number;
};

// Même palette que le pop-up "membre CHAMA" : cohérence visuelle entre les
// deux pop-ups de célébration du site.
const COLORS = [
  "#39f0ff",
  "#ff4fd8",
  "#42ffb0",
  "#ffd166",
  "#1ea7ff",
  "#c084fc",
  "#ffffff",
  "#ff8a5c",
];

let uid = 0;
function nextId() {
  uid += 1;
  return uid;
}

function randomShape(): Shape {
  const r = Math.random();
  if (r < 0.4) return "rect";
  if (r < 0.72) return "ribbon";
  return "circle";
}

function shapeSize(shape: Shape) {
  if (shape === "ribbon") return { w: 4 + Math.random() * 3, h: 12 + Math.random() * 7 };
  if (shape === "rect") return { w: 7 + Math.random() * 5, h: 7 + Math.random() * 5 };
  const d = 6 + Math.random() * 5;
  return { w: d, h: d };
}

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function buildBurstParticle(): Particle {
  const angle = Math.random() * Math.PI * 2;
  const distance = 160 + Math.random() * 320;
  const shape = randomShape();
  const { w, h } = shapeSize(shape);

  return {
    id: nextId(),
    kind: "burst",
    left: 50,
    w,
    h,
    color: randomColor(),
    shape,
    duration: 1100 + Math.random() * 750,
    delay: Math.random() * 140,
    drift: 0,
    rot: Math.random() * 900 - 450,
    burstX: Math.cos(angle) * distance,
    burstY: Math.sin(angle) * distance - 70,
  };
}

function buildRainParticle(): Particle {
  const shape = randomShape();
  const { w, h } = shapeSize(shape);

  return {
    id: nextId(),
    kind: "rain",
    left: Math.random() * 100,
    w,
    h,
    color: randomColor(),
    shape,
    duration: 3400 + Math.random() * 2600,
    delay: Math.random() * 200,
    drift: Math.random() * 160 - 80,
    rot: Math.random() * 720 - 360,
    burstX: 0,
    burstY: 0,
  };
}

function shapeRadius(shape: Shape) {
  return shape === "circle" ? "9999px" : "2px";
}

export function ApprovalWelcomePopup() {
  const [visible, setVisible] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [, startTransition] = useTransition();
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const countRef = useRef(0);

  useEffect(() => {
    const MAX_CONCURRENT = 160;

    function removeParticle(id: number) {
      countRef.current = Math.max(0, countRef.current - 1);
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }

    function spawn(particle: Particle) {
      if (countRef.current >= MAX_CONCURRENT) return;
      countRef.current += 1;
      setParticles((prev) => [...prev, particle]);
      const t = setTimeout(
        () => removeParticle(particle.id),
        particle.delay + particle.duration + 60,
      );
      timeoutsRef.current.push(t);
    }

    // Explosion d'ouverture : grosse salve de confettis dès l'apparition.
    for (let i = 0; i < 90; i += 1) spawn(buildBurstParticle());

    // Puis une pluie continue tant que le pop-up reste ouvert.
    const rainInterval = setInterval(() => {
      for (let i = 0; i < 3; i += 1) spawn(buildRainParticle());
    }, 240);

    return () => {
      clearInterval(rainInterval);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
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
      markApprovalWelcomeSeen();
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

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ perspective: 700 }}
      >
        {particles.map((p) => (
          <span
            key={p.id}
            className="chama-confetti-particle absolute left-1/2 top-1/2"
            style={
              {
                width: p.w,
                height: p.h,
                backgroundColor: p.color,
                borderRadius: shapeRadius(p.shape),
                boxShadow: `0 0 6px ${p.color}66`,
                marginLeft: p.kind === "rain" ? undefined : -p.w / 2,
                marginTop: p.kind === "rain" ? undefined : -p.h / 2,
                left: p.kind === "rain" ? `${p.left}%` : "50%",
                top: p.kind === "rain" ? "-8vh" : "38%",
                animation:
                  p.kind === "burst"
                    ? `chama-confetti-burst ${p.duration}ms cubic-bezier(0.15, 0.7, 0.25, 1) ${p.delay}ms both`
                    : `chama-confetti-rain ${p.duration}ms linear ${p.delay}ms both`,
                "--chama-x": `${p.burstX}px`,
                "--chama-y": `${p.burstY}px`,
                "--chama-rot": `${p.rot}deg`,
                "--chama-drift": `${p.drift}px`,
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

        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10">
          <PartyPopper className="h-8 w-8 text-emerald-300" />
        </span>

        <h2 className="neon-title neon-gradient-text mt-4 text-2xl font-black">
          Compte validé ! 🎉
        </h2>

        <p className="neon-text-muted mt-3 text-sm leading-6 md:text-base">
          Félicitations, ton compte a été validé par la Team CHAMA ! Tu peux
          maintenant rejoindre les files de mix, t’inscrire aux événements et
          traîner avec le reste de la squad. À très vite sur les games ! 🚀
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
