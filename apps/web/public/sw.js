// Service Worker for Web Push Notifications
// Handles push events and notification clicks — no fetch caching.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    return
  }

  const title = data.title || 'Abaci One'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    data: data.data || {},
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url
  if (!url) return

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab if one matches the URL
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise open a new window
        return clients.openWindow(url)
      })
  )
})
