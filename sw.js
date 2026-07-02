// StudyOS Service Worker v2 - Web Push対応
const CACHE = 'studyos-v2';
const ASSETS = ['./index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// ===== プッシュ通知受信 =====
self.addEventListener('push', e => {
  let data = { title: 'StudyOS', body: 'お知らせがあります' };
  try { if (e.data) data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'studyos-' + Date.now(),
      vibrate: [200, 100, 200],
      data: { url: './' }
    })
  );
});

// ===== 通知タップ =====
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

// ===== インアプリ通知（アプリ起動中） =====
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body, icon: './icon.svg', badge: './icon.svg',
        vibrate: [300, 100, 300]
      });
    }, Math.min(delay, 86400000));
  }
});
