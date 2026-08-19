# Final Fix Report — 行情表拆分期货/期权双标签 全分支审查修复

- **日期**: 2026-08-13
- **分支**: `feature/md-refactor`
- **状态**: DONE

---

## 1. Status

**DONE** — 全部 10 项审查发现（Critical #1、Important #2/#3/#4、Cheap minors #6/#8/#9/#10）已修复；全量前端测试 1232 通过、`npm run build` 通过、`npx tsc --noEmit` 零错误；已提交一个 commit。

## 2. Commits made

| Commit | 说明 |
|--------|------|
| `1a6f7bc` fix(market): 全分支审查修复（订阅防覆盖/自选排序/筛选校验/共享菜单/单次setFilter/App守卫） | 12 文件，+452/−269。结尾含 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` |

未 push、未 merge。

## 3. Per-finding fixes

### Critical #1 — 期货表无 isActive 接线 → 跨标签订阅被覆盖

根因：`TabContent` 同时挂载所有面板（`display:none` 隐藏不活跃面板），期货 `QuoteTable`（MarketPanel）与期权 `QuoteTable`（OptionsPanel）同时向单一 `visibleInstrumentIDs` 上报；`useSubscriptionManager` 以可见区为权威。MarketPanel 未传 `isActive`，且隐藏面板挂载时的 `setTimeout(notifyVisibleRange,0)` 会在启动时覆盖活跃面板可见区；切回期货时期货表不重报 → 10s 宽限期内被退订、表冻结。

修复（三部分）：

1. **接线 isActive**
   - `frontend/src/modules/market/MarketPanel.tsx:37`：`const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'market' && t.id === s.activeTabId))`，并在 `:229` 传给 `<QuoteTable isActive={isActive} … />`（镜像 OptionsPanel 的写法）。
   - `frontend/src/pages/FavoritesPage.tsx:28` + `:78`：FavoritesPage 也渲染 QuoteTable，同样接入 isActive（`type === 'favorites'`）。它未接 `onVisibleRangeChange`，属防御性接线。
2. **挂载重报按 isActive 门控**
   - `frontend/src/modules/market/QuoteTable.tsx:55` 新增 `isActiveRef`（`:79` effect 保持最新）。
   - `QuoteTable.tsx:114-118` 新增 `scheduleVisibleRangeReport`：`isActiveRef.current === false` 时跳过。语义上 `undefined`（未显式传 isActive 的历史调用方/既有测试）仍按原行为上报，只有显式 `isActive={false}` 的隐藏面板被门控——避免破坏既有消费者。
   - 两处构建后延迟上报改用该 helper：`:393`（初始渲染）与 `:439`（contracts/favoritedIds 重建后）。`isActive` 翻转 effect（`:522`）保留，激活时立即补报。
3. **回归测试**
   - `frontend/src/modules/market/QuoteTable.test.tsx:793`：`isActive={false}` 挂载并推进 fake timers → `onVisibleRangeChange` **不被**调用；`isActive` 翻转为 `true` → 被调用且上报活跃合约 ID 列表。
   - `frontend/src/modules/options/OptionsPanel.test.tsx:190`：期权标签隐藏（期货激活）时 OptionsPanel 挂载不上报，`visibleInstrumentIDs` 保持空（防止覆盖期货可见范围）。
   - 同步更新 `OptionsPanel.test.tsx:171` 可见区上报用例：显式置 `activeTabId:'tab-options'` 使期权面板为激活态再断言上报（此前依赖默认标签态隐含“挂载即上报”，与修复后的隐藏面板行为冲突）；`beforeEach` 现重置双固定标签，保证用例顺序无关。

### Important #2 — 期货自选视图未排序

- `frontend/src/modules/market/MarketPanel.tsx:48-51`：`favoriteFutures`（裸 `favorites.filter(...)`）改为 `sortedFavorites = sortFutures(favorites.filter((c) => c.productClass === '1'))`，`:55` baseContracts 改用 `sortedFavorites`。spec 决策 3 的排序现在作用于全部/自选两种基础集。
- 测试 `frontend/src/modules/market/MarketPanel.test.tsx:512`：自选视图输入无序收藏（CZCE-FG610、SHFE-cu2609、CZCE-FG609）→ 断言表格记录为 `['cu2609','FG609','FG610']`（交易所→品种→月份）。

### Important #3 + #8 — marketFilter.load 形状校验 + EMPTY_FILTER 复用

`frontend/src/stores/marketFilter.ts`：
- `:21-28` 新增 `isValidFilter`：筛选态必须为对象且 `exchanges`/`products` 均为数组。
- `load()`（`:58-67`）：`JSON.parse` 后逐页 `isValidFilter` 校验，不合法回退 `EMPTY_FILTER`；`{futures:5}`、`{futures:{exchanges:'x'}}` 等“合法 JSON 但形状损坏”不再让 `filter.exchanges.length` 抛错。
- `reset`（`:54`）、初始态（`:31-32`）与 load 兜底（`:64-65`）统一复用 `filter.ts` 导出的 `EMPTY_FILTER`，不再内联 `{ exchanges: [], products: [] }`。
- 测试 `frontend/src/stores/marketFilter.test.ts:92`：`{futures:5, options:null}` 与 `{futures:{exchanges:'x',products:[]}}` 均回退默认且不抛错，另一页正常恢复。

### Important #4 — 抽取共享 useContractMenus

新建 `frontend/src/hooks/useContractMenus.tsx`（`.tsx` 因内含 JSX；esbuild 对 `.ts` 不支持 JSX）。
- 入参：`contextMenu`/`multiSelectMenu` 状态、`favoritedIds`、`contracts`、`addToFavorites`/`removeFromFavorites`、`openOrderPopup`/`openQueryPopup`/`openKlineTab`/`openOrderTabs`/`openKlineTabs`/`closeMenus`。
- 返回：`singleMenu`（单选右键菜单 JSX）、`multiMenu`（多选右键菜单 JSX）、`batchToggleFavorite(selectedInstrument, selectedContracts)`（工具栏收藏按钮：多选批量收藏/取消 + 单选切换）、`favoriteButtonLabel(selectedInstrument, selectedContracts)`（按钮文案）。
- 两面板消费：
  - `frontend/src/modules/market/MarketPanel.tsx:100-114`（调用）、`:199`/`:201`（工具栏按钮）、`:263-264`（渲染 `{singleMenu}{multiMenu}`）。删除原 `:286-365` 内联菜单与 `:179-225` 批量收藏 handler（约 150 行）。
  - `frontend/src/modules/options/OptionsPanel.tsx:113-127`（调用）、`:221`/`:223`（工具栏按钮）、`:291-292`（渲染）。删除原 `:315-395` 内联菜单与 `:205-248` handler。
- 行为完全一致（菜单项、disabled、计数 toast 文案逐字保留）。两面板原测试（右键菜单/收藏列/批量收藏）全绿，无需改动用例。

### Cheap minor #6 — 单一 setFilter 动作

`frontend/src/stores/marketFilter.ts:45-52`：新增 `setFilter(page, filter)`，一次 `set` 同时写入 `exchanges`+`products`（订阅式持久化 → 单次 localStorage 写）。`setExchanges`/`setProducts` 保留（store 自测仍在用）。
- `MarketPanel.tsx:186` 与 `OptionsPanel.tsx:207` 的 `ContractFilter onChange` 改为 `useMarketFilterStore.getState().setFilter(page, v)`。
- 测试 `frontend/src/stores/marketFilter.test.ts:85`。

### Cheap minor #9 — App 启动 effect 守卫

`frontend/src/App.tsx:31` 新增 `startupLoadedRef = useRef(false)`，启动 effect（`:49-58`）首次执行后置位，StrictMode 开发双挂载不再重复 `loadAllInstruments`/`loadFavoriteContracts`/`load()`。用 `useRef` 而非模块级变量：`App.test.tsx` 在同一文件多次 `render(<App />)`，每次渲染需重新触发加载（用例断言 `calledTimes(1)`），模块级守卫会破坏该断言，`useRef` 每次渲染重置。

### Cheap minor #10 — 排序组内首维用例

`frontend/src/modules/market/sort.test.ts:68`：同标底、同类型、同行权价，仅 `expireDate` 不同 → 先到期在前（覆盖首比较维）。`:78`：同标底、同到期日，`C 前 P 后、行权价升序`（覆盖次/末比较维）。

## 4. Test result one-liner

`cd frontend && npm test` → **106 个测试文件、1232 用例全部通过**；`npm run build`（tsc && vite build）通过；`npx tsc --noEmit` 退出码 0。

## 5. Concerns

1. **`=== false` 门控 vs `!isActive`**：门控采用“仅显式 `isActive={false}` 的隐藏面板跳过上报”，`undefined`（未传 prop 的历史调用方，如既有 QuoteTable 测试）保持原“挂载即上报”行为。当前生产消费者（MarketPanel/OptionsPanel/FavoritesPage）均显式传值，无行为回归；但若未来新调用方不传 isActive 又在 TabContent 中隐藏渲染，仍会覆盖可见区。建议后续将 `isActive` 设为必传 prop。
2. **激活重报时序**：`isActive` 翻转 effect（`QuoteTable.tsx:522`）在激活提交时同步调用 `notifyVisibleRange`，依赖 vtable 对刚变为可见的容器能返回正确可见区。此为既有行为（OptionsPanel 原样使用），未改动；若极端时序下 `getBodyVisibleCellRange` 返回空，后续滚动/合约变更会兜底重报。
3. **浮动窗兜底边缘**：`TabContent` 的 `effectiveActiveId` 在活跃标签浮动时回退到 market 标签并显示 MarketPanel，但 MarketPanel 的 `isActive` 基于裸 `activeTabId` 计算（`type==='market' && id===activeTabId`），此时可能为 `false` 而不上报。此为 `TabContent` 浮动兜底路径的既有语义，OptionsPanel 同样如此，本次未引入新回归；订阅仍靠 10s 宽限期维持。
4. **文件扩展名**：共享 hook 为 `useContractMenus.tsx`（含 JSX），与 finding 建议的 `.ts` 略异，属必要（JSX 需 `.tsx`）；import 无扩展名，调用方无感。
