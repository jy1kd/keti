import { useState } from 'react'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'
import './CollectionsPage.css'

export function CollectionsPage() {
  const { collections, createCollection, renameCollection, deleteCollection } = useCollectionsStore()
  const openTab = useTabStore((s) => s.openTab)
  const updateTab = useTabStore((s) => s.updateTab)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createCollection(name)
    setNewName('')
    toast.success(`已新建收藏夹「${name}」`)
  }

  const openCollection = (id: string, name: string) => {
    openTab({ type: 'collection', title: `📁 ${name}`, props: { collectionId: id } })
  }

  const startRename = (id: string, name: string) => {
    setRenamingId(id)
    setRenameValue(name)
  }

  const commitRename = (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    renameCollection(id, name)
    // 同步已打开的该夹标签标题
    useTabStore.getState().tabs
      .filter((t) => t.type === 'collection' && t.props.collectionId === id)
      .forEach((t) => updateTab(t.id, { title: `📁 ${name}` }))
    setRenamingId(null)
    toast.success('已重命名')
  }

  const confirmDelete = () => {
    if (!deletingId) return
    deleteCollection(deletingId)
    // 关闭已打开的该夹标签页，避免残留「收藏夹不存在」僵尸页
    useTabStore.getState().tabs
      .filter((t) => t.type === 'collection' && t.props.collectionId === deletingId)
      .forEach((t) => useTabStore.getState().closeTab(t.id))
    setDeletingId(null)
    toast.success('已删除收藏夹')
  }

  return (
    <section className="collections-page" data-testid="collections-page">
      <div className="collections-page__create">
        <input
          className="collections-page__input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="新建收藏夹名称..."
        />
        <button className="collections-page__create-btn" onClick={handleCreate}>+ 新建收藏夹</button>
      </div>
      <div className="collections-page__list">
        {collections.length === 0 ? (
          <div className="collections-page__empty">
            <p>还没有收藏夹</p>
            <p className="collections-page__hint">在上方新建，或去行情页点 ⭐ 收藏到收藏夹</p>
          </div>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="collections-page__item">
              {renamingId === c.id ? (
                <input
                  className="collections-page__rename-input"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(c.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <span className="collections-page__name">{c.name}</span>
              )}
              <span className="collections-page__count">{c.instrumentIDs.length} 个合约</span>
              <div className="collections-page__actions">
                <button className="collections-page__btn" onClick={() => openCollection(c.id, c.name)}>打开</button>
                <button className="collections-page__btn" onClick={() => startRename(c.id, c.name)}>重命名</button>
                <button className="collections-page__btn collections-page__btn--danger" onClick={() => setDeletingId(c.id)}>删除</button>
              </div>
            </div>
          ))
        )}
      </div>

      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal-content collections-page__confirm" onClick={(e) => e.stopPropagation()}>
            <h3>删除收藏夹</h3>
            <p>「{collections.find((c) => c.id === deletingId)?.name}」内的合约仅从本夹移除，不影响其他收藏夹与合约本身。</p>
            <div className="collections-page__confirm-actions">
              <button onClick={() => setDeletingId(null)}>取消</button>
              <button data-testid="confirm-delete" className="collections-page__btn--danger" onClick={confirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
