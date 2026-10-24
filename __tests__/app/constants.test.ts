import { describe, expect, it } from 'vitest'
import { BISMILLAH, normalizeArabic, quranAudioUrl, quranSurahAudioUrl, stripBismillahPrefix } from '../../src/app/constants'

describe('Quran text helpers', () => {
  it('normalizes Arabic alef variants and removes diacritics', () => {
    expect(normalizeArabic('إِنَّ آدَمَ')).toBe('ان ادم')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeArabic('  سبحان   الله  ')).toBe('سبحان الله')
  })

  it('removes a standalone Bismillah prefix from a Quran ayah', () => {
    expect(stripBismillahPrefix(`${BISMILLAH} الْحَمْدُ لِلَّهِ`)).toBe('الْحَمْدُ لِلَّهِ')
  })

  it('handles API Bismillah spelling differences', () => {
    expect(stripBismillahPrefix('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ الحمد لله')).toBe('الحمد لله')
  })

  it('uses the live editions and supported bitrates for Quran audio', () => {
    expect(quranAudioUrl('ar.abdulbasitmurattal', 1)).toBe('https://cdn.islamic.network/quran/audio/192/ar.abdulbasitmurattal/1.mp3')
    expect(quranAudioUrl('ar.abdurrahmaansudais', 1)).toBe('https://cdn.islamic.network/quran/audio/192/ar.abdurrahmaansudais/1.mp3')
    expect(quranAudioUrl('ar.alafasy', 1)).toBe('https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3')
  })

  it('builds the verified complete-surah URL for every approved reciter', () => {
    const expected = {
      'ar.minshawi': 'https://server10.mp3quran.net/minsh/001.mp3',
      'ar.alafasy': 'https://server8.mp3quran.net/afs/001.mp3',
      'ar.husary': 'https://server13.mp3quran.net/husr/001.mp3',
      'ar.abdulbasitmurattal': 'https://server7.mp3quran.net/basit/001.mp3',
      'ar.abdurrahmaansudais': 'https://server11.mp3quran.net/sds/001.mp3',
      'ar.mahermuaiqly': 'https://server12.mp3quran.net/maher/001.mp3',
      'ar.hudhaify': 'https://server9.mp3quran.net/hthfi/001.mp3',
      'ar.saoodshuraym': 'https://server7.mp3quran.net/shur/001.mp3',
      'ar.ahmedajamy': 'https://server10.mp3quran.net/ajm/001.mp3',
      'ar.shaatree': 'https://server11.mp3quran.net/shatri/001.mp3',
    } as const

    for (const [reciter, url] of Object.entries(expected)) {
      expect(quranSurahAudioUrl(reciter as Parameters<typeof quranSurahAudioUrl>[0], 1)).toBe(url)
    }
  })

  it('does not alter text without an exact Bismillah prefix', () => {
    const text = 'الحمد لله رب العالمين'
    expect(stripBismillahPrefix(text)).toBe(text)
  })
})
