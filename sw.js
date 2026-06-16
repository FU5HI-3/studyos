// StudyOS Service Worker v1
const CACHE = 'studyos-v1';
const ASSETS = ['./study-app.html', './manifest.json'];

// ===== インストール：アセットをキャッシュ =====
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ===== アクティベート：古いキャッシュ削除 =====
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ===== フェッチ：キャッシュ優先 =====
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./study-app.html')))
  );
});

// ===== プッシュ通知受信 =====
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'StudyOS', body: '締切が近づいています！' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'StudyOS', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'studyos',
      data: data,
      actions: [
        { action: 'open', title: '開く' },
        { action: 'dismiss', title: '後で' }
      ],
      vibrate: [200, 100, 200]
    })
  );
});

// ===== 通知クリック =====
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./study-app.html');
    })
  );
});

// ===== ローカル通知スケジューラー（メインから呼ばれる） =====
// アプリが開いているときにタイマーを設定、バックグラウンドでは動かない
// → アプリ起動時に毎回チェックして当日分のアラームをセットする方式
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = e.data;
    // delay ms 後に通知（最大24h）
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: './icon-192.png',
        tag: 'deadline-' + Date.now(),
        vibrate: [300, 100, 300]
      });
    }, Math.min(delay, 86400000));
  }
});
