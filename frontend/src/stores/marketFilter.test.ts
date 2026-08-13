import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketFilterStore } from './marketFilter'
import { EMPTY_FILTER } from '@/modules/market/filter'

const STORAGE_KEY = 'simnow-market-filter'

describe('useMarketFilterStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useMarketFilterStore.setState({
      futures: { exchanges: [], products: [] },
      options: { exchanges: [], products: [] },
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
    expect(stored.futures).toEqual({ exchanges: ['SHFE'], products: [] })
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
    expect(futures).toEqual({ exchanges: ['SHFE'], products: ['cu'] })
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
})
