# 设计文档：期权页 → 堆叠可折叠 T 型链 + 系列收藏

> 日期：2026-08-17　分支建议：`feature/options-stacked-t`
> 关联：`frontend/src/modules/options/`、`frontend/src/stores/collections.ts`、`frontend/src/pages/CollectionPage.tsx`

## 1. 背景与问题

现状期权页（`OptionsPanel`）是**平铺期权列表**：每个 C/P 合约一行，按 `underlyingInstrID` 分组，标底期货行（红粗合并）作组头。T型报价（`TQuoteView`/`TQuoteTable`）是独立的浮动窗，与列表互不相干。两个问题：

- **指数期权（MO/IO/HO）没有标底行**：`groupOptionsByUnderlying` 只在 `futures` 列表里按 `underlyingInstrID` 配到真实期货时才产出标底行（`OptionsPanel.tsx:108`）；而 MO2608 这类中证1000/沪深300/上证50 股指期权的 `underlyingInstrID`（如 `MO2608`）本身就不是可交易期货 → 组无头、整组只有 C/P 平铺。这与 `docs/superpowers/specs/2026-08-12-market-tab-split-design.md`「标底行仍可显示」的设计意图相悖。
- **平铺列表不适合读链**：逐行浏览 C/P 无法快速对比行权价两侧，用户真正想看的是一整条 T 型链。

## 2. 目标与非目标

### 目标
1. 期权页从「平铺列表」改为「**堆叠可折叠 T 型链**」：每个标底 = 一个红粗组头 + 可展开的迷你 T 表（C 左 / 行权价中 / P 右）。
2. 指数期权（无真实期货标底）也获得组头（合成），缺失组头问题消除。
3. 系列收藏：用户可收藏**整个标底系列**（如 `MO2608`），收藏夹页以同样堆叠 T 型渲染。
4. 保真工具栏能力：交易所+标底品种筛选、搜索（过滤组）、高级搜索（定位到组）、不倒退。

### 非目标（本次明确不做）
- 指数期权实时指数行情/IV/内在价值/希腊字母（依赖外部指数源，见 §6 后续）。
- 真实期货标底在组头显示实时价（用户已拍板：组头纯导航，不显示）。
- 平铺表式的单合约多选/拖选/右键菜单（用户已拍板：报价为主）。
- 跨组虚拟化与多组并发上限优化（先实测，超出再定）。
- `TQuoteView` 悬浮窗：保持不变，仍可从行情页调用。

## 3. 阶段拆分

| 阶段 | 内容 | 触及 | 独立可上线 |
|------|------|------|-----------|
| P1 | 期权页视图重构：堆叠可折叠 T 型链 | `OptionsPanel`、新 `OptionChainGroup`、`TQuoteTable`(+`onRowClick`)、数据管道、工具栏 | 是（不含收藏） |
| P2 | 系列收藏 | `collections.ts`(+`seriesIDs`)、`CollectionPicker`、`CollectionPage` 渲染 | 是 |

P1 不依赖 P2：期权页在 P1 阶段**不设 ⭐**（收藏功能 P2 恢复）。两阶段各自独立单测、独立 PR。

## 4. P1 期权页视图重构

### 4.1 数据管道

```
期权全量 (productClass '2' | '6')
  → filterByExchangeAndProduct(交易所 + 标底品种)        // 粒度 = 标底合约：按合约 exchangeID + deriveUnderlyingProduct(underlyingInstrID)
  → groupOptionsByUnderlying                             // 组 = {{underlyingID, underlying?, options[]}}
  → 组搜索过滤（标底代码 / 品种中文名 substring，大小写不敏感）// 未命中的组整组隐藏
  → 渲染组列表（折叠态 = 轻 DOM 组头；展开态 = 该组 T 表）
```

- 复用现有纯函数：`groupOptionsByUnderlying`、`filterByExchangeAndProduct`、`deriveUnderlyingProduct`、`naturalCompare`、`getProductName`。
- 「组内无可见期权 → 整组隐藏」语义天然保留（过滤作用于期权后再分组）。
- 组头数据：真实期货标底用 `g.underlying`；缺失时用合成标底（见 §4.2）。

### 4.2 组件结构

