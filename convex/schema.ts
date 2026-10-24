import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  pushSubscriptions: defineTable({
    deviceId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    lat: v.number(),
    lng: v.number(),
    timezone: v.string(),
    calcMethod: v.optional(v.string()),
    asrSchool: v.optional(v.string()),
    remindersEnabled: v.optional(v.boolean()),
    prayerTimeEnabled: v.optional(v.boolean()),
    prayerReminderLead: v.optional(v.number()),
    dailyAyahEnabled: v.optional(v.boolean()),
    quranReminderEnabled: v.optional(v.boolean()),
    quranReminderTime: v.optional(v.string()),
    azkarMorningEnabled: v.optional(v.boolean()),
    azkarEveningEnabled: v.optional(v.boolean()),
    // Deprecated notification categories retained for stored-document compatibility.
    azkarReminderEnabled: v.optional(v.boolean()),
    sunriseSunsetEnabled: v.optional(v.boolean()),
    fastingAlertsEnabled: v.optional(v.boolean()),
    // Deprecated pre-launch fields, never actually used by any real client.
    prayerReminderEnabled: v.optional(v.boolean()),
    leadTimeMinutes: v.optional(v.number()),
    adhanEnabled: v.optional(v.boolean()),
    azkarSleepEnabled: v.optional(v.boolean()),
    lastSentKeys: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  }).index('by_deviceId', ['deviceId'])
    .index('by_endpoint', ['endpoint']),
  pushSendLog: defineTable({
    deviceIdPrefix: v.string(),
    key: v.string(),
    kind: v.string(),
    plannedAtMs: v.number(),
    sentAtMs: v.number(),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index('by_deviceIdPrefix', ['deviceIdPrefix'])
    .index('by_plannedAtMs', ['plannedAtMs']),
  prayerTimingsCache: defineTable({
    cacheKey: v.string(),
    fetchedAt: v.number(),
    timings: v.array(
      v.object({
        day: v.number(),
        timings: v.record(v.string(), v.string()),
      }),
    ),
  }).index('by_cacheKey', ['cacheKey']),
})
