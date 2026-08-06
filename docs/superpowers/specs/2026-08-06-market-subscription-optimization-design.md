# Design: 行情表格订阅优化

**日期**: 2026-08-06
**状态**: 已批准

---

## 1. 背景与目标

行情表格（`MarketTable`）按需订阅当前实现为「屏幕内合约订阅、屏幕外合约退订」。实测在拖动进度条快速滚动时，出现两类体验问题：

1. **拖动过程中请求量巨大**：可见区域每 ~100ms 变化一次，触发订阅/退订 diff，拖动 3 秒约产生 **30 个 HTTP 请求**（subscribe + unsubscribe 各半），且大量请求是「刚订阅就退订」的重复劳动。
2. **停下后要等很久才填满**：CTP `SubscribeMarketData` 为异步回包，重新订阅的合约要等下一个 tick 才推送数据；拖动期间被反复退订的合约滑回时全部要走慢路径。

此外，每次 WS tick 更新时 `MarketTable` 都**全量重建全部合约的 record 并 `setRecords` 全量替换**——6000 个合约每个 tick 全量重绘，浪费严重。

### 目标

- 消除订阅/退订抖动，拖动滑回时立即有数据
- 大幅降低拖动期间请求量
- 永不触顶后端 `MAX_SUBSCRIPTIONS = 500` 上限
- 减少每次 tick 的全量重建开销

### 已确认的决策

| 决策点 | 结论 |
|--------|------|
| 优化范围 | 仅前端，后端零改动 |
| 退订策略 | 延迟退订（30s 宽限期），不再立即退订 |
| 拖动策略 | 拖动中只增不减，停止后统一 diff |
| 上限保护 | `SOFT_LIMIT = 480 < 500`，LRU 淘汰最久未见的低优先级合约 |
| 更新方式 | `setRecords`（全量）→ `updateRecords`（局部） |
| 触发方式 | 用 `visibleInstrumentIDs` 短窗口内多次变化推断拖动态，不改 `MarketTable` 滚动接线 |

---

## 2. 架构总览

**核心思想：把「立即退订」改为「订阅保持」，把「全量重建」改为「局部更新」。**

```
当前：
可见区变化 → 100ms防抖 → 立即 diff → subscribe + unsubscribe（立即退订）
tick 更新  → contracts.map 全量重建 → setRecords 全量替换

改造后：
可见区变化 → 200ms防抖 → 更新"应该订阅"集合
           ├─ subscribe（立即，100ms 防抖）
           └─ unsubscribe（延迟 30s 宽限期，500ms 防抖，拖动中暂停）
           └─ 订阅数 > SOFT_LIMIT(480) → LRU 淘汰最久未见
tick 更新  → 只 rebuild 变化的合约 → updateRecords 局部重绘
```

- **订阅管理**集中在 `useSubscriptionManager.ts` 一个 Hook，用 `Map<instrumentID, lastVisibleTime>` 替代 `Set<string>`。
- **局部更新**在 `MarketTable.tsx` + `useMarketWs.ts` + `store.ts` 三处配合。
- 五个机制（下表）彼此独立、可叠加。

| # | 机制 | 文件 | 解决 |
|---|------|------|------|
| 1 | 延迟退订（30s 宽限期） | useSubscriptionManager | 订阅抖动 |
| 2 | 分层防抖（sub 100ms / unsub 500ms） | useSubscriptionManager | 请求量 |
| 3 | 拖动中只增不减 | useSubscriptionManager | 请求风暴 |
| 4 | LRU 上限保护（SOFT_LIMIT=480） | useSubscriptionManager | 500 上限 |
| 5 | 局部更新（updateRecords） | MarketTable + useMarketWs + store | 全量重建开销 |

---

## 3. `useSubscriptionManager` 改造

### 3.1 数据结构：Set → Map

```ts
/** instrumentID → 最近一次可见时间戳（ms） */
const subscribedRef = useRef<Map<string, number>>(new Map())
```

- 订阅一个合约时：`subscribedRef.current.set(id, now)`。
- 每次可见区变化时：对可见合约刷新 `lastVisibleTime`。

### 3.2 延迟退订（机制 1）

退订判定从「不在应该订阅集合」改为「**不在集合 且 超过宽限期未可见**」：

```ts
const GRACE_MS = 30_000  // 宽限期

// 需要退订 = 已订阅 - 应该订阅，且 lastVisibleTime 距今 > GRACE_MS
for (const [id, lastVisible] of subscribedRef.current) {
  if (!shouldSubscribe.has(id) && Date.now() - lastVisible > GRACE_MS) {
    toUnsubscribe.push(id)
  }
}
```

