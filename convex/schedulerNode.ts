"use node"

import webpush from 'web-push'
import { internalAction, type ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { buildNotificationPayload, notificationTag, type NotificationEnvelope } from './notificationEngine'
import { dailyAyahFor } from './shared/dailyAyah'

const API = 'https://api.aladhan.com/v1'
const CACHE_MAX_AGE = 3 * 24 * 60 * 60 * 1000
const SCHEDULER_CONCURRENCY = 6
// The cron runs every minute; this window compensates for a delayed tick.
const EVENT_COMPENSATION_WINDOW_MINUTES = 3
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const
const AUXILIARY_TIMINGS = ['Sunrise', 'Sunset'] as const
const LABELS: Record<(typeof PRAYERS)[number], string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
}
type PrayerKey = (typeof PRAYERS)[number]
type CachedDay = { day: number; timings: Record<string, string> }

type Candidate = {
  deviceId: string
  prayer: string
  event: 'before' | 'now' | 'daily-ayah' | 'quran-reminder' | 'azkar-morning' | 'azkar-evening'
  notification: NotificationEnvelope
  reason: string
  sentKey: string
  ttl: number
}

type TickResult = {
  enabled: boolean
  dryRun: boolean
  processed: number
  sent: number
  skipped: number
  expired: number
  candidates: Array<{ deviceId: string; prayer: string; event: string; type: string; title: string; body: string; reason: string }>
  errors: Array<{ deviceId: string; error: string }>
}

type Subscription = {
  id: Id<'pushSubscriptions'>
  deviceId: string
  endpoint: string
  p256dh: string
  auth: string
  lat: number
  lng: number
  timezone: string
  calcMethod: string
  asrSchool: string
  remindersEnabled: boolean
  prayerTimeEnabled: boolean
  prayerReminderLead: number
  dailyAyahEnabled: boolean
  quranReminderEnabled: boolean
  quranReminderTime: string
  azkarMorningEnabled: boolean
  azkarEveningEnabled: boolean
  lastSentKeys: string[]
}

