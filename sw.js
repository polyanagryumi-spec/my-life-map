const CACHE='life-map-public-v4';
const ASSETS=['./','./index.html','./style.css','./app.js','./seed.js','./core.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const allowed=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('life-map-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  // Serve only the fixed interface assets; records and imported files never enter the cache or network.
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin){event.respondWith(Promise.resolve(Response.error()));return;}
  url.search='';url.hash='';
  const asset=allowed.has(url.href)?url.href:event.request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:null;
  if(!asset){event.respondWith(Promise.resolve(new Response('Not found',{status:404})));return;}
  event.respondWith(fetch(asset,{credentials:'omit',referrerPolicy:'no-referrer'}).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(asset,copy)));return response;}
    return caches.match(asset).then(cached=>cached||response);
  }).catch(()=>caches.match(asset).then(cached=>cached||Response.error())));
});
