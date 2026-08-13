# 行情表拆分 v2（标底合并行 / T型报价独立悬浮标签 / 筛选交叉过滤）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首版「期货/期权双标签 + 排序 + 多选筛选 + 搜索栏重构」的 v2 迭代：期权列表标底行改为合并表头行（标红加粗大字）；T型报价从期权页二级视图拆为独立悬浮标签页（可开多个、去 IV、下拉排序、入口多处）；筛选交易所/品种双向交叉联动。

**Architecture:** 标底行用 vtable `mergeCells(0,row,endCol,row)` 整行合并（v1.26 支持），`optionsSpec` 标底行 `buildRecord` 只留 `instrumentID`+`kind`。T型报价新增 `'tquote'` tab 类型，`TQuoteView` 自包含化（本地 state 存链/波动率/标的/到期日，直连 API，删除独占的 `useOptionsStore`），经 `openFloatingTab` 打开即悬浮；多实例按标底去重。筛选交叉用纯函数 `computeFilterOptions` 派生双向动态列表。

**Tech Stack:** React 18 + TypeScript + Vite；@visactor/vtable 1.26（`mergeCells`）；Zustand；vitest；Electron menu/IPC。

**Spec:** `docs/superpowers/specs/2026-08-12-market-tab-split-design.md`（§7 v2 章节）

## Global Constraints

- 分支 `feature/md-refactor`；前端 `frontend/src` + `frontend/electron`，无后端改动。
- 标底行（`kind==='underlying'`）：只显示标底代码，**标红、加粗、字号加大**（约 14px），整行合并；单击仍选中该期货（金色锚点）；双击/右键 → 打开该标底 T型报价悬浮标签。
- T型报价 `'tquote'` tab：`TabContent` 渲染 `TQuoteView`（`props.instrumentID` 预选标底）；打开即 `openFloatingTab` 悬浮；多实例按 `instrumentID` 去重（`tab-tquote-<标底>` 各一 + 一个空白通用实例 `tab-tquote`）；浮动窗支持放大/最小化/拖拽（复用 FloatingWindow）。
- T型报价入口：顶部菜单「行情」加「📉 T型报价」（`open-floating tab:'tquote'`）打开空白悬浮标签；期权列表双击/右键标底行打开预选悬浮标签。
- `TQuoteView`：删除 `useOptionsStore` 依赖（该 store 仅 TQuoteView 使用，删除 store.ts + store.test.ts），改本地 state + 直连 `getOptionChains`/`getVolatility`/`getOptionUnderlyings`；标的搜索下拉**排序**（字典序）；`TQuoteTable` **去掉 IV（隐含波动率）列**（callIV/putIV 及相关 prop 移除）。
- OptionsPanel **移除 `[列表|T型报价]` 切换**，期权标签页只显示分组列表。
- 筛选交叉：`computeFilterOptions(contracts, exchanges, products, getProduct)` → 可选交易所 = 有合约满足已选品种；可选品种 = 有合约满足已选交易所；期货页按 `productID`、期权页按标底品种派生；`ContractFilter` 用动态列表。
- 全量前端测试 + `npm run build` + `npx tsc --noEmit` 必须通过；既有 1232 测试不得回归。
- 测试命令：单文件 `cd frontend && npx vitest run <相对路径>`；全量 `cd frontend && npm test`。
- 每次提交结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

### Task 1: 期权列表标底行 → 合并表头行（标红加粗大字）

**Files:**
- Modify: `frontend/src/modules/market/optionsSpec.ts`（标底行 `buildRecord` 精简为只留名称）
- Modify: `frontend/src/modules/market/QuoteTable.tsx`（`mergeCells` 合并标底行 + 合约列样式标红加粗大字）
- Modify: `frontend/src/modules/market/quoteTableCore.ts`（若需要导出合并用常量）
- Test: `frontend/src/modules/market/optionsSpec.test.ts`、`frontend/src/modules/market/QuoteTable.test.tsx`

**Interfaces:**
- Consumes: `QuoteTableSpec`/`QuoteRecord`/`kind`（quoteTableCore）。
- Produces: 标底行记录只含 `instrumentID`/`kind`/`contractType:'标'`，其余行情字段为空/占位；`QuoteTable` 渲染后对 `kind==='underlying'` 行执行 `mergeCells(0, row, colCount-1, row)`；合约列对 underlying 行返回 `{ color:'#f87171', fontWeight:'bold', fontSize:14 }`（整行合并后该样式作用于合并单元格）。

