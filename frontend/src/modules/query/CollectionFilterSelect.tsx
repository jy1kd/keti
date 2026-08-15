import { useCollectionsStore } from '@/stores/collections'

interface CollectionFilterSelectProps {
  /** 当前选中收藏夹 id；'' = 全部收藏夹 */
  value: string
  onChange: (collectionId: string) => void
}

/**
 * 收藏夹过滤下拉框（报单/持仓查询工具栏共用）。
 * 选项 = 「全部收藏夹」+ 各收藏夹名；无收藏夹时不渲染（查询页无收藏数据时可自选全部）。
 * 过滤逻辑见 ./filter.ts 的 filterByCollection。
 */
export function CollectionFilterSelect({ value, onChange }: CollectionFilterSelectProps) {
  const collections = useCollectionsStore((s) => s.collections)
  if (collections.length === 0) return null
  return (
    <select
      className="collection-filter-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="按收藏夹过滤"
    >
      <option value="">全部收藏夹</option>
      {collections.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