function localParts(nowMs: number, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(new Date(nowMs))
  const get = (name: string) =>
    Number(parts.find((part) => part.type === name)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

function parseTime(value: string) {
  const raw = value.split(' ')[0]
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function parseReminderClock(value: string) {
  return parseTime(value.trim())
}

function dateKey(parts: ReturnType<typeof localParts>) {
  return (
    String(parts.year) +
    '-' +
    String(parts.month).padStart(2, '0') +
    '-' +
    String(parts.day).padStart(2, '0')
  )
}

function monthCacheKey(
  subscription: Subscription,
  parts: ReturnType<typeof localParts>,
) {
  const lat = subscription.lat.toFixed(2)
  const lng = subscription.lng.toFixed(2)
  const yearMonth =
    String(parts.year) + '-' + String(parts.month).padStart(2, '0')
  return (
    lat +
    ',' +
    lng +
    '|' +
    subscription.calcMethod +
    '|' +
    subscription.asrSchool +
    '|' +
    subscription.timezone +
    '|' +
    yearMonth
  )
}

function toArabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function reminderLeadText() {
  const minutes = 5
  return 'بعد ' + toArabicDigits(minutes) + ' دقائق'
}

export function buildCandidate(
  subscription: Subscription,
  prayer: PrayerKey,
  event: Candidate['event'],
  todayKey: string,
  lead: number,
  ttl: number,
): Candidate {
  const before = event === 'before'
  const notificationType = before ? 'prayer-reminder' : 'adhan'
  const key = prayer + '-' + event + '-' + todayKey
  return {
    deviceId: subscription.deviceId,
    prayer,
    event,
    notification: buildNotificationPayload({
      type: notificationType,
      title: before ? 'اقترب وقت الصلاة' : 'حان وقت الصلاة',
      body: before
        ? LABELS[prayer] + ' ' + reminderLeadText()
        : LABELS[prayer],
      // Must equal the local-timer tag in usePrayerReminders.ts (azkar-<prayer>-<event>-YYYY-MM-DD)
      // so a push and a local notification for the same prayer replace each other.
      tag: 'azkar-' + key,
      url: '/?open=prayer',
      target: 'prayer',
      metadata: {
        prayer,
        event,
        date: todayKey,
      },
    }),
    reason: before
      ? 'داخل نافذة التذكير قبل الصلاة بـ5 دقائق'
      : 'داخل نافذة دخول الوقت لمدة 3 دقائق',
    sentKey: todayKey + ':' + prayer + ':' + event,
    ttl,
  }
}

async function fetchMonth(
  subscription: Subscription,
  parts: ReturnType<typeof localParts>,
): Promise<CachedDay[]> {
  const query = new URLSearchParams({
    latitude: String(subscription.lat),
    longitude: String(subscription.lng),
    method: subscription.calcMethod,
    school: subscription.asrSchool,
    timezonestring: subscription.timezone,
  })
  const response = await fetch(
    API +
      '/calendar/' +
      String(parts.year) +
      '/' +
      String(parts.month) +
      '?' +
      query.toString(),
  )
  if (!response.ok) throw new Error('Aladhan HTTP ' + String(response.status))

  const json = (await response.json()) as {
    data?: Array<{
      date?: { gregorian?: { day?: unknown } }
      timings?: Record<string, unknown>
    }>
  }

  const result: CachedDay[] = []
  for (const item of json.data ?? []) {
    const day = Number(item.date?.gregorian?.day)
    const timings = item.timings
    if (!Number.isInteger(day) || !timings || typeof timings !== 'object') {
      continue
    }

    const clean: Record<string, string> = {}
    let valid = true
    for (const timingKey of [...PRAYERS, ...AUXILIARY_TIMINGS]) {
      const value = timings[timingKey]
      if (typeof value !== 'string' || parseTime(value) === null) {
        valid = false
        break
      }
      clean[timingKey] = value.split(' ')[0]
    }
    if (valid) result.push({ day, timings: clean })
  }

  if (!result.length) throw new Error('Aladhan returned no valid prayer timings')
  return result
}

async function getMonth(
  ctx: ActionCtx,
  subscription: Subscription,
  parts: ReturnType<typeof localParts>,
  dryRun: boolean,
  cacheMemo: Map<string, CachedDay[]>,
) {
  const cacheKey = monthCacheKey(subscription, parts)
  const memoized = cacheMemo.get(cacheKey)
  if (memoized) return memoized

  const cached = await ctx.runQuery(internal.scheduler.getPrayerTimingsCache, {
    cacheKey,
  })
  const cacheHasAuxiliaryTimings =
    cached !== null &&
    cached.timings.length > 0 &&
    cached.timings.every(
      (day) =>
        typeof day.timings.Sunrise === 'string' &&
        typeof day.timings.Sunset === 'string' &&
        parseTime(day.timings.Sunrise) !== null &&
        parseTime(day.timings.Sunset) !== null,
    )

  if (
    cached &&
    cacheHasAuxiliaryTimings &&
    Date.now() - cached.fetchedAt <= CACHE_MAX_AGE
  ) {
    cacheMemo.set(cacheKey, cached.timings)
    return cached.timings
  }

  const fresh = await fetchMonth(subscription, parts)
  if (!dryRun) {
    await ctx.runMutation(internal.scheduler.savePrayerTimingsCache, {
      cacheKey,
      fetchedAt: Date.now(),
      timings: fresh,
    })
  }
  cacheMemo.set(cacheKey, fresh)
  return fresh
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1))
  const run = async () => {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => run()))
  return results
}

