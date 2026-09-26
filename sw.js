// Service Worker — مسؤول عن استقبال إشعارات Push الحقيقية وعرضها
// حتى لو الموقع مسكّر تماماً أو الموبايل بالخلفية.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'تنبيه من مبنى الطاقة', body: '' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    try { data.body = event.data.text(); } catch (e2) {}
  }

  const options = {
    body: data.body || '',
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    vibrate: [180, 80, 180],
    dir: 'rtl',
    lang: 'ar',
    tag: 'energy-building-alert',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'تنبيه من مبنى الطاقة', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
