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

  it('删除收藏夹后关闭已打开的该夹标签页（不残留「收藏夹不存在」僵尸页）', () => {
    useTabStore.getState().openTab({ type: 'collection', title: '📁 农产品', props: { collectionId: 'a' } })
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('删除')[0])
    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection' && t.props.collectionId === 'a')).toHaveLength(0)
  })

  it('空态', () => {
    useCollectionsStore.setState({ collections: [] })
    render(<CollectionsPage />)
    expect(screen.getByText(/还没有收藏夹/)).toBeDefined()
  })
})
