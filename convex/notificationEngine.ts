import { v } from 'convex/values'

export const notificationTypeValidator = v.union(
  v.literal('prayer-reminder'),
  v.literal('adhan'),
  v.literal('azkar'),
  v.literal('daily-ayah'),
  v.literal('quran-reminder'),
)

export type NotificationType =
  | 'prayer-reminder'
  | 'adhan'
  | 'azkar'
  | 'daily-ayah'
  | 'quran-reminder'

export type NotificationTarget = 'prayer' | 'azkar' | 'quran' | 'home'

export type NotificationEnvelope = {
  type: NotificationType
  title: string
  body: string
  tag: string
  url: string
  target: NotificationTarget
  sound?: string
  vibrate?: number[]
  metadata?: Record<string, string>
}

export const notificationEnvelopeValidator = v.object({
  type: notificationTypeValidator,
  title: v.string(),
  body: v.string(),
  tag: v.string(),
  url: v.string(),
  target: v.union(
    v.literal('prayer'),
    v.literal('azkar'),
    v.literal('quran'),
    v.literal('home'),
  ),
  sound: v.optional(v.string()),
  vibrate: v.optional(v.array(v.number())),
  metadata: v.optional(v.record(v.string(), v.string())),
})

export function buildNotificationPayload(
  notification: NotificationEnvelope,
): NotificationEnvelope {
  return {
    ...notification,
    metadata: notification.metadata
      ? { ...notification.metadata }
      : undefined,
  }
}

export function notificationTag(
  type: NotificationType,
  key: string,
) {
  return 'muslim-' + type + '-' + key
}
