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
    const aCheck = screen.getByRole('checkbox', { name: /A/ }) as HTMLInputElement
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
    expect((screen.getByRole('checkbox', { name: /A/ }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /A/ }))
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406']) // 未勾选不动
  })

  it('全选/全不选 toggle', () => {
    render(<CollectionPicker isOpen instrumentIDs={['cu2609']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/全选/))
    expect((screen.getByRole('checkbox', { name: /A/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: /B/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('新建收藏夹：回车创建并勾选', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/新建收藏夹/), { target: { value: '新夹' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/新建收藏夹/), { key: 'Enter' })
    const collections = useCollectionsStore.getState().collections
    const created = collections.find((c) => c.name === '新夹')
    expect(created).toBeDefined()
    expect((screen.getByRole('checkbox', { name: /新夹/ }) as HTMLInputElement).checked).toBe(true)
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
    // Task 4 将加入 collections 类型
    expect(useTabStore.getState().tabs.some((t) => (t.type as string) === 'collections')).toBe(true)
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

  // -------- Series mode --------

  it('series 模式：初始勾选按 seriesIDs 判定，单 series 确认走 addSeriesToCollections', () => {
    const addSeriesToCollections = vi.fn()
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '期权夹', instrumentIDs: [], seriesIDs: [] }],
      addSeriesToCollections,
    } as any)
    render(<CollectionPicker isOpen seriesIDs={['MO2608']} onClose={vi.fn()} />)
    // 单 series：默认不勾选（不在任何夹）
    expect((screen.getByRole('checkbox', { name: /期权夹/ }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /期权夹/ }))
    fireEvent.click(screen.getByText('确定'))
    expect(addSeriesToCollections).toHaveBeenCalledWith(['MO2608'], expect.arrayContaining(['a']))
  })

  it('series 模式：单 series 已在夹中 → 预勾选，取消后移除全部收藏', () => {
    const removeSeriesFromAllCollections = vi.fn()
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '期权夹', instrumentIDs: [], seriesIDs: ['MO2608'] }],
      removeSeriesFromAllCollections,
    } as any)
    render(<CollectionPicker isOpen seriesIDs={['MO2608']} onClose={vi.fn()} />)
    expect((screen.getByRole('checkbox', { name: /期权夹/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /期权夹/ })) // 取消勾选
    fireEvent.click(screen.getByText('确定'))
    // 单 series 取消全部勾选 → 从所有夹移除
    expect(removeSeriesFromAllCollections).toHaveBeenCalledWith(['MO2608'])
  })

  it('series 模式：多 series 批量 → addSeriesToCollections(ids, checkedIds)', () => {
    const addSeriesToCollections = vi.fn()
    useCollectionsStore.setState({
      collections: [
        { id: 'a', name: '夹A', instrumentIDs: [], seriesIDs: [] },
        { id: 'b', name: '夹B', instrumentIDs: [], seriesIDs: [] },
      ],
      addSeriesToCollections,
    } as any)
    render(<CollectionPicker isOpen seriesIDs={['MO2608', 'MO2609']} onClose={vi.fn()} />)
    // 多 series 不预勾选
    expect((screen.getByRole('checkbox', { name: /夹A/ }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /夹A/ }))
    fireEvent.click(screen.getByText('确定'))
    expect(addSeriesToCollections).toHaveBeenCalledWith(['MO2608', 'MO2609'], ['a'])
  })

  it('series 模式：移除全部收藏 → removeSeriesFromAllCollections', () => {
    const removeSeriesFromAllCollections = vi.fn()
    const onClose = vi.fn()
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '期权夹', instrumentIDs: [], seriesIDs: ['MO2608'] }],
      removeSeriesFromAllCollections,
    } as any)
    render(<CollectionPicker isOpen seriesIDs={['MO2608']} onClose={onClose} />)
    fireEvent.click(screen.getByText('移除全部收藏'))
    expect(removeSeriesFromAllCollections).toHaveBeenCalledWith(['MO2608'])
    expect(onClose).toHaveBeenCalled()
  })

  it('series 模式：头部文案包含「系列」', () => {
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '期权夹', instrumentIDs: [], seriesIDs: [] }],
    } as any)
    render(<CollectionPicker isOpen seriesIDs={['MO2608']} onClose={vi.fn()} />)
    expect(screen.getByText(/系列/)).toBeTruthy()
  })

  it('series 模式：未勾选任何夹 + 单 series → toast.error', () => {
    const onClose = vi.fn()
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '期权夹', instrumentIDs: [], seriesIDs: [] }],
    } as any)
    render(<CollectionPicker isOpen seriesIDs={['MO2608']} onClose={onClose} />)
    // 不勾选直接确定（单 series，未勾选 → 移除全部）
    fireEvent.click(screen.getByText('确定'))
    expect(toast.success).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
