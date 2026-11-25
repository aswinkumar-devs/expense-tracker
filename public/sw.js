const CACHE_NAME='expense-tracker-v20261125';
const APP_SHELL=['/','/manifest.json','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;
  if(e.request.mode==='navigate'||url.pathname==='/'||url.pathname.endsWith('/index.html')){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put('/index.html',c));return r}).catch(()=>caches.match('/index.html').then(r=>r||caches.match('/'))));return}
  const hashed=/\/(?:assets\/[^/]+-[A-Za-z0-9_-]+\.[^/]+|[^/]+\.[a-f0-9]{8,}\.[^/]+)$/.test(url.pathname);
  if(hashed){e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(r.ok){const x=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put(e.request,x))}return r})))}
});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
