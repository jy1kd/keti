import { create } from 'zustand'
import { getInstrumentsByIds } from '@/services/api'
import { useUserPrefsStore } from './userPrefs'
import { useContractsStore } from './contracts'

export interface Collection {
  id: string
  name: string
  instrumentIDs: string[]
  seriesIDs?: string[]
}

let idCounter = 0
export function nextCollectionId(): string {
  idCounter += 1
  return `coll-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

/** 持久化元数据 → userPrefs + localStorage */
function persist(collections: Collection[]): void {
  useUserPrefsStore.getState().setCollections(collections)
  useUserPrefsStore.getState().saveToLocalStorage()
}

/** 所有收藏夹合约 ID 并集（行情页 ⭐ 填充态） */
export function unionFavoritedIds(collections: Collection[]): Set<string> {
  const set = new Set<string>()
  for (const c of collections) for (const id of c.instrumentIDs) set.add(id)
  return set
}

/** 所有收藏夹系列 ID 并集（期权系列 ⭐ 填充态） */
export function unionSerializedIds(collections: Collection[]): Set<string> {
  const set = new Set<string>()
  for (const c of collections) for (const id of (c.seriesIDs ?? [])) set.add(id)
  return set
}

/** 指定收藏夹内合约 ID 集合（夹页 ⭐ 填充态） */
export function collectionFavoritedIds(collections: Collection[], collectionId: string): Set<string> {
  return new Set(collections.find((c) => c.id === collectionId)?.instrumentIDs ?? [])
}

interface CollectionsStore {
  collections: Collection[]
  loaded: boolean
  loadCollections: () => Promise<void>
  createCollection: (name: string) => string | null
  renameCollection: (id: string, name: string) => boolean
  deleteCollection: (id: string) => void
  addToCollections: (instrumentIDs: string[], collectionIds: string[]) => void
  removeFromCollection: (instrumentID: string, collectionId: string) => void
  removeFromAllCollections: (instrumentIDs: string[]) => void
  addSeriesToCollections: (seriesIDs: string[], collectionIds: string[]) => void
  removeSeriesFromCollection: (seriesID: string, collectionId: string) => void
  removeSeriesFromAllCollections: (seriesIDs: string[]) => void
}

export const useCollectionsStore = create<CollectionsStore>((set, get) => ({
  collections: [],
  loaded: false,

  loadCollections: async () => {
    useUserPrefsStore.getState().loadFromLocalStorage()
    const collections = useUserPrefsStore.getState().collections
    if (collections.length === 0) {
      set({ collections: [], loaded: true })
      return
    }
    const allIds = Array.from(new Set(collections.flatMap((c) => c.instrumentIDs)))
    const hasAnySeries = collections.some((c) => (c.seriesIDs ?? []).length > 0)
    // 守卫：所有夹均为空时不调 API——后端 ids 为空会回退返回全市场合约（1000+）
    if (allIds.length === 0 && !hasAnySeries) {
      set({ collections, loaded: true })
      return
    }
    try {
      // 只在有 instrumentIDs 时调 API
      const result = allIds.length > 0 ? await getInstrumentsByIds(allIds) : { instruments: [] as any[] }
      const byId = new Set((result.instruments ?? []).map((c) => c.instrumentID))
      let changed = false
      const next = collections.map((c) => {
        const valid = c.instrumentIDs.filter((id) => {
          if (byId.has(id)) return true
          changed = true
          return false
        })
        // 校验 seriesIDs：contracts 已加载时，只保留有对应期权合约的 series
        const contracts = useContractsStore.getState().contracts
        let validSeries = c.seriesIDs ?? []
        if (contracts.length > 0) {
          const optByUnderlying = new Set<string>()
          for (const ct of contracts) {
            if ((ct.productClass === '2' || ct.productClass === '6') && ct.underlyingInstrID) {
              optByUnderlying.add(ct.underlyingInstrID)
            }
          }
          validSeries = validSeries.filter((s) => optByUnderlying.has(s))
        }
        if (validSeries.length !== (c.seriesIDs ?? []).length) changed = true
        return { ...c, instrumentIDs: valid, seriesIDs: validSeries }
      })
      if (changed) persist(next)
      set({ collections: next, loaded: true })
    } catch (err) {
      // 拉取失败时保留 userPrefs 中的元数据，避免后续任一 mutation 以空数组持久化覆盖真实数据
      console.error('[collections] Failed to load collection contracts:', err)
      set({ collections, loaded: true })
    }
  },

  createCollection: (name) => {
    if (get().collections.some((c) => c.name === name)) return null
    const id = nextCollectionId()
    const collections = [...get().collections, { id, name, instrumentIDs: [], seriesIDs: [] }]
    persist(collections)
    set({ collections })
    return id
  },

  renameCollection: (id, name) => {
    if (get().collections.some((c) => c.id !== id && c.name === name)) return false
    const collections = get().collections.map((c) => (c.id === id ? { ...c, name } : c))
    persist(collections)
    set({ collections })
    return true
  },

  deleteCollection: (id) => {
    const collections = get().collections.filter((c) => c.id !== id)
    persist(collections)
    set({ collections })
  },

  addToCollections: (instrumentIDs, collectionIds) => {
    const collections = get().collections.map((c) => {
      if (!collectionIds.includes(c.id)) return c
      const added = instrumentIDs.filter((id) => !c.instrumentIDs.includes(id))
      if (added.length === 0) return c
      return { ...c, instrumentIDs: [...c.instrumentIDs, ...added] }
    })
    persist(collections)
    set({ collections })
  },

  removeFromCollection: (instrumentID, collectionId) => {
    const collections = get().collections.map((c) =>
      c.id === collectionId ? { ...c, instrumentIDs: c.instrumentIDs.filter((id) => id !== instrumentID) } : c,
    )
    persist(collections)
    set({ collections })
  },

  removeFromAllCollections: (instrumentIDs) => {
    const ids = new Set(instrumentIDs)
    const collections = get().collections.map((c) => ({
      ...c,
      instrumentIDs: c.instrumentIDs.filter((id) => !ids.has(id)),
    }))
    persist(collections)
    set({ collections })
  },

  addSeriesToCollections: (seriesIDs, collectionIds) => {
    const collections = get().collections.map((c) => {
      if (!collectionIds.includes(c.id)) return c
      const added = seriesIDs.filter((id) => !(c.seriesIDs ?? []).includes(id))
      if (added.length === 0) return c
      return { ...c, seriesIDs: [...(c.seriesIDs ?? []), ...added] }
    })
    persist(collections)
    set({ collections })
  },

  removeSeriesFromCollection: (seriesID, collectionId) => {
    const collections = get().collections.map((c) =>
      c.id === collectionId ? { ...c, seriesIDs: (c.seriesIDs ?? []).filter((id) => id !== seriesID) } : c,
    )
    persist(collections)
    set({ collections })
  },

  removeSeriesFromAllCollections: (seriesIDs) => {
    const ids = new Set(seriesIDs)
    const collections = get().collections.map((c) => ({
      ...c,
      seriesIDs: (c.seriesIDs ?? []).filter((id) => !ids.has(id)),
    }))
    persist(collections)
    set({ collections })
  },
}))
