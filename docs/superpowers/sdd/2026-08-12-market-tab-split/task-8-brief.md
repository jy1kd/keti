### Task 8: 搜索栏重构（功能靠左、搜索贴右）+ 期权页搜索定位

**Files:**
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（工具行重排：左功能集群 + 右搜索）
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（同布局 + 搜索定位到标底分组）
- Modify: `frontend/src/modules/market/styles.css`（`market-toolbar__search` 加 `margin-left:auto`）
- Test: `frontend/src/modules/market/MarketPanel.test.tsx`、`frontend/src/modules/options/OptionsPanel.test.tsx`

**Interfaces:**
- Consumes: `ContractSearch`、`InstrumentSearchModal`、`useMarketFilterStore`、`groupOptionsByUnderlying`。
- Produces: 两页工具行布局「[全部|自选] [筛选] [仅交易中] [收藏] …(弹性)… [搜索框][🔍]」；期权页搜索选中期权合约时定位到其标底分组。

- [ ] **Step 1: 写失败测试**

`MarketPanel.test.tsx` 追加布局断言（用 `data-testid` 或顺序断言）：搜索框（`placeholder="搜索合约..."`）在 DOM 中位于收藏按钮之后；`筛选` 按钮位于「全部/自选」之后、「仅交易中」之前。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/MarketPanel.test.tsx`
Expected: FAIL（当前搜索在中间）

- [ ] **Step 3: 重排工具行 + CSS**

`MarketPanel.tsx` 工具行 JSX 顺序改为：`market-toolbar__tabs`（全部/自选）→ `ContractFilter` → `market-toolbar__actions`（仅交易中 + 收藏）→ `market-toolbar__search`（ContractSearch + 🔍 + 计数）。`styles.css` 的 `.market-toolbar__search` 加 `margin-left: auto;`（吃掉中间空间，把搜索推右）。

- [ ] **Step 4: 期权页搜索定位**

`OptionsPanel.tsx` 列表视图：搜索框作用域=当前期权列表（标底 `instrumentID` + 期权 `instrumentID` + `getProductName` 中文名）；选中时若命中期权合约，找到其 `underlyingInstrID` 所在分组首行 `instrumentID`，`setSelectedInstrument(underlyingID)` 并 `setSelectedContracts(new Set([underlyingID]))`（复用 futures 页 `handleSelectContract` 语义，锚点跳转）。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: 全量回归 + 提交**

Run: `cd frontend && npm test && npm run build`
Expected: 全绿 + 构建通过

```bash
git add frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionsPanel.test.tsx frontend/src/modules/market/styles.css
git commit -m "feat(market): 搜索栏重构（功能靠左、搜索贴右）+ 期权页搜索定位标底分组"
```

---

## Self-Review 记录

- **Spec 覆盖**：标签页改造→Task 2/6；表格泛化→Task 5/6；多选筛选→Task 7；排序→Task 1；搜索栏重构→Task 8；菜单改名→Task 3；订阅架构→Task 4。全部覆盖。
- **类型一致性**：`QuoteTableSpec`/`QuoteRecord`/`ColumnDef` 在 Task 5 定义、Task 6 复用；`sortFutures`/`groupOptionsByUnderlying`/`deriveUnderlyingProduct` 在 Task 1 定义、Task 6/7 复用；`MarketFilter`/`filterByExchangeAndProduct` 在 Task 7 定义、Task 8 复用。字段名一致。
- **范围**：单一实现计划，8 个任务各自可独立提交且测试绿。
