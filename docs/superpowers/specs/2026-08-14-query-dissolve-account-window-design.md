# 查询窗口解散 + 资金独立窗口 设计方案

> 将查询窗口（成交/资金/止损单）整体解散：资金拆为独立窗口，
> 成交/止损单随查询窗口一并下线。查询功能最终全部独立成窗口，
> 资金窗口入口放在左上角 Electron 原生菜单「功能」子菜单，与报单/持仓查询窗口范式一致。

---

## 一、定位与范围

### 1.1 目标

查询功能全部独立成窗口，原「查询窗口」不复存在：

| 窗口 | 标签类型 | 内容 | 入口 |
|------|---------|------|------|
| 报单查询窗口（现有） | `query-orders` | 报单流水 + 状态筛选 | 原生菜单「功能」 |
| 持仓查询窗口（现有） | `query-positions` | 持仓明细 + 合约模糊匹配 | 原生菜单「功能」 |
| 资金查询窗口（**新增**） | `query-account` | 账户资金 + 10s 自刷新 | 原生菜单「功能」（💰 资金查询窗口） |
| ~~查询窗口~~ | ~~`query`~~ | ~~成交 / 资金 / 止损单~~ | **删除** |

### 1.2 范围边界（防漂移）

| 项 | 决策 |
|---|---|
| 后端 | **零改动**。`/api/query/trades`、`/api/order/stop/*` 等接口保留 |
| 报单面板 `StopOrderForm.tsx`（创建止损单） | **保留**，仅移除查询窗口内 `StopOrderList` 列表展示 |
| `isPaused` store 字段 | **保留**（`AccountBar`/`MarketDepth`/`InfiniteOrderPage` 读取做轮询门控；无置位方后恒 `false`） |
| `orders`/`positions`/`account` 及对应 fetch | **保留**（报单/持仓/资金窗口 + 报单面板 `AccountBar` 复用） |
| 成交/止损单 UI | **删除**（`TradeFlow`/`StopOrderList` 仅被 `QueryPanel` 引用，无其他入口） |

### 1.3 核心增量

1. 新标签类型 `query-account` + 资金窗口组件接入（复用现有 `AccountQuery` + 自刷新）。
2. 原生菜单「功能」子菜单：删 `📋 查询窗口`，增 `💰 资金查询窗口`。
3. 删除查询窗口全部 5 个入口（原生菜单 / 托盘导航 / BottomBar / TabBar 加号菜单 / 合约右键菜单）。
4. store 瘦身：移除只服务于已下线功能的字段与方法。

---

## 二、入口：左上角原生菜单

`frontend/electron/menuTemplate.ts`「功能」子菜单调整：

```
功能
├── 📝 报单窗口        （现有，下单）
├── 📈 K线窗口         （现有）
├── 📋 报单查询窗口    （现有）
├── 📋 持仓查询窗口    （现有）
├── 💰 资金查询窗口    （新增）
├── ─────────
└── 退出
```

> 「📋 查询窗口」菜单项随查询窗口解散一并移除；托盘菜单镜像 `getAppMenuDef()`，自动同步消失。

完整链路改动：

| 文件 | 改动 |
|---|---|
| `frontend/electron/menuTemplate.ts` | `FloatingTab` 删 `'query'` 加 `'query-account'`；「功能」子菜单 `func-query` → `func-query-account` |
| `frontend/electron/menuActions.ts` | **无需改动**（`open-floating` 分支已通用，透传 tab 值） |
| `frontend/electron/preload.ts` | `onOpenFloatingTab` 回调类型（2 处）删 `'query'` 加 `'query-account'` |
| `frontend/src/services/electron.ts` | `onOpenFloatingTab` IPC 类型同步 |
| `frontend/src/App.tsx` | `onOpenFloatingTab` switch 删 `query` 加 `query-account`；`onNavigateTab` 删 `case 'query'` |
| `frontend/src/utils/openFloatingTab.ts` | 删 `openQueryFloating`；加 `openAccountQueryFloating()` |

