# Design: 行情页填充、合约列冻结与选中态/订阅一致性修复

**日期**: 2026-08-10
**状态**: 已批准

---

## 1. 背景

六个 UI/数据一致性问题，均集中在行情模块（`MarketPanel` / `MarketTable`）及其周边（期权页、报单/K线浮窗、订阅管理）：

| # | 问题 | 现象 |
|---|------|------|
| 1 | 页面未占满 | 行情主页面 / T型期权页面没有自动填充可用空间（横向留白 + 纵向未撑满） |
| 2 | 合约列未冻结 | 行情表横向拖动时「合约」列随列滚走，无法固定最左侧 |
| 3 | 自选偶尔不推数据 | 收藏的自选合约偶尔不推送行情，重新收藏（remove+add）后才恢复 |
| 4 | 右键不选中 | 右键合约弹出菜单但不选中该合约，高亮仍停在上一左键合约 |
| 5 | 双高亮区 | 有时屏幕出现两个批量选中高亮区域 |
| 6 | 空合约浮窗不渲染 | 未选中合约时，经工具栏/顶部菜单打开报单、K线浮窗，窗内无实际内容（仅占位文案） |

**目标**：一次性消除以上 6 个问题，核心原则——**选中态以蓝色选区为唯一数据源（金色活动锚点始终位于选区内）、订阅生命周期单一负责人**。

---

## 2. 根因分析

### 2.1 问题 1 — 页面未占满

- **期权页（确定）**：`OptionPanel.tsx:274` 给 `.options-chain-table` 设内联固定高度 `chainHeight()`（按行权价数量 × 28px 估算）。行权价数量少时表格只占上部，下方空白；`.options-content`（`options/styles.css:126-130`）虽 `flex:1`，但表格自身高度固定不撑满。
- **行情页高度（高概率）**：`.panel-content`（`market/styles.css:59-64`）同时声明 `flex:1` 与 `height:100%`，与 `market-toolbar` 叠加后高度链双重计数，纵向布局不精确。
- **行情页宽度（确定）**：`MarketTable.tsx:196` `widthMode:'standard'` 按列固定宽度渲染，宽屏下列宽合计 < 容器宽度，最右侧留白。

### 2.2 问题 2 — 合约列未冻结

`MarketTable.tsx:194-244` 创建 `ListTable` 时未配置 `frozenColCount`，横向滚动时「合约」列跟随滚动。

### 2.3 问题 3 — 自选偶尔不推数据（三层脱节）

1. **前端直连退订绕过订阅管理器**：`stores/contracts.ts:103-118` `removeFromFavorites` 直接 `unsubscribeMarket([X])`，但订阅管理器 `useSubscriptionManager` 的 `subscribedRef` 仍认为 X 已订阅。X 若仍在视野内，`should` 含 X 且 `subscribedRef` 含 X → 永不重订，而后端/CTP 已退订 → 该行永久 `--`。重新收藏时 `addToFavorites` 走全新 `subscribeMarket([X])` → 才恢复。
2. **后端订阅"假成功"**：`market_service.py:249-251` **先把合约加入 `_subscriptions` 再调 CTP**；`ctp_bridge.py:338-341` 的 `_subscribe_with_tracking` 忽略 `md_api.subscribe` 的 int 返回值。CTP 一旦拒绝（返回非 0），本地已记录、接口仍 `success:true` → 前端标记已订阅、永不重试；下一轮 diff 重试时后端返回 `alreadySubscribed:true` 再次"成功"，但 CTP 实际未订 → 无数据。
3. **重连恢复用过期快照**：`reconnect.py:73-94` 重连后按 `reconnect_svc._subscriptions`（仅订阅时同步、退订不同步）恢复，而非权威的 `market_service._subscriptions`；且前端 WS 重连（`useReconnect.ts` / `services/ws.ts`）不触发任何重新订阅动作，无治愈兜底。

### 2.4 问题 4 — 右键不选中合约

`MarketTable.tsx:331-347` 的 `contextmenu_cell` 只打开菜单，未更新选中态（`selectedContracts` / `selectedInstrument`），高亮停在上一左键合约。

