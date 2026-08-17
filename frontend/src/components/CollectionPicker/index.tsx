import { useEffect, useRef, useState } from 'react'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'
import './index.css'

interface CollectionPickerProps {
  isOpen: boolean
  /** 目标合约：1 个 = 单选（对账）；>1 = 批量（只加不删） */
  instrumentIDs?: string[]
  /** P2 新增：系列模式（与 instrumentIDs 互斥） */
  seriesIDs?: string[]
  onClose: () => void
}

export function CollectionPicker({ isOpen, instrumentIDs = [], seriesIDs, onClose }: CollectionPickerProps) {
  const isSeries = seriesIDs != null
  const ids = isSeries ? seriesIDs : instrumentIDs
  const collections = useCollectionsStore((s) => s.collections)
  const {
    createCollection, addToCollections, removeFromCollection, removeFromAllCollections,
    addSeriesToCollections, removeSeriesFromCollection, removeSeriesFromAllCollections,
  } = useCollectionsStore()
  const openTab = useTabStore((s) => s.openTab)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const single = ids.length === 1
  const targetId = ids[0]

  // 打开时初始化勾选态：单选预勾选所在夹；批量全部不勾。
  // 系列模式按 seriesIDs 判定，合约模式按 instrumentIDs 判定。
  // 注意：不能依赖 collections——本组件内的 createCollection 会变更 collections，
  // 若将其作为依赖，新建收藏夹后 effect 重跑会把新夹的勾选态重置掉。
  useEffect(() => {
    if (!isOpen) return
    if (single) {
      const key = isSeries ? 'seriesIDs' : 'instrumentIDs'
      setChecked(new Set(collections.filter((c) => (c[key] ?? []).includes(targetId)).map((c) => c.id)))
    } else {
      setChecked(new Set())
    }
    setNewName('')
  }, [isOpen, single, targetId, isSeries]) // eslint-disable-line react-hooks/exhaustive-deps

  // 外部点击 / Esc 关闭
  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const allChecked = collections.length > 0 && collections.every((c) => checked.has(c.id))

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(collections.map((c) => c.id)))
  }

  const toggleOne = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    const id = createCollection(name)
    setChecked((prev) => new Set(prev).add(id))
    setNewName('')
    toast.success(`已新建收藏夹「${name}」`)
  }

  const handleRemoveAll = () => {
    if (isSeries) {
      removeSeriesFromAllCollections(seriesIDs!)
      toast.success(`已移除 ${ids.length} 个系列的全部收藏`)
    } else {
      removeFromAllCollections(instrumentIDs)
      toast.success(`已移除 ${instrumentIDs.length} 个合约的全部收藏`)
    }
    onClose()
  }

  const handleConfirm = () => {
    const checkedIds = Array.from(checked)
    if (checkedIds.length === 0) {
      if (single) {
        // 单选未勾选任何夹 = 从所有夹移除
        if (isSeries) removeSeriesFromAllCollections([targetId])
        else removeFromAllCollections([targetId])
        toast.success(`已移除 ${targetId} 的全部收藏`)
        onClose()
      } else {
        toast.error('请选择收藏夹')
      }
      return
    }
    if (isSeries) {
      if (single) {
        const current = collections.filter((c) => (c.seriesIDs ?? []).includes(targetId)).map((c) => c.id)
        const toAdd = checkedIds.filter((id) => !current.includes(id))
        const toRemove = current.filter((id) => !checkedIds.includes(id))
        if (toAdd.length > 0) addSeriesToCollections([targetId], toAdd)
        for (const id of toRemove) removeSeriesFromCollection(targetId, id)
        toast.success(`已收藏到 ${checkedIds.length} 个收藏夹`)
      } else {
        addSeriesToCollections(ids, checkedIds)
        toast.success(`已将 ${ids.length} 个系列收藏到 ${checkedIds.length} 个收藏夹`)
      }
    } else {
      if (single) {
        const current = collections.filter((c) => c.instrumentIDs.includes(targetId)).map((c) => c.id)
        const toAdd = checkedIds.filter((id) => !current.includes(id))
        const toRemove = current.filter((id) => !checkedIds.includes(id))
        if (toAdd.length > 0) addToCollections([targetId], toAdd)
        for (const id of toRemove) removeFromCollection(targetId, id)
        toast.success(`已收藏到 ${checkedIds.length} 个收藏夹`)
      } else {
        addToCollections(instrumentIDs, checkedIds)
        toast.success(`已将 ${instrumentIDs.length} 个合约收藏到 ${checkedIds.length} 个收藏夹`)
      }
    }
    onClose()
  }

  const openManage = () => {
    onClose()
    openTab({ type: 'collections', title: '📁 收藏夹' })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content collection-picker" ref={containerRef}>
        <div className="modal-header">
          <h3>
            {isSeries
              ? single
                ? '收藏系列到收藏夹'
                : `收藏 ${ids.length} 个系列到收藏夹`
              : single
                ? '收藏到收藏夹'
                : `收藏 ${instrumentIDs.length} 个合约到收藏夹`}
          </h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="collection-picker__list">
          <div className="collection-picker__row">
            <label>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              全选 / 全不选
            </label>
          </div>
          {collections.map((c) => (
            <div key={c.id} className="collection-picker__row">
              <label>
                <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleOne(c.id)} />
                <span className="collection-picker__name">{c.name}</span>
                <span className="collection-picker__count">
                  {isSeries ? (c.seriesIDs?.length ?? 0) : c.instrumentIDs.length}
                </span>
              </label>
            </div>
          ))}
          {collections.length === 0 && <div className="collection-picker__empty">还没有收藏夹，先新建一个</div>}
        </div>
        <div className="collection-picker__new">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="新建收藏夹名称..."
          />
          <button onClick={handleCreate}>+ 新建</button>
        </div>
        <div className="collection-picker__footer">
          <button className="collection-picker__manage" onClick={openManage}>管理收藏夹</button>
          {single && (
            <button className="collection-picker__remove-all" onClick={handleRemoveAll}>移除全部收藏</button>
          )}
          <button className="collection-picker__confirm" onClick={handleConfirm}>确定</button>
        </div>
      </div>
    </div>
  )
}