- 宽限期内滑回 → 不触发退订，`lastVisibleTime` 刷新。
- 效果：拖动滑过的合约保留订阅，滑回立即有数据，无需重新走 CTP 异步回包。

### 3.3 分层防抖（机制 2）

subscribe 与 unsubscribe 使用不同的防抖窗口：

| 操作 | 防抖窗口 | 原因 |
|------|----------|------|
| subscribe | 100ms | 滑入的合约要尽快有数据 |
| unsubscribe | 500ms + 30s 宽限期 | 退订不急，避免抖动 |

实现：拆成两个独立定时器，subscribe 与 unsubscribe 各自防抖合并。

### 3.4 拖动中只增不减（机制 3）

用「短窗口内多次可见区变化」推断拖动态：

```ts
const DRAG_WINDOW_MS = 300   // 窗口
const DRAG_THRESHOLD = 2     // 窗口内变化次数

// 记录 recentChanges: number[]（时间戳数组）
// 每次 visibleInstrumentIDs 变化时 push(Date.now())，剔除窗口外的旧记录
// 若窗口内变化次数 ≥ 阈值 → 视为拖动中
const isDragging = recentChanges.filter(t => now - t < DRAG_WINDOW_MS).length >= DRAG_THRESHOLD
```

- **拖动中**：只执行 subscribe，**完全不发 unsubscribe**（含 LRU 淘汰）。
- **停止后**（无变化 500ms）：执行一次完整 diff——subscribe + unsubscribe + LRU 淘汰。

### 3.5 LRU 上限保护（机制 4）

三层优先级，决定谁被保留、谁被淘汰：

| 层级 | 合约 | 退订策略 |
|------|------|----------|
| 高 | 锁定合约（lockedContracts） | 永不退订，不参与淘汰 |
| 高 | 自选合约（favorites） | 永不退订 |
| 中 | 当前可见 + 预加载区 | 保持订阅 |
| 低 | 滑出但仍在宽限期内的合约 | 延迟退订，LRU 候选 |

```ts
const SOFT_LIMIT = 480  // < 后端 500，留 20 余量

// 完整 diff 时：
// 1. 先按宽限期退订
// 2. 若 subscribedRef.size + 新增订阅 > SOFT_LIMIT：
//    → 按 lastVisibleTime 从旧到新，批量淘汰低优先级合约（跳过自选/锁定）
//    → 直到腾出空间（保底 ≤ 480）
// 3. 最终才 unsubscribeMarket(淘汰清单) + subscribeMarket(新增清单)
```

- 淘汰的是**最久没见过的**低优先级合约——拖回时重新订阅的代价最小。
- 拖动中不淘汰（订阅数暂时超限也无妨，停止后收敛）。

---

## 4. `MarketTable` 局部更新（机制 5）

### 4.1 现状问题

`MarketTable.tsx:437-448`：

```ts
useEffect(() => {
  const records = contracts.map((c) => buildRecord(c, snapshots.get(...)))  // 全量重建 6000 条
  recordsRef.current = records
  tableRef.current.setRecords(records)  // 全量替换
}, [contracts, snapshots, ...])
```

每次 `snapshots` 变化（每个 WS 批量）→ 全量重建所有 record → `setRecords` 全量重绘。

### 4.2 改造：updateRecords 局部更新

vtable 提供 `updateRecords(records, recordIndexs, triggerEvent?)`，只更新指定行。

**数据流：**

```
useMarketWs batchUpdate(snaps) → 已知本次变化的 instrumentID
  → store 记录本次变化集
  → MarketTable 新 prop: updatedInstrumentIDs
  → 只 rebuild 变化的合约，映射到行号
  → updateRecords(updatedRecords, updatedRowIndexes)
```

**`useMarketWs.ts`**：`batchUpdate(snaps)` 后，把本次变化的 instrumentID 集合传给 MarketTable（经 store 中转）。

**`store.ts`**：`batchUpdate` 返回/记录本次更新的 instrumentID 列表（或新增独立 action `getUpdatedSince()`）。

**`MarketTable.tsx`**：

```ts
// 高频 tick 更新：只 rebuild 变化行
useEffect(() => {
  if (!tableRef.current) return
  if (!updatedInstrumentIDs?.length) return
  const updatedRecords: any[] = []
  const updatedRowIndexes: number[] = []
  for (const id of updatedInstrumentIDs) {
    const rowIndex = contracts.findIndex((c) => c.instrumentID === id)  // 0-based 数据行
    if (rowIndex < 0) continue
    updatedRecords.push(recordsRef.current[rowIndex])  // 已由下方 effect 预构建
    updatedRowIndexes.push(rowIndex + 1)               // vtable 行号（0=表头）
  }
  tableRef.current.updateRecords(updatedRecords, updatedRowIndexes)
}, [updatedInstrumentIDs])
```

