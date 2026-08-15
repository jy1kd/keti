import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionFilterSelect } from './CollectionFilterSelect'
import { filterByCollection } from './filter'
import { useCollectionsStore } from '@/stores/collections'

const collections = [
  { id: 'a', name: '农产品', instrumentIDs: ['IF2608', 'IF2609'] },
  { id: 'b', name: '黑色系', instrumentIDs: ['RB2610'] },
]

describe('CollectionFilterSelect', () => {
  beforeEach(() => {
    useCollectionsStore.setState({ collections: [] })
  })

  it('无收藏夹时不渲染任何控件', () => {
    render(<CollectionFilterSelect value="" onChange={vi.fn()} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('有收藏夹时渲染「全部收藏夹」+ 各夹选项', () => {
    useCollectionsStore.setState({ collections })
    render(<CollectionFilterSelect value="" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('全部收藏夹')).toBeInTheDocument()
    expect(screen.getByText('农产品')).toBeInTheDocument()
    expect(screen.getByText('黑色系')).toBeInTheDocument()
  })

  it('选择变化时回调 onChage（收藏夹 id）', () => {
    useCollectionsStore.setState({ collections })
    const onChange = vi.fn()
    render(<CollectionFilterSelect value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('filterByCollection', () => {
  const items = [
    { instrumentID: 'IF2608' },
    { instrumentID: 'IF2609' },
    { instrumentID: 'RB2610' },
  ]

  it('collectionId 为空时返回全部', () => {
    expect(filterByCollection(items, collections, '')).toHaveLength(3)
  })

  it('只保留选中收藏夹内的合约', () => {
    const result = filterByCollection(items, collections, 'a')
    expect(result.map((i) => i.instrumentID)).toEqual(['IF2608', 'IF2609'])
  })

  it('收藏夹内无匹配项时返回空数组', () => {
    expect(filterByCollection(items, collections, 'zzz')).toEqual([])
  })
})
