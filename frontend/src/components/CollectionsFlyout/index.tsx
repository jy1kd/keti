import { useState } from 'react'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { openCollectionFloating } from '@/utils/openFloatingTab'
import { toast } from '@/components/Toast'
import './index.css'

/**
 * CollectionsFlyout — 收藏夹快速入口弹层（顶栏「📁 收藏夹」hover / `+` 菜单项）
 *
 * 内容：顶部「+ 新建收藏夹」输入 + 收藏夹列表（名 + 合约数，点击直接打开为悬浮窗）
 * + 「管理收藏夹」链接。免去先开管理页再选择的中间步骤。
 */
export function CollectionsFlyout({ onClose }: { onClose: () => void }) {
  const collections = useCollectionsStore((s) => s.collections)
  const createCollection = useCollectionsStore((s) => s.createCollection)
  const openTab = useTabStore((s) => s.openTab)
  const [newName, setNewName] = useState('')

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createCollection(name)
    setNewName('')
    toast.success(`已新建收藏夹「${name}」`)
  }

  const handleOpen = (id: string, name: string) => {
    openCollectionFloating(id, name)
    onClose()
  }

  const handleManage = () => {
    openTab({ type: 'collections', title: '📁 收藏夹' })
    onClose()
  }

  return (
    <div className="collections-flyout" role="menu" aria-label="收藏夹">
      <div className="collections-flyout__create">
        <input
          className="collections-flyout__input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="新建收藏夹名称..."
        />
        <button className="collections-flyout__new-btn" onClick={handleCreate}>+ 新建</button>
      </div>
      <div className="collections-flyout__list">
        {collections.length === 0 ? (
          <div className="collections-flyout__empty">还没有收藏夹</div>
        ) : (
          collections.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitem"
              className="collections-flyout__item"
              onClick={() => handleOpen(c.id, c.name)}
            >
              <span className="collections-flyout__name">📁 {c.name}</span>
              <span className="collections-flyout__count">{c.instrumentIDs.length}</span>
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        className="collections-flyout__manage"
        onClick={handleManage}
      >
        管理收藏夹 →
      </button>
    </div>
  )
}
