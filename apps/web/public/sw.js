// Service Worker for Web Push Notifications
// Handles push events and notification clicks — no fetch caching.

// Activate immediately without waiting for existing clients to close
self.addEventListener('install', (event) => {
  console.log('[SW] Installing')
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  console.log('[SW] Push received', event)

  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
      console.log('[SW] Push data:', data)
    } catch (err) {
      console.error('[SW] Failed to parse push data:', err)
      data = { title: 'Abaci One', body: event.data.text() }
    }
  }

  const title = data.title || 'Abaci One'
  const options = {
    body: data.body || 'New notification',
    icon: data.icon || '/icon-192x192.png',
    data: data.data || {},
  }

  console.log('[SW] Showing notification:', title, options)
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url
  if (!url) return

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
