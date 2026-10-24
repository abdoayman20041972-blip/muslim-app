import { describe, expect, it } from 'vitest'
import { buildCandidate, buildSimpleCandidate, candidatesFor } from '../../convex/schedulerNode'

const subscription = {
  deviceId: '12345678-device',
  endpoint: 'https://example.test/push',
  p256dh: 'p256dh',
  auth: 'auth',
  lat: 30.29,
  lng: 31.32,
  timezone: 'Africa/Cairo',
  calcMethod: '5',
  asrSchool: '0',
  remindersEnabled: false,
  prayerTimeEnabled: true,
  prayerReminderLead: 5,
  dailyAyahEnabled: true,
  quranReminderEnabled: true,
  quranReminderTime: '20:00',
  azkarMorningEnabled: true,
  azkarEveningEnabled: true,
  lastSentKeys: [],
} as any

const timings = { Sunrise: '05:21', Sunset: '18:42' }

describe('server notification candidates', () => {
  it('creates daily ayah at midnight and rejects it after the 3-minute window', () => {
    const atMidnight = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 0, minute: 0, second: 0 }, 'daily-ayah', timings)
    const insideCompensation = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 0, minute: 2, second: 59 }, 'daily-ayah', timings)
    const afterWindow = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 0, minute: 3, second: 0 }, 'daily-ayah', timings)
    expect(atMidnight?.notification.type).toBe('daily-ayah')
    expect(atMidnight?.notification.url).toBe('/?open=ayah')
    expect(atMidnight?.sentKey).toBe('2026-09-30:daily-ayah')
    expect(insideCompensation?.notification.type).toBe('daily-ayah')
    expect(afterWindow).toBeNull()
    expect(atMidnight?.notification.tag).toBe('muslim-daily-ayah-2026-09-30')
  })

  it('supports an independent prayer-time notification without the pre-prayer reminder', () => {
    const atPrayer = candidatesFor({ ...subscription, remindersEnabled: false, prayerTimeEnabled: true }, { year: 2026, month: 9, day: 30, hour: 5, minute: 21, second: 0 }, { Fajr: '05:21', Dhuhr: '12:44', Asr: '16:09', Maghrib: '18:40', Isha: '19:58' })
    expect(atPrayer.map((candidate) => candidate.event)).toContain('now')
    const beforeOnly = candidatesFor({ ...subscription, remindersEnabled: true, prayerTimeEnabled: false }, { year: 2026, month: 9, day: 30, hour: 5, minute: 16, second: 0 }, { Fajr: '05:21', Dhuhr: '12:44', Asr: '16:09', Maghrib: '18:40', Isha: '19:58' })
    expect(beforeOnly.map((candidate) => candidate.event)).toContain('before')
    expect(beforeOnly.map((candidate) => candidate.event)).not.toContain('now')
  })

  it('creates the Quran reading reminder at the selected time and rejects it after the window', () => {
    const atTime = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 20, minute: 0, second: 0 }, 'quran-reminder', timings)
    const inside = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 20, minute: 2, second: 59 }, 'quran-reminder', timings)
    const after = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 20, minute: 3, second: 0 }, 'quran-reminder', timings)
    expect(atTime?.notification.type).toBe('quran-reminder')
    expect(atTime?.notification.url).toBe('/?open=ayah')
    expect(atTime?.notification.tag).toBe('muslim-quran-reminder-2026-09-30')
    expect(inside).not.toBeNull()
    expect(after).toBeNull()
  })

  it('keeps Push tags identical to the existing Local Notification tag contract', () => {
    const before = buildCandidate(subscription, 'Fajr', 'before', '2026-09-30', 5, 300)
    const now = buildCandidate(subscription, 'Fajr', 'now', '2026-09-30', 5, 300)
    expect(before.notification.tag).toBe('azkar-Fajr-before-2026-09-30')
    expect(now.notification.tag).toBe('azkar-Fajr-now-2026-09-30')
  })

  it('creates morning and evening azkar with client-matching tags and routes', () => {
    const morning = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 5, minute: 21, second: 0 }, 'azkar-morning', timings)
    const evening = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 18, minute: 42, second: 0 }, 'azkar-evening', timings)
    expect(morning?.notification.tag).toBe('muslim-azkar-morning-2026-09-30')
    expect(morning?.notification.url).toBe('/?open=azkar')
    expect(evening?.notification.tag).toBe('muslim-azkar-evening-2026-09-30')
    expect(evening?.sentKey).toBe('2026-09-30:azkar-evening')
  })

  it('checks the exact three-minute boundary for Azkar timing windows', () => {
    const before = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 5, minute: 20, second: 59 }, 'azkar-morning', timings)
    const atStart = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 5, minute: 21, second: 0 }, 'azkar-morning', timings)
    const atEnd = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 5, minute: 24, second: 0 }, 'azkar-morning', timings)
    expect(before).toBeNull()
    expect(atStart).not.toBeNull()
    expect(atEnd).toBeNull()
  })

  it('requires Sunrise and Sunset timing values for Azkar windows', () => {
    const withoutSunrise = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 5, minute: 21, second: 0 }, 'azkar-morning', {})
    const withoutSunset = buildSimpleCandidate(subscription, { year: 2026, month: 9, day: 30, hour: 18, minute: 42, second: 0 }, 'azkar-evening', {})
    expect(withoutSunrise).toBeNull()
    expect(withoutSunset).toBeNull()
  })
})