- [ ] **Step 1: 写失败测试**

`frontend/src/modules/market/optionsSpec.test.ts` 追加：

```ts
it('标底行记录只含名称与 kind，行情字段置空', () => {
  const r = optionsSpec.buildRecord(fut /* productClass '1' FG609 */, undefined, false)
  expect(r.kind).toBe('underlying')
  expect(r.instrumentID).toBe('FG609')
  expect(r.contractType).toBe('标')
  // 不再填充行情数据字段（整行合并后只显示名称）
  expect(r.lastPrice).toBeUndefined()
  expect(r.change).toBeUndefined()
  expect(r.bidPrice1).toBeUndefined()
})
```

`QuoteTable.test.tsx` 追加（断言 underlying 行被合并 + 合约列样式）：mock vtable 实例后，构造含 `kind:'underlying'` 的 spec/records，断言 `mockInstance.mergeCells` 被以 `(0, rowIndex, colCount-1, rowIndex)` 调用，且渲染的合约列样式回调对 underlying 行返回红/粗/大字号。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/optionsSpec.test.ts src/modules/market/QuoteTable.test.tsx`
Expected: FAIL（标底行仍带行情字段 / 未 mergeCells）

- [ ] **Step 3: 精简 optionsSpec 标底行**

`frontend/src/modules/market/optionsSpec.ts` 的 `buildRecord`：当 `kind === 'underlying'` 时返回 `{ instrumentID, kind, contractType: '标' }`（不填 lastPrice/change/bid/ask/volume/openInterest/expireDate/exchangeID/status/favorite），其余字段缺省（vtable 渲染为空）。期权行逻辑不变。

- [ ] **Step 4: QuoteTable 合并标底行 + 样式**

`frontend/src/modules/market/QuoteTable.tsx`：
- 新增 `applyRowMerges()`（在 `setRecords` 之后、以及 records 重建 effect 内调用）：遍历 `recordsRef.current`，对 `record.kind === 'underlying'` 的行 `table.mergeCells(0, rowIndex + 1, spec.columns.length - 1, rowIndex + 1)`（vtable 行号 0=表头，+1 偏移；注意先清理旧合并或按数据重建）。合并时机在 setRecords 渲染后（`requestAnimationFrame` 兜底）。
- 合约列样式：在 `spec.columns` 中「合约」列（`field==='instrumentID'`）若带 style 回调则叠加：对 `record.kind==='underlying'` 返回 `{ color:'#f87171', fontWeight:'bold', fontSize:14 }`（比默认 12 加大）。实现时可在 QuoteTable 内统一为合约列包一层：`const mergedStyle = (args) => kind==='underlying' ? redBoldLarge : (原style?.(args))`。
- 确保 `click_cell`/`contextmenu_cell`/`dblclick` 在合并单元格上仍解析出正确行（vtable 合并单元格的 row 索引指向被合并首行，天然正确）。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/optionsSpec.test.ts src/modules/market/QuoteTable.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/modules/market/optionsSpec.ts frontend/src/modules/market/QuoteTable.tsx frontend/src/modules/market/optionsSpec.test.ts frontend/src/modules/market/QuoteTable.test.tsx
git commit -m "feat(options): 期权列表标底行改为合并表头行（标红加粗大字，不显行情）"
```

---

### Task 2: T型报价 → 独立悬浮标签页（多实例自包含）

**Files:**
- Modify: `frontend/src/stores/tabs.ts`（`TabType` 加 `'tquote'`）
- Modify: `frontend/src/components/TabContent/index.tsx`（`case 'tquote'` 渲染 `TQuoteView`，传 `props.instrumentID`）
- Modify: `frontend/src/utils/openFloatingTab.ts`（加 `openTQuoteFloating(underlyingID?)`）
- Modify: `frontend/src/modules/options/TQuoteView.tsx`（自包含化 + 标的下拉排序 + `instrumentID` 预选）
- Modify: `frontend/src/modules/options/TQuoteTable.tsx`（去 IV 列）
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（移除 `[列表|T型报价]` 切换；双击/右键标底行 → openTQuoteFloating）
- Modify: `frontend/electron/menuTemplate.ts`（行情子菜单加「📉 T型报价」；`FloatingTab` 类型加 `'tquote'`）
- Modify: `frontend/electron/menuActions.ts`（`open-floating` 透传即可，确认无白名单）
- Modify: `frontend/src/App.tsx`（`onOpenFloatingTab` switch 加 `case 'tquote'`）
- Modify: `frontend/src/services/electron.ts`（`onOpenFloatingTab` 回调类型加 `'tquote'`）
- Modify: `frontend/electron/preload.ts`（类型/注释同步）
- Delete: `frontend/src/modules/options/store.ts`、`frontend/src/modules/options/store.test.ts`（TQuoteView 自包含后独占 store 成死代码）
- Test: `frontend/src/modules/options/OptionsPanel.test.tsx`、`frontend/src/modules/options/TQuoteView.test.tsx`、`frontend/src/components/TabContent/index.test.tsx`、`frontend/src/App.test.tsx`、`frontend/electron/__tests__/menuTemplate.test.ts`

