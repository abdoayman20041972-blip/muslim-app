import { describe, expect, it } from 'vitest'
import { claimSentKeyInMemory, classifyPushStatus, releaseClaimInMemory } from '../../convex/scheduler'
import { mapWithConcurrency } from '../../convex/schedulerNode'
import { shouldRepairPushSubscription } from '../../src/app/features/notifications/pushSubscription'

describe('notification reliability helpers', () => {
  it('keeps the first 11 same-day events when the eleventh is added', () => {
    const keys = Array.from({ length: 10 }, (_, i) => '2026-09-29:event-' + i)
    const result = claimSentKeyInMemory(keys, '2026-09-29', '2026-09-29:event-10')
    expect(result.claimed).toBe(true)
    expect(result.next).toHaveLength(11)
    expect(result.next).toEqual(keys.concat('2026-09-29:event-10'))
  })

  it('drops old dates while retaining today', () => {
    const result = claimSentKeyInMemory(
      ['2026-09-28:old', '2026-09-29:a', '2026-09-29:b'],
      '2026-09-29',
      '2026-09-29:c',
    )
    expect(result.next).toEqual(['2026-09-29:a', '2026-09-29:b', '2026-09-29:c'])
  })

  it('does not claim the same key twice', () => {
    const result = claimSentKeyInMemory(['2026-09-29:a'], '2026-09-29', '2026-09-29:a')
    expect(result.claimed).toBe(false)
  })

  it('releases a failed claim so the same event can be claimed again', () => {
    const key = '2026-09-29:Fajr:before'
    const claimed = claimSentKeyInMemory([], '2026-09-29', key)
    expect(claimed.claimed).toBe(true)
    const released = releaseClaimInMemory(claimed.next, key)
    expect(released).toEqual([])
    expect(claimSentKeyInMemory(released, '2026-09-29', key).claimed).toBe(true)
  })

  it('classifies 404 and 410 as expired while other failures are retryable', () => {
    expect(classifyPushStatus(404)).toBe('expired')
    expect(classifyPushStatus(410)).toBe('expired')
    expect(classifyPushStatus(500)).toBe('retry')
    expect(classifyPushStatus(undefined)).toBe('retry')
  })

  it('keeps concurrent scheduler work bounded', async () => {
    let active = 0
    let maxActive = 0
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return value * 2
    })

    expect(result).toEqual([2, 4, 6, 8, 10, 12])
    expect(maxActive).toBe(2)
  })

  it('requests self-healing only for granted permission and an existing browser subscription', () => {
    expect(shouldRepairPushSubscription('granted', true, null)).toBe(true)
    expect(shouldRepairPushSubscription('default', true, null)).toBe(false)
    expect(shouldRepairPushSubscription('granted', false, null)).toBe(false)
    expect(shouldRepairPushSubscription('granted', true, 'subscription-id')).toBe(false)
  })
})
