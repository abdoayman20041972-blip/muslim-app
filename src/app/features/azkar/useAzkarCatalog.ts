import { useEffect, useState } from 'react'
import { azkarCategories, type ZikrCategory, type ZikrItem } from '../../../azkar-data'

const CACHE_KEY = 'azkar_catalog_v4'
const CACHE_TIME_KEY = 'azkar_catalog_v4_time'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 10000
const HISN_API_BASE = 'https://www.hisnmuslim.com/api/ar'
const HISN_CATEGORY_IDS: Record<string, number> = {
  'after-prayer': 25,
  sleep: 28,
  awakening: 1,
}
const SOURCE_KEY = 'azkar_catalog_source'

const apiCategoryMap: Record<string, { id: string; label: string; subtitle: string; icon: ZikrCategory['icon'] }> = {
  'أذكار الصباح': { id: 'morning', label: 'أذكار الصباح', subtitle: 'من الفجر إلى الضحى', icon: 'sun' },
  'أذكار المساء': { id: 'evening', label: 'أذكار المساء', subtitle: 'من العصر إلى الليل', icon: 'moon' },
  'أذكار بعد السلام من الصلاة المفروضة': { id: 'after-prayer', label: 'أذكار بعد الصلاة', subtitle: 'عقب كل صلاة مكتوبة', icon: 'prayer' },
  'تسابيح': { id: 'tasbih', label: 'تسابيح وأذكار', subtitle: 'تسبيح واستغفار في كل وقت', icon: 'spark' },
  'أذكار النوم': { id: 'sleep', label: 'أذكار النوم', subtitle: 'قبل أن تنام', icon: 'bed' },
  'أذكار الاستيقاظ': { id: 'awakening', label: 'أذكار الاستيقاظ', subtitle: 'عند الاستيقاظ من النوم', icon: 'sun' },
  'أدعية قرآنية': { id: 'quran-duas', label: 'أدعية قرآنية', subtitle: 'أدعية من كتاب الله', icon: 'spark' },
  'أدعية الأنبياء': { id: 'prophetic-duas', label: 'أدعية الأنبياء', subtitle: 'من أدعية الأنبياء في القرآن', icon: 'spark' },
}

function itemId(categoryId: string, index: number) {
  return `${categoryId}:item-${index + 1}`
}

