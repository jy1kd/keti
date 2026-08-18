import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketFilterStore } from './marketFilter'
import { EMPTY_FILTER } from '@/modules/market/filter'

const STORAGE_KEY = 'simnow-market-filter'

describe('useMarketFilterStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useMarketFilterStore.setState({
      futures: { ...EMPTY_FILTER },
      options: { ...EMPTY_FILTER },
      futuresCollectionId: '',
      optionsCollectionId: '',
      optionsTabs: { exchange: '', tabs: [], activeIndex: 0 },
    })
  })

  it('初始状态：期货/期权两页均为空筛选（=不限）', () => {
    const { futures, options } = useMarketFilterStore.getState()
    expect(futures).toEqual(EMPTY_FILTER)
    expect(options).toEqual(EMPTY_FILTER)
  })

  it('setExchanges 只更新指定页交易所，不影响另一页', () => {
    useMarketFilterStore.getState().setExchanges('futures', ['SHFE'])
    const { futures, options } = useMarketFilterStore.getState()
    expect(futures.exchanges).toEqual(['SHFE'])
    expect(futures.products).toEqual([])
    expect(options).toEqual(EMPTY_FILTER)
  })

  it('setProducts 更新指定页品种', () => {
    useMarketFilterStore.getState().setProducts('options', ['FG'])
    const { futures, options } = useMarketFilterStore.getState()
    expect(options.products).toEqual(['FG'])
    expect(options.exchanges).toEqual([])
    expect(futures).toEqual(EMPTY_FILTER)
  })

  it('reset 清空指定页筛选，另一页保留', () => {
    useMarketFilterStore.getState().setExchanges('futures', ['SHFE'])
    useMarketFilterStore.getState().setProducts('futures', ['cu'])
    useMarketFilterStore.getState().setExchanges('options', ['CZCE'])
    useMarketFilterStore.getState().reset('futures')
    const { futures, options } = useMarketFilterStore.getState()
    expect(futures).toEqual(EMPTY_FILTER)
    expect(options.exchanges).toEqual(['CZCE'])
  })

  it('每次变更自动持久化到 localStorage', () => {
    useMarketFilterStore.getState().setExchanges('futures', ['SHFE'])
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.futures).toEqual({ exchanges: ['SHFE'], products: [], underlyings: [] })
    expect(stored.options).toEqual(EMPTY_FILTER)
  })

  it('load 从 localStorage 恢复两页筛选态', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        futures: { exchanges: ['SHFE'], products: ['cu'] },
        options: { exchanges: ['CZCE'], products: ['FG'] },
      }),
    )
    useMarketFilterStore.getState().load()
    const { futures, options } = useMarketFilterStore.getState()
    expect(futures).toEqual({ exchanges: ['SHFE'], products: ['cu'] })
    expect(options).toEqual({ exchanges: ['CZCE'], products: ['FG'] })
  })

  it('load 遇损坏数据时忽略并保持默认', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(() => useMarketFilterStore.getState().load()).not.toThrow()
    expect(useMarketFilterStore.getState().futures).toEqual(EMPTY_FILTER)
  })

  it('load 缺失某页时补默认值', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ futures: { exchanges: ['SHFE'], products: [] } }),
    )
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().futures.exchanges).toEqual(['SHFE'])
    expect(useMarketFilterStore.getState().options).toEqual(EMPTY_FILTER)
  })

  it('setFilter 一次更新指定页交易所+品种（单一 localStorage 写）', () => {
    useMarketFilterStore.getState().setFilter('futures', { exchanges: ['SHFE'], products: ['cu'] })
    const { futures, options } = useMarketFilterStore.getState()
    expect(futures).toEqual({ exchanges: ['SHFE'], products: ['cu'], underlyings: [] })
    expect(options).toEqual(EMPTY_FILTER)
  })

  it('load 遇「合法 JSON 但形状损坏」时回退默认，不抛错', () => {
    // {futures: 5} 解析成功但非对象 → 回退空筛选
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ futures: 5, options: null }))
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().futures).toEqual(EMPTY_FILTER)
    expect(useMarketFilterStore.getState().options).toEqual(EMPTY_FILTER)

    // {futures: {exchanges: 'x'}} 字段非数组 → futures 回退，options 正常恢复
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        futures: { exchanges: 'x', products: [] },
        options: { exchanges: ['CZCE'], products: ['FG'] },
      }),
    )
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().futures).toEqual(EMPTY_FILTER)
    expect(useMarketFilterStore.getState().options).toEqual({ exchanges: ['CZCE'], products: ['FG'] })
  })

  // --- 收藏夹过滤（每页独立 id，持久化） ---

  it('setCollectionId 只更新指定页收藏夹 id，另一页保留', () => {
    useMarketFilterStore.getState().setCollectionId('futures', 'a')
    const { futuresCollectionId, optionsCollectionId } = useMarketFilterStore.getState()
    expect(futuresCollectionId).toBe('a')
    expect(optionsCollectionId).toBe('')
  })

  it('setCollectionId 期权页与期货页互不干扰', () => {
    useMarketFilterStore.getState().setCollectionId('futures', 'a')
    useMarketFilterStore.getState().setCollectionId('options', 'b')
    const { futuresCollectionId, optionsCollectionId } = useMarketFilterStore.getState()
    expect(futuresCollectionId).toBe('a')
    expect(optionsCollectionId).toBe('b')
  })

  it('收藏夹 id 变更自动持久化到 localStorage', () => {
    useMarketFilterStore.getState().setCollectionId('futures', 'a')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.futuresCollectionId).toBe('a')
    expect(stored.optionsCollectionId).toBe('')
  })

  it('load 从 localStorage 恢复两页收藏夹 id', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        futures: { exchanges: [], products: [] },
        options: { exchanges: [], products: [] },
        futuresCollectionId: 'a',
        optionsCollectionId: 'b',
      }),
    )
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().futuresCollectionId).toBe('a')
    expect(useMarketFilterStore.getState().optionsCollectionId).toBe('b')
  })

  it('load 收藏夹 id 字段非字符串时回退为空串', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        futures: { exchanges: [], products: [] },
        options: { exchanges: [], products: [] },
        futuresCollectionId: 5,
        optionsCollectionId: null,
      }),
    )
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().futuresCollectionId).toBe('')
    expect(useMarketFilterStore.getState().optionsCollectionId).toBe('')
  })

  // --- 期权页筛选 Tab（optionsTabs：交易所→品种 Tab→系列，持久化） ---

  it('optionsTabs 初始为空', () => {
    expect(useMarketFilterStore.getState().optionsTabs).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })

  it('setOptionsTabs 整体更新 optionsTabs 并持久化到 localStorage', () => {
    const next = {
      exchange: 'SHFE',
      tabs: [{ product: 'cu', series: ['cu2609'] }, { product: 'al', series: [] }],
      activeIndex: 0,
    }
    useMarketFilterStore.getState().setOptionsTabs(next)
    expect(useMarketFilterStore.getState().optionsTabs).toEqual(next)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.optionsTabs).toEqual(next)
    // 不影响期货页
    expect(useMarketFilterStore.getState().futures).toEqual(EMPTY_FILTER)
  })

  it('load 从 localStorage 恢复 optionsTabs', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        futures: { exchanges: [], products: [] },
        options: { exchanges: [], products: [] },
        optionsTabs: { exchange: 'CZCE', tabs: [{ product: 'FG', series: ['FG609'] }], activeIndex: 0 },
      }),
    )
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().optionsTabs).toEqual({
      exchange: 'CZCE',
      tabs: [{ product: 'FG', series: ['FG609'] }],
      activeIndex: 0,
    })
  })

  it('load 缺失 optionsTabs 字段时补默认（旧数据兼容）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ futures: { exchanges: [], products: [] } }))
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().optionsTabs).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })

  it('load 遇损坏的 optionsTabs（形状非法）时回退默认，不抛错', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ optionsTabs: { exchange: 5, tabs: 'x', activeIndex: 'a' } }),
    )
    expect(() => useMarketFilterStore.getState().load()).not.toThrow()
    expect(useMarketFilterStore.getState().optionsTabs).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })

  it('load 遇损坏的 optionsTabs tab 项时整体回退默认', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ optionsTabs: { exchange: 'CZCE', tabs: [{ product: 7, series: 'x' }], activeIndex: 0 } }),
    )
    useMarketFilterStore.getState().load()
    expect(useMarketFilterStore.getState().optionsTabs).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })
})
