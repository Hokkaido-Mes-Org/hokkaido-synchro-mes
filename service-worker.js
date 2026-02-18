// service-worker.js
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Notificação Syncrho MES';
  const options = {
    body: data.body || 'Uma máquina está parada há mais de 10 minutos.',
    icon: data.icon || 'https://i.postimg.cc/5jdHwhF9/hokkaido-logo-110.png',
    badge: data.badge || 'https://i.postimg.cc/5jdHwhF9/hokkaido-logo-110.png',
    data: data.url || '/' // URL para abrir ao clicar
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
