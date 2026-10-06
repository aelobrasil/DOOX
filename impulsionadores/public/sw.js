const CACHE='hocco-shell-v4';
const META='hocco-meta-v1';
const CORE=['/offline','/manifest.webmanifest','/icon.svg'];

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
  const isStatic=url.pathname.startsWith('/_next/static/')||url.pathname==='/manifest.webmanifest'||url.pathname==='/icon.svg';
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
  const title=data.title||'HOCCO · mantenha sua ofensiva';
  const options={
    body:data.body||'Entre hoje, mantenha sua sequência e acompanhe os Hypes e benefícios HOCCO.',
    icon:'/icon.svg',
    badge:'/icon.svg',
    tag:data.tag||'hocco-daily',
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
    title:'HOCCO · sua ofensiva continua hoje',
    body:'Entre hoje para manter sua ofensiva e acompanhar os Hypes, HC e benefícios HOCCO.',
    tag:'hocco-daily-reminder',
    url:'/app',
  });
  await cache.put(key,new Response(today,{headers:{'Content-Type':'text/plain'}}));
}

self.addEventListener('periodicsync',event=>{
  if(event.tag==='hocco-daily-reminder')event.waitUntil(dailyReminder());
});
