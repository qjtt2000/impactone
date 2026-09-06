const CACHE='impactone-daily-v317-footer-reference-fix-20260906';
const STATIC=[
  '/daily-publication.css','/daily-interactions.js','/impactone-config.js','/manifest.webmanifest',
  '/images/brand/impactone-icon-192.png','/images/brand/impactone-icon-512.png',
  '/images/daily/impactone-skyline-20260906.png',
  '/images/daily/ui/focus-icon.png','/images/daily/ui/scan-icon.png','/images/daily/ui/view-mark.png',
  '/images/daily/sample-oil-clean-v315.png',
  '/images/brand/impactone-logo-original.png','/images/brand/impactone-logo-raw-20260906.png','/images/daily/impactone-nyc-skyline-original.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const req=event.request;
  const url=new URL(req.url);

  // Pages and code files are network-first so a new deployment is not hidden behind an old PWA cache.
  if(req.mode==='navigate' || /\.(?:js|css|webmanifest)$/i.test(url.pathname)){
    event.respondWith(
      fetch(req).then(res=>{
        if(res.ok && url.origin===location.origin){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy));
        }
        return res;
      }).catch(()=>caches.match(req))
    );
    return;
  }

  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res.ok&&url.origin===location.origin){
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy));
    }
    return res;
  })));
});

// Web Push receiver. The backend may send JSON or plain text.
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json?.()||{}}catch{data={body:event.data?.text?.()||''}}
  const title=data.title||'IMPACTONE｜每日必读';
  const options={
    body:data.body||'今日《影响力·每日必读》已更新，点击查看。',
    icon:data.icon||'/images/brand/impactone-icon-192.png',
    badge:data.badge||'/images/brand/impactone-icon-192.png',
    data:{url:data.url||'/daily/2026-08-19.html'},
    tag:data.tag||'impactone-daily',
    renotify:false
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||'/daily/2026-08-19.html',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus' in client){
        try{await client.navigate(target)}catch{}
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