**兼容性（已核对）：**
- **行索引映射不受影响**：所有交互（单击/双击/右键/Shift 范围选择/收藏列）用 `recordsRef.current[i]` 按 contracts 顺序取行，`updateRecords` 按行号更新不改变此映射。
- **选中高亮保留全量 `setRecords`**：`selectedContracts` 变化靠 `bodyStyle.bgColor` 全量重绘（低频用户交互，成本可接受）。tick 更新走 `updateRecords` 局部。
- **contracts 变化（合约列表刷新）仍走全量 `setRecords`**：合约增删是低频事件。

### 4.3 性能收益

| 场景 | 现状 | 改造后 |
|------|------|--------|
| WS tick（几十条更新） | 6000 条全量重建 + 全量重绘 | 几十条重建 + 局部重绘 |
| 合约列表刷新（低频） | 全量 | 全量（不变） |
| 选中变化（低频） | 全量 | 全量（不变） |

---

## 5. 数据流

```
订阅流（拖动）：
scroll → MarketTable.notifyVisibleRange(100ms 防抖) → setVisibleInstrumentIDs
  → useSubscriptionManager(200ms 防抖)
    ├─ subscribe（100ms 防抖，拖动中也执行）
    └─ unsubscribe（500ms 防抖 + 30s 宽限期，拖动中暂停）
    └─ 停止后完整 diff：subscribe + unsubscribe + LRU 淘汰(≤480)

行情流（tick）：
WS market_data → useMarketWs 缓冲 → batchUpdate(snaps) → store 更新 snapshots + 记录变化集
  → MarketTable：只 rebuild 变化行 → updateRecords(局部重绘)
```

---

## 6. 错误处理

- **subscribe / unsubscribe 失败**：沿用现有逻辑（try/catch + console.error），本地状态保持一致（订阅失败仍记录为已订阅，等待下一次 diff 重试）。
- **LRU 淘汰遇到后端超限**：SOFT_LIMIT=480 永远 < 500，预留 20 余量；即便极端情况下 CTP 返回失败，本地已移除，下次 diff 可恢复。
- **updateRecords 行号越界**：`rowIndex < 0` 跳过；vtable 未就绪时 `try/catch` 包裹（沿用现有 `notifyVisibleRange` 模式）。

---

## 7. 测试方案

新增/修改测试文件：

**`frontend/src/hooks/useSubscriptionManager.test.ts`（新建）**

1. **延迟退订**：合约滑出可见区 30s 内不退订（`vi.useFakeTimers()` 推进 10s，断言无 unsubscribe 调用）；超 30s 未可见 → 触发退订；宽限期内滑回 → 退订取消、时间刷新。
2. **拖动中只增不减**：连续多次 `setVisibleInstrumentIDs` → 期间只发 subscribe 不发 unsubscribe；停止后发一次合并退订。
3. **LRU 上限**：注入 480+ 合约 → 订阅数永不超 480；淘汰顺序为最久未见；自选/锁定合约永不淘汰；边界（恰好 SOFT_LIMIT 时新增）只淘汰最旧一个。
4. **分层防抖**：subscribe 用 100ms 窗口、unsubscribe 用 500ms 窗口，断言两种防抖独立。

**`frontend/src/modules/market/MarketTable.test.tsx`（修改）**

5. **updateRecords 局部更新**：mock vtable 的 `updateRecords`/`setRecords`，断言 tick 更新只调 `updateRecords`（不调 `setRecords`）；选中变化仍调 `setRecords`。
6. **行索引映射保持**：局部更新后单击/右键/收藏仍能取到正确行。

**mock 方式：** `vi.mock('@/services/api')` 记录 `subscribeMarket`/`unsubscribeMarket` 调用；`vi.useFakeTimers()` 控制时间推进；`setupTests.ts` 已有 `setRecords: vi.fn()`，需补充 `updateRecords: vi.fn()`。

---

## 8. 非目标

- 后端订阅/退订接口改造（合并去抖、批量优化）——本轮不动后端
- 快照缓存回填（subscribe 后立即 `getSnapshots`）——用户未选择
- K 线、期权链等其他表格的局部更新改造
- 虚拟滚动按需订阅之外的渲染优化
