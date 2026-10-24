import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { APP_SETTINGS_KEYS, readSetting } from '../../settings'
import { dailyAyahFor } from '../../../daily-ayahs'
import {
  dateKey,
  getTimings,
  parsePrayerTime,
  readPrayerCoords,
  type Timings,
} from '../prayer/prayerTimes'

// Native Android notifications with an adhan sound, covering prayer times,
// pre-prayer reminders, the daily ayah, the Quran reading reminder and the
// morning/evening azkar. All scheduling is local; no server or service worker
// is involved. Replaces the web timers (useIslamicNotifications /
// usePrayerReminders) which stop the moment the app is closed inside the APK.

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
const REMINDER_CHANNEL = 'muslim-reminders'
const ID_BASE = 700_000_000

let scheduledFingerprint = ''
let createdChannelSound: string | null = null
let inFlight: Promise<void> | null = null

async function ensureChannels() {
  const sound = readAdhanSoundMode()
  // Android never updates an existing channel's sound, so the adhan channel is
  // deleted and recreated whenever the selected sound mode changes. Without
  // this, changing the setting in the app had no effect until reinstall.
  if (sound !== createdChannelSound) {
    createdChannelSound = sound
    for (const id of [ADHAN_CHANNEL, PRAYER_CHANNEL]) {
      try {
        await LocalNotifications.deleteChannel({ id })
      } catch {}
    }
  }
  try {
    await LocalNotifications.createChannel({
      id: PRAYER_CHANNEL,
      name: 'تذكير قبل الصلاة',
      importance: 'DEFAULT' as never,
      visibility: 'PUBLIC' as never,
      vibration: true,
    } as never)
    await LocalNotifications.createChannel({
      id: ADHAN_CHANNEL,
      name: 'الأذان',
      description: 'أذان وقت الصلاة',
      importance: (sound === 'silent' ? 'LOW' : 'HIGH') as never,
      visibility: 'PUBLIC' as never,
      ...(sound === 'adhan' ? { sound: 'adhan.mp3' } : {}),
      vibration: sound !== 'silent',
    } as never)
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL,
      name: 'التذكيرات اليومية',
      description: 'آية اليوم وتذكير القرآن وأذكار الصباح والمساء',
      importance: 'DEFAULT' as never,
      visibility: 'PUBLIC' as never,
      vibration: true,
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

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) % 90_000
  return h
}

function midnightOf(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function atTime(date: Date, hours: number, minutes: number) {
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}

type Entry = { id: number; at: Date; title: string; body: string; channel: string; target: string }

async function run() {
  const atTimeEnabled = readSetting(APP_SETTINGS_KEYS.prayerTime, '1') === '1'
  const beforeEnabled = readSetting(APP_SETTINGS_KEYS.reminders) === '1'
  const ayahEnabled = readSetting(APP_SETTINGS_KEYS.dailyAyah, '0') === '1'
  const quranEnabled = readSetting(APP_SETTINGS_KEYS.quranReminder, '0') === '1'
  const morningEnabled = readSetting(APP_SETTINGS_KEYS.azkarMorning, '0') === '1'
  const eveningEnabled = readSetting(APP_SETTINGS_KEYS.azkarEvening, '0') === '1'
  const quranTime = readSetting(APP_SETTINGS_KEYS.quranReminderTime, '20:00')
  const lead = Number(readSetting(APP_SETTINGS_KEYS.prayerReminderLead, '5')) || 5
  const sound = readAdhanSoundMode()
  const coords = readPrayerCoords()
  const needsTimings = (atTimeEnabled || beforeEnabled || morningEnabled || eveningEnabled) && !!coords

  const fingerprint = [
    coords?.lat ?? '',
    coords?.lng ?? '',
    atTimeEnabled,
    beforeEnabled,
    ayahEnabled,
    quranEnabled,
    quranTime,
    morningEnabled,
    eveningEnabled,
    lead,
    sound,
    dateKey(new Date()),
  ].join('|')
  if (fingerprint === scheduledFingerprint) return

  const granted = await requestPermission()
  if (!granted) return
  await ensureChannels()
  scheduledFingerprint = fingerprint

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let todayTimings: Timings | null = null
  let tomorrowTimings: Timings | null = null
  if (needsTimings && coords) {
    try {
      ;[todayTimings, tomorrowTimings] = await Promise.all([getTimings(coords, today), getTimings(coords, tomorrow)])
    } catch {
      // Prayer/azkar entries are skipped for now; the next hourly refresh retries.
    }
  }

  const entries: Entry[] = []
  const push = (key: string, at: Date, title: string, body: string, channel: string, target: string) => {
    if (at.getTime() <= Date.now()) return
    entries.push({ id: ID_BASE + hash(key), at, title, body, channel, target })
  }

  const day = (date: Date, timings: Timings | null) => {
    if (!timings) return
    const key = dateKey(date)
    for (const prayer of PRAYERS) {
      const time = parsePrayerTime(timings[prayer], date)
      if (!time) continue
      if (atTimeEnabled) {
        push(key + prayer + 'at', time, 'حان وقت صلاة ' + LABELS[prayer], 'حي على الصلاة، حي على الفلاح', ADHAN_CHANNEL, 'prayer')
      }
      if (beforeEnabled) {
        push(
          key + prayer + 'before',
          new Date(time.getTime() - lead * 60_000),
          'اقترب وقت صلاة ' + LABELS[prayer],
          'تبقى ' + lead + ' دقائق على الأذان',
          PRAYER_CHANNEL,
          'prayer',
        )
      }
    }
    const sunrise = parsePrayerTime(timings.Sunrise, date)
    const sunset = parsePrayerTime(timings.Sunset, date)
    if (morningEnabled && sunrise) {
      push(key + 'morning', sunrise, 'أذكار الصباح', 'حان وقت أذكار الصباح مع الشروق.', REMINDER_CHANNEL, 'azkar')
    }
    if (eveningEnabled && sunset) {
      push(key + 'evening', sunset, 'أذكار المساء', 'حان وقت أذكار المساء مع الغروب.', REMINDER_CHANNEL, 'azkar')
    }
  }
  day(today, todayTimings)
  day(tomorrow, tomorrowTimings)

  if (ayahEnabled) {
    // The coming two midnights; the ayah text matches each scheduled date.
    for (let i = 1; i <= 2; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const at = midnightOf(date)
      const ayah = dailyAyahFor(at)
      push(dateKey(date) + 'ayah', at, 'آية اليوم', ayah.text + ' — ' + ayah.surah, REMINDER_CHANNEL, 'ayah')
    }
  }

  if (quranEnabled) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(quranTime)
    if (match) {
      for (const date of [today, tomorrow]) {
        push(
          dateKey(date) + 'quran',
          atTime(date, Number(match[1]), Number(match[2])),
          'حان وقت قراءة القرآن',
          'خصص وقتك اليوم لتلاوة القرآن.',
          REMINDER_CHANNEL,
          'ayah',
        )
      }
    }
  }

  await cancelOurs()
  if (!entries.length) return
  try {
    await LocalNotifications.schedule({
      notifications: entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        schedule: { at: entry.at, allowWhileIdle: true },
        channelId: entry.channel,
        actionTypeId: '',
        extra: { target: entry.target },
      })),
    })
  } catch {}
}

/**
 * Schedules every native notification type (prayer, adhan reminders, daily
 * ayah, Quran reminder, morning/evening azkar). Safe to call repeatedly:
 * in-flight calls are deduplicated and an unchanged state is a no-op.
 */
export function scheduleNativeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}
