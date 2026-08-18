import { useEffect, useRef } from 'react'
import { useCollectionsStore } from '@/stores/collections'

interface CollectionFilterTabsProps {
  /** 当前选中收藏夹 id；'' = 全部 */
  value: string
  onChange: (collectionId: string) => void
}

/**
 * 收藏夹过滤 Tab 条（期货页工具栏下方，替换原 CollectionFilterSelect 下拉）。
 * 首 Tab「全部」+ 每个收藏夹一个 Tab（夹名 + 合约数角标）。
 *
 * 收藏夹数量可变：
 * - 0 个夹 → 整条不渲染（不占纵向空间，与旧下拉行为一致）
 * - 夹多/窄屏 → 单行横滚（wheel 横转 scrollLeft，与 TabBar 行为一致），夹名省略号截断
 *
 * value 指向已删除的夹时降级为「全部」高亮（stale 回退，配合 MarketPanel 的 store 清理）。
 * 过滤逻辑不在本组件：点击仅写 futuresCollectionId，过滤由 MarketPanel 的 filterByCollection 完成。
 */
export function CollectionFilterTabs({ value, onChange }: CollectionFilterTabsProps) {
  const collections = useCollectionsStore((s) => s.collections)
  const elRef = useRef<HTMLDivElement>(null)

  // 原生 wheel → 水平滚动（React onWheel 为 passive，preventDefault 无效；与 TabBar 方案一致）。
  // hasCollections 翻转（0→N）时重新挂载监听；无溢出时不拦截滚轮。
  const hasCollections = collections.length > 0
  useEffect(() => {
    const el = elRef.current
    if (!el || !hasCollections) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += e.deltaX + e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasCollections])

  if (!hasCollections) return null

  const activeId = collections.some((c) => c.id === value) ? value : ''

  return (
    <div
      ref={elRef}
      className="collection-tabs"
      role="tablist"
      aria-label="收藏夹过滤"
      data-testid="collection-tabs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeId === ''}
        className={`collection-tab${activeId === '' ? ' collection-tab--active' : ''}`}
        onClick={() => onChange('')}
        title="全部合约"
      >
        全部
      </button>
      {collections.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={activeId === c.id}
          className={`collection-tab${activeId === c.id ? ' collection-tab--active' : ''}`}
          onClick={() => onChange(c.id)}
          title={c.name}
        >
          <span className="collection-tab__name">📁 {c.name}</span>
          <span className="collection-tab__count">({c.instrumentIDs.length})</span>
        </button>
      ))}
    </div>
  )
}