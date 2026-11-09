// Service worker de Mi Día (versión web).
// 1. Guarda la app en el dispositivo para que abra sin conexión (los datos los cachea la app aparte).
// 2. Recibe los avisos Web Push aunque la app esté cerrada y, al tocarlos, abre la pantalla que toca.
//
// BUILD y PRECACHE los rellena scripts/build-sw.mjs después de `expo export` (cada deploy = versión nueva).
// En desarrollo (`expo start`) se quedan así y no se cachea nada.

const BUILD = 'dev';
const PRECACHE = [];

const PREFIX = 'mi-dia-';
const CACHE = PREFIX + BUILD;
const KEEP_BUILDS = 2; // la versión anterior se conserva por si una pestaña abierta aún la usa
const NAV_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (BUILD !== 'dev') {
        const cache = await caches.open(CACHE);
        await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Los nombres llevan la fecha del build delante: se conservan las KEEP_BUILDS más recientes
      const ours = (await caches.keys()).filter((k) => k.startsWith(PREFIX)).sort().reverse();
      await Promise.all(ours.slice(KEEP_BUILDS).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (BUILD === 'dev' || req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase y demás: directo a la red

  // Páginas: primero la red (versión al día); sin conexión o si tarda, la app guardada
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await withTimeout(fetch(req), NAV_TIMEOUT_MS);
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Archivos de la app (nombres con hash, no cambian): primero la caché
  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })(),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// ---------- Avisos Web Push ----------

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Mi Día';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ('navigate' in w && w.url !== url) await w.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
