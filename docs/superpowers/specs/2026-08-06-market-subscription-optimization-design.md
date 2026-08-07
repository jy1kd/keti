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
| 优化范围 | 仅前端，后端零改动（快照回填复用后端已有 `_snapshots` 缓存） |
| 退订策略 | 延迟退订（30s 宽限期），不再立即退订 |
| 拖动策略 | 拖动中零 HTTP（既不订阅也不退订），停止后统一 diff 订阅最终可见区 |
| 上限保护 | `SOFT_LIMIT = 480 < 500`，LRU 淘汰最久未见；新批次超限时退订先行（await）再订阅 |
| 更新方式 | `setRecords`（全量）→ `updateRecords`（局部） |
| 触发方式 | 用 `visibleInstrumentIDs` 短窗口内多次变化推断拖动态，不改 `MarketTable` 滚动接线 |
| **快照回填** | **订阅成功后立即 `getSnapshots(订阅列表)`，用后端缓存快照先填表，实时 tick 再覆盖（方案 A）** |

---

## 2. 架构总览

**核心思想：把「立即退订」改为「订阅保持」，把「全量重建」改为「局部更新」。**

```
当前：
可见区变化 → 100ms防抖 → 立即 diff → subscribe + unsubscribe（立即退订）
tick 更新  → contracts.map 全量重建 → setRecords 全量替换

改造后：
可见区变化 → 拖动检测（300ms 窗口 ≥2 次变化）
           ├─ 拖动中：零 HTTP（既不订阅也不退订），只记录变化时间戳
           └─ 停止后 / 非拖动变化 → 完整 diff：
                ├─ subscribe（成功 → getSnapshots 回填缓存快照，立即有数据）
                ├─ unsubscribe（30s 宽限期 + LRU 淘汰最久未见）
                └─ 新批次超 SOFT_LIMIT → 退订先行（await 后端确认）→ 再订阅
tick 更新  → 只 rebuild 变化的合约 → updateRecords 局部重绘
```

- **订阅管理**集中在 `useSubscriptionManager.ts` 一个 Hook，用 `Map<instrumentID, lastVisibleTime>` 替代 `Set<string>`。
- **局部更新**在 `MarketTable.tsx` + `useMarketWs.ts` + `store.ts` 三处配合。
- **快照回填**在 `useSubscriptionManager.ts` 内、subscribe 成功后触发，复用后端 `getSnapshots` 接口 + 后端 `_snapshots` 缓存，后端零改动。
- 七个机制（下表）彼此独立、可叠加。

| # | 机制 | 文件 | 解决 |
|---|------|------|------|
| 1 | 延迟退订（30s 宽限期） | useSubscriptionManager | 订阅抖动 |
| 2 | 停止后统一完整 diff（无拖动中防抖） | useSubscriptionManager | 请求量 |
| 3 | 拖动中零 HTTP（不订不退） | useSubscriptionManager | 请求风暴 |
| 4 | LRU 上限保护（SOFT_LIMIT=480）+ 退订先行串行化兜底 | useSubscriptionManager | 500 上限 |
| 5 | 局部更新（updateRecords） | MarketTable + useMarketWs + store | 全量重建开销 |
| 6 | 快照回填（subscribe 后 getSnapshots） | useSubscriptionManager | 停止后填满慢 |
| 7 | 滚动松手立即完整 diff（mouseup 信号） | MarketTable + store + useSubscriptionManager | 拖停止检测 500ms 等待 |

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

### 3.3 停止后统一完整 diff（机制 2）

不再有「拖动中的分层防抖」。订阅只发生在**完整 diff** 时——非拖动变化立即执行，拖动停止后 500ms 执行一次。拖动中零 HTTP（见机制 3）。退订由完整 diff 的宽限期判定统一处理（见机制 1、4）。

### 3.4 拖动中零 HTTP（机制 3）

用「短窗口内多次可见区变化」推断拖动态：

```ts
const DRAG_WINDOW_MS = 300   // 窗口
const DRAG_THRESHOLD = 2     // 窗口内变化次数

// 记录 recentChanges: number[]（时间戳数组）
// 每次 visibleInstrumentIDs 变化时 push(Date.now())，剔除窗口外的旧记录
// 若窗口内变化次数 ≥ 阈值 → 视为拖动中
const isDragging = recentChanges.filter(t => now - t < DRAG_WINDOW_MS).length >= DRAG_THRESHOLD
```