export function buildSimpleCandidate(subscription: Subscription, parts: ReturnType<typeof localParts>, event: 'daily-ayah' | 'quran-reminder' | 'azkar-morning' | 'azkar-evening', timings: Record<string, string>): Candidate | null {
  const todayKey = dateKey(parts)
  const nowMinutes = parts.hour * 60 + parts.minute + parts.second / 60
  const ayah = event === 'daily-ayah'
  const quranReminder = event === 'quran-reminder'
  const morning = event === 'azkar-morning'
  const targetMinutes = ayah
    ? 0
    : quranReminder
      ? parseReminderClock(subscription.quranReminderTime)
      : parseTime(timings[morning ? 'Sunrise' : 'Sunset'] ?? '')
  if (targetMinutes === null || nowMinutes < targetMinutes || nowMinutes >= targetMinutes + EVENT_COMPENSATION_WINDOW_MINUTES) return null
  const a = ayah ? dailyAyahFor(new Date(parts.year, parts.month - 1, parts.day)) : null
  const kind = ayah ? 'daily-ayah' : event
  const title = ayah ? 'آية اليوم' : quranReminder ? 'حان وقت قراءة القرآن' : morning ? 'أذكار الصباح' : 'أذكار المساء'
  const body = ayah ? a!.text + ' — ' + a!.surah : quranReminder ? 'حان وقت قراءة القرآن.' : morning ? 'حان وقت أذكار الصباح مع الشروق.' : 'حان وقت أذكار المساء مع الغروب.'
  const type = ayah ? 'daily-ayah' : quranReminder ? 'quran-reminder' : 'azkar'
  const tag = ayah
    ? notificationTag('daily-ayah', todayKey)
    : quranReminder
      ? notificationTag('quran-reminder', todayKey)
      : notificationTag('azkar', (morning ? 'morning' : 'evening') + '-' + todayKey)
  return {
    deviceId: subscription.deviceId,
    prayer: ayah || quranReminder ? 'Quran' : 'Azkar',
    event,
    notification: buildNotificationPayload({
      type,
      title,
      body,
      tag,
      url: ayah || quranReminder ? '/?open=ayah' : '/?open=azkar',
      target: ayah || quranReminder ? 'quran' : 'azkar',
      metadata: { date: todayKey, event },
    }),
    reason: ayah ? 'داخل نافذة آية اليوم عند 00:00 لمدة 3 دقائق' : quranReminder ? 'داخل نافذة تذكير قراءة القرآن لمدة 3 دقائق' : 'داخل نافذة أذكار ' + (morning ? 'الصباح' : 'المساء') + ' لمدة 3 دقائق',
    sentKey: todayKey + ':' + kind,
    ttl: 300,
  }
}

export function candidatesFor(subscription: Subscription, parts: ReturnType<typeof localParts>, timings: Record<string, string>): Candidate[] {
  const nowMinutes = parts.hour * 60 + parts.minute + parts.second / 60
  const lead = 5
  const todayKey = dateKey(parts)
  const result: Candidate[] = []
  for (const prayer of PRAYERS) {
    const prayerMinutes = parseTime(timings[prayer])
    if (prayerMinutes === null) continue
    if (subscription.remindersEnabled) {
      const beforeStart = prayerMinutes - lead
      if (nowMinutes >= beforeStart && nowMinutes < prayerMinutes) {
        const secondsUntilPrayer = Math.max(1, Math.floor((prayerMinutes - nowMinutes) * 60))
        const reminderTtl = Math.max(30, secondsUntilPrayer - 30)
        result.push(buildCandidate(subscription, prayer, 'before', todayKey, lead, reminderTtl))
      }
    }
    if (subscription.prayerTimeEnabled && nowMinutes >= prayerMinutes && nowMinutes < prayerMinutes + EVENT_COMPENSATION_WINDOW_MINUTES) {
      result.push(buildCandidate(subscription, prayer, 'now', todayKey, lead, 300))
    }
  }
  if (subscription.dailyAyahEnabled) { const c = buildSimpleCandidate(subscription, parts, 'daily-ayah', timings); if (c) result.push(c) }
  if (subscription.quranReminderEnabled) { const c = buildSimpleCandidate(subscription, parts, 'quran-reminder', timings); if (c) result.push(c) }
  if (subscription.azkarMorningEnabled) { const c = buildSimpleCandidate(subscription, parts, 'azkar-morning', timings); if (c) result.push(c) }
  if (subscription.azkarEveningEnabled) { const c = buildSimpleCandidate(subscription, parts, 'azkar-evening', timings); if (c) result.push(c) }
  return result
}

