const CACHE = 'alpha-v3';
const ASSETS = ['/index.html', '/styles.css', '/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Requisições não-GET (envio de lead pro Supabase / planilha) passam direto
  if (req.method !== 'GET') return;

  // Documento HTML: rede primeiro, cache como reserva (sempre versão atualizada)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Demais arquivos (CSS, JS, ícones, manifest): cache primeiro, mas atualiza
  // o cache em segundo plano a cada visita (stale-while-revalidate) — assim
  // deploys futuros de app.js/styles.css chegam sem depender de bump manual do CACHE.
  e.respondWith(
    caches.match(req).then(cached => {
      const emBackground = fetch(req)
        .then(res => {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || emBackground;
    })
  );
});
