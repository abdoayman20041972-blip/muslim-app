import { describe, expect, it } from 'vitest'
import {
  buildNotificationPayload,
  notificationTag,
  type NotificationEnvelope,
} from '../../convex/notificationEngine'

describe('notification engine', () => {
  it('builds a stable typed notification envelope without changing its metadata', () => {
    const notification: NotificationEnvelope = {
      type: 'prayer-reminder',
      title: 'اقترب وقت الصلاة',
      body: 'الفجر بعد ٥ دقائق',
      tag: notificationTag('prayer-reminder', 'Fajr-before-2026-09-28'),
      url: '/',
      target: 'prayer',
      metadata: {
        prayer: 'Fajr',
        event: 'before',
        date: '2026-09-28',
      },
    }

    expect(buildNotificationPayload(notification)).toEqual(notification)
    expect(notification.tag).toBe(
      'muslim-prayer-reminder-Fajr-before-2026-09-28',
    )
  })

  it('covers every notification type currently represented by the engine', () => {
    const types = ['prayer-reminder', 'adhan', 'azkar', 'daily-ayah', 'quran-reminder'] as const
    for (const type of types) {
      const payload: NotificationEnvelope = {
        type, title: 'title', body: 'body', tag: notificationTag(type, 'x'), url: '/', target: type === 'azkar' ? 'azkar' : type === 'quran-reminder' || type === 'daily-ayah' ? 'quran' : 'prayer',
      }
      expect(buildNotificationPayload(payload)).toEqual(payload)
    }
  })

  it('preserves optional sound, vibration, and metadata fields', () => {
    const payload: NotificationEnvelope = {
      type: 'adhan', title: 'حان وقت الصلاة', body: 'الفجر', tag: 'x', url: '/?open=prayer', target: 'prayer', sound: 'adhan', vibrate: [200, 100, 200], metadata: { prayer: 'Fajr' },
    }
    const result = buildNotificationPayload(payload)
    expect(result).toEqual(payload)
    expect(result.metadata).not.toBe(payload.metadata)
  })

  it('supports the notification tag naming contract', () => {
    expect(notificationTag('prayer-reminder', 'x')).toBe('muslim-prayer-reminder-x')
    expect(notificationTag('adhan', 'x')).toBe('muslim-adhan-x')
    expect(notificationTag('azkar', 'x')).toBe('muslim-azkar-x')
    expect(notificationTag('quran-reminder', 'x')).toBe('muslim-quran-reminder-x')
  })
})
