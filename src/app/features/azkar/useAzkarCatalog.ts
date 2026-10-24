import { useEffect, useState } from 'react'
import { azkarCategories, type ZikrCategory } from '../../../azkar-data'

const SOURCE_KEY = 'azkar_catalog_source'

// The full Hisn al-Muslim content is now bundled offline (see azkar-hisn.ts),
// so the catalog no longer needs remote fetching or source switching.
export function useAzkarCatalog() {
  const [categories] = useState<ZikrCategory[]>(() => withStableIds(azkarCategories))
  const [source] = useState(() => {
    try { return localStorage.getItem(SOURCE_KEY) || 'bundled' } catch { return 'bundled' }
  })

  useEffect(() => {
    const onSettings = () => {
      try { localStorage.setItem(SOURCE_KEY, 'bundled') } catch {}
    }
    window.addEventListener('azkar-settings-changed', onSettings)
    return () => window.removeEventListener('azkar-settings-changed', onSettings)
  }, [])

  return { categories, source: 'bundled' as const }
}

export { SOURCE_KEY, withStableIds }

function withStableIds(categories: ZikrCategory[]): ZikrCategory[] {
  return categories.map((category, categoryIndex) => ({
    ...category,
    items: category.items.map((item, index) => ({
      ...item,
      id: item.id || `${category.id || `cat-${categoryIndex}`}:item-${index + 1}`,
    })),
  }))
}