> 注：`preload.ts` 的 IPC channel 字符串与 `ipc/index.ts` 手动保持一致（文件头有说明），改动类型时注意同步。菜单测试 `menuTemplate.test.ts` 需同步更新断言。

---

## 三、标签页与组件调整

### 3.1 标签类型（`frontend/src/stores/tabs.ts`）

- `TabType` / `TAB_TYPES`：删 `'query'`，加 `'query-account'`。
- `frontend/src/components/TabContent/index.tsx`：`renderTabContent` 删 `case 'query'`（及 `QueryPanel` import），加 `case 'query-account'` → `<AccountQuery />`。

### 3.2 资金窗口（`frontend/src/modules/query/`）

| 文件 | 动作 |
|---|---|
| `AccountQuery.tsx` | **改造** — 加 10s `fetchAccount` 自刷新（防重入，对齐 `OrdersQuery` 节奏），成为资金窗口内容 |
| `AccountQuery.test.tsx` | **更新** — 适配自刷新（mock 已存在，处理初始 fetch 的 act/计时器） |
| `QueryPanel.tsx` / `QueryPanel.test.tsx` | **删除** |
| `TradeFlow.tsx` / `TradeFlow.test.tsx` | **删除**（成交下线） |
| `StopOrderList.tsx` / `StopOrderList.test.tsx` | **删除**（止损单列表下线） |
| `styles.css` | **保留**（`AccountQuery` 样式仍用；dead CSS 可顺带清理，非必须） |

### 3.3 查询窗口全部入口移除（5 处）

| 入口 | 位置 | 改动 |
|---|---|---|
| 原生菜单 | `menuTemplate.ts` `func-query` | 移除（见上） |
| 托盘导航 | `App.tsx` `onNavigateTab` `case 'query'` | 移除 |
| BottomBar | `BottomBar/index.tsx` 查询按钮 + `openQueryFloating` | 移除按钮与引用 |
| TabBar | `TabBar/index.tsx` `ADD_TAB_ITEMS` 查询项 | 移除该项 |
| 合约右键 | `useContractContextMenu.ts` `openQueryPopup`、`useContractMenus.tsx` 菜单项、`MarketPanel`/`FavoritesPage`/`OptionsPanel` 去引用 | 移除 |

---

## 四、store 瘦身（`frontend/src/modules/query/store.ts`）

### 4.1 移除

| 类别 | 字段 / 方法 |
|---|---|
| Tab 控制 | `QueryTab` 类型、`activeTab`、`setActiveTab` |
| 成交数据 | `trades`、`newTradeIDs`、`clearNewTradeID`、`fetchTrades`、`upsertTrade` |
| 止损单数据 | `stopOrders`、`fetchStopOrders`、`handleCancelStopOrder` |
| 批量刷新 | `refreshAll` |
| 查询窗口控制 | `isLoading`、`isRefreshing`、`togglePause` |
| 副作用 | api `cancelStopOrder` import |

### 4.2 保留

- `orders` / `positions` / `account` + `fetchOrders` / `fetchPositions` / `fetchAccount`（报单/持仓/资金窗口 + `AccountBar` 复用）。
- `handleCancelOrder` / `handleCancelAll`（报单查询窗口）。
- `newOrderRefs` / `clearNewOrderRef` / `upsertOrder`（报单查询窗口新单高亮）。
- `isPaused` **字段保留**（值恒 `false`，无置位方）：`AccountBar`/`MarketDepth`/`InfiniteOrderPage` 轮询门控读取，移除会破坏它们。

---

## 五、数据刷新策略

