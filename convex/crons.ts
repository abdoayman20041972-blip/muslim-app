import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'prayer-push-scheduler',
  { minutes: 1 },
  internal.schedulerNode.tick,
)

crons.interval(
  'push-send-log-cleanup',
  { hours: 24 },
  internal.scheduler.cleanupPushSendLog,
  {},
)

export default crons