**Interfaces:**
- Consumes: `openFloatingTab`（openFloatingTab.ts）、`generateTabId`、`useContractContextMenu`。
- Produces: `openTQuoteFloating(underlyingID?: string): boolean`（空白或预选悬浮）；`TQuoteView` 组件签名 `{ instrumentID?: string }`；tab id `tab-tquote` / `tab-tquote-<标底>`。

- [ ] **Step 1: 写失败测试**

`OptionsPanel.test.tsx` 追加：断言「列表」视图仍在（默认）；断言不再渲染 `[T型报价]` 切换按钮（`getByText('T型报价')` 在工具行不存在——注意区分右键菜单文案）；双击标底行 → `openTQuoteFloating` 被调用（mock 该函数，断言收到标底 instrumentID）；右键标底行 → 弹「打开T型报价」菜单（仅此项）。

`TabContent/index.test.tsx` 追加：`type:'tquote'` 渲染 `TQuoteView`（mock 组件断言收到 `instrumentID` prop）。

`App.test.tsx` 追加：`onOpenFloatingTab('tquote')` → `openTQuoteFloating` 被调用。

`frontend/electron/__tests__/menuTemplate.test.ts` 追加：行情子菜单含「📉 T型报价」。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/options/OptionsPanel.test.tsx src/components/TabContent/index.test.tsx src/App.test.tsx electron/__tests__/menuTemplate.test.ts`
Expected: FAIL（切换仍在 / tquote 未渲染 / 菜单无项）

- [ ] **Step 3: tabs 类型 + TabContent + openFloatingTab**

`frontend/src/stores/tabs.ts`：`TabType` 加 `'tquote'`；`TAB_TYPES` 加 `'tquote'`。`TabContent/index.tsx`：`case 'tquote'` → `<TQuoteView instrumentID={getInstrumentID(tab.props)} />`（import TQuoteView）。`openFloatingTab.ts`：

```ts
/** 打开 T型报价悬浮窗：传 underlyingID 则预选该标底，否则空白（窗内自选） */
export function openTQuoteFloating(underlyingID?: string): boolean {
  return openFloatingTab({
    type: 'tquote',
    title: underlyingID ? `📉 T型报价-${underlyingID}` : '📉 T型报价',
    props: underlyingID ? { instrumentID: underlyingID } : {},
    size: { w: 900, h: 600 },
  })
}
```

- [ ] **Step 4: TQuoteView 自包含化 + 排序 + 预选 + 去 IV**

`frontend/src/modules/options/TQuoteView.tsx` 重构：
- 签名 `{ instrumentID?: string }`。
- **自包含**：本地 `useState` 保存 `optionChains`/`volatility`/`selectedUnderlying`/`selectedExpireDate`/`loading`/`error`；`fetchOptionChains`/`fetchVolatility` 改为直连 `getOptionChains`/`getVolatility`（`@/services/api`）；`expirations` 本地由 `optionChains` 派生；删除对 `useOptionsStore` 的 import 与 `availableExpirations()` 使用。删除 `frontend/src/modules/options/store.ts` + `store.test.ts`（确认无其他引用——已核实仅 TQuoteView 使用）。
- **预选**：mount 时若 `props.instrumentID` 存在 → `selectUnderlying(instrumentID)`（自动加载链）；`useEffect` 依赖 `props.instrumentID`。
- **排序**：`availableUnderlyings` 设值前 `[...underlyings].sort()`；`filteredUnderlyings` 也按字典序。
- `TQuoteTable.tsx`：删除 callIV/putIV 列与相关 `volatility` prop 使用（列头去掉「隐含波动率」；`TQuoteTable` 不再接收 `volatility`）。若 `volatility` prop 仍被其它逻辑引用，一并清理。

- [ ] **Step 5: OptionsPanel 移除切换 + 标底行入口**

`frontend/src/modules/options/OptionsPanel.tsx`：
- 删除 `view` state、`market-toolbar__mode` 按钮块、`view === 'tquote' ? <TQuoteView/> : ...` 条件分支（始终渲染列表 `QuoteTable`）；工具行直接是列表集群（全部/自选 → 筛选 → 仅交易中 → 收藏 → 搜索）。
- **双击标底行**：新增 `handleRowDoubleClick(instrumentID, price)` —— 查 `contracts`，若该合约 `productClass === '1'`（标底期货）→ `openTQuoteFloating(instrumentID)`；否则走原 `handleDoubleClick`（期权行开报单弹窗）。传给 `QuoteTable.onRowDoubleClick`。
- **右键标底行**：新增本地 `underlyingMenu` state；`handleRowContextMenu(instrumentID, price, event)` —— 查合约，若标底 → `setUnderlyingMenu({ instrumentID, x, y })`（渲染仅「打开T型报价」的 `ContextMenu`，onClick → `openTQuoteFloating(instrumentID)` + close）；否则走原 `handleContextMenu`。传给 `QuoteTable.onContextMenu`。
- 保留 `useContractContextMenu` 的多选菜单（期权行多选仍用 `handleMultiSelectContextMenu`）。

- [ ] **Step 6: 顶部菜单 + IPC**

`frontend/electron/menuTemplate.ts`：`FloatingTab` 类型加 `'tquote'`；行情子菜单 `⭐ 自选行情` 后加 `{ id:'market-tquote', label:'📉 T型报价', action:{ type:'open-floating', tab:'tquote' } }`（在分隔符前）。`frontend/src/App.tsx` `onOpenFloatingTab` switch 加 `case 'tquote': openTQuoteFloating(); break`（import openTQuoteFloating）。`frontend/src/services/electron.ts` 与 `frontend/electron/preload.ts` 的 `onOpenFloatingTab` 回调类型加 `'tquote'`。`menuActions.ts` 无需改（`open-floating` 已透传 tab）。

- [ ] **Step 7: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/options/OptionsPanel.test.tsx src/modules/options/TQuoteView.test.tsx src/components/TabContent/index.test.tsx src/App.test.tsx electron/__tests__/menuTemplate.test.ts electron/__tests__/menuManager.test.ts`
Expected: PASS（删 store 后 `store.test.ts` 一并删，无孤儿引用）

