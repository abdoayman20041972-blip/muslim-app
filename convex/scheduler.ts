import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'

const timingValidator = v.object({
  day: v.number(),
  timings: v.record(v.string(), v.string()),
})

const subscriptionValidator = v.object({
  id: v.id('pushSubscriptions'),
  deviceId: v.string(),
  endpoint: v.string(),
  p256dh: v.string(),
  auth: v.string(),
  lat: v.number(),
  lng: v.number(),
  timezone: v.string(),
  calcMethod: v.string(),
  asrSchool: v.string(),
  remindersEnabled: v.boolean(),
  prayerTimeEnabled: v.boolean(),
  prayerReminderLead: v.number(),
  dailyAyahEnabled: v.boolean(),
  quranReminderEnabled: v.boolean(),
  quranReminderTime: v.string(),
  azkarMorningEnabled: v.boolean(),
  azkarEveningEnabled: v.boolean(),
  lastSentKeys: v.array(v.string()),
})

function mapSubscription(row: Doc<'pushSubscriptions'>) {
  return {
    id: row._id,
    deviceId: row.deviceId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    lat: row.lat,
    lng: row.lng,
    timezone: row.timezone,
    calcMethod: row.calcMethod ?? '5',
    asrSchool: row.asrSchool ?? '0',
    remindersEnabled: row.remindersEnabled ?? false,
    prayerTimeEnabled: row.prayerTimeEnabled ?? true,
    prayerReminderLead: row.prayerReminderLead ?? 5,
    dailyAyahEnabled: row.dailyAyahEnabled ?? false,
    quranReminderEnabled: row.quranReminderEnabled ?? false,
    quranReminderTime: row.quranReminderTime ?? '20:00',
    azkarMorningEnabled: row.azkarMorningEnabled ?? false,
    azkarEveningEnabled: row.azkarEveningEnabled ?? false,
    lastSentKeys: row.lastSentKeys ?? [],
  }
}

export const getSubscriptionsForTick = internalQuery({
  args: {},
  returns: v.array(subscriptionValidator),
  handler: async (ctx) => {
    const rows = await ctx.db.query('pushSubscriptions').take(500)
    return rows.map(mapSubscription)
  },
})

export const getSubscriptionsForTickPage = internalQuery({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    page: v.array(subscriptionValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('pushSubscriptions')
      .order('asc')
      .paginate({ numItems: 100, cursor: args.cursor ?? null })
    return {
      page: result.page.map(mapSubscription),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    }
  },
})

export const getPrayerTimingsCache = internalQuery({
  args: { cacheKey: v.string() },
  returns: v.union(
    v.object({
      fetchedAt: v.number(),
      timings: v.array(timingValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('prayerTimingsCache')
      .withIndex('by_cacheKey', (q) => q.eq('cacheKey', args.cacheKey))
      .unique()

    if (!row) return null
    return { fetchedAt: row.fetchedAt, timings: row.timings }
  },
})

export const savePrayerTimingsCache = internalMutation({
  args: {
    cacheKey: v.string(),
    fetchedAt: v.number(),
    timings: v.array(timingValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('prayerTimingsCache')
      .withIndex('by_cacheKey', (q) => q.eq('cacheKey', args.cacheKey))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        fetchedAt: args.fetchedAt,
        timings: args.timings,
      })
    } else {
      await ctx.db.insert('prayerTimingsCache', {
        cacheKey: args.cacheKey,
        fetchedAt: args.fetchedAt,
        timings: args.timings,
      })
    }

    return null
  },
})

/** @deprecated Kept temporarily for Convex internal contract compatibility. Use claimSentKey. */
export const recordPushSuccess = internalMutation({
  args: {
    subscriptionId: v.id('pushSubscriptions'),
    todayKey: v.string(),
    sentKey: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get('pushSubscriptions', args.subscriptionId)
    if (!row) return false
    const current = row.lastSentKeys ?? []
    const cleaned = current.filter((key) => key.startsWith(args.todayKey + ':'))
    if (cleaned.includes(args.sentKey)) return false
    const next = [...cleaned, args.sentKey]
    if (next.length > 60) next.splice(0, next.length - 60)
    await ctx.db.patch(args.subscriptionId, { lastSentKeys: next })
    return true
  },
})

export const LAST_SENT_KEYS_LIMIT = 60

export function classifyPushStatus(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410 ? 'expired' as const : 'retry' as const
}

export function releaseClaimInMemory(current: string[], sentKey: string) {
  return current.filter((key) => key !== sentKey)
}

export function claimSentKeyInMemory(current: string[], todayKey: string, sentKey: string) {
  const cleaned = current.filter((key) => key.startsWith(todayKey + ':'))
  if (cleaned.includes(sentKey)) return { claimed: false, next: cleaned }
  const next = [...cleaned, sentKey]
  if (next.length > LAST_SENT_KEYS_LIMIT) next.splice(0, next.length - LAST_SENT_KEYS_LIMIT)
  return { claimed: true, next }
}

export const claimSentKey = internalMutation({
  args: { subscriptionId: v.id('pushSubscriptions'), todayKey: v.string(), sentKey: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get('pushSubscriptions', args.subscriptionId)
    if (!row) return false
    const result = claimSentKeyInMemory(row.lastSentKeys ?? [], args.todayKey, args.sentKey)
    if (!result.claimed) return false
    await ctx.db.patch(args.subscriptionId, { lastSentKeys: result.next })
    return true
  },
})

export const releaseClaim = internalMutation({
  args: { subscriptionId: v.id('pushSubscriptions'), sentKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get('pushSubscriptions', args.subscriptionId)
    if (row) await ctx.db.patch(args.subscriptionId, {
      lastSentKeys: (row.lastSentKeys ?? []).filter((key) => key !== args.sentKey),
    })
    return null
  },
})

export const logPushAttempt = internalMutation({
  args: {
    deviceIdPrefix: v.string(), key: v.string(), kind: v.string(),
    plannedAtMs: v.number(), sentAtMs: v.number(), ok: v.boolean(),
    statusCode: v.optional(v.number()), error: v.optional(v.string()),
  },
  returns: v.id('pushSendLog'),
  handler: async (ctx, args) => ctx.db.insert('pushSendLog', args),
})

export const listPushSendLog = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    deviceIdPrefix: v.string(), key: v.string(), kind: v.string(),
    plannedAtMs: v.number(), sentAtMs: v.number(), ok: v.boolean(),
    statusCode: v.optional(v.number()), error: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200))
    const rows = await ctx.db.query('pushSendLog').withIndex('by_plannedAtMs').order('desc').take(limit)
    return rows.map(({ deviceIdPrefix, key, kind, plannedAtMs, sentAtMs, ok, statusCode, error }) =>
      ({ deviceIdPrefix, key, kind, plannedAtMs, sentAtMs, ok, statusCode, error }))
  },
})

export const cleanupPushSendLog = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000
    const rows = await ctx.db.query('pushSendLog')
      .withIndex('by_plannedAtMs', (q) => q.lt('plannedAtMs', cutoffMs))
      .take(100)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  },
})

export const deleteSubscription = internalMutation({
  args: { subscriptionId: v.id('pushSubscriptions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get('pushSubscriptions', args.subscriptionId)
    if (row) await ctx.db.delete(args.subscriptionId)
    return null
  },
})