const candidateValidator = v.object({
  deviceId: v.string(),
  prayer: v.string(),
  event: v.string(),
  type: v.string(),
  title: v.string(),
  body: v.string(),
  reason: v.string(),
})

const resultValidator = v.object({
  enabled: v.boolean(),
  dryRun: v.boolean(),
  processed: v.number(),
  sent: v.number(),
  skipped: v.number(),
  expired: v.number(),
  candidates: v.array(candidateValidator),
  errors: v.array(v.object({ deviceId: v.string(), error: v.string() })),
})

async function executeTick(
  ctx: ActionCtx,
  args: { nowMs?: number; deviceId?: string; dryRun: boolean },
): Promise<TickResult> {
  const enabled = process.env.PUSH_SCHEDULER_ENABLED === 'true'
  if (!args.dryRun && !enabled) {
    return {
      enabled: false,
      dryRun: false,
      processed: 0,
      sent: 0,
      skipped: 0,
      expired: 0,
      candidates: [],
      errors: [],
    }
  }

  let sent = 0
  let skipped = 0
  let expired = 0
  const candidates: Candidate[] = []
  const errors: Array<{ deviceId: string; error: string }> = []
  const cacheMemo = new Map<string, Promise<CachedDay[]>>()

  const processSubscription = async (subscription: Subscription) => {
    if (!subscription.remindersEnabled && !subscription.prayerTimeEnabled && !subscription.dailyAyahEnabled && !subscription.quranReminderEnabled && !subscription.azkarMorningEnabled && !subscription.azkarEveningEnabled) {
      return { sent: 0, skipped: 0, expired: 0, candidates: [] as Candidate[], errors: [] as Array<{ deviceId: string; error: string }> }
    }

    const localCandidates: Candidate[] = []
    const localErrors: Array<{ deviceId: string; error: string }> = []
    let localSent = 0
    let localSkipped = 0
    let localExpired = 0

    try {
      const parts = localParts(args.nowMs ?? Date.now(), subscription.timezone)
      const cacheKey = monthCacheKey(subscription, parts)
      let monthPromise = cacheMemo.get(cacheKey)
      if (!monthPromise) {
        monthPromise = getMonth(ctx, subscription, parts, args.dryRun, new Map())
        cacheMemo.set(cacheKey, monthPromise)
      }
      const month = await monthPromise
      const today = month.find((entry) => entry.day === parts.day)
      if (!today) {
        localErrors.push({
          deviceId: subscription.deviceId,
          error: 'لا توجد مواقيت لليوم في كاش Aladhan',
        })
        return { sent: localSent, skipped: localSkipped, expired: localExpired, candidates: localCandidates, errors: localErrors }
      }

      const wanted = candidatesFor(subscription, parts, today.timings)
      const sentKeys = new Set(
        subscription.lastSentKeys.filter((key) => key.startsWith(dateKey(parts) + ':')),
      )

      for (const candidate of wanted) {
        if (sentKeys.has(candidate.sentKey)) {
          localSkipped += 1
          continue
        }

        localCandidates.push(candidate)
        if (args.dryRun) continue

        const privateKey = process.env.VAPID_PRIVATE_KEY
        if (!privateKey) {
          localErrors.push({
            deviceId: subscription.deviceId,
            error: 'VAPID_PRIVATE_KEY غير مضبوط في بيئة Convex',
          })
          break
        }

        const claimed = await ctx.runMutation(internal.scheduler.claimSentKey, {
          subscriptionId: subscription.id,
          todayKey: dateKey(parts),
          sentKey: candidate.sentKey,
        })
        if (!claimed) {
          localSkipped += 1
          continue
        }

        const plannedAtMs = args.nowMs ?? Date.now()
        const kind = candidate.notification.type
        const deviceIdPrefix = subscription.deviceId.slice(0, 8)

        try {
          const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
          if (!vapidPublicKey) {
            await ctx.runMutation(internal.scheduler.releaseClaim, {
              subscriptionId: subscription.id,
              sentKey: candidate.sentKey,
            })
            await ctx.runMutation(internal.scheduler.logPushAttempt, {
              deviceIdPrefix, key: candidate.sentKey, kind,
              plannedAtMs, sentAtMs: Date.now(), ok: false,
              error: 'VAPID_PUBLIC_KEY غير مضبوط في بيئة Convex',
            })
            localErrors.push({ deviceId: subscription.deviceId, error: 'VAPID_PUBLIC_KEY غير مضبوط في بيئة Convex' })
            break
          }

          webpush.setVapidDetails('mailto:push@muslim.app', vapidPublicKey, privateKey)
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(candidate.notification),
            { urgency: 'high', TTL: candidate.ttl },
          )

          await ctx.runMutation(internal.scheduler.logPushAttempt, {
            deviceIdPrefix, key: candidate.sentKey, kind,
            plannedAtMs, sentAtMs: Date.now(), ok: true,
          })
          localSent += 1
          sentKeys.add(candidate.sentKey)
        } catch (error) {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'statusCode' in error &&
            typeof error.statusCode === 'number'
              ? error.statusCode
              : undefined

          await ctx.runMutation(internal.scheduler.logPushAttempt, {
            deviceIdPrefix, key: candidate.sentKey, kind,
            plannedAtMs, sentAtMs: Date.now(), ok: false, statusCode,
            error: 'Push send failed',
          })

          if (statusCode === 404 || statusCode === 410) {
            await ctx.runMutation(internal.scheduler.deleteSubscription, {
              subscriptionId: subscription.id,
            })
            localExpired += 1
            localErrors.push({
              deviceId: subscription.deviceId,
              error: 'انتهى اشتراك Push أو أصبح غير صالح (HTTP ' + String(statusCode) + ')',
            })
            break
          }

          await ctx.runMutation(internal.scheduler.releaseClaim, {
            subscriptionId: subscription.id,
            sentKey: candidate.sentKey,
          })
          localErrors.push({
            deviceId: subscription.deviceId,
            error: statusCode
              ? 'فشل إرسال Push (HTTP ' + String(statusCode) + ')'
              : 'فشل إرسال Push',
          })
        }
      }
    } catch (error) {
      localErrors.push({
        deviceId: subscription.deviceId,
        error: error instanceof Error ? error.message : 'تعذر حساب مواقيت الصلاة',
      })
    }

    return { sent: localSent, skipped: localSkipped, expired: localExpired, candidates: localCandidates, errors: localErrors }
  }

  let cursor: string | undefined
  let processed = 0

  do {
    const page = await ctx.runQuery(internal.scheduler.getSubscriptionsForTickPage, {
      cursor,
    }) as {
      page: Subscription[]
      isDone: boolean
      continueCursor: string
    }

    const subscriptions = args.deviceId
      ? page.page.filter((row) => row.deviceId === args.deviceId)
      : page.page

    const pageResults = await mapWithConcurrency(
      subscriptions,
      SCHEDULER_CONCURRENCY,
      (subscription) => processSubscription(subscription),
    )

    processed += subscriptions.length
    for (const result of pageResults) {
      sent += result.sent
      skipped += result.skipped
      expired += result.expired
      candidates.push(...result.candidates)
      errors.push(...result.errors)
    }

    if (page.isDone) break
    cursor = page.continueCursor
  } while (cursor)

  return {
    enabled,
    dryRun: args.dryRun,
    processed,
    sent,
    skipped,
    expired,
    candidates: candidates.map(
      ({ deviceId, prayer, event, notification, reason }) => ({
        deviceId,
        prayer,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        reason,
        event,
      }),
    ),
    errors,
  }
}

export const tick = internalAction({
  args: {},
  returns: resultValidator,
  handler: async (ctx): Promise<TickResult> =>
    executeTick(ctx, { dryRun: false }),
})

export const runTick = internalAction({
  args: {
    nowMs: v.optional(v.number()),
    deviceId: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  returns: resultValidator,
  handler: async (ctx, args): Promise<TickResult> =>
    executeTick(ctx, {
      nowMs: args.nowMs,
      deviceId: args.deviceId,
      dryRun: args.dryRun ?? false,
    }),
})
