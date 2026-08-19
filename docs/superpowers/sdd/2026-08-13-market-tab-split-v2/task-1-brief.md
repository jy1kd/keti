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

