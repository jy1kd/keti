# Issue Fix Report — 行情表拆分 v2 运行时问题（feature/md-refactor）

- 日期：2026-08-13
- 状态：DONE
- 提交：`d75d85f`
- 主题：`fix(options): 标底行合并重捕获文本 + T型报价标题随动 + 订阅批次上限`
- 分支：`feature/md-refactor`（仅提交，未 push / 未 merge）

---

## 逐项修复

### Issue A — 期权列表标底行在筛选后滞留旧合约，且可见区计算被陈旧合并范围破坏

- 修复文件：`frontend/src/modules/market/QuoteTable.tsx` — `applyRowMerges`（行 156-182）。
- vtable 证据：`frontend/node_modules/@visactor/vtable/cjs/ListTable.js` 行 1132-1133 — `mergeCells()` 把 `text: this.getCellValue(startCol, startRow)` 存入 `options.customMergeCell`，即**合并单元格文本在合并瞬间捕获**。`setRecords` 重建数据后，旧合并范围若被跳过（原代码 `if (mergedRowsRef.current.has(row)) { next.add(row); continue }`），同一物理行虽是标底但合约已变时仍残留旧 `text`，且陈旧 range 破坏行高/`getBodyVisibleCellRange` 计算。
- 做法：`applyRowMerges` 改为**每次全量撤销再重合并**——先对 `mergedRowsRef` 全部行 `unmergeCells(0, row, lastCol, row)`（含仍为标底的行），再对当前全部 underlying 行 `mergeCells(0, row, lastCol, row)` 让 vtable 重捕获当前记录文本。保留 try/catch + rAF 兜底语义。`mergedRowsRef` 注释同步更新。
- 测试：`frontend/src/modules/market/QuoteTable.test.tsx` 「标底行合并为整行表头」describe 新增用例「筛选/搜索重建后同一物理行仍是标底但合约变化 → 重新 mergeCells 重捕获文本（不再跳过）」：首轮 records `[AD2609, opt]` 断言 `mergeCells(0,1,13,1)`；清空 mock 后 rerender `[MA609, opt]`（物理行 1 仍标底、合约不同），断言 `unmergeCells(0,1,13,1)` **且** `mergeCells(0,1,13,1)` **再次**被调用（旧实现会跳过 → 红）。既有「重建数据行号漂移」用例（断言 unmerge 1 + merge 2）与新实现兼容，未改仍通过；无需要删除的 skip 断言（原实现虽跳过但仍标底行，但此前无对应测试固化该 skip 行为）。
- 验证文本重捕获行为：上述断言即「vtable 在 mergeCells 时捕获 text」的直接回归——若跳过重新 mergeCells，合并单元格无法重捕获 MA609 文本。

### Issue B — T型报价窗内切换标底后悬浮标签标题不随动

- 修复文件：
  - `frontend/src/components/TabContent/index.tsx` 行 55-56：`case 'tquote'` 改为 `<TQuoteView instrumentID={getInstrumentID(tab.props)} tabId={tab.id} />`。
  - `frontend/src/modules/options/TQuoteView.tsx`：props 增加 `tabId?: string`；`selectUnderlying(value)`（行 106-121）在更新本地状态后，`if (tabId)` 时 `useTabStore.getState().updateTab(tabId, { title: value ? \`📉 T型报价-${value}\` : '📉 T型报价', props: value ? { instrumentID: value } : {} })`。`useCallback` 依赖更新为 `[tabId]`。`updateTab` 的 type+instrumentID 去重（该标底已有标签则关闭本标签并激活它）保留——一标底一窗。挂载预选 effect 现会无害地同步一次同名标题。
