const CACHE="hocco-v10-final";
const ASSETS=[
  "./","./index.html","./style.css","./app.js","./site.webmanifest",
  "./favicon.ico","./favicon-16x16.png","./favicon-32x32.png",
  "./apple-touch-icon.png","./icon-192.png","./icon-512.png","./icon-512-maskable.png"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  .then(()=>self.clients.claim())
));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r;
  }).catch(()=>caches.match("./index.html"))));
});
