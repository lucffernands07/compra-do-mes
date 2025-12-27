const CACHE_NAME = 'precos-v1';
const assets = [
  './',
  './index.html',
  './app.js',
  './styles.css', // adicione o nome do seu arquivo CSS aqui
  './prices/compare.json'
];

// Instala o service worker e guarda os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Responde com o cache quando estiver offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