- **拖动中**：零 HTTP——既不 subscribe 也不 unsubscribe，只记录变化时间戳。理由：拖动过程中用户不关注被快速略过的合约内容，订阅它们纯属浪费（请求风暴 + LRU 无谓膨胀）。
- **停止后**（无变化 500ms）：执行一次完整 diff——subscribe 当前可见区 + 宽限期退订 + LRU 淘汰。
- **效果**：LRU 不随拖动膨胀（subscribedRef 停在拖动前水平），拖到底部只是新增一个底部窗口，后端名额充足——「拖动到底不刷新」的竞态（订阅到达时后端仍满被原子整批拒绝）直接消失。
- **挂载不计入拖动**：首次挂载的 effect 运行不是用户的可见区变化，不写入 `recentChanges`（`didMountRef` 守卫），避免首个可见窗口被误判为拖动态而把首次订阅推迟 500ms。
- **代价（已认可）**：拖动过程中可见区显示 `--`/旧缓存；快速方向键/滚轮滚动也会被判为「拖动」而抑制订阅（如需区分可用可见区跳变距离，后续可按需加）。

### 3.5 LRU 上限保护 + 退订先行串行化兜底（机制 4）

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
// 3. 若需要腾名额 → 退订先行：await unsubscribeMarket(淘汰清单) 确认后端已删除，
//    再 subscribeMarket(新增清单)；否则两者并行发出
```

- 淘汰的是**最久没见过的**低优先级合约——拖回时重新订阅的代价最小。
- **退订先行（串行化兜底）**：后端 `subscribe()` 的 500 上限检查是「请求到达时刻」的原子快照，若订阅到达时后端集合仍满会被**整批拒绝**（`success:false`），可见合约卡旧数据直到重试。因此当 `subscribedRef.size + 新增订阅 > SOFT_LIMIT` 时，先 await 退订（后端确认已释放名额）再订阅，保证订阅到达时集合已腾空。平时无需腾名额，订阅与退订并行（不加延迟）。
- 拖动中零 HTTP（机制 3），淘汰只发生在停止后的完整 diff。

### 3.6 滚动松手立即完整 diff（机制 7）

**问题：** 机制 3 的拖动态推断用「300ms 窗口 ≥2 次变化」判定拖动，停止后须等 **500ms** 才触发完整 diff。对滚动条拖拽（大范围移动的主要方式），释放滚动条的瞬间即已确定「已停止」，500ms 是纯等待。

**方案：** 用 DOM 层「释放」信号替代 500ms 推断，松手即触发完整 diff：

```
滚动条释放（window mouseup 距上次 scroll < 200ms）
  → MarketTable：取消 100ms 防抖 → 立即 notifyVisibleRange()（最终可见区）
  → store.markScrollEnd()（scrollEndSeq 单调递增）
  → useSubscriptionManager effect 消费信号
    → 清 recentChangesRef（后续变化不再被误判为拖动态）
    → 清 fullDiffTimerRef（取消待定 500ms 定时器，避免重复 diff）
    → 立即 runFullDiff()
