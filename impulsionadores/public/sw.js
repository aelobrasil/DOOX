const CACHE='hocco-shell-v3';
const CORE=['/offline','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  const isStatic=url.pathname.startsWith('/_next/static/')||url.pathname==='/manifest.webmanifest'||url.pathname==='/icon.svg';
  if(isStatic){event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(request,clone))}return response})));return}
  if(request.mode==='navigate') event.respondWith(fetch(request).catch(()=>caches.match('/offline')));
});
