// Focus Flow service worker — handles notification clicks
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = self.registration.scope;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(target) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
