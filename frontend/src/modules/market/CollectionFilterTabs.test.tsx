import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionFilterTabs } from './CollectionFilterTabs'
import { useCollectionsStore } from '@/stores/collections'

beforeEach(() => {
  useCollectionsStore.setState({ collections: [], loaded: true })
})

describe('CollectionFilterTabs', () => {
  it('无收藏夹时不渲染（不占工具栏下方空间）', () => {
    render(<CollectionFilterTabs value="" onChange={() => {}} />)
    expect(screen.queryByTestId('collection-tabs')).not.toBeInTheDocument()
  })

  it('渲染「全部」+ 各收藏夹 Tab，角标显示合约数', () => {
    useCollectionsStore.setState({
      collections: [
        { id: 'a', name: '自选', instrumentIDs: ['IF2608', 'cu2609'] },
        { id: 'b', name: '黑色系', instrumentIDs: ['RB2610'] },
      ],
      loaded: true,
    })
    render(<CollectionFilterTabs value="a" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '全部' })).toBeInTheDocument()
    const selfTab = screen.getByRole('tab', { name: /自选/ })
    const blackTab = screen.getByRole('tab', { name: /黑色系/ })
    expect(selfTab).toBeInTheDocument()
    expect(blackTab).toBeInTheDocument()
    expect(selfTab).toHaveTextContent('2')
    expect(blackTab).toHaveTextContent('1')
  })

  it('选中 Tab 标记 aria-selected（value 对应夹高亮，「全部」不高亮）', () => {
    useCollectionsStore.setState({ collections: [{ id: 'a', name: '自选', instrumentIDs: [] }], loaded: true })
    render(<CollectionFilterTabs value="a" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /自选/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'false')
  })

  it('value 为空（全部）时「全部」高亮', () => {
    useCollectionsStore.setState({ collections: [{ id: 'a', name: '自选', instrumentIDs: [] }], loaded: true })
    render(<CollectionFilterTabs value="" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true')
  })

  it('点击夹 Tab 触发 onChange 带夹 id；点击「全部」带空串', async () => {
    useCollectionsStore.setState({
      collections: [
        { id: 'a', name: '自选', instrumentIDs: [] },
        { id: 'b', name: '黑色系', instrumentIDs: [] },
      ],
      loaded: true,
    })
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CollectionFilterTabs value="" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: /黑色系/ }))
    expect(onChange).toHaveBeenCalledWith('b')
    await user.click(screen.getByRole('tab', { name: '全部' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('value 指向已删除的夹时按「全部」选中（stale 回退，不把缺失夹标为高亮）', () => {
    useCollectionsStore.setState({ collections: [{ id: 'a', name: '自选', instrumentIDs: [] }], loaded: true })
    render(<CollectionFilterTabs value="ghost" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /自选/ })).toHaveAttribute('aria-selected', 'false')
  })
})