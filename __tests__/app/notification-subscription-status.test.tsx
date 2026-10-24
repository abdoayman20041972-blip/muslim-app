import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NotificationsSection } from '../../src/app/features/settings/sections/NotificationsSection'

const pushMock = vi.hoisted(() => ({
  subscribe: vi.fn(async () => ({ ok: true })),
  getStatus: vi.fn(async (): Promise<{ exists: boolean; updatedAt: number | null }> => ({ exists: false, updatedAt: null })),
  hasBrowserSubscription: vi.fn(async () => false),
  unsubscribe: vi.fn(async () => true),
}))

vi.mock('../../src/app/features/notifications/pushSubscription', () => ({
  usePushSubscription: () => pushMock,
}))

const props = {
  notificationStatus: 'granted' as const,
  dailyAyah: false,
  azkarMorning: false,
  azkarEvening: false,
  notify: vi.fn(async () => true),
  toggleNotify: vi.fn(async () => {}),
  setDailyAyah: vi.fn(),
  setAzkarMorning: vi.fn(),
  setAzkarEvening: vi.fn(),
}

describe('NotificationsSection push status', () => {
  it('shows disabled when either side has no subscription', async () => {
    pushMock.getStatus.mockResolvedValue({ exists: false, updatedAt: null })
    pushMock.hasBrowserSubscription.mockResolvedValue(false)
    render(<NotificationsSection {...props} />)
    expect(await screen.findByRole('button', { name: 'تفعيل' })).toBeTruthy()
  })
  it('shows enabled and unsubscribes', async () => {
    pushMock.getStatus.mockResolvedValue({ exists: true, updatedAt: 123 })
    pushMock.hasBrowserSubscription.mockResolvedValue(true)
    render(<NotificationsSection {...props} />)
    expect(await screen.findByRole('button', { name: 'تعطيل' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'تعطيل' }))
    await waitFor(() => expect(pushMock.unsubscribe).toHaveBeenCalled())
  })
  it('shows permission denied', async () => {
    render(<NotificationsSection {...props} notificationStatus="denied" />)
    expect(await screen.findByRole('button', { name: 'الإذن مرفوض' })).toBeTruthy()
  })
})
