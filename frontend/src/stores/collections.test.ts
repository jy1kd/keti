import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCollectionsStore, unionFavoritedIds, collectionFavoritedIds } from './collections'
import { useUserPrefsStore } from './userPrefs'

vi.mock('@/services/api', () => ({
  getInstrumentsByIds: vi.fn(),
  getInstruments: vi.fn(),
  subscribeMarket: vi.fn(),
  unsubscribeMarket: vi.fn(),
}))

const mockContract = {
  instrumentID: 'au2406',
  instrumentName: '黄金2406',
  exchangeID: 'SHFE',
  productID: 'au',
  volumeMultiple: 1000,
  priceTick: 0.02,
  expireDate: '2024-06-15',
  isTrading: 1,
  productClass: '1',
}

describe('useCollectionsStore', () => {
  beforeEach(() => {
    useCollectionsStore.setState({ collections: [], loaded: false })
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { buy: 'b', sell: 's', cancel: 'c', reverse: '', lock: '', batchCancel: 'Escape', openOrder: '', openKline: '', openSettings: '' },
      quickTradeConfig: { lock: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, reverse: { close: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, open: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, executionMode: 'serial' }, confirmBeforeExecute: true },
    })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('createCollection 创建收藏夹并持久化，返回 id', () => {
    const id = useCollectionsStore.getState().createCollection('农产品')
    expect(useCollectionsStore.getState().collections).toEqual([{ id, name: '农产品', instrumentIDs: [] }])
    const stored = JSON.parse(localStorage.getItem('simnow-user-prefs') || '{}')
    expect(stored.collections).toEqual([{ id, name: '农产品', instrumentIDs: [] }])
  })

  it('addToCollections 去重追加；removeFromCollection 移除单个；removeFromAllCollections 全夹移除', () => {
    const store = useCollectionsStore.getState()
    const a = store.createCollection('A')
    const b = store.createCollection('B')
    store.addToCollections(['au2406', 'rb2406'], [a, b])
    store.addToCollections(['au2406'], [a]) // 重复
    expect(useCollectionsStore.getState().collections.find((c) => c.id === a)?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    store.removeFromCollection('au2406', a)
    expect(useCollectionsStore.getState().collections.find((c) => c.id === a)?.instrumentIDs).toEqual(['rb2406'])
    expect(useCollectionsStore.getState().collections.find((c) => c.id === b)?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    store.removeFromAllCollections(['au2406'])
    expect(useCollectionsStore.getState().collections.find((c) => c.id === b)?.instrumentIDs).toEqual(['rb2406'])
  })

  it('renameCollection / deleteCollection', () => {
    const store = useCollectionsStore.getState()
    const id = store.createCollection('旧名')
    store.renameCollection(id, '新名')
    expect(useCollectionsStore.getState().collections[0].name).toBe('新名')
    store.deleteCollection(id)
    expect(useCollectionsStore.getState().collections).toEqual([])
  })

  it('loadCollections：无收藏夹时置空并 loaded', async () => {
    await useCollectionsStore.getState().loadCollections()
    expect(useCollectionsStore.getState().loaded).toBe(true)
    expect(useCollectionsStore.getState().collections).toEqual([])
  })

  it('loadCollections：union 一次拉取解析，无效 ID 清理并回写', async () => {
    const { getInstrumentsByIds } = await import('@/services/api')
    // 经 userPrefs 播种（loadCollections 从 userPrefs 读取，直接 set collections store 会被覆盖）
    useUserPrefsStore.getState().setCollections([{ id: 'a', name: 'A', instrumentIDs: ['au2406', 'delisted1'] }])
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract], count: 1 })
    await useCollectionsStore.getState().loadCollections()
    const coll = useCollectionsStore.getState().collections[0]
    expect(coll.instrumentIDs).toEqual(['au2406']) // delisted1 被清理
    expect(getInstrumentsByIds).toHaveBeenCalledWith(['au2406', 'delisted1'])
    const stored = JSON.parse(localStorage.getItem('simnow-user-prefs') || '{}')
    expect(stored.collections[0].instrumentIDs).toEqual(['au2406'])
    expect(useCollectionsStore.getState().loaded).toBe(true)
  })

  it('纯派生函数', () => {
    const cols = [
      { id: 'a', name: 'A', instrumentIDs: ['au2406', 'rb2406'] },
      { id: 'b', name: 'B', instrumentIDs: ['rb2406'] },
    ]
    expect(Array.from(unionFavoritedIds(cols)).sort()).toEqual(['au2406', 'rb2406'])
    expect(Array.from(collectionFavoritedIds(cols, 'a')).sort()).toEqual(['au2406', 'rb2406'])
    expect(collectionFavoritedIds(cols, 'zz').size).toBe(0)
  })
})