```
OptionsPanel
├── 工具栏（改造，见 §4.5）
└── 组列表（一个滚动容器，`OptionsPanel` 直接管理）
    ├── OptionChainGroup × N
    │     ├── 组头（红粗 datum；单击切换折叠）
    │     └── （展开时）到期日切换条（最早到期默认） + 迷你 TQuoteTable
```

**合成标底 `syntheticUnderlyingContract(underlyingInstrID): ContractInfo`**（新增于 `modules/market/sort.ts`）：
- `instrumentID = underlyingInstrID`、`productClass: '1'`（走现有 buildRecord 的 underlying 分支 → 红粗合并行渲染复用）、`isTrading: 0`（不可交易 → 不可下单）、`productID = deriveUnderlyingProduct(underlyingInstrID)`、`instrumentName = getProductName(productID)`。

**`OptionChainGroup`（新组件，`modules/options/OptionChainGroup.tsx`）**：
- props：`{ underlyingID: string; group: OptionGroup; onSelectContract: (instrumentID, price) => void }`。
- 内部状态：`expanded`、`chains: OptionChain[]`（`getOptionChains(underlyingID)` 首次展开时拉取并缓存于组件）、`activeExpireDate`（默认最早到期）。
- 组头：`instrumentID`（真实标底 = 期货代码；合成 = 系列代码，如 `MO2608`）+ 品种中文名 + 到期数/到期月提示；红粗样式沿用 `QuoteTable` 的 `UNDERLYING_HEADER_STYLE` 语义但由本组件自己渲染（独立于 vtable）。
- 组头附带一个「⇗ 新窗」小按钮调 `openTQuoteFloating(underlyingID)`：保留原「打开 T型报价」悬浮窗能力，不依赖右键菜单。

**`TQuoteTable`（改造，`modules/options/TQuoteTable.tsx`）**：
- 新增可选 `onRowClick?: (instrumentID: string, price: number) => void`。
- `TQuoteRow` 增加 `callInstrumentID` / `putInstrumentID`（由链 contract 填充），供点击事件取到具体 C/P 合约。
- 行记录合并逻辑（strike → call|put）不变；某侧缺失时该单元格仍 `--`，点击仅对存在的侧回退。
- `onRowClick` 未传时行为完全不变（`TQuoteView` 悬浮窗不受影响）。
- 「行权价」中列不触发 `onRowClick`（非合约）。

### 4.3 交互

| 元素 | 单击 | 双击 | 右键 |
|------|------|------|------|
| 组头 | 折叠/展开切换 | 无 | 无（「新窗」按钮独立承载原 T型入口） |
| 到期日 tabs | 切到期链 | — | — |
| T 表 C/P 行 | 选中 + 最新价回填报单表（`usePointOrder.onOrder` 语义），**不开弹窗** | 无 | 无 |
| 行权价列 | 无 | 无 | 无 |

- 单击回填对标平铺期权的 `onOrder`：`setSelectedInstrument` + `setOrderInstrument` +（非期货时）`setOrderForm({ limitPrice })`。指数合成组头不可点击下单。
- 不做跨表多选/拖选；不做收藏 ⭐（P2 提供系列收藏）。
- 搜索/筛选**只控制组可见性**，不自动展开；但搜索下拉/高级搜索**选中某个合约时** → 展开其所在组并滚动定位（用户显式选择才展开）。

### 4.4 订阅与性能

- 展开某组 → `getOptionChains(underlyingID)`（组件内 Map 缓存）→ 取 `activeExpireDate` 链 → 对链内 C/P 合约 `addLockedContract(id)` + `getSnapshots(ids)` 预拉快照；折叠/切到期/卸载 → `removeLockedContract(id)`。复用 `TQuoteView.tsx:160-181` 的锁定/解锁 + 订阅管理器宽限期优雅退订模式。
- 指数标底（合成组头）**永不订阅**任何 id。
- 折叠态 = 零 vtable、零订阅（组内 T 表不挂载）。
- 本次不做跨组虚拟化；若实测多组并发展开导致订阅打满（`market_service.MAX_SUBSCRIPTIONS`），后续加「并发展开组数上限」。

### 4.5 工具栏改造