/** Normalize transport artifacts only; preserve punctuation and quotation marks. */
function normalizeText(text: string) {
  return text
    .replace(/\\r\\n|\\n|\\r|\r\n|\n|\r/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTrailingArtifact(text: string): string {
  return text.replace(/(?:\s*'\s*,?){4,}\s*$/, '').trim()
}

function extractEmbeddedSource(text: string) {
  const match = text.match(/\[([^\[\]]+)\]\.?\s*$/)
  if (!match) return { text, source: undefined }
  return {
    text: text.slice(0, match.index).trim().replace(/[.!،,:;\s]+$/u, ''),
    source: `[${match[1].trim()}]`,
  }
}

function isUsableText(text: string) {
  const clean = normalizeText(text)
  return clean.length >= 2
    && /[\u0600-\u06FF]/u.test(clean)
    && clean.toLowerCase() !== 'stop'
    && !/^stop[\s.,]*$/i.test(clean)
}

function withStableIds(categories: ZikrCategory[]): ZikrCategory[] {
  return categories.map(category => ({
    ...category,
    items: category.items.map((item, index) => ({
      ...item,
      id: item.id || itemId(category.id, index),
    })),
  }))
}

function mergeCategory(local: ZikrCategory, incoming: ZikrItem[]) {
  const existing = withStableIds([local])[0]
  const seen = new Set(existing.items.map(item => normalizeText(item.text)))
  const additions = incoming.filter(item => {
    const key = normalizeText(item.text)
    if (!isUsableText(key) || seen.has(key)) return false
    seen.add(key)
    return true
  }).map((item, offset) => ({ ...item, id: item.id || itemId(existing.id, existing.items.length + offset) }))
  return additions.length ? { ...existing, items: [...existing.items, ...additions] } : existing
}

function mergeCatalog(base: ZikrCategory[], incoming: ZikrCategory[]) {
  const result = withStableIds(base)
  for (const category of incoming) {
    const index = result.findIndex(item => item.id === category.id)
    if (index >= 0) result[index] = mergeCategory(result[index], category.items)
    else result.push(withStableIds([category])[0])
  }
  return result
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchCatalog(): Promise<ZikrCategory[]> {
  // The previous Bonyan endpoint is currently returning HTTP 500. Use the
  // stable Hisn al-Muslim JSON endpoint for enrichment instead of making
  // "مدمج + خارجي" silently fall back to the bundled catalog.
  const entries = Object.entries(HISN_CATEGORY_IDS)
  const fetched = await Promise.all(entries.map(async ([categoryId, remoteId]) => {
    const local = azkarCategories.find(category => category.id === categoryId)
    if (!local) return null
    const response = await fetchWithTimeout(`${HISN_API_BASE}/${remoteId}.json`)
    if (!response.ok) return null
    const json = await response.json() as Record<string, Array<{
      ID?: number
      ARABIC_TEXT?: string
      REPEAT?: number | string
    }>>
    const rawItems = Object.values(json).flat()
    const localCount = local.items.length
    const items: ZikrItem[] = rawItems.map((item, index) => {
      const normalized = normalizeText(item.ARABIC_TEXT ?? '')
      const trimmed = stripTrailingArtifact(normalized)
      const extracted = extractEmbeddedSource(trimmed)
      return {
        id: itemId(categoryId, localCount + index),
        text: extracted.text,
        source: 'حصن المسلم',
        ...(Number(item.REPEAT) > 1 ? { repeat: Number(item.REPEAT) } : {}),
      }
    }).filter(item => isUsableText(item.text))
    return items.length ? { ...local, items } : null
  }))

  return fetched.filter((category): category is ZikrCategory => Boolean(category && category.items.length))
}

export function useAzkarCatalog() {
  const [categories, setCategories] = useState<ZikrCategory[]>(() => withStableIds(azkarCategories))
  const [source, setSource] = useState(() => {
    try { return localStorage.getItem(SOURCE_KEY) || 'bundled' } catch { return 'bundled' }
  })

  useEffect(() => {
    const onSettings = () => {
      try { setSource(localStorage.getItem(SOURCE_KEY) || 'bundled') } catch { setSource('bundled') }
    }
    window.addEventListener('azkar-settings-changed', onSettings)
    return () => window.removeEventListener('azkar-settings-changed', onSettings)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadCatalog = () => {
      const bundled = withStableIds(azkarCategories)

      // Always restore the bundled catalog first. This makes the embedded
      // content immediately visible after switching sources and also gives
      // merged mode a reliable offline baseline when the remote endpoint fails.
      setCategories(bundled)

      if (source === 'bundled') return

      let cacheFresh = false
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        const cachedAt = Number(localStorage.getItem(CACHE_TIME_KEY) || 0)
        cacheFresh = Boolean(cached && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS)
        if (cached) {
          const parsed = JSON.parse(cached) as ZikrCategory[]
          if (Array.isArray(parsed) && parsed.length) setCategories(current => mergeCatalog(bundled, parsed))
        }
      } catch {}

      if (cacheFresh) return

      fetchCatalog().then(remote => {
        if (cancelled || !remote.length) return
        setCategories(current => {
          const merged = mergeCatalog(bundled, remote)
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(merged))
            localStorage.setItem(CACHE_TIME_KEY, String(Date.now()))
          } catch {}
          return merged
        })
      }).catch(() => {})
    }

    const runIdle = (fn: () => void) => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 1800 })
      else globalThis.setTimeout(fn, 0)
    }
    runIdle(loadCatalog)
    const onRefresh = () => loadCatalog()
    window.addEventListener('azkar-catalog-refresh', onRefresh)
    return () => {
      cancelled = true
      window.removeEventListener('azkar-catalog-refresh', onRefresh)
    }
  }, [source])

  return { categories, source }
}

export { CACHE_KEY, CACHE_TIME_KEY, CACHE_TTL_MS, mergeCatalog, normalizeText, SOURCE_KEY, withStableIds }