- [ ] **Step 8: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/ frontend/src/utils/openFloatingTab.ts frontend/src/modules/options/ frontend/electron/menuTemplate.ts frontend/electron/menuActions.ts frontend/src/App.tsx frontend/src/services/electron.ts frontend/electron/preload.ts frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuManager.test.ts
git rm frontend/src/modules/options/store.ts frontend/src/modules/options/store.test.ts
git commit -m "feat(options): T型报价独立为悬浮标签页（多实例自包含，去IV，下拉排序，多入口）"
```

---

### Task 3: 筛选交叉过滤（交易所↔品种双向联动）

**Files:**
- Modify: `frontend/src/modules/market/filter.ts`（加 `computeFilterOptions`）
- Modify: `frontend/src/components/ContractFilter/index.tsx`（用动态列表替换静态传入）
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（期货页传全量合约供交叉计算）
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（期权页传全量合约供交叉计算，按标底品种）
- Test: `frontend/src/modules/market/filter.test.ts`、`frontend/src/components/ContractFilter/index.test.tsx`

**Interfaces:**
- Consumes: `MarketFilter`/`filterByExchangeAndProduct`（filter.ts）。
- Produces: `computeFilterOptions(contracts, exchanges, products, getProduct) → { exchanges: string[]; products: string[] }`：`exchanges` = 有合约满足「products(或空)」的交易所；`products` = 有合约满足「exchanges(或空)」的品种。`ContractFilter` 增加可选 props 或在组件内接收全量契约与 getProduct 自行计算。

- [ ] **Step 1: 写失败测试**

`frontend/src/modules/market/filter.test.ts` 追加：

```ts
import { computeFilterOptions } from './filter'