| 控件 | 现状语义 | 新语义 |
|------|---------|--------|
| `ContractFilter` | 过滤期权合约行 | 过滤「组」（粒度 = 标底合约的 exchangeID + 标底品种） |
| `ContractSearch` | 过滤行 + 选择定位合约 | 过滤组（标底代码/品种中文名）；命中仅组可见 |
| ⭐ 收藏按钮 | 对 selectedInstrument 批量收藏 | **P1 移除**（P2 恢复为组头系列收藏） |
| 🔍 高级搜索 | 跨页定位合约 | 选中合约 → 展开其所在组并滚动定位（若未展开） |
| 搜索计数 | `rows.length` | 命中组数 |

## 5. P2 系列收藏

### 5.1 数据模型（`stores/collections.ts`）

- `Collection` 增加 `seriesIDs: string[]`（与 `instrumentIDs` 并存，向后兼容既有单合约收藏）。
- store 新增：
  - `addSeriesToCollections(seriesIDs: string[], collectionIds: string[])`
  - `removeSeriesFromCollection(seriesID, collectionId)`
  - `removeSeriesFromAllCollections(seriesIDs)`
  - `unionSerializedIds(collections): Set<string>`（组头 ⭐ 填充态）
- 持久化：`seriesIDs` 随 `persist()` 一并写入 localStorage（现有 `persist`/`loadFromLocalStorage` 机制不变）。
- `loadCollections` 对 `seriesIDs` 的存在性校验：不改用 `getInstrumentsByIds`（series 非合约），改为「存在任一 `productClass in ('2','6')` 且 `underlyingInstrID === series` 的合约」；实现时若 contracts 未加载完成则先保留（不误删），待加载后再校验。

### 5.2 组头 ⭐ 系列收藏（P1 之后的 OptionsPanel 增量）

- 组头右侧 ⭐：切换该 series 是否已收藏（`favoritedSeriesIds.has(underlyingID)`）。
- 复用 `CollectionPicker` 弹选夹面板，但提交的是 **series**（需 `CollectionPicker` 增加 series 模式）。

### 5.3 收藏夹页（`CollectionPage`）

- 渲染 `collection.seriesIDs` 为**堆叠 T 型组**（复用 `OptionChainGroup`，可直接交互）。
- 渲染 `collection.instrumentIDs` 保持现有单合约展示（含期货/期权合同行）。
- 两段并存：有 series → series 段在前；有 contract → 原契约段在后。
- `CollectionsPage`（所有夹的列表页）不展示明细，不受影响。

## 6. 测试策略（TDD）

**P1**
- `sort.test`：`syntheticUnderlyingContract` 字段断言。
- 新 `OptionsPanel.test`：
  - 默认全部折叠（组头可见、无 vtable 挂载）；
  - 点击组头展开 → 渲染 T 表、`addLockedContract` 被调、`getSnapshots` 被调；
  - 折叠 → `removeLockedContract` 被调；
  - 到期切换 → 链切换 + 锁更新；
  - 搜索/筛选 → 组可见性变化、`ContractSearch` 语义为过滤组；
  - T 行单击 → 回填报单表（onOrder）、不开弹窗；行权价/组头不触发；
  - 指数组合成组头出现 + 不订阅任何 id；
  - `TQuoteTable` 未传 `onRowClick` 时空跑（回归：TQuoteView 不变）。
- `TQuoteTable.test`：带 `onRowClick` 时点击 C/P 侧回退对应合约；中列不回调。

**P2**
- `collections.test`：`seriesIDs` 增删/持久化/并集/存在性校验（空夹守卫、series 校验逻辑）。
- `CollectionPage.test`：series 段渲染为 T 型组（可展开/可切到期）、与 contract 段并存、双段过滤计数。

## 7. 后续（明确不在本次范围）

- 指数期权实时指数行情 + IV/内在价值/时间价值/希腊字母：需先 spike 确认 SimNow 是否有指数行情源；若无则需外部指数源，作为独立项目评估。
- 收藏夹 series 段的订阅上限、跨组虚拟化。
- 平铺期权表彻底删除：P1 起 OptionsPanel 不再平铺；`futuresSpec`/平铺相关交互代码在 P1 内评估清理范围（仅删期权页分支，不动 `MarketPanel` 期货平铺）。