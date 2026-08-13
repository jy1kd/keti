# 查询面板拆分：报单查询 + 持仓查询 设计方案

> 将现有查询窗口拆分为三个独立可开窗口（报单查询 / 持仓查询 / 查询窗口），
> 报单查询按成交状态筛选，持仓查询按合约模糊匹配。
> 入口统一放在左上角 Electron 原生菜单「功能」子菜单，与现有浮动窗范式一致。

---

## 一、定位与范围

### 1.1 目标

把现有 `QueryPanel`（内部 5 个 tab：报单 / 成交 / 持仓 / 资金 / 止损单）拆分为**三个独立窗口**：

| 窗口 | 内容 | 筛选 | 入口 |
|------|------|------|------|
| 报单查询窗口（新增） | 报单流水 + 撤销全部 / 单笔撤单 / 新单高亮 | 状态筛选：全部 / 未成交 / 已成交 | 原生菜单「功能」 |
| 持仓查询窗口（新增） | 持仓明细 + 平仓按钮 | 合约输入框模糊匹配 | 原生菜单「功能」 |
| 查询窗口（保留） | 成交 / 资金 / 止损单 | 无 | 原生菜单「功能」（现有） |

### 1.2 范围边界（防漂移）

| 项 | 决策 |
|---|---|
| `OrderFlow.tsx` / `Position.tsx` / `store.ts` | **不动**，新窗口直接复用（数据在同一 `useQueryStore`） |
| 后端 | **零改动**。`/api/query/orders`、`/api/query/positions` 全量返回，筛选在前端完成 |
| 报单窗口合约筛选 | **不做**（用户确认报单窗口只做状态筛选） |
| 查询窗口是否去掉报单/持仓 tab | **去掉**（已独立出去，避免重复入口） |
| 数据刷新 | 按窗口只刷自己数据集，三者不相交，遵守 CTP ~1 次/秒限频 |

### 1.3 核心增量

1. **两个新标签页类型** `query-orders` / `query-positions` + 各自独立窗口组件。
2. **原生菜单两项新入口**（复用现有 `open-floating` IPC 链路）。
3. **报单窗口状态筛选**（全部 / 未成交 / 已成交）。
4. **持仓窗口合约输入框模糊匹配**。

---

## 二、页面布局

### 2.1 报单查询窗口

```
┌──────────────────────────────────────────────┐
│ [全部报单] [未成交报单] [已成交报单]     撤销全部   123 笔 │
├──────────────────────────────────────────────┤
│ 报单号│合约│买卖│开平│价格│委托量│成交量│状态│时间│操作 │
└──────────────────────────────────────────────┘
```

### 2.2 持仓查询窗口

```
┌──────────────────────────────────────────────┐
│ [合约搜索框 ⚲  ...]                      N 个合约 │
├──────────────────────────────────────────────┤
│ 合约│方向│持仓量│持仓盈亏│开仓成本│占用保证金│今仓│昨仓│操作 │
└──────────────────────────────────────────────┘
```

### 2.3 查询窗口（保留，TABS 缩减）

```
┌──────────────────────────────────────────────┐
│ [成交] [资金] [止损单]                   刷新/暂停      │
├──────────────────────────────────────────────┤
│ 对应内容                                       │
└──────────────────────────────────────────────┘
```

---

## 三、入口：左上角原生菜单

`frontend/electron/menuTemplate.ts`「功能」子菜单新增两项：

```
功能
├── 📝 报单窗口        （现有，下单）
├── 📈 K线窗口         （现有）
├── 📋 查询窗口        （现有，成交/资金/止损单）
├── 📋 报单查询窗口    （新增）
├── 📋 持仓查询窗口    （新增）
├── ─────────
└── 退出
```

完整链路改动：

| 文件 | 改动 |
|---|---|
| `frontend/electron/menuTemplate.ts` | `FloatingTab` 联合类型加 `'query-orders'` / `'query-positions'`；「功能」子菜单新增两个 `open-floating` 菜单项 |
| `frontend/electron/menuActions.ts` | **无需改动**（`open-floating` 分支已通用，透传 tab 值） |
| `frontend/electron/preload.ts` | `onOpenFloatingTab` 回调类型加两个取值（channel 字符串不变） |
| `frontend/electron/ipc/index.ts` / `.d.ts` | `FloatingTab` 相关类型同步（如存在） |
| `frontend/src/App.tsx` | `onOpenFloatingTab` switch 加两个 case |
| `frontend/src/utils/openFloatingTab.ts` | 新增 `openOrdersQueryFloating()` / `openPositionsQueryFloating()` |

> 注：`preload.ts` 的 IPC channel 字符串与 `ipc/index.ts` 手动保持一致（文件头有说明），改动类型时注意同步。菜单测试 `menuTemplate.test.ts` 需同步更新断言。

---

## 四、标签页与组件拆分

### 4.1 标签类型（`frontend/src/stores/tabs.ts`）

- `TabType` 新增 `'query-orders'`、`'query-positions'`，加入 `TAB_TYPES`。
- `frontend/src/components/TabContent/index.tsx` `renderTabContent` 加两个 case，渲染新组件。

### 4.2 组件（`frontend/src/modules/query/`）

| 文件 | 动作 |
|---|---|
| `OrdersQuery.tsx` | **新增** — 报单查询窗口（筛选条 + 复用 `OrderFlow` 表格） |
| `PositionsQuery.tsx` | **新增** — 持仓查询窗口（合约输入框 + 复用 `Position` 表格） |
| `QueryPanel.tsx` | **改造** — `TABS` 去掉 `orders` / `positions`，只留 成交/资金/止损单；`refreshAll` 瘦身 |
| `OrderFlow.tsx` / `Position.tsx` / `store.ts` | **不动** |

### 4.3 复用边界

- `OrdersQuery` 通过 `useQueryStore` 读 `orders` / `newOrderRefs`，调 `handleCancelOrder` / `handleCancelAll` —— 与 `OrderFlow` 完全同源。
- `PositionsQuery` 读 `positions`，平仓逻辑（今仓→平今、昨仓→平昨、对手价取行情快照、打开报单标签页）复用 `Position` 现有实现。
- 不复制表格逻辑，避免两份维护。

---

## 五、报单查询窗口：状态筛选

### 5.1 筛选语义（CTP orderStatus 映射，已确认）

| 选项 | 规则 | CTP 状态 |
|------|------|----------|
| 全部报单 | 所有状态（含已撤单） | 0/1/2/3/5 |
| 未成交报单 | 完全没有成交量且未撤 | 2 未成交(排队)、3 未成交 |
| 已成交报单 | 有成交量 | 0 全部成交、1 部分成交 |

- **部分成交（1）归属已成交**（有成交量即已成交）——已确认。
- **已撤单（5）仅在「全部」显示**。
- 默认选中「全部报单」。

### 5.2 保留交互

- 撤销全部按钮 + `C` 快捷键（`activeTab === 'orders'` 时生效——注意：新窗口非原 QueryPanel 的 tab，`C` 键逻辑需平移到 `OrdersQuery`，`handleCancelAll` 复用）。
- 单笔撤单按钮（仅活跃状态 1/2/3 显示）。
- 新单 2 秒高亮（`newOrderRefs` + 自动清除计时器）。

---

## 六、持仓查询窗口：合约筛选

- **合约输入框模糊匹配**：`instrumentID` 前缀/子串匹配（输入 `IF` 过滤所有 IF 合约），大小写不敏感，清空显示全部。对齐行情面板 `MarketPanel` 的 `searchQuery` 过滤写法。
- **保留交互**：平仓按钮原样保留（今仓/昨仓 offsetFlag 判定、对手价取快照、`openTab` 报单标签）。
- 空态「暂无持仓数据」保留。

---

## 七、数据刷新策略

### 7.1 现状

`refreshAll()` 10 秒串行刷 5 项（每项间隔 1.2s，一轮约 5s），受 CTP ~1 次/秒查询限频约束。

### 7.2 拆分后：按窗口只刷自己数据集

| 窗口 | 轮询 | 增量更新 |
|------|------|----------|
| 报单查询 | `fetchOrders`（10s 独立自刷新） | `upsertOrder`（WS `order_return` 已有） |
| 持仓查询 | `fetchPositions`（10s 独立自刷新） | 持仓 WS 推送（如有则接入） |
| 查询窗口 | `refreshTrades` + `refreshAccount` + `refreshStopOrders` | `upsertTrade`（WS `trade_return` 已有） |

- 每窗口沿用 QueryPanel 现有「完成后调度下一次」防重入写法。
- 单查询间隔 10s，远低于 CTP 限频；三窗口数据集不相交，互不重复。
- `QueryPanel.refreshAll` 瘦身：不再刷 orders / positions（由各自窗口负责）。

---

## 八、测试策略

| 类型 | 内容 |
|---|---|
| 组件测试（新增） | `OrdersQuery`：状态筛选三档边界（全部/未成交/已成交、部分成交归属、已撤单仅全部显示）、撤销全部/单笔撤单、新单高亮 |
| 组件测试（新增） | `PositionsQuery`：合约输入框模糊匹配（空→全部、IF→IF 合约、大小写）、平仓按钮保留 |
| 组件测试（更新） | `QueryPanel.test.tsx`：TABS 断言去掉 orders/positions |
| Electron 测试（更新） | `menuTemplate.test.ts`：新增菜单项断言；`preload` 类型/通道同步 |
| 回归 | `OrderFlow` / `Position` 现有测试全绿（复用组件未动） |
| 前端全量 | `npm test`（469+ 用例） |

---

## 九、决策记录

| # | 决策 | 依据 |
|---|---|---|
| 1 | 两个独立标签页类型，非面板内 tab | 用户选择「两个独立标签页」 |
| 2 | 入口在左上角原生菜单「功能」子菜单 | 用户指定，复用 `open-floating` 链路 |
| 3 | 原查询窗口保留（成交/资金/止损单），去掉报单/持仓 tab | 用户选择「保留原查询窗口」 |
| 4 | 报单窗口状态筛选：未成交=无成交量未撤(2,3)；已成交=有成交量(0,1)；已撤单仅全部 | 用户确认「部分成交算已成交」 |
| 5 | 持仓窗口合约输入框模糊匹配 | 用户指定 |
| 6 | 报单窗口不加合约筛选 | 用户最新指定「报单从是否成交筛选」 |
| 7 | 后端零改动，前端筛选 | 数据量小，全量返回已够 |

---

## 十、迭代路线

### Phase 1（本次）
- [ ] 标签类型 + 菜单入口 + IPC 链路（tabs / menuTemplate / preload / App / openFloatingTab）
- [ ] `OrdersQuery` + 状态筛选 + 复用 OrderFlow 交互 + `C` 键平移
- [ ] `PositionsQuery` + 合约模糊匹配 + 复用 Position 平仓
- [ ] `QueryPanel` TABS 缩减 + `refreshAll` 瘦身
- [ ] 上述测试全绿 + 现有查询/报单/持仓回归

---

*文档版本：v1.0 | 生成日期：2026-08-13*
