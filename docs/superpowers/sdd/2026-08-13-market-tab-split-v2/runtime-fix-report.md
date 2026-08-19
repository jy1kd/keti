# Runtime Fix Report — 行情表拆分 v2（feature/md-refactor）

- 日期：2026-08-13
- 状态：DONE
- 提交：`e35811c353cd69b5340905a1572aa2a4e483244b`
- 主题：`fix(options): 修复行情表拆分 v2 运行时问题（T型报价崩溃/0高/去到期日/悬浮跳页/排序）`
- 分支：`feature/md-refactor`（仅提交，未 push / 未 merge）

---

## 逐项修复

### Issue #1 — TQuoteTable 卸载 release 与 ResizeObserver 100ms 防抖回调竞态崩溃

- 修复文件：`frontend/src/modules/options/TQuoteTable.tsx`（mount effect 清理函数，行 146-157，`RESIZE_SETTLE_MS = 250` 在行 150）
- 做法：卸载时不再同步 `table.release()`，改为 `setTimeout(() => { t.release(); if (tableRef.current === t) tableRef.current = null }, 250)`。250ms > vtable 内部 100ms 防抖，挂起的 resize 回调先在存活表上触发，避开 `internalProps = null` 后 `resize() → getElement()` 读 null。`release()` 幂等（isReleased 守卫），真实卸载后延迟释放安全；StrictMode 双挂载时延迟释放释放的是旧脱离表，`tableRef.current` 已指向新表（仅当仍相等才置 null）。
- 测试：`frontend/src/modules/options/TQuoteTable.test.tsx` — 重写原「releases vtable instance on unmount」为「卸载后延迟 250ms 释放」（`vi.useFakeTimers()` + `vi.advanceTimersByTime(250)`，断言 250ms 内未 release、250ms 后 release 恰好 1 次；try/finally 还原真实时钟）。无测试再断言 release 同步触发。

### Issue #2a — 悬浮窗中 T型报价 0 高度塌陷（flex 失效）

- 修复文件：`frontend/src/modules/options/styles.css` — `.options-panel`（行 19-25），`flex: 1 1 0` 改为 `height: 100%`（行 22），保留 `display:flex; flex-direction:column; min-height:0`。
- 根因：TQuoteView 现渲染在悬浮窗（父级 div 为 `display:block` 定高），flex 在 block 父级下失效，`.options-panel` 缩到内容高度、`.options-chain-table` 塌陷为 0 → vtable canvas 0×0。
- 测试：`frontend/src/modules/options/TQuoteView.style.test.tsx` — 第 3 个用例原断言「flex 填充、非 height:100%」（正是此 bug 的固化），已改为断言 `height:100%` + `display:flex` + `flex-direction:column` + `min-height:0`。

### Issue #2b — 移除 T型报价 到期日选择器

- 修复文件：`frontend/src/modules/options/TQuoteView.tsx`
  - 删除 `formatExpireDate`（原行 9-12）、`selectedExpireDate` state（原行 30）、`handleExpireDateChange`、`expirations` memo、工具栏「到期日:` label/select 块（原行 243-251）。
  - `selectedChain` 改为取该标底首条链：`optionChains.find((c) => c.underlying === selectedUnderlying)`（行 96-99）。
  - `selectUnderlying` 不再设置到期日（行 102-122）。
  - 空态分支简化为 `!selectedUnderlying ? '请先选择标的合约' : '无匹配的期权链数据'`（行 241-245）。
- 测试：`frontend/src/modules/options/TQuoteView.test.tsx`
  - 删除原「到期日 select 由 optionChains 派生」用例。
  - 原「renders single table when both underlying and expiry selected」改为「标底多到期日时默认取首条链（无到期日选择器），只渲染单表」。
  - 新增「无到期日选择器（去 到期日 select）」用例（断言 `queryByLabelText(/到期日/)` 与「请选择到期日」option 均为 null）。

### Issue #3 — 打开浮动窗把主内容拽到期货页

- 修复文件：`frontend/src/utils/openFloatingTab.ts`（行 24-41）
  - `openFloatingTab` 在 `openTab` 前捕获 `priorActive = useTabStore.getState().activeTabId`；`detachTabAt` 成功后 `if (ok && priorActive) useTabStore.getState().setActiveTab(priorActive)` 恢复。detachTabAt（detachDrag.ts 行 35-37）的「活跃标签脱离切回 market」逻辑保留——那是手动拖拽的预期行为，仅编程入口 openFloatingTab 不再被拽走主窗口。
  - 对全部浮动入口生效（order/kline/query/settings/ipc-monitor/tquote）。
- 测试：`frontend/src/utils/openFloatingTab.test.ts` — 新增「打开浮动窗后保持原活跃标签（openTab 激活 + detachTabAt 切回 market 后恢复 priorActive）」用例：activeTabId='tab-options' 下 openQueryFloating 后仍为 'tab-options' 且窗口已登记。
- 检查过既有断言：`src/utils/detachDrag.test.ts`（行 34-38）、`TabContent/detachFlow.integration.test.tsx`、`detachFlow.repro.test.tsx` 均直接测 `detachTabAt` 手动拖拽语义（拖离活跃标签切回 market），属预期行为，不需改动，全部仍通过。未发现任何既有用例断言「openFloatingTab 后 activeTabId 变 market」需要更新。

### Issue #4 — T型报价标底下拉 FG610 排在 ad2608 前（大小写敏感的 JS 默认排序）

- 修复文件：`frontend/src/modules/options/TQuoteView.tsx`
  - 引入 `import { naturalCompare } from '@/modules/market/sort'`（行 5）。
  - 三处 `.sort()` → `.sort(naturalCompare)`：`filteredUnderlyings`（行 45）、挂载加载 effect（行 76）、`handleRefreshUnderlyings`（行 165）。
  - naturalCompare = `localeCompare(..., { numeric: true, sensitivity: 'base' })`，不区分大小写 + 数字自然序。
- 测试：`frontend/src/modules/options/TQuoteView.test.tsx`
  - 原「sorts available underlyings lexicographically」改为「按不区分大小写自然序排序标底下拉（cu2609 在 FG609 前）」。
  - 新增「标底 a 开头小写排在 FG610 等大写之前」：`['FG610','ad2608','MA609']` → `['ad2608','FG610','MA609']`。

---

## 验证结果

- 定向：`TQuoteView.test.tsx` / `TQuoteTable.test.tsx` / `OptionsPanel.test.tsx` / `openFloatingTab.test.ts` → 4 文件 55 用例全绿。
- 关联 detach：`detachDrag.test.ts` / `detachFlow.integration.test.tsx` / `detachFlow.repro.test.tsx` → 3 文件 11 用例全绿。
- 全量：`npm test` → **105 文件 / 1232 用例全部通过**。
- 构建：`npm run build`（含 `tsc`）成功；`npx tsc --noEmit` → 退出码 0 无错误。

## Concerns

- 无功能性担忧。唯一需要留意的既有测试是 `TQuoteView.style.test.tsx` 第 3 个用例——它之前固化了 `flex:1 1 0`（正是 Issue #2a 的 bug 来源），已随修复改为断言 `height:100%`。
- 手动拖拽（detachTabAt 直接调用）仍保持「拖离活跃标签切回 market」语义，与本修复互不冲突（openFloatingTab 是编程入口，二者行为刻意区分）。
