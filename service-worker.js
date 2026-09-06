const CACHE='impactone-daily-v311';
const STATIC=[
  '/daily-publication.css','/daily-interactions.js','/impactone-config.js','/manifest.webmanifest',
  '/images/brand/impactone-icon-192.png','/images/brand/impactone-icon-512.png',
  '/images/brand/impactone-logo-original.png','/images/daily/impactone-nyc-skyline-original.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const req=event.request;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res}).catch(()=>caches.match(req)));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok&&new URL(req.url).origin===location.origin){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res})));
});
