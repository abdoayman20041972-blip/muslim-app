import { useConvex } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { APP_SETTINGS_KEYS, readSetting } from '../../settings'
import { readPrayerCoords, currentMethod, currentSchool } from '../prayer/prayerTimes'
import { requestNotificationPermission } from './notifications'

const DEVICE_ID_KEY = 'azkar_push_device_id'

type SubscriptionPayload = {
  deviceId: string
  endpoint: string
  p256dh: string
  auth: string
  lat: number
  lng: number
  calcMethod: string
  asrSchool: string
  timezone: string
  remindersEnabled: boolean
  prayerTimeEnabled: boolean
  prayerReminderLead: number
  dailyAyahEnabled: boolean
  quranReminderEnabled: boolean
  quranReminderTime: string
  azkarMorningEnabled: boolean
  azkarEveningEnabled: boolean
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    // Storage unavailable: fall back to a session-only id rather than failing.
    return crypto.randomUUID()
  }
}

// Web Push requires the VAPID public key as a raw byte buffer, not the
// URL-safe base64 string the server hands us.
function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const array = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i)
  return array.buffer
}

function enabled(key: string) {
  return readSetting(key, '0') === '1'
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'permission-denied' | 'no-coords' | 'error' }

export function shouldRepairPushSubscription(
  permission: NotificationPermission,
  hasBrowserSubscription: boolean,
  syncResult: string | null,
) {
  return permission === 'granted' && hasBrowserSubscription && syncResult === null
}

export function usePushSubscription() {
  const convex = useConvex()
  const saveSubscription = (args: SubscriptionPayload) => {
    if (!convex) return Promise.reject(new Error('Convex client unavailable'))
    return convex.mutation(api.pushSubscriptions.saveSubscription, args)
  }
  const syncSubscription = (args: SubscriptionPayload) => {
    if (!convex) return Promise.resolve(null)
    return convex.mutation(api.pushSubscriptions.syncSubscription, args)
  }

  const readCurrentSubscription = async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return null
    }

    const coords = readPrayerCoords()
    if (!coords) return null

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return null

      const json = subscription.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!json.endpoint || !p256dh || !auth) return null

      return {
        deviceId: getDeviceId(),
        endpoint: json.endpoint,
        p256dh,
        auth,
        lat: coords.lat,
        lng: coords.lng,
        calcMethod: currentMethod(),
        asrSchool: currentSchool(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        remindersEnabled: enabled(APP_SETTINGS_KEYS.reminders),
        prayerTimeEnabled: enabled(APP_SETTINGS_KEYS.prayerTime),
        prayerReminderLead: 5,
        dailyAyahEnabled: enabled(APP_SETTINGS_KEYS.dailyAyah),
        quranReminderEnabled: enabled(APP_SETTINGS_KEYS.quranReminder),
        quranReminderTime: readSetting(APP_SETTINGS_KEYS.quranReminderTime, '20:00'),
        azkarMorningEnabled: enabled(APP_SETTINGS_KEYS.azkarMorning),
        azkarEveningEnabled: enabled(APP_SETTINGS_KEYS.azkarEvening),
      }
    } catch {
      return null
    }
  }

  const getStatus = async () => {
    if (!convex) return { exists: false, updatedAt: null as number | null }
    return convex.query(api.pushSubscriptions.getSubscriptionStatus, {
      deviceId: getDeviceId(),
    })
  }

  const hasBrowserSubscription = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false
    try {
      const registration = await navigator.serviceWorker.ready
      return Boolean(await registration.pushManager.getSubscription())
    } catch {
      return false
    }
  }

  const unsubscribe = async (): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) await subscription.unsubscribe()
      }
      if (!convex) return false
      await convex.mutation(api.pushSubscriptions.removeSubscription, {
        deviceId: getDeviceId(),
      })
      return true
    } catch {
      return false
    }
  }

  const sync = async (): Promise<boolean> => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return false
    }
    const current = await readCurrentSubscription()
    if (!current) return false
    const id = await syncSubscription(current)
    if (shouldRepairPushSubscription(Notification.permission, true, id)) {
      await saveSubscription(current)
      return true
    }
    return id !== null
  }

  const subscribe = async (): Promise<PushSubscribeResult> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' }
    }

    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      return { ok: false, reason: 'permission-denied' }
    }

    const coords = readPrayerCoords()
    if (!coords) {
      return { ok: false, reason: 'no-coords' }
    }

    try {
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
      }

      const json = subscription.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!json.endpoint || !p256dh || !auth) {
        return { ok: false, reason: 'error' }
      }

      await saveSubscription({
        deviceId: getDeviceId(),
        endpoint: json.endpoint,
        p256dh,
        auth,
        lat: coords.lat,
        lng: coords.lng,
        calcMethod: currentMethod(),
        asrSchool: currentSchool(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        remindersEnabled: enabled(APP_SETTINGS_KEYS.reminders),
        prayerTimeEnabled: enabled(APP_SETTINGS_KEYS.prayerTime),
        prayerReminderLead: 5,
        dailyAyahEnabled: enabled(APP_SETTINGS_KEYS.dailyAyah),
        quranReminderEnabled: enabled(APP_SETTINGS_KEYS.quranReminder),
        quranReminderTime: readSetting(APP_SETTINGS_KEYS.quranReminderTime, '20:00'),
        azkarMorningEnabled: enabled(APP_SETTINGS_KEYS.azkarMorning),
        azkarEveningEnabled: enabled(APP_SETTINGS_KEYS.azkarEvening),
      })

      return { ok: true }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  return { subscribe, sync, getStatus, hasBrowserSubscription, unsubscribe }
}
