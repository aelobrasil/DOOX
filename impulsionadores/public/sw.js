const CACHE='hocco-shell-v8';
const META='hocco-meta-v1';
const CORE=['/offline','/manifest.webmanifest','/icon.svg','/hocco-192.png','/hocco-512.png','/hocco-badge-96.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>![CACHE,META].includes(key)).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname==='/controle')return;
  const isStatic=url.pathname.startsWith('/_next/static/')||['/manifest.webmanifest','/icon.svg','/hocco-192.png','/hocco-512.png','/hocco-badge-96.png'].includes(url.pathname);
  if(isStatic){
    event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{
      if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(request,clone))}
      return response;
    })));
    return;
  }
  if(request.mode==='navigate') event.respondWith(fetch(request).catch(()=>caches.match('/offline')));
});

async function showHoccoNotification(data={}){
  const title=data.title||'HOCCO · a história continua';
  const options={
    body:data.body||'Acompanhe os novos acontecimentos, bastidores e experiências da comunidade HOCCO.',
    icon:'/hocco-192.png',
    badge:'/hocco-badge-96.png',
    tag:data.tag||'hocco-daily',
    lang:'pt-BR',
    renotify:false,
    data:{url:data.url||'/app'},
  };
  return self.registration.showNotification(title,options);
}

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||''}}
  event.waitUntil(showHoccoNotification(data));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/app';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(const client of clients){
      if('focus' in client){client.navigate(target);return client.focus()}
    }
    return self.clients.openWindow?self.clients.openWindow(target):null;
  }));
});

async function dailyReminder(){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const cache=await caches.open(META);
  const key=new Request(`${self.location.origin}/__hocco_daily_reminder`);
  const previous=await cache.match(key);
  if(previous&&await previous.text()===today)return;
  await showHoccoNotification({
    title:'HOCCO · a história continua hoje',
    body:'Acompanhe os novos acontecimentos, bastidores e experiências da comunidade HOCCO.',
    tag:'hocco-daily-reminder',
    url:'/app',
  });
  await cache.put(key,new Response(today,{headers:{'Content-Type':'text/plain'}}));
}

self.addEventListener('periodicsync',event=>{
  if(event.tag==='hocco-daily-reminder')event.waitUntil(dailyReminder());
});
