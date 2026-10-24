const CACHE_NAME = 'azkar-cache-v6'
const APP_SHELL = ['/', '/manifest.json', '/favicon.svg']
// Pages are fetched network-first so a new deploy shows up on the next visit;
// if the network is slow or offline we fall back to the cached copy.
const NAVIGATION_TIMEOUT_MS = 3500
const PUSH_SUBSCRIPTION_SYNC_URL = 'https://merry-mole-605.eu-west-1.convex.cloud/push-subscription-change'

async function networkFirstNavigation(event, request) {
  const cache = await caches.open(CACHE_NAME)
  const fromCache = async () => (await cache.match(request)) || (await cache.match('/'))
  try {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('navigation-timeout')), NAVIGATION_TIMEOUT_MS)
    })
    const response = await Promise.race([fetch(request), timeout]).finally(() => clearTimeout(timer))
    if (response.ok) {
      event.waitUntil(cache.put(request, response.clone()).catch(() => undefined))
      return response
    }
    if (response.status >= 500) return (await fromCache()) || response
    return response
  } catch {
    return (await fromCache()) || Response.error()
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

// Received when the push server sends a message via VAPID, even while the
// app is fully closed. The payload is JSON set by the server; we fall back
// to a generic notification if parsing fails so a malformed payload never
// silently drops the wake-up.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'مسلم'
  const body = data.body || ''
  const tag = data.tag
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      dir: 'rtl',
      lang: 'ar',
      icon: '/icon-192.png',
      ...(data.target === 'prayer' ? { vibrate: [200, 100, 200] } : {}),
      ...(tag ? { tag } : {}),
      ...(data.url ? { data: { url: data.url, target: data.target } } : {}),
    })
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin
  const quranApi = url.origin === 'https://api.alquran.cloud'
  const fontOrigin = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com'
  if (!sameOrigin && !quranApi && !fontOrigin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event, request))
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone()
            return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined).then(() => response)
          }
          return response
        })
        .catch(() => cached)
      event.waitUntil(refresh.catch(() => undefined))
      return cached || refresh
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  const oldSubscription = event.oldSubscription
  if (!oldSubscription) return

  event.waitUntil(
    self.registration.pushManager
      .subscribe(oldSubscription.options)
      .then(async (subscription) => {
        const oldEndpoint = oldSubscription.endpoint
        const endpoint = subscription.endpoint
        const p256dh = subscription.getKey('p256dh')
        const auth = subscription.getKey('auth')

        if (p256dh && auth) {
          const toBase64Url = (value) => {
            const bytes = new Uint8Array(value)
            let binary = ''
            bytes.forEach((byte) => {
              binary += String.fromCharCode(byte)
            })
            return btoa(binary)
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/g, '')
          }

          try {
            await fetch(PUSH_SUBSCRIPTION_SYNC_URL, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
              body: JSON.stringify({
                oldEndpoint,
                endpoint,
                p256dh: toBase64Url(p256dh),
                auth: toBase64Url(auth),
              }),
            })
          } catch {}
        }

        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        clients.forEach((client) =>
          client.postMessage({ type: 'push-subscription-changed' }),
        )
        return subscription
      })
      .catch(() => undefined),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)
      if (existing) {
        return existing.focus().then(() => existing.postMessage({
          type: 'notification-click',
          url: targetUrl,
        }))
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