### 2.5 问题 5 — 双高亮区（两套高亮并存）

- 金色：`MarketTable.tsx:527-545` 的 `selectRow(selectedInstrument)`（vtable 原生选中高亮）；
- 蓝色：`MarketTable.tsx:222-229` 的 `selectedContracts` → `bodyStyle.bgColor`。

拖选 / Shift 范围选只改 `selectedContracts`、不改 `selectedInstrument` → 金色单行 + 蓝色多行 = 两个高亮区。

### 2.6 问题 6 — 空合约浮窗不渲染

`OrderPage.tsx:55-64`、`KLinePage.tsx:94-98` 在 `instrumentID` 为空时只渲染「请在行情表格中选择合约后打开…」占位文案，浮窗打开后无可交互内容。

---

## 3. 架构决策

**决策 1 — 选中态唯一数据源 + 金色活动锚点。** `selectedContracts`（蓝色选区）是选中态的唯一数据源；vtable 原生 `selectRow` 金色高亮**保留**，作为选区内的「活动行」锚点（类似 Excel 活动单元格）。关键约束：**金色只在 `selectedInstrument ∈ selectedContracts` 时渲染**（`selectRow` effect 加守卫）——单选时金蓝重合，多选时金色落选区锚点行，锚点被移出选区则金色消失。高亮永远唯一，绝不出现第二个独立区域。`selectedInstrument` 同时承担「当前合约」业务概念（报单/K线/收藏按钮）。

**决策 2 — 订阅生命周期单一负责人。** `addToFavorites` / `removeFromFavorites` 只维护 favorites 状态，订阅/退订统一由 `useSubscriptionManager` 对 `should`（可见 + 自选 + 锁定）做 diff，消除 `subscribedRef` 与后端/CTP 脱节。

**决策 3 — 后端先验证后记录。** `market_service.subscribe()` 先调 CTP、成功才写入 `_subscriptions`；CTP 返回非 0 → 不记录、返回 `success:false`，让前端下轮 diff 重试（消除"假成功"永久无数据）。

**决策 4 — 重连双保险。** 后端重连恢复用权威 `market_service._subscriptions` 并对账补订；前端 WS（重）连接成功后触发一次「强制重订阅」（清空 `subscribedRef` 后对全部 `should` 重发一次批量订阅），WS 层兜底治愈任何失步。

**决策 5 — 空合约浮窗可交互。** 报单/K线浮窗在无 `instrumentID` 时渲染窗内 `ContractSearch`，选中后走既有 `handleSwitch` → `updateTab` 更新 tab props/title → 正文渲染，`useTabContractLocks` 自动锁定订阅。

---

## 4. 修改范围

### 4.1 问题 1 — 页面自动填充（高宽都填）

| 文件 | 改动 |
|------|------|
| `frontend/src/modules/options/OptionPanel.tsx` | 删除 `chainHeight()` 及内联 `style={{ height: chainHeight(...) }}` |
| `frontend/src/modules/options/styles.css` | `.options-chain-table` 由 `width:100%` 改为 `flex:1; min-height:0; height:100%; width:100%`；`.options-panel` 由 `height:100%` 改 `flex:1 1 0; min-height:0` |
| `frontend/src/modules/market/styles.css` | `.panel-content` 删 `height:100%` 只留 `flex:1; min-height:0; overflow:hidden`；确认 `.market-panel` 用 `flex:1; min-height:0` 兜底（现为 `height:100%`） |
| `frontend/src/modules/market/MarketTable.tsx` | `widthMode` 由 `'standard'` 改 `'adaptive'`（列宽按容器自适应、填满容器）；若 adaptive 挤压价格列观感不佳，回退「固定列宽 + 末尾弹性列」方案 |

> 注：`adaptive` 会把容器宽度分配到各列，可能挤压价格列。实施时优先浏览器验证，观感不佳再改弹性尾列。

### 4.2 问题 2 — 合约列冻结

`frontend/src/modules/market/MarketTable.tsx` 创建 ListTable 时加：

