# Task 2 报告：TQuoteTable 支持 onRowClick

## 状态
DONE_WITH_CONCERNS

## 提交
- `e81fc39059d0ed054736d4b96db66407909dd0ff` — `feat(options): TQuoteTable 支持 onRowClick 回填合约`

## 改动概览

### TQuoteTable.tsx
- `TQuoteRow` 新增 `callInstrumentID?` / `putInstrumentID?` 字段。
- `buildRecords` 填充两侧 `instrumentID`（来自 `OptionQuote.instrumentID`）。
- 新增 props：`onRowClick?: (instrumentID: string, price: number) => void` 与 `onTableReady?: (table: ListTable) => void`。
- 新增 `recordsRef` 保存当前 `records`，供 `click_cell` 回调按行索引取行数据（mount 与 update 两处 effect 同步写入）。
- mount effect 中 `new ListTable(...)` 之后调用 `onTableReady?.(table)`，并 `table.on('click_cell', ...)`：
  - C 侧列索引 `0..4` 且 `record.callInstrumentID` 存在 → `onRowClick(callInstrumentID, callLastPrice)`（number 否则 0）。
  - P 侧列索引 `6..10` 且 `record.putInstrumentID` 存在 → `onRowClick(putInstrumentID, putLastPrice)`。
  - 中列 `5`（行权价）与缺失侧不回调。
  - 回调同时兼容 vtable 真实事件字段 `{ col, row }` 与 `{ colIndex, rowIndex }`。
- 未传 `onRowClick` 时：回调内部直接 `return`，行为与改动前完全一致（TQuoteView 仍无 `onRowClick`，属回归安全）。

### TQuoteTable.test.tsx（保留全部既有测试，新增 6 个用例）
- 未传 onRowClick 不报错（回归 TQuoteView）
- onTableReady 透传 vtable 实例
- 点击 C 侧最新价列(index 4)回传 `FG609-C-1300`, 10
- 点击 P 侧最新价列(index 6)回传 `FG609-P-1250`, 5
- 点击中列(index 5)不回调
- 缺失侧（C 侧无合约）不回调，但 P 侧仍可回调

## 测试摘要
单文件 15 passed；options 套件 4 files / 60 passed；`tsc --noEmit` 通过（exit 0）。

## 测试中修正的关键点
- 列索引按真实 columns 数组更正：C 侧 callLastPrice = **index 4**（brief 误写为 6），P 侧 putLastPrice = index 6，中列行权价 = index 5。测试 col 值已按此更正。
- 全局 mock（src/setupTests.ts）的 `ListTable` 返回**共享单例** `mockInstance`，所有渲染复用同一 `table.on` 注册表。因此不能用 `ListTable.mock.results[0]` 或 `find('click_cell')`（会取到最早的注册/实例）。实现改用 `onTableReady` 透传 `onTableReady` 捕获实例，并在 `getClickHandler` 中取「最近一次」`click_cell` 注册（按 `ListTable.mock.results` 最后一项的 `on` 调用逆序查找），规避共享单例陷阱。

## Concerns
1. **共享单例 mock 脆弱**：`getClickHandler` 依赖「取最近一次 click_cell 注册」的约定；若未来某测试在同一用例内多次渲染 TQuoteTable 并都带 onRowClick，可能取到非预期 handler。当前 6 个用例各只渲染一次，安全。
2. **`onTableReady` 目前仅测试使用**：生产代码（TQuoteView）未传，纯透传无副作用；若后续要做真实单元格点击回填，需配合 UI 层接入 `onRowClick`。
3. **真实 vtable click_cell 事件字段**：实现已兼容 `col/row` 与 `colIndex/rowIndex`，但生产环境未实测（jsdom 无法真实初始化 canvas vtable），仅通过 mock 验证逻辑分支。
4. 未改动 `OptionChain`/`OptionQuote` 类型（types.ts 已含 `instrumentID`，无需改）。
