import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const repairSubscriptionByEndpoint = internalMutation({
  args: {
    oldEndpoint: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.oldEndpoint))
      .first()
    if (!existing) return false
    await ctx.db.patch(existing._id, {
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      updatedAt: Date.now(),
    })
    return true
  },
})

export const syncSubscription = mutation({
  args: {
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
  },
  returns: v.union(v.id('pushSubscriptions'), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .unique()

    if (!existing) return null

    await ctx.db.patch(existing._id, {
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      lat: args.lat,
      lng: args.lng,
      timezone: args.timezone,
      calcMethod: args.calcMethod ?? '5',
      asrSchool: args.asrSchool ?? '0',
      remindersEnabled: args.remindersEnabled ?? false,
      prayerTimeEnabled: args.prayerTimeEnabled ?? true,
      prayerReminderLead: args.prayerReminderLead ?? 5,
      dailyAyahEnabled: args.dailyAyahEnabled ?? false,
      quranReminderEnabled: args.quranReminderEnabled ?? false,
      quranReminderTime: args.quranReminderTime ?? '20:00',
      azkarMorningEnabled: args.azkarMorningEnabled ?? false,
      azkarEveningEnabled: args.azkarEveningEnabled ?? false,
      updatedAt: Date.now(),
    })
    return existing._id
  },
})

export const saveSubscription = mutation({
  args: {
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
    // Deprecated notification categories retained only for backward-compatible
    // Convex callers; the current UI no longer exposes or writes them.
    azkarReminderEnabled: v.optional(v.boolean()),
    sunriseSunsetEnabled: v.optional(v.boolean()),
    fastingAlertsEnabled: v.optional(v.boolean()),
    // Deprecated: accepted only so the earlier (pre-launch, never actually
    // used) function shape stays compatible per Convex's deploy check. Not
    // read by the handler and not stored.
    prayerReminderEnabled: v.optional(v.boolean()),
    leadTimeMinutes: v.optional(v.number()),
    adhanEnabled: v.optional(v.boolean()),
    azkarSleepEnabled: v.optional(v.boolean()),
  },
  returns: v.id('pushSubscriptions'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .unique()

    const doc = {
      deviceId: args.deviceId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      lat: args.lat,
      lng: args.lng,
      timezone: args.timezone,
      calcMethod: args.calcMethod ?? '5',
      asrSchool: args.asrSchool ?? '0',
      remindersEnabled: args.remindersEnabled ?? false,
      prayerTimeEnabled: args.prayerTimeEnabled ?? true,
      prayerReminderLead: args.prayerReminderLead ?? 5,
      dailyAyahEnabled: args.dailyAyahEnabled ?? false,
      quranReminderEnabled: args.quranReminderEnabled ?? false,
      quranReminderTime: args.quranReminderTime ?? '20:00',
      azkarMorningEnabled: args.azkarMorningEnabled ?? false,
      azkarEveningEnabled: args.azkarEveningEnabled ?? false,
      updatedAt: Date.now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, doc)
      return existing._id
    }

    return await ctx.db.insert('pushSubscriptions', doc)
  },
})

export const getSubscriptionStatus = query({
  args: { deviceId: v.string() },
  returns: v.object({
    exists: v.boolean(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .unique()
    return {
      exists: Boolean(existing),
      updatedAt: existing?.updatedAt ?? null,
    }
  },
})

export const removeSubscription = mutation({
  args: { deviceId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .unique()
    if (!existing) return false
    await ctx.db.delete(existing._id)
    return true
  },
})
