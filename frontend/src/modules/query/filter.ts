import type { Collection } from '@/stores/collections'

/**
 * 按收藏夹过滤：collectionId 为空时返回全部；
 * 否则仅保留 instrumentID 属于该收藏夹的条目（收藏夹不存在时视为无匹配）。
 */
export function filterByCollection<T extends { instrumentID: string }>(
  items: T[],
  collections: Collection[],
  collectionId: string,
): T[] {
  if (!collectionId) return items
  const ids = new Set(collections.find((c) => c.id === collectionId)?.instrumentIDs ?? [])
  return items.filter((item) => ids.has(item.instrumentID))
}