```

**三个改动点：**

1. **store**：新增 `scrollEndSeq: number`（初始 0）+ action `markScrollEnd()`（递增）。用**单调递增计数器**而非布尔/置 null：置 null 会触发第二次 effect 运行（null→值→null 两次依赖变化），造成重复 diff；计数器只增不reset，消费靠 `lastHandledScrollEndRef` 判重。
2. **MarketTable**：scroll 处理器记录 `lastScrollAtRef = Date.now()`；新增 `window mouseup` 监听——`Date.now() - lastScrollAt < SCROLL_RELEASE_WINDOW_MS(200)` 才视为滚动条释放（避免普通点击误触发）→ 取消待发 100ms 防抖 → 最终 `notifyVisibleRange()`（同步写 store）→ `useMarketStore.getState().markScrollEnd()`。
3. **useSubscriptionManager**：effect 顶部消费信号——`scrollEndSeq > lastHandledScrollEndRef.current` 时：置 `lastHandledScrollEndRef.current = scrollEndSeq`、清 `recentChangesRef`、清 `fullDiffTimerRef`、立即 `runFullDiff()` 并 return（跳过 isDragging 分支）。`scrollEndSeq` 加入 effect 依赖数组。

**为何不用 VTable 原生事件：** VTable 无「滚动停止」事件——`SCROLL_VERTICAL_END` 仅在滚动到底（`scrollTop + viewHeight >= totalHeight`）时触发，不是松手信号，不可用。

**覆盖与限制：**
- ✅ 滚动条拖拽释放（用户主要痛点）——松手即 diff，数据出现从「~600ms + 订阅往返」缩短到「0ms + 订阅往返」，砍掉 ~500ms 大头
- ✅ 滚动条轨道点击跳转（mousedown→scroll→mouseup）
- ⚠️ 滚轮/方向键滚动无 mouseup，仍走 500ms 推断窗口（本轮不改；如需可后续加 scroll idle 计时器）
- 拖动中（鼠标按住未松）不触发 mouseup，机制 3 零 HTTP 保持
- 误触发（滚轮停止后 <200ms 内点击）仅一次立即 diff，多为空操作（订阅已满足），无害

**与既有机制衔接：** flush 只是把 `runFullDiff` 提前调用，串行化兜底、宽限期、LRU、快照回填全部保留。非拖动态变化本就走立即 diff，flush 对之为空操作。**flush 的关键收益之一**：取消待定 500ms 定时器，避免「提前 diff + 定时器再 diff」的双重订阅（同批次 subscribe 未入 `subscribedRef` 时二次 diff 会重复发订阅）。

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

## 4.5 快照回填（机制 6，方案 A）

**问题：** 订阅停止后要等 CTP 异步回包才有数据，期间表格显示 `--`。17488 条合约场景下，从顶拖到底停住后，可见区合约全部要等 tick 才填满。

**方案：** subscribe 成功后立即 `getSnapshots(订阅列表)`，用后端 `_snapshots` 缓存里已有的最后快照先填表，实时 tick 再覆盖。

**关键事实（已核实）：** 后端 `market_service` 的 `_snapshots` 缓存持续存在——每次 CTP `OnRtnDepthMarketData` 回调都 `update_snapshot` 写缓存，**订阅/退订不清缓存**。所以任何 tick 过的合约，缓存里都有其最后价格。订阅后立即拉，多数可见合约能立刻显示最后已知价。

### 数据流

```
subscribe 成功
  → getSnapshots(订阅列表)          // 复用现有 /api/market/snapshots
  → 返回 { snapshots: { id: {...} } }
  → batchUpdate(缓存快照)            // 写入 market store
  → MarketTable prevSnapshotsRef 自 diff → updateRecords 局部重绘
  → 实时 tick 到来 → WS → batchUpdate → 覆盖为最新价
```

### 实现要点

- 在 `useSubscriptionManager` 的 subscribe 成功回调里、`subscribedRef.set` 之后，对 `toSubscribe` 调 `getSnapshots(toSubscribe)`。
- 返回值 `{ snapshots }` 转成 `MarketSnapshot[]` 调 `useMarketStore.getState().batchUpdate(...)`。
- **不改变订阅/退订逻辑**——回填是「订阅成功后的附加动作」，失败静默（`catch` 忽略），实时 tick 兜底。
- 缓存快照可能过期（最后价格是几分钟前的），但**显示旧价 > 显示 `--`**，实时 tick 会在毫秒级内覆盖。

### 与既有机制的衔接

- 复用 Task 1 已实现并保留的 `batchUpdate`（它 `set` 新快照对象，MarketTable 引用比较自 diff 能识别为变化行）。
- 快照回填走 `batchUpdate` 写入 store，`recentlyUpdated` 无需恢复（MarketTable 自 diff 已够用）。
- 只在「订阅成功的合约」上回填，避免对未订阅合约拉缓存。

---

## 5. 数据流

```
订阅流（拖动）：
scroll → MarketTable.notifyVisibleRange(100ms 防抖) → setVisibleInstrumentIDs
  → useSubscriptionManager：拖动检测（300ms 窗口 ≥2 次变化）
    ├─ 拖动中：零 HTTP（不订不退）
    ├─ 滚动松手（mouseup <200ms 内）→ markScrollEnd → 立即完整 diff（跳过 500ms 窗口）
    └─ 停止后 / 非拖动变化 → 完整 diff：
         subscribe 当前可见区（成功 → getSnapshots 回填）
       + 宽限期退订（30s）
       + LRU 淘汰（≤480；新批次超限时退订先行 await 再订阅）