```ts
const table = new ListTable(containerRef.current, {
  columns,
  records,
  frozenColCount: 1,   // 冻结「合约」列
  ...
})
```

冻结列与 `scrollToCell({col:0})`、行高亮、右键定位兼容（冻结列 `data-row` / `getCellAt` 不受影响）。T型期权表不冻结（行权价居中属设计意图）。

### 4.3 问题 3 — 自选订阅一致性

**前端：**

| 文件 | 改动 |
|------|------|
| `frontend/src/stores/contracts.ts` | `addToFavorites` / `removeFromFavorites` / `loadFavoriteContracts` 去掉直连 `subscribeMarket` / `unsubscribeMarket`，只维护 favorites 状态（`addToFavorites` 移除"订阅失败则不收藏"的 guard，订阅失败由管理器 diff 重试兜底） |
| `frontend/src/modules/market/store.ts` | 新增 `forceResubscribeSeq: number` + `markForceResubscribe()`（monotonic 信号，语义同 `scrollEndSeq`） |
| `frontend/src/hooks/useSubscriptionManager.ts` | 消费该序号：递增时清空 `subscribedRef` 并立即 `runFullDiff()`（对全部 `should` 重发一次批量订阅） |
| `frontend/src/hooks/useReconnect.ts` | 连接成功回调触发 `markForceResubscribe()`（初始连接 + 断线重连都触发；`subscribeMarket` 是批量 POST，幂等且成本低） |

**后端：**

| 文件 | 改动 |
|------|------|
| `server/services/ctp_bridge.py` | `_subscribe_with_tracking` **透传 `md_api.subscribe` 的 int 返回值**，不再吞掉 CTP 拒绝 |
| `server/services/market_service.py` | `subscribe()` 改为：**先调 CTP，成功才写入 `_subscriptions`**；CTP 返回非 0 → 不记录、返回 `success:false`（含 `message` 供前端日志） |
| `server/services/ctp_startup.py` | 重连恢复订阅改用**权威 `market_service._subscriptions`**（而非 `reconnect_svc` 过期快照）；重连成功后对 `_subscriptions` ↔ `md_api.subscribed_instruments` 对账，缺失即补订 |

### 4.4 问题 4 — 右键选中

`frontend/src/modules/market/MarketTable.tsx` `contextmenu_cell` 单选分支，先更新选中态再开菜单：

```ts
table.on('contextmenu_cell', (args: any) => {
  const rowIndex = args.row - 1
  const record = recordsRef.current[rowIndex]
  if (!record) return
  const selected = selectedContractsRef.current
  if (selected && selected.size > 1 && selected.has(record.instrumentID) && onMultiSelectContextMenuRef.current) {
    // 右键命中多选集合内 → 保持集合，显示多选菜单（现状不变）
    onMultiSelectContextMenuRef.current(Array.from(selected), event)
  } else {
    // 右键落在集合外 → 先同步选中态到该合约，再显示单选菜单：
    // onSelectionChange 置蓝区 = {id}，下方 handleContextMenu 置金色锚点 = id，蓝金重合
    onSelectionChangeRef.current?.(new Set([record.instrumentID]))
    onContextMenuRef.current?.(record.instrumentID, price, event)
  }
})
```

`frontend/src/hooks/useContractContextMenu.ts` 的 `handleContextMenu` 内调用 `useMarketStore.getState().setSelectedInstrument(instrumentID)`，把金色锚点同步到右键合约（FavoritesPage 一并受益）。两处更新后，右键的蓝色选区与金色锚点落在同一行，高亮立即切换。

### 4.5 问题 5 — 高亮统一（蓝色选区 + 金色活动锚点）

`frontend/src/modules/market/MarketTable.tsx`：

