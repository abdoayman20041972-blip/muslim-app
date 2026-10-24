"use node"
import webpush from 'web-push'
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const sendTestPush = action({
  args: {
    deviceId: v.string(),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async () => ({
    ok: false,
    error: 'deprecated: use the internal action',
  }),
})

export const sendTestPushInternal = internalAction({
  args: {
    deviceId: v.string(),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const subscription = await ctx.runQuery(
      internal.pushSubscriptionQuery.getSubscriptionByDeviceId,
      { deviceId: args.deviceId },
    )

    if (!subscription) {
      return {
        ok: false,
        error: 'لا يوجد اشتراك لهذا الجهاز',
      }
    }

    const privateKey = process.env.VAPID_PRIVATE_KEY
    if (!privateKey) {
      return {
        ok: false,
        error: 'VAPID_PRIVATE_KEY غير مضبوط في بيئة Convex',
      }
    }

    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY
      if (!publicKey) {
        return { ok: false, error: 'VAPID_PUBLIC_KEY غير مضبوط في بيئة Convex' }
      }
      webpush.setVapidDetails(
        'mailto:push@muslim.app',
        publicKey,
        privateKey,
      )

      // High urgency so Android delivers immediately instead of deferring
      // the message while the device is dozing or in battery saver.
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title: args.title ?? 'مسلم',
          body: args.body ?? 'إشعار Push تجريبي',
        }),
        { urgency: 'high', TTL: 300 },
      )

      return { ok: true }
    } catch (error) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : undefined

      if (statusCode === 404 || statusCode === 410) {
        return {
          ok: false,
          error: `انتهى اشتراك Push أو أصبح غير صالح (HTTP ${statusCode})`,
        }
      }

      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: statusCode
          ? `فشل إرسال Push (HTTP ${statusCode}): ${message}`
          : `فشل إرسال Push: ${message}`,
      }
    }
  },
})
