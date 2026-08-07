import { describe, it, expect } from 'vitest'
import { aggregateMyOrders, ACTIVE_ORDER_STATUSES, type RawOrderEntry } from './myOrders'

function order(overrides: Partial<RawOrderEntry>): RawOrderEntry {
  return {
    orderRef: 'ORD-001',
    instrumentID: 'IF2608',
    direction: '0', // 0=买
    combOffsetFlag: '0',
    limitPrice: 4696,
    volumeTotalOriginal: 5,
    volumeTraded: 0,
    orderStatus: '2', // 已报未成交排队
    insertTime: '09:30:01',
    ...overrides,
  }
}

describe('aggregateMyOrders（P3 盘口我方挂单聚合）', () => {
  it('仅聚合当前合约的未成交单', () => {
    const orders = [
      order({ orderRef: 'A', instrumentID: 'IF2608', limitPrice: 4696, direction: '0' }),
      order({ orderRef: 'B', instrumentID: 'IC2608', limitPrice: 5600, direction: '0' }),
    ]
    const agg = aggregateMyOrders(orders, 'IF2608')
    expect(agg.byPrice.get(4696)?.buyVolume).toBe(5)
    expect(agg.byPrice.get(5600)).toBeUndefined()
  })

  it('仅聚合活动状态（部分成交/已报排队/未成交），排除已撤与全部成交', () => {
    const orders = [
      order({ orderRef: 'A', orderStatus: '1', limitPrice: 4696 }), // partial
      order({ orderRef: 'B', orderStatus: '2', limitPrice: 4695 }), // queuing
      order({ orderRef: 'C', orderStatus: '3', limitPrice: 4694 }), // no traded
      order({ orderRef: 'D', orderStatus: '5', limitPrice: 4693 }), // canceled
      order({ orderRef: 'E', orderStatus: '0', limitPrice: 4692 }), // all traded
    ]
    const agg = aggregateMyOrders(orders, 'IF2608')
    expect(agg.byPrice.get(4696)?.buyVolume).toBe(5)
    expect(agg.byPrice.get(4695)?.buyVolume).toBe(5)
    expect(agg.byPrice.get(4694)?.buyVolume).toBe(5)
    expect(agg.byPrice.get(4693)).toBeUndefined()
    expect(agg.byPrice.get(4692)).toBeUndefined()
  })

  it('买/卖方向分别聚合：0=买入列，1=卖出列', () => {
    const orders = [
      order({ orderRef: 'A', direction: '0', limitPrice: 4694 }),
      order({ orderRef: 'B', direction: '1', limitPrice: 4696 }),
    ]
    const agg = aggregateMyOrders(orders, 'IF2608')
    expect(agg.byPrice.get(4694)?.buyVolume).toBe(5)
    expect(agg.byPrice.get(4694)?.sellVolume).toBe(0)
    expect(agg.byPrice.get(4696)?.sellVolume).toBe(5)
    expect(agg.byPrice.get(4696)?.buyVolume).toBe(0)
  })

  it('剩余量 = 原量 - 已成交量', () => {
    const orders = [
      order({ orderRef: 'A', volumeTotalOriginal: 10, volumeTraded: 4, limitPrice: 4696 }),
    ]
    const agg = aggregateMyOrders(orders, 'IF2608')
    expect(agg.byPrice.get(4696)?.buyVolume).toBe(6)
  })

  it('同档位多笔买单 → 量求和、笔数计数、orderRef 汇总', () => {
    const orders = [
      order({ orderRef: 'A', limitPrice: 4694, volumeTotalOriginal: 3 }),
      order({ orderRef: 'B', limitPrice: 4694, volumeTotalOriginal: 2 }),
    ]
    const agg = aggregateMyOrders(orders, 'IF2608')
    const lvl = agg.byPrice.get(4694)!
    expect(lvl.buyVolume).toBe(5)
    expect(lvl.buyCount).toBe(2)
    expect(lvl.buyRefs).toEqual(['A', 'B'])
  })

  it('全档汇总笔数（汇总行 (N) 用）', () => {
    const orders = [
      order({ orderRef: 'A', direction: '0', limitPrice: 4694 }),
      order({ orderRef: 'B', direction: '0', limitPrice: 4693 }),
      order({ orderRef: 'C', direction: '1', limitPrice: 4696 }),
    ]
    const agg = aggregateMyOrders(orders, 'IF2608')
    expect(agg.totalBuyCount).toBe(2)
    expect(agg.totalSellCount).toBe(1)
  })

  it('ACTIVE_ORDER_STATUSES 覆盖 1/2/3', () => {
    expect(ACTIVE_ORDER_STATUSES).toEqual(['1', '2', '3'])
  })
})
