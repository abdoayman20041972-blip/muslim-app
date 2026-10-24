import { internalQuery } from './_generated/server'
import { v } from 'convex/values'

export const getSubscriptionByDeviceId = internalQuery({
  args: { deviceId: v.string() },
  returns: v.union(
    v.object({
      endpoint: v.string(),
      p256dh: v.string(),
      auth: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .unique()

    if (!subscription) return null

    return {
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    }
  },
})
