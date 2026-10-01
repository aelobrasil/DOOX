const CACHE='doox-static-v2026-10-01-order-fix';
const ASSETS=['/','/index.html','/manifest.webmanifest','/assets/hocco-simulacao-modelo.mp4','/assets/hocco-simulacao-modelo-poster.jpg','/assets/overlay-audio-notificacao.mp3'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/')) return;

  // HTML/JS/CSS must always be refreshed from the network so a deployment
  // cannot leave the browser running an obsolete order-submission flow.
  const dynamic=/\.(html?|js|css)$/i.test(url.pathname) || url.pathname==='/' || url.pathname==='/manifest.webmanifest';
  if(dynamic){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached=>cached||fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
        return response;
      }).catch(()=>cached))
  );
});