- 测试：
  - `frontend/src/modules/options/TQuoteView.test.tsx` 新增「窗内切换标底 → updateTab 同步悬浮标签标题与 props（tabId + 新合约）」：`vi.spyOn(useTabStore.getState(), 'updateTab')`，渲染 `<TQuoteView instrumentID="IF2608" tabId="tab-tquote-IF2608" />`，加载链后 `mockClear` 掉挂载预选同步，下拉选 MA609，断言 `updateTab` 收到 `('tab-tquote-IF2608', { title: '📉 T型报价-MA609', props: { instrumentID: 'MA609' } })`。try/finally 还原 spy。
  - `frontend/src/components/TabContent/index.test.tsx`：TQuoteView mock 增捕获 `tabId` 并渲染 `<span data-testid="tquote-tabid">`；「tquote 透传」用例增断言 `tabId === 'tab-tquote-IF2608'`。

### Issue C — 订阅超限：554 个合约整批提交被后端 500 上限原子整批拒绝

- 修复文件：`frontend/src/hooks/useSubscriptionManager.ts` — `runFullDiff`。
- 做法：把原步骤 1 的 `toSubscribe` 改为全量候选 `toSubscribeAll`，**先**算退订集（宽限期过期 + LRU 淘汰）得到 `unsubscribeIds`，再在步骤 3.5 加防御性批次上限：
  ```ts
  const capacity = Math.max(0, SOFT_LIMIT - subscribedRef.current.size + unsubscribeIds.length)
  const toSubscribe = toSubscribeAll.slice(0, capacity)
  const dropped = toSubscribeAll.length - toSubscribe.length
  if (dropped > 0) console.warn(`[行情订阅上限] 可见区合约超前端软上限：本批 ${toSubscribeAll.length} 个，仅订阅前 ${toSubscribe.length} 个，${dropped} 个留待下次 diff`)
  ```
  超出的合约本批不订阅（留待下次 diff 可见区收敛后重试），避免一次性提交 554 被后端整批拒绝。既有「退订先行」串行化路径原样保留。
  - **与任务书字面片段的差异**：任务书给出 `capacity = SOFT_LIMIT - subscribedRef.current.size`（不扣即将退订名额）。若照字面实现，当 `subscribedRef` 已满 480 且 `toSubscribe` 为 3 时（既有「退订先行」用例场景）`capacity=0` → `toSubscribe` 被截为 0 → `subscribeMarket` 不再被调用，既有 `useSubscriptionManager.test.ts`「新批次超 SOFT_LIMIT 时退订先行再订阅」用例会红。因此 capacity 额外加 `+ unsubscribeIds.length`（退订先行会先释放这些名额），既修复 554 超限批次，又保住既有退订先行语义与用例。其余既有用例（LRU 淘汰、宽限期等）全量复核通过。
- 测试：`frontend/src/hooks/useSubscriptionManager.test.ts` 新增「should 集超 SOFT_LIMIT 时本批最多订阅 SOFT_LIMIT，超出部分留待下次 diff 并告警」：可见区 554 个合约 → 断言 `subscribeMarket` 恰被调用 1 次且批次长度为 480，`console.warn` 收到含「留待下次 diff」的告警。

---

## 验证结果

- 定向：`QuoteTable.test.tsx` / `TQuoteView.test.tsx` / `useSubscriptionManager.test.ts` / `TabContent/index.test.tsx` / `OptionsPanel.test.tsx` → 5 文件 134 用例全绿。
- 全量：`npm test` → **105 文件 / 1235 用例全部通过**。
- 构建：`npm run build`（含 `tsc`）成功；`npx tsc --noEmit` → 退出码 0 无错误。

## Concerns

- Issue C 的批次上限与任务书字面片段有一处必要偏差（capacity 计入本批即将退订腾出的名额），原因见上；不如此会破坏既有「退订先行」用例且让 NEW1-3 永远无法在 480 满额+LRU 场景下订阅。
- 本批被截断的合约仅在下次 diff 时重试：若可见区持续超过后端 500（正常业务不可能，软上限 480 < 500），最多每次少订阅直到收敛，不会死循环。
- TQuoteView 测试中的 act() 警告为既有异步 setState 噪音，非本修复引入，不失败。
