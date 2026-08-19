### Task 5: 收藏夹管理页完整实现

**Files:**
- Modify: `frontend/src/pages/CollectionsPage.tsx`（替换壳）
- Modify: `frontend/src/pages/CollectionsPage.css`
- Test: `frontend/src/pages/CollectionsPage.test.tsx`（新，替代原 FavoritesPage.test.tsx 的收藏页职责）

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）、`useTabStore`、`toast`
- Produces: 无（页面终端）

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/pages/CollectionsPage.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionsPage } from './CollectionsPage'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'

vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const seed = () =>
  useCollectionsStore.setState({
    collections: [
      { id: 'a', name: '农产品', instrumentIDs: ['au2406', 'rb2406'] },
      { id: 'b', name: '黑色系', instrumentIDs: [] },
    ],
    loaded: true,
  })

describe('CollectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('展示收藏夹列表（名称 + 合约数）', () => {
    render(<CollectionsPage />)
    expect(screen.getByText('农产品')).toBeDefined()
    expect(screen.getByText('黑色系')).toBeDefined()
    expect(screen.getByText('2 个合约')).toBeDefined()
  })

  it('新建收藏夹', () => {
    render(<CollectionsPage />)
    fireEvent.change(screen.getByPlaceholderText(/新建收藏夹/), { target: { value: '新夹' } })
    fireEvent.click(screen.getByText('+ 新建收藏夹'))
    expect(useCollectionsStore.getState().collections.some((c) => c.name === '新夹')).toBe(true)
  })

  it('打开收藏夹 → 打开 collection 标签（按 collectionId 去重）', () => {
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('打开')[0])
    const state = useTabStore.getState()
    expect(state.tabs.some((t) => t.type === 'collection' && t.props.collectionId === 'a')).toBe(true)
    fireEvent.click(screen.getAllByText('打开')[0])
    expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection')).toHaveLength(1)
  })

  it('重命名同步已打开的夹标签标题', () => {
    useTabStore.getState().openTab({ type: 'collection', title: '📁 农产品', props: { collectionId: 'a' } })
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('重命名')[0])
    const input = screen.getByDisplayValue('农产品')
    fireEvent.change(input, { target: { value: '农产品2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const coll = useCollectionsStore.getState().collections.find((c) => c.id === 'a')!
    expect(coll.name).toBe('农产品2')
    const tab = useTabStore.getState().tabs.find((t) => t.type === 'collection' && t.props.collectionId === 'a')!
    expect(tab.title).toBe('📁 农产品2')
  })

  it('删除需确认；确认后夹被删除，不影响合约本身', () => {
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('删除')[0]) // 行内删除按钮
    expect(screen.getByText('删除收藏夹')).toBeDefined() // 确认弹窗出现
    fireEvent.click(screen.getByTestId('confirm-delete')) // 弹窗内确认按钮（唯一 testid）
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'a')).toBeUndefined()
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'b')).toBeDefined()
  })

  it('空态', () => {
    useCollectionsStore.setState({ collections: [] })
    render(<CollectionsPage />)
    expect(screen.getByText(/还没有收藏夹/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/CollectionsPage.test.tsx`
Expected: FAIL — 壳只渲染空态。

- [ ] **Step 3: 实现 `CollectionsPage.tsx`**

```tsx
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
```

- [ ] **Step 4: 实现 `CollectionsPage.css`**（替换壳 css）

```css
.collections-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  padding: 12px;
  box-sizing: border-box;
}

.collections-page__create {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.collections-page__input {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
}

.collections-page__create-btn {
  padding: 6px 14px;
  background: var(--color-primary, #4a9eff);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.collections-page__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.collections-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.collections-page__name {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collections-page__count {
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.collections-page__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.collections-page__btn {
  padding: 4px 10px;
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.collections-page__btn--danger {
  color: var(--color-error);
}

.collections-page__rename-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--color-primary, #4a9eff);
  border-radius: 4px;
  font-size: 13px;
}

.collections-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  min-height: 200px;
}

.collections-page__hint {
  font-size: 13px;
  margin-top: 8px;
}

.collections-page__confirm {
  width: 340px;
  padding: 16px;
}

.collections-page__confirm p {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 8px 0 16px;
}

.collections-page__confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.collections-page__confirm-actions button {
  padding: 6px 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/CollectionsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/CollectionsPage.tsx frontend/src/pages/CollectionsPage.css frontend/src/pages/CollectionsPage.test.tsx
git commit -m "feat(collections): 收藏夹管理页完整实现（新建/列表/打开/重命名同步标题/删除确认）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