- **保留** `selectRow` 金色高亮 effect（`MarketTable.tsx:527-545`）；
- **加守卫**：仅当 `selectedInstrument ∈ selectedContracts` 才调用 `selectRow`；否则跳过（锚点被移出选区时金色消失，只剩蓝色选区）；
- 蓝色选区高亮只读 `selectedContracts`（`bodyStyle.bgColor`，`MarketTable.tsx:222-229`），保留 `selectedContracts` 变化时的 `setRecords` 重绘 effect（`MarketTable.tsx:518-524`）；
- **锚点同步**：多选交互把 `selectedInstrument` 更新为选区内的活动行——拖选 → 拖选起始行；Shift 范围选 / Ctrl 点击 → 点击行（现有 `click_cell` 的 `onClickRef` 已隐式触发 `setSelectedInstrument`）；单选 → 该行。

效果：单选金蓝同高亮单行；多选统一为「蓝底金边」的活动行锚点；配 4.4 右键后，左键 / 右键 / 拖选 / Shift / Ctrl+A 的高亮始终唯一。

### 4.6 问题 6 — 空合约浮窗可交互

- `frontend/src/pages/OrderPage.tsx:55-64`：`!instrumentID` 分支（含 floating 模式）由占位文案改为窗内 `ContractSearch`，选中后调既有 `handleSwitch`；
- `frontend/src/pages/KLinePage.tsx:94-98`：`!instrumentID` 分支同样改为窗内 `ContractSearch`，选中后调既有 `handleSwitch`。

复用现有 `handleSwitch` → `updateTab` 链路，`useTabContractLocks` 在 props 更新后自动锁定订阅。

---

## 5. 不修改的文件

| 文件 | 原因 |
|------|------|
| `TQuoteTable.tsx` 表格逻辑 | 冻结列/选中态仅行情表涉及；期权表仅外层高度填充 |
| `services/ws.ts` | WSManager 只补触发点（useReconnect 消费），不重构连接管理 |
| `reconnect.py` 对外接口 | 仅 `ctp_startup.py` 改调用来源，ReconnectService 结构不动 |

## 6. 测试影响

| 测试 | 需更新 |
|------|--------|
| `MarketTable.test.tsx` | 右键选中态、`frozenColCount`、`selectRow` 守卫（锚点在/不在选区）断言、`widthMode` |
| `useSubscriptionManager.test.ts` | 强制重订阅（`forceResubscribeSeq`）分支 |
| `contracts` store 相关测试 | 去掉直连订阅后 `addToFavorites`/`removeFromFavorites` 行为 |
| `OrderPage` / `KLinePage` 测试 | 空合约选择器断言 |
| 后端 `test_market_service.py` | `subscribe()` CTP 失败回滚（`success:false`、不写入 `_subscriptions`） |
| `useReconnect.test.ts` | 连接成功触发 `markForceResubscribe` |

## 7. 验证

1. `cd frontend && npm test` — 全部单测绿（含更新断言）
2. `cd server && python -m pytest tests/ -v` — 后端 108 单测绿
3. `cd frontend && npm run dev` + 后端 `start.py` 手动过一遍：
   - **#1** 行情/期权页随窗口大小自适应填满（宽屏 + 窄屏）
   - **#2** 行情表横向拖动，「合约」列固定最左侧
   - **#3** 收藏→移除→滚动→重收、以及 CTP 断线重连后，自选/可见合约数据恢复推送
   - **#4** 右键不同合约，高亮立即切换到该合约
   - **#5** 拖选 / Shift / Ctrl+A 全选，高亮始终唯一（蓝色选区 + 金色活动行锚点，无独立第二高亮区）
   - **#6** 无选中合约时从底部工具条打开报单/K线浮窗，窗内可搜索并选中合约后正常渲染

## 8. 实施顺序

1. **问题 2**（独立、最小）：`frozenColCount: 1`
2. **问题 1**（纯 CSS/配置）：期权表高度、`.panel-content` 高度链、`widthMode`
3. **问题 4 + 5**（同属选中态重构，一并做）：右键选中 + `selectRow` 守卫与锚点同步
4. **问题 6**（独立）：空合约浮窗内嵌 ContractSearch
5. **问题 3**（前后端、改动最大放最后）：前端订阅管理器 + 后端 CTP 返回值校验/重连对账
6. 全量测试 + 浏览器手动验证
