// Service worker minimal : uniquement les notifications push (pas de cache
// offline — on ne veut pas risquer de servir des pages périmées).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Chrome/Android vérifie la présence d'un gestionnaire fetch pour juger un
// site "installable" (condition de beforeinstallprompt) — sans lui, le
// bouton d'install en un clic peut ne jamais se proposer sur certains
// appareils/versions. Pur passage au réseau, aucun cache ajouté (voir le
// commentaire en tête de fichier : volontairement pas de mode hors-ligne).
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "CHAMA", body: event.data.text() };
  }

  const title = payload.title || "CHAMA";
  const url = payload.url || "/";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
      });

      // Badge sur l'icône de l'app (PWA installée) — pas supporté partout,
      // on ignore silencieusement si l'API n'existe pas.
      if ("setAppBadge" in self.navigator) {
        try {
          const clientsList = await self.clients.matchAll({ type: "window" });
          const unreadHint = clientsList.length === 0 ? 1 : undefined;
          if (unreadHint) await self.navigator.setAppBadge(unreadHint);
        } catch {
          // ignore
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientsList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});
