import { useEffect, useMemo, useState } from 'react'
import { useQueryStore } from './store'
import { Position } from './Position'
import { CollectionFilterSelect } from './CollectionFilterSelect'
import { filterByCollection } from './filter'
import { useCollectionsStore } from '@/stores/collections'
import './styles.css'

export function PositionsQuery() {
  const positions = useQueryStore((s) => s.positions)
  const fetchPositions = useQueryStore((s) => s.fetchPositions)
  const collections = useCollectionsStore((s) => s.collections)
  const [search, setSearch] = useState('')
  const [collectionId, setCollectionId] = useState('')

  // 10s 自刷新：完成后调度下一次，避免重入
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = async () => {
      await fetchPositions()
      if (cancelled) return
      timer = setTimeout(schedule, 10000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchPositions])

  // 合约模糊匹配：instrumentID 子串、大小写不敏感、空输入显示全部
  const bySearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return positions
    return positions.filter((p) => p.instrumentID.toLowerCase().includes(q))
  }, [positions, search])

  // 收藏夹过滤（与搜索叠加）
  const filtered = filterByCollection(bySearch, collections, collectionId)

  return (
    <div className="positions-query">
      <div className="flow-toolbar">
        <CollectionFilterSelect value={collectionId} onChange={setCollectionId} />
        <input
          type="text"
          className="position-search"
          placeholder="筛选合约，如 IF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Position
        positions={filtered}
        emptyText={collectionId ? '该收藏夹无持仓' : search.trim() ? '无匹配持仓' : undefined}
      />
    </div>
  )
}