describe('computeFilterOptions', () => {
  const list = [
    c('FG609', 'CZCE', 'FG'), c('cu2609', 'SHFE', 'cu'),
    c('MA609', 'CZCE', 'MA'), c('MA610', 'CZCE', 'MA'),
  ]
  it('未选任何筛选时列出全部交易所与品种', () => {
    const r = computeFilterOptions(list, [], [], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE', 'SHFE'])
    expect(r.products).toEqual(['FG', 'cu', 'MA'])
  })
  it('选品种后交易所只剩有该品种的交易所', () => {
    const r = computeFilterOptions(list, [], ['MA'], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE'])
  })
  it('选交易所后品种只剩该所有合约的品种', () => {
    const r = computeFilterOptions(list, ['SHFE'], [], (x) => x.productID)
    expect(r.products).toEqual(['cu'])
  })
  it('已选品种与已选交易所交集（不影响可用项）', () => {
    const r = computeFilterOptions(list, ['CZCE'], ['FG'], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE'])
    expect(r.products).toEqual(['FG', 'MA'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/filter.test.ts`
Expected: FAIL（`computeFilterOptions` 未导出）

- [ ] **Step 3: 实现 computeFilterOptions**

`frontend/src/modules/market/filter.ts`：

```ts
/** 筛选面板动态选项：exchanges = 有合约满足已选品种的交易所；products = 有合约满足已选交易所的品种（空集=不限） */
export function computeFilterOptions(
  contracts: ContractInfo[],
  exchanges: string[],
  products: string[],
  getProduct: (c: ContractInfo) => string,
): { exchanges: string[]; products: string[] } {
  const exSet = exchanges.length ? new Set(exchanges) : null
  const prodSet = products.length ? new Set(products) : null
  // 可选交易所：满足已选品种（若有）的合约所涉及的交易所
  const ex = new Set<string>()
  // 可选品种：满足已选交易所（若有）的合约所涉及的品种
  const prod = new Set<string>()
  for (const c of contracts) {
    if (prodSet && !prodSet.has(getProduct(c))) continue
    ex.add(c.exchangeID)
    if (!exSet || exSet.has(c.exchangeID)) prod.add(getProduct(c))
  }
  return { exchanges: [...ex].sort(), products: [...prod].sort() }
}
```

（注意：`ex` 只累加「品种满足」的合约交易所；`prod` 只累加「交易所满足」的合约品种。）

- [ ] **Step 4: ContractFilter 用动态列表**

`frontend/src/components/ContractFilter/index.tsx`：props 增加 `getProduct: (c: ContractInfo) => string` 与 `allContracts: ContractInfo[]`（或改为接收 `exchanges`/`products` 全量 + 派生函数）；组件内部用 `computeFilterOptions` 计算展示列表。已选项目仍显示在列表中（即使被交叉过滤掉，只要它在已选集合中就要保留勾选显示，避免已选项消失无法取消）——实现时把「已选项并回可用列表」。

- [ ] **Step 5: 两页接入**

`MarketPanel.tsx`：`<ContractFilter allContracts={sortedFutures} getProduct={(c)=>c.productID} .../>`（品种=productID）。`OptionsPanel.tsx`：`<ContractFilter allContracts={options} getProduct={(c)=>deriveUnderlyingProduct(c.underlyingInstrID ?? '')} .../>`（品种=标底品种）。

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/filter.test.ts src/components/ContractFilter/index.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 7: 全量回归 + 提交**

Run: `cd frontend && npm test && npm run build && npx tsc --noEmit`
Expected: 全绿 + 构建/类型通过

```bash
git add frontend/src/modules/market/filter.ts frontend/src/components/ContractFilter/ frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/options/OptionsPanel.tsx
git commit -m "feat(market): 筛选交易所/品种双向交叉联动（computeFilterOptions）"
```

---

## Self-Review 记录

- **Spec 覆盖**：§7.1 标底合并行 → V2-1；§7.2 T型报价独立悬浮标签 → V2-2；§7.3 筛选交叉 → V2-3。全覆盖。
- **类型一致性**：`openTQuoteFloating(underlyingID?)`、`TQuoteView { instrumentID? }`、`'tquote'` tab、`computeFilterOptions` 签名在 V2-1/V2-2/V2-3 各自定义并被消费方引用，字段一致。
- **风险点**：V2-1 的 `mergeCells` 时序（setRecords 后需渲染完成再合并，用 rAF 兜底）；V2-2 的 TQuoteView 自包含化是中等重构（删 store 需确认无孤儿引用，已核实仅 TQuoteView 使用）；V2-2 多实例按 `instrumentID` 去重（`generateTabId` 用 `props.instrumentID`，`tab-tquote-<标底>` 天然成立）。
