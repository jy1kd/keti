import { useEffect, useMemo, useState } from 'react'
import { useQueryStore } from './store'
import { Position } from './Position'

export function PositionsQuery() {
  const positions = useQueryStore((s) => s.positions)
  const fetchPositions = useQueryStore((s) => s.fetchPositions)
  const [search, setSearch] = useState('')

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
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return positions
    return positions.filter((p) => p.instrumentID.toLowerCase().includes(q))
  }, [positions, search])

  return (
    <div className="positions-query">
      <div className="flow-toolbar">
        <input
          type="text"
          className="position-search"
          placeholder="筛选合约，如 IF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Position positions={filtered} emptyText={search.trim() ? '无匹配持仓' : undefined} />
    </div>
  )
}
