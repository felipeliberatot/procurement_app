// Service Worker para CGS Agrícola PWA
const CACHE_NAME = 'cgs-agricola-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Estratégia: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requisições de API
  if (event.request.url.includes('/api/trpc') || 
      event.request.url.includes('/api/admin')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
