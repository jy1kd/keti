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

