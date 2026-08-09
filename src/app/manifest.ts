import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CHAMA Squad Manager",
    short_name: "CHAMA",
    description:
      "Gestion de team Warzone, mix automatique, événements et communauté CHAMA.",
    start_url: "/acceuil",
    display: "standalone",
    background_color: "#0b0f1e",
    theme_color: "#0b0f1e",
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
