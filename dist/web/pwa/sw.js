// Service Worker para CGS Agrícola PWA
// Versão atualizada — força limpeza de cache antigo
const CACHE_NAME = 'cgs-agricola-v3';
const ICON_CACHE = 'cgs-icons-v3';

self.addEventListener('install', (event) => {
  // Ativa imediatamente sem esperar tabs antigas fecharem
  self.skipWaiting();
  
  // Pré-cacheia os ícones novos
  event.waitUntil(
    caches.open(ICON_CACHE).then((cache) => {
      return cache.addAll([
        '/api/app/pwa/icons/icon-192x192.png',
        '/api/app/pwa/icons/icon-512x512.png',
        '/api/app/pwa/icons/icon-152x152.png',
      ]);
    }).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  // Remove todos os caches antigos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== ICON_CACHE)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => clients.claim())
  );
});

// Estratégia: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requisições de API e tRPC
  if (event.request.url.includes('/api/trpc') || 
      event.request.url.includes('/api/admin')) return;

  // Para ícones: Cache First (mais rápido)
  if (event.request.url.includes('/pwa/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(ICON_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Para demais recursos: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
