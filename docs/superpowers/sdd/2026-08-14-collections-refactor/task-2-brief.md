### Task 2: CollectionPicker 选夹面板组件

**Files:**
- Create: `frontend/src/components/CollectionPicker/index.tsx`
- Create: `frontend/src/components/CollectionPicker/index.css`
- Test: `frontend/src/components/CollectionPicker/index.test.tsx`

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）；`useTabStore.openTab`；`toast`
- Produces: `export function CollectionPicker({ isOpen, instrumentIDs, onClose }: { isOpen: boolean; instrumentIDs: string[]; onClose: () => void })` — `instrumentIDs.length===1` 单选对账；`>1` 批量只加

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/components/CollectionPicker/index.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionPicker } from './index'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'

vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const seed = () =>
  useCollectionsStore.setState({
    collections: [
      { id: 'a', name: 'A', instrumentIDs: ['au2406'] },
      { id: 'b', name: 'B', instrumentIDs: ['rb2406'] },
    ],
    loaded: true,
  })

describe('CollectionPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('单选模式：预勾选所在夹；取消勾选 + 确定 → 从该夹移除', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    const aCheck = screen.getByRole('checkbox', { name: /A/ })
    expect(aCheck.checked).toBe(true)
    fireEvent.click(aCheck)
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual([]) // 对账移除
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406'])
  })

  it('单选模式：勾选新夹 + 确定 → 加入', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /B/ }))
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406', 'au2406'])
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406']) // 保持
  })

  it('批量模式：不预勾选；确认加入勾选的夹（只加不删）', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406', 'rb2406']} onClose={vi.fn()} />)
    // 批量预勾选为空
    expect(screen.getByRole('checkbox', { name: /A/ }).checked).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /A/ }))
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406']) // 未勾选不动
  })

  it('全选/全不选 toggle', () => {
    render(<CollectionPicker isOpen instrumentIDs={['cu2609']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/全选/))
    expect(screen.getByRole('checkbox', { name: /A/ }).checked).toBe(true)
    expect(screen.getByRole('checkbox', { name: /B/ }).checked).toBe(true)
  })

  it('新建收藏夹：回车创建并勾选', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/新建收藏夹/), { target: { value: '新夹' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/新建收藏夹/), { key: 'Enter' })
    const collections = useCollectionsStore.getState().collections
    const created = collections.find((c) => c.name === '新夹')
    expect(created).toBeDefined()
    expect(screen.getByRole('checkbox', { name: /新夹/ }).checked).toBe(true)
  })

  it('单选「移除全部收藏」从所有夹移除并关闭', () => {
    const onClose = vi.fn()
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={onClose} />)
    fireEvent.click(screen.getByText('移除全部收藏'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual([])
    expect(onClose).toHaveBeenCalled()
  })

  it('「管理收藏夹」打开 collections 管理标签', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('管理收藏夹'))
    expect(useTabStore.getState().tabs.some((t) => t.type === 'collections')).toBe(true)
  })

  it('Escape 关闭', () => {
    const onClose = vi.fn()
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('批量模式未勾选任何夹 → toast.error 且不关闭', () => {
    const onClose = vi.fn()
    render(<CollectionPicker isOpen instrumentIDs={['au2406', 'rb2406']} onClose={onClose} />)
    fireEvent.click(screen.getByText('确定'))
    expect(toast.error).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/components/CollectionPicker/index.test.tsx`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 实现 `CollectionPicker/index.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'
import './index.css'

interface CollectionPickerProps {
  isOpen: boolean
  /** 目标合约：1 个 = 单选（对账）；>1 = 批量（只加不删） */
  instrumentIDs: string[]
  onClose: () => void
}

export function CollectionPicker({ isOpen, instrumentIDs, onClose }: CollectionPickerProps) {
  const collections = useCollectionsStore((s) => s.collections)
  const { createCollection, addToCollections, removeFromCollection, removeFromAllCollections } = useCollectionsStore()
  const openTab = useTabStore((s) => s.openTab)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const single = instrumentIDs.length === 1
  const targetId = instrumentIDs[0]

  // 打开时初始化勾选态：单选预勾选所在夹；批量全部不勾
  useEffect(() => {
    if (!isOpen) return
    if (single) {
      setChecked(new Set(collections.filter((c) => c.instrumentIDs.includes(targetId)).map((c) => c.id)))
    } else {
      setChecked(new Set())
    }
    setNewName('')
  }, [isOpen, single, targetId, collections])

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
    removeFromAllCollections(instrumentIDs)
    toast.success(`已移除 ${instrumentIDs.length} 个合约的全部收藏`)
    onClose()
  }

  const handleConfirm = () => {
    const checkedIds = Array.from(checked)
    if (checkedIds.length === 0) {
      if (single) {
        // 单选未勾选任何夹 = 从所有夹移除
        removeFromAllCollections([targetId])
        toast.success(`已移除 ${targetId} 的全部收藏`)
        onClose()
      } else {
        toast.error('请选择收藏夹')
      }
      return
    }
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
          <h3>{single ? '收藏到收藏夹' : `收藏 ${instrumentIDs.length} 个合约到收藏夹`}</h3>
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
                <span className="collection-picker__count">{c.instrumentIDs.length}</span>
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
```

- [ ] **Step 4: 实现 `CollectionPicker/index.css`**

```css
/* 收藏夹选择面板（复用 modal-overlay/modal-content 骨架） */
.collection-picker {
  width: 320px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.collection-picker__list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 4px 0;
}

.collection-picker__row {
  padding: 6px 12px;
  font-size: 13px;
}

.collection-picker__row label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.collection-picker__row input[type='checkbox'] {
  accent-color: var(--color-primary, #4a9eff);
}

.collection-picker__name {
  color: var(--text-primary);
  flex: 1;
}

.collection-picker__count {
  color: var(--text-secondary);
  font-size: 12px;
}

.collection-picker__empty {
  padding: 12px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 12px;
}

.collection-picker__new {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}

.collection-picker__new input {
  flex: 1;
  padding: 4px 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
}

.collection-picker__new button {
  padding: 4px 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.collection-picker__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}

.collection-picker__manage {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.collection-picker__remove-all {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--color-error);
  font-size: 12px;
  cursor: pointer;
}

.collection-picker__confirm {
  padding: 4px 16px;
  background: var(--color-primary, #4a9eff);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/components/CollectionPicker/index.test.tsx`
Expected: PASS（`modal-overlay`/`modal-content`/`modal-header`/`modal-close` 为全局 modal 样式，若测试环境无全局 css 不影响 DOM 断言）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/CollectionPicker/
git commit -m "feat(collections): CollectionPicker 选夹面板组件

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

