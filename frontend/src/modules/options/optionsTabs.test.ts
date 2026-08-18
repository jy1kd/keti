import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import {
  EMPTY_OPTIONS_TABS,
  addOptionsTab,
  removeOptionsTab,
  setActiveOptionsTab,
  setOptionsTabSeries,
  clearOptionsTabs,
  filterByOptionsTabs,
} from './optionsTabs'

function makeContract(instrumentID: string, underlyingInstrID: string, exchangeID = 'CZCE'): ContractInfo {
  return { instrumentID, underlyingInstrID, exchangeID } as ContractInfo
}

const getProduct = (c: ContractInfo) => (c.underlyingInstrID ?? '').replace(/\d+$/, '')

describe('optionsTabs 状态转换（纯函数）', () => {
  it('初始为空：无交易所、无 tab', () => {
    expect(EMPTY_OPTIONS_TABS).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })

  it('addOptionsTab 追加 tab 并激活新 tab（末尾）', () => {
    const s1 = addOptionsTab(EMPTY_OPTIONS_TABS, 'FG')
    const s2 = addOptionsTab(s1, 'MA')
    expect(s2.tabs.map((t) => t.product)).toEqual(['FG', 'MA'])
    expect(s2.activeIndex).toBe(1)
    expect(s2.tabs[0].series).toEqual([])
  })

  it('addOptionsTab 重复品种不重复添加，仅激活已存在的 tab', () => {
    const s1 = addOptionsTab(EMPTY_OPTIONS_TABS, 'FG')
    const s2 = addOptionsTab(s1, 'MA')
    const s3 = addOptionsTab(s2, 'FG')
    expect(s3.tabs.map((t) => t.product)).toEqual(['FG', 'MA'])
    expect(s3.activeIndex).toBe(0)
  })

  it('setActiveOptionsTab 切换激活 tab；越界不变化', () => {
    const s1 = addOptionsTab(addOptionsTab(EMPTY_OPTIONS_TABS, 'FG'), 'MA')
    const s2 = setActiveOptionsTab(s1, 0)
    expect(s2.activeIndex).toBe(0)
    expect(setActiveOptionsTab(s2, 99)).toEqual(s2)
    expect(setActiveOptionsTab(s2, -1)).toEqual(s2)
  })

  it('setOptionsTabSeries 只更新指定 tab 的系列，不动其它 tab', () => {
    const s1 = addOptionsTab(addOptionsTab(EMPTY_OPTIONS_TABS, 'FG'), 'MA')
    const s2 = setOptionsTabSeries(s1, 0, ['FG609', 'FG610'])
    expect(s2.tabs[0].series).toEqual(['FG609', 'FG610'])
    expect(s2.tabs[1].series).toEqual([])
    expect(s2.activeIndex).toBe(s1.activeIndex)
  })

  it('removeOptionsTab：移除激活 tab 回落到前一个；越界不变更', () => {
    const s1 = addOptionsTab(addOptionsTab(addOptionsTab(EMPTY_OPTIONS_TABS, 'FG'), 'MA'), 'cu')
    const s2 = setActiveOptionsTab(s1, 2)
    const s3 = removeOptionsTab(s2, 2) // 移除激活(cu) → 回落 MA(idx1)
    expect(s3.tabs.map((t) => t.product)).toEqual(['FG', 'MA'])
    expect(s3.activeIndex).toBe(1)
    expect(removeOptionsTab(s1, 99)).toEqual(s1)
  })

  it('removeOptionsTab：移除非激活且在前面的 tab，激活索引左移（保持指向原 tab）', () => {
    const s1 = addOptionsTab(addOptionsTab(EMPTY_OPTIONS_TABS, 'FG'), 'MA')
    const s2 = setActiveOptionsTab(s1, 1) // 激活 MA
    const s3 = removeOptionsTab(s2, 0) // 移除 FG
    expect(s3.tabs.map((t) => t.product)).toEqual(['MA'])
    expect(s3.activeIndex).toBe(0) // 仍指向 MA
  })

  it('removeOptionsTab：清空最后一个 tab 后 activeIndex=0，exchange 保留', () => {
    const s1 = addOptionsTab(EMPTY_OPTIONS_TABS, 'FG')
    expect(removeOptionsTab(s1, 0)).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })

  it('clearOptionsTabs 清空交易所与会话 tab', () => {
    const s1 = addOptionsTab(EMPTY_OPTIONS_TABS, 'FG')
    expect(clearOptionsTabs(s1)).toEqual({ exchange: '', tabs: [], activeIndex: 0 })
  })
})

describe('filterByOptionsTabs（期权页数据管道）', () => {
  const contracts = [
    makeContract('FG609-C-1300', 'FG609'),
    makeContract('FG610-P-1300', 'FG610'),
    makeContract('MA609-C-1000', 'MA609'),
    makeContract('cu2609-C-70000', 'cu2609', 'SHFE'),
  ]

  it('无 tab → 返回全量（不过滤）', () => {
    expect(filterByOptionsTabs(contracts, EMPTY_OPTIONS_TABS, getProduct)).toEqual(contracts)
  })

  it('有激活 tab 且 series 为空 → 只保留该品种全部系列', () => {
    const s = addOptionsTab(EMPTY_OPTIONS_TABS, 'FG')
    const result = filterByOptionsTabs(contracts, s, getProduct)
    expect(result.map((c) => c.instrumentID)).toEqual(['FG609-C-1300', 'FG610-P-1300'])
  })

  it('激活 tab 选了 series → 只保留选中系列', () => {
    let s = addOptionsTab(EMPTY_OPTIONS_TABS, 'FG')
    s = setOptionsTabSeries(s, 0, ['FG609'])
    const result = filterByOptionsTabs(contracts, s, getProduct)
    expect(result.map((c) => c.instrumentID)).toEqual(['FG609-C-1300'])
  })

  it('多个 tab 时只取激活 tab（activeIndex 指向谁过滤谁）', () => {
    let s = addOptionsTab(addOptionsTab(EMPTY_OPTIONS_TABS, 'FG'), 'cu')
    s = setActiveOptionsTab(s, 1)
    const result = filterByOptionsTabs(contracts, s, getProduct)
    expect(result.map((c) => c.instrumentID)).toEqual(['cu2609-C-70000'])
  })

  it('activeIndex 越界（如删除后的 stale 值）时按最后一个 tab 兜底', () => {
    const s = { exchange: 'CZCE', tabs: [{ product: 'FG', series: [] }], activeIndex: 5 }
    const result = filterByOptionsTabs(contracts, s, getProduct)
    expect(result.map((c) => c.instrumentID)).toEqual(['FG609-C-1300', 'FG610-P-1300'])
  })
})