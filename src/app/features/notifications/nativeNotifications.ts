import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { APP_SETTINGS_KEYS, readSetting } from '../../settings'
import {
  dateKey,
  getTimings,
  parsePrayerTime,
  readPrayerCoords,
  type Timings,
} from '../prayer/prayerTimes'

// Native Android prayer notifications with an adhan sound, replacing the
// web-only timers inside the Capacitor shell. All scheduling is local; no
// server or service worker is involved.

export type AdhanSoundMode = 'adhan' | 'default' | 'silent'

export function readAdhanSoundMode(): AdhanSoundMode {
  const v = readSetting('adhan_sound', 'adhan')
  return v === 'default' || v === 'silent' ? v : 'adhan'
}

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const
const LABELS: Record<string, string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
}
const ADHAN_CHANNEL = 'muslim-adhan'
const PRAYER_CHANNEL = 'muslim-prayer'
const ID_BASE = 700_000_000

let scheduledFingerprint = ''

async function ensureChannels() {
  try {
    const sound = readAdhanSoundMode()
    await LocalNotifications.createChannel({
      id: PRAYER_CHANNEL,
      name: 'مواقيت الصلاة',
      importance: 'HIGH' as never,
      visibility: 'PUBLIC' as never,
      sound: sound === 'silent' ? undefined : undefined,
      vibration: sound !== 'silent',
    } as never)
    await LocalNotifications.createChannel({
      id: ADHAN_CHANNEL,
      name: 'الأذان',
      description: 'أذان وقت الصلاة',
      importance: 'HIGH' as never,
      visibility: 'PUBLIC' as never,
      sound: sound === 'adhan' ? 'adhan.mp3' : undefined,
      vibration: sound !== 'silent',
    } as never)
  } catch {
    // Channel creation can fail on unsupported webviews; notifications still work.
  }
}

async function requestPermission(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}

async function cancelOurs() {
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + 100_000)
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  } catch {}
}

function dayEntries(date: Date, timings: Timings | null, atTimeEnabled: boolean, beforeEnabled: boolean, leadMinutes: number) {
  const key = dateKey(date)
  const now = Date.now()
  const out: { id: number; at: Date; title: string; body: string; adhan: boolean }[] = []
  for (const prayer of PRAYERS) {
    const time = timings ? parsePrayerTime(timings[prayer], date) : null
    if (!time) continue
    if (atTimeEnabled && time.getTime() > now) {
      out.push({
        id: ID_BASE + hash(key + prayer + 'at'),
        at: time,
        title: 'حان وقت صلاة ' + LABELS[prayer],
        body: 'حي على الصلاة، حي على الفلاح',
        adhan: true,
      })
    }
    if (beforeEnabled) {
      const before = new Date(time.getTime() - leadMinutes * 60_000)
      if (before.getTime() > now) {
        out.push({
          id: ID_BASE + hash(key + prayer + 'before'),
          at: before,
          title: 'اقترب وقت صلاة ' + LABELS[prayer],
          body: 'تبقى ' + leadMinutes + ' دقائق على الأذان',
          adhan: false,
        })
      }
    }
  }
  return out
}

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) % 90_000
  return h
}

export async function scheduleNativePrayerNotifications() {
  if (!Capacitor.isNativePlatform()) return
  const atTimeEnabled = readSetting(APP_SETTINGS_KEYS.prayerTime, '1') === '1'
  const beforeEnabled = readSetting(APP_SETTINGS_KEYS.reminders) === '1'
  if (!atTimeEnabled && !beforeEnabled) return
  const coords = readPrayerCoords()
  if (!coords) return
  const fingerprint = [coords.lat, coords.lng, atTimeEnabled, beforeEnabled, readAdhanSoundMode(), dateKey(new Date())].join('|')
  if (fingerprint === scheduledFingerprint) return
  scheduledFingerprint = fingerprint

  const granted = await requestPermission()
  if (!granted) return
  await ensureChannels()

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  let todayTimings: Timings | null = null
  let tomorrowTimings: Timings | null = null
  try {
    ;[todayTimings, tomorrowTimings] = await Promise.all([getTimings(coords, today), getTimings(coords, tomorrow)])
  } catch {
    return
  }
  const lead = Number(readSetting(APP_SETTINGS_KEYS.prayerReminderLead, '5')) || 5
  const entries = [
    ...dayEntries(today, todayTimings, atTimeEnabled, beforeEnabled, lead),
    ...dayEntries(tomorrow, tomorrowTimings, atTimeEnabled, beforeEnabled, lead),
  ]

  await cancelOurs()
  if (!entries.length) return
  try {
    await LocalNotifications.schedule({
      notifications: entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        schedule: { at: entry.at, allowWhileIdle: true },
        channelId: entry.adhan ? ADHAN_CHANNEL : PRAYER_CHANNEL,
        actionTypeId: '',
        extra: { target: 'prayer' },
      })),
    })
  } catch {}
}