| 窗口 | 轮询 | 说明 |
|------|------|------|
| 报单查询 | `fetchOrders`（10s 独立自刷新） | 现有 `OrdersQuery`，不动 |
| 持仓查询 | `fetchPositions`（10s 独立自刷新） | 现有 `PositionsQuery`，不动 |
| 资金查询 | `fetchAccount`（10s 独立自刷新，**新增**） | 新增到 `AccountQuery` |

- `refreshAll` 删除后无聚合刷新入口；各窗口只刷自己数据集，遵守 CTP ~1 次/秒限频。
- 报单面板 `AccountBar` 仍独立刷新 持仓→账户，与资金窗口并存时账户查询约 2 次/10s ≈ 0.2 次/秒，远低于限频。
- `isPaused` 门控：`AccountBar`/`MarketDepth`/`InfiniteOrderPage` 读取逻辑原样保留（值恒 `false`，查询始终放行）。

---

## 六、测试策略

| 类型 | 内容 |
|---|---|
| 更新（Electron） | `menuTemplate.test.ts` 功能子菜单标签（删「📋 查询窗口」，增「💰 资金查询窗口」）；`preload`/`menuActions` 类型与通道同步断言 |
| 更新（前端） | `App.test.tsx`（query-account case，删 query case）、`tabs.test.ts`（TAB_TYPES）、`openFloatingTab.test.ts`、`TabContent.test.tsx`、`BottomBar.test.tsx`（删查询按钮）、`TabBar.test.tsx`（删查询项）、`useContractContextMenu.test.ts`（删 openQueryPopup）、`AccountQuery.test.tsx`（自刷新）、`store.test.ts`（瘦身后字段） |
| 删除 | `QueryPanel.test.tsx`、`TradeFlow.test.tsx`、`StopOrderList.test.tsx` |
| 夹具替换 | `TabContent/detachFlow.repro` / `integration` 等以 query tab 做夹具的测试换用其它类型 |
| 回归 | 前端全量 `npm test`（469+）；Electron 测试 `npm test`（electron 目录） |

---

## 七、构建产物

- 重新构建并提交 `frontend/dist-electron/`（`main.cjs`/`preload.cjs` 含菜单模板），沿用 `d517579`「更新构建产物以匹配菜单入口」先例。

---

## 八、决策记录

| # | 决策 | 依据 |
|---|---|---|
| 1 | 查询窗口整体解散，不保留 | 用户明确「查询窗口直接移除，不再保留查询窗口」 |
| 2 | 资金独立成窗口，成交/止损单下线 | 用户选择「只留资金，其余下线」 |
| 3 | 资金入口在左上角原生菜单「功能」 | 用户指定，复用 `open-floating` 链路（报单/持仓查询同款） |
| 4 | 资金窗口为浮动窗，非独立 BrowserWindow | 与报单/持仓查询范式一致，避免维护两套开窗机制 |
| 5 | store 彻底瘦身（方案一） | 用户选择方案一：无死代码，符合一致性检查口径 |
| 6 | `isPaused` 字段保留 | `AccountBar`/`MarketDepth`/`InfiniteOrderPage` 轮询门控读取 |
| 7 | `StopOrderForm` 创建保留，`StopOrderList` 展示下线 | 用户下线的是查询窗口内的列表展示，创建流程独立 |
| 8 | 后端零改动 | 接口保留，前端 UI 结构调整 |

---

## 九、迭代路线

- [ ] 标签类型 + 菜单入口 + IPC 链路（tabs / menuTemplate / preload / electron.ts / App / openFloatingTab）
- [ ] 资金窗口：`AccountQuery` 自刷新 + TabContent 接入
- [ ] 查询窗口 5 入口全部移除（原生菜单 / 托盘导航 / BottomBar / TabBar / 右键菜单）
- [ ] 下线：删除 `QueryPanel`/`TradeFlow`/`StopOrderList` + 测试；store 瘦身
- [ ] 测试全绿 + 前端/Electron 全量回归 + 重新构建 `dist-electron`

---

*文档版本：v1.0 | 生成日期：2026-08-14*
