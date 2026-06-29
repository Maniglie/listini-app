// sw.js — Service Worker Listini Prezzi
const CACHE_VERSION = 1;
const CACHE_NAME = `listini-v${CACHE_VERSION}`;

// Shell files da cachare subito (escluso index.html — sempre network-first)
const PRECACHE = [
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/iife/polyfill.min.js',
];

// ── Install: precache app shell ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: elimina cache vecchie ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase API → sempre network (dati sempre freschi)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // index.html → network-first, fallback cache (aggiornamenti immediati)
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Font Google → stale-while-revalidate
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fresh = fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        });
        return cached || fresh;
      })
    );
    return;
  }

  // Tutto il resto → cache-first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
