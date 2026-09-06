const CACHE_NAME='hocco-doox-v20';
const ASSETS=[
'/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png',
'/hocco-poster-oficial.png','/hocco-story-1.png','/hocco-story-2.png','/hocco-universe.png',
'/insertion-guide.png','/overlay-cinematic.png','/pov-demo-01.jpg','/pov-demo-02.jpg','/pov-demo-03.jpg','/simulacao-cinematica.jpg'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const isNavigation=e.request.mode==='navigate' || new URL(e.request.url).pathname==='/' || new URL(e.request.url).pathname==='/index.html';
 if(isNavigation){
   e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE_NAME).then(c=>c.put('/index.html',clone)).catch(()=>{});return r;}).catch(()=>caches.match('/index.html')));
   return;
 }
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,clone)).catch(()=>{});return r;}).catch(()=>caches.match('/index.html'))));
});