行情流（tick）：
WS market_data → useMarketWs 缓冲 → batchUpdate(snaps) → store 更新 snapshots + 记录变化集
  → MarketTable：只 rebuild 变化行 → updateRecords(局部重绘)
```

---

## 6. 错误处理

- **subscribe / unsubscribe 失败**：success 门控——`resp?.success` 为真才更新 `subscribedRef`；被整批拒绝（`success:false`）的合约不入 `subscribedRef`，留在待订阅状态，下次 diff 自动重试。网络异常 try/catch + console.error。
- **退订先行时退订失败**：不阻塞订阅——catch 后仍执行 subscribe（尽力而为）；后端若仍满则下次 diff 重试。
- **LRU 淘汰遇到后端超限**：SOFT_LIMIT=480 永远 < 500，预留 20 余量；即便极端情况下 CTP 返回失败，本地已移除，下次 diff 可恢复。
- **updateRecords 行号越界**：`rowIndex < 0` 跳过；vtable 未就绪时 `try/catch` 包裹（沿用现有 `notifyVisibleRange` 模式）。

---

## 7. 测试方案

新增/修改测试文件：

**`frontend/src/hooks/useSubscriptionManager.test.ts`（新建）**

1. **延迟退订**：合约滑出可见区 30s 内不退订（`vi.useFakeTimers()` 推进 10s，断言无 unsubscribe 调用）；超 30s 未可见 → 触发退订；宽限期内滑回 → 退订取消、时间刷新。
2. **拖动中零 HTTP**：连续多次 `setVisibleInstrumentIDs`（300ms 内 ≥2 次）→ 期间 subscribe 与 unsubscribe **均不被调用**；停止 500ms 后完整 diff 订阅最终可见区。
3. **LRU 上限 + 退订先行串行化**：注入 480+ 合约 → 订阅数永不超 480；淘汰顺序为最久未见；自选/锁定永不淘汰；新批次超 SOFT_LIMIT 时断言 `unsubscribeMarket` 先于 `subscribeMarket` 调用（`mock.invocationCallOrder`）。
4. **完整 diff 时机**：非拖动可见区变化立即订阅；拖动停止后 500ms 统一完整 diff。

**`frontend/src/modules/market/MarketTable.test.tsx`（修改）**

5. **updateRecords 局部更新**：mock vtable 的 `updateRecords`/`setRecords`，断言 tick 更新只调 `updateRecords`（不调 `setRecords`）；选中变化仍调 `setRecords`。
6. **行索引映射保持**：局部更新后单击/右键/收藏仍能取到正确行。

**快照回填（方案 A，`useSubscriptionManager.test.ts` 追加）**

7. **订阅成功后回填缓存快照**：mock `getSnapshots` 返回缓存快照，断言 subscribe 成功后 `getSnapshots(订阅列表)` 被调用、返回的快照经 `batchUpdate` 写入 store；`getSnapshots` 失败时静默（不抛错，实时 tick 兜底）。
8. **滚动松手立即完整 diff（机制 7）**：
   - store 单测：`markScrollEnd()` 递增 `scrollEndSeq`（`store.test.ts`）
   - hook 单测：模拟拖动态（300ms 内 ≥2 次变化、零 HTTP）后调 `markScrollEnd()` → **不推进 500ms** 即订阅最终可见区；松手后可见区变化不再被误判为拖动态（立即订阅）（`useSubscriptionManager.test.ts`）
   - MarketTable 接线：mock scroll 处理器后 `window.dispatchEvent(new Event('mouseup'))` → `scrollEndSeq` 递增（`MarketTable.test.tsx`）

**mock 方式：** `vi.mock('@/services/api')` 记录 `subscribeMarket`/`unsubscribeMarket`/`getSnapshots` 调用；`vi.useFakeTimers()` 控制时间推进；`setupTests.ts` 已有 `setRecords: vi.fn()`，需补充 `updateRecords: vi.fn()`。

---

## 8. 非目标

- 后端订阅/退订接口改造（合并去抖、批量优化）——本轮不动后端
- K 线、期权链等其他表格的局部更新改造
- 虚拟滚动按需订阅之外的渲染优化
- 滚轮/方向键滚动的停止检测（无 mouseup 信号，仍走 500ms 推断窗口；如需可后续加 scroll idle 计时器）
