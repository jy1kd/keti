### Task 8: Frontend — 市场 Store 清理

**Files:**
- Modify: `frontend/src/modules/market/store.ts`

**Interfaces:**
- Removes: `fetchInstruments`, `refreshInstruments`, `isRefreshing` (不再需要)

- [ ] **Step 1: Remove unused methods from market store**

从 `frontend/src/modules/market/store.ts` 中移除 `fetchInstruments`、`refreshInstruments`、`isRefreshing` 以及相关的 `refreshInstruments` import。保留 `subscribeInstruments`（仍然用于批量订阅）。

```typescript
import { create } from 'zustand'
import type { MarketSnapshot, KLineData } from '@/services/types'
import { subscribeMarket } from '@/services/api'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
  subscribeInstruments: (instruments: string[]) => Promise<void>
  klineData: Map<string, KLineData[]>
  setKlineData: (instrument: string, data: KLineData[]) => void
  appendKline: (instrument: string, candle: KLineData) => void
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: null,
  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
  snapshots: new Map(),
  updateSnapshot: (snapshot) =>
    set((state) => {
      const next = new Map(state.snapshots)
      next.set(snapshot.instrumentID, snapshot)
      return { snapshots: next }
    }),
  batchUpdate: (updates) =>
    set((state) => {
      const next = new Map(state.snapshots)
      for (const snap of updates) {
        next.set(snap.instrumentID, snap)
      }
      return { snapshots: next }
    }),
  subscribeInstruments: async (instruments: string[]) => {
    try {
      await subscribeMarket(instruments)
    } catch (error) {
      console.warn('[MarketStore] subscribeInstruments failed:', error)
    }
  },
  klineData: new Map(),
  setKlineData: (instrument, data) =>
    set((state) => {
      const next = new Map(state.klineData)
      const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
      next.set(instrument, sorted)
      return { klineData: next }
    }),
  appendKline: (instrument, candle) =>
    set((state) => {
      const next = new Map(state.klineData)
      const existing = next.get(instrument)
      if (!existing || existing.length === 0) {
        next.set(instrument, [candle])
        return { klineData: next }
      }
      // ... (保留现有的 appendKline 逻辑)
      const last = existing[existing.length - 1]
      let updated: typeof existing
      if (candle.timestamp === last.timestamp) {
        updated = [...existing.slice(0, -1), candle]
      } else if (candle.timestamp > last.timestamp) {
        updated = [...existing, candle]
        if (updated.length > 200) updated = updated.slice(-200)
      } else {
        return state
      }
      next.set(instrument, updated)
      return { klineData: next }
    }),
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all frontend checks**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/market/store.ts
git commit -m "refactor(task-15): market store 清理 — 移除 fetchInstruments/refreshInstruments"
```

---

## 后续验证步骤

1. **后端测试**: `cd server && python -m pytest tests/ -v` — 全部通过
2. **前端构建**: `cd frontend && npm run build` — 无错误
3. **功能验证**:
   - 启动后端 + 前端
   - 检查行情表格是否展示预设合约
   - 点击"搜索合约"→ 选择交易所 → 选择品种 → 查看合约列表
   - 点击"订阅"→ 合约出现在行情表格中
   - 选中合约 → 点击"退订"→ 合约从表格中移除
   - 刷新页面 → 验证订阅列表持久化
