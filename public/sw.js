const FALLBACK_URL = '/chat'
const FALLBACK_ICON = '/icon-192.png'

function safeAppPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return FALLBACK_URL
  }

  try {
    const url = new URL(value, self.location.origin)
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : FALLBACK_URL
  } catch {
    return FALLBACK_URL
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}

  try {
    const parsed = event.data ? event.data.json() : {}
    payload = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'Venezuela Inmuebles'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: typeof payload.icon === 'string' ? payload.icon : FALLBACK_ICON,
    badge: FALLBACK_ICON,
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    data: { url: safeAppPath(payload.click_url || payload.url) },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetPath = safeAppPath(event.notification.data && event.notification.data.url)
  const targetUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (client.url === targetUrl && 'focus' in client) return client.focus()
      if ('navigate' in client && 'focus' in client) {
        await client.navigate(targetUrl)
        return client.focus()
      }
    }

    return self.clients.openWindow(targetUrl)
  })())
})
