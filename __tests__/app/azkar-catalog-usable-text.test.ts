import { describe, expect, it } from 'vitest'
import { mergeCatalog } from '../../src/app/features/azkar/useAzkarCatalog'
import type { ZikrCategory } from '../../src/azkar-data'

const base: ZikrCategory[] = [{ id: 'morning', label: 'أذكار الصباح', subtitle: 'اختبار', icon: 'sun', items: [{ id: 'morning:item-1', text: 'ذكر أساسي' }] }]

describe('azkar catalog usable text', () => {
  it('adds Arabic text without digits or symbols', () => {
    const result = mergeCatalog(base, [{ id: 'morning', label: 'أذكار الصباح', subtitle: 'اختبار', icon: 'sun', items: [{ text: 'الحمد لله رب العالمين' }] }])
    expect(result[0].items).toHaveLength(2)
    expect(result[0].items[1].text).toBe('الحمد لله رب العالمين')
  })

  it('does not add stop values', () => {
    const result = mergeCatalog(base, [{ id: 'morning', label: 'أذكار الصباح', subtitle: 'اختبار', icon: 'sun', items: [{ text: 'stop' }, { text: 'stop .' }] }])
    expect(result[0].items).toHaveLength(1)
  })

  it('does not add Latin text without Arabic letters', () => {
    const result = mergeCatalog(base, [{ id: 'morning', label: 'أذكار الصباح', subtitle: 'اختبار', icon: 'sun', items: [{ text: 'hello world' }] }])
    expect(result[0].items).toHaveLength(1)
  })
})
