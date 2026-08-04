# PR-R20 审查反馈（审查窗口 · 第一轮）

- **PR**: PR-R20 持仓平仓打开报单标签
- **分支**: `feature/redesign-r20-position-close`
- **审查窗口**: 角色B 审查窗口
- **审查日期**: 2026-08-04
- **审查范围**: `git diff main...feature/redesign-r20-position-close`
  - `frontend/src/modules/query/Position.tsx`（+8）
  - `frontend/src/modules/query/Position.test.tsx`（+22）
  - `docs/tasks/task-redesign.md`（PR 状态更新）
- **验证**: 完整前端测试套件 **769 tests / 76 files 全部通过**，无回归

## 审查结论

✅ **通过**（无 🔴 阻断性，无必须修改项）

## 🔴 阻断性问题

无

## 🟡 改进建议

1. **新增测试未锁「填参数 + 开标签」完整链路**
   `opens an order tab with close params when clicking 平仓` 只断言了标签打开（title/props/activeTabId），未在同一用例中断言 orderForm 平仓参数。direction/combOffsetFlag/limitPrice/对手价 已由既有测试分别覆盖，但 **`volumeTotalOriginal`（=pos.position）从未被任何测试断言**。建议在该测试中追加断言，把「点击平仓 → 填参数 + 开标签」的完整行为锁在一个用例中，并为 volumeTotalOriginal 补上缺失覆盖：

   ```js
   const form = useOrderStore.getState().orderForm
   expect(form.direction).toBe('sell')
   expect(form.combOffsetFlag).toBe('close_today')
   expect(form.volumeTotalOriginal).toBe(2)
   ```

2. **工作区卫生**
   工作树存在未提交改动 `frontend/dist-electron/windowManager.cjs`，经核实为**行尾（LF/CRLF）噪音改动**，内容 diff 为空。合并前建议 `git checkout -- frontend/dist-electron/windowManager.cjs` 丢弃，保持工作区干净。（另有 3 个与 PR 无关的未跟踪文件：`generate_weekly_report.py` 及实习周报 docx，无需处理。）

## 🔵 疑问确认

1. **MAX_TABS 达上限时静默失败**：当已打开 15 个标签时，`openTab` 返回 false 且无任何提示——此时 orderForm 已填充平仓参数，但报单标签未打开，用户无感知。与 R13 双击打开报单标签的既有行为一致（预置 openTab 行为，非本次引入）。确认可接受？

2. **测试隔离**：既有用例（如 `uses close_today`）点击平仓后现在也会触发 openTab 副作用（向真实 tabStore 追加标签）。新增测试已用 `setState` 重置 tabs 未破坏断言，但 `beforeEach` 未统一重置 tabStore，用例存在顺序依赖风险。建议后续在 `beforeEach` 重置 `useTabStore`。

## 审查维度摘要

| 维度 | 评估 |
|------|------|
| 功能正确性 | ✅ 平仓参数先 `setOrderForm`（**合并语义**）再 `openTab`；OrderPage 挂载 `useEffect` 仅合并 `instrumentID`，不清空平仓参数 |
| 标签打开 | ✅ `openTab` 生成 `tab-order-{instrumentID}`，title `📝 报单-{instrumentID}`；重复点击去重并激活已有标签，orderForm 经响应式订阅同步更新 |
| 订阅锁定 | ✅ `useTabContractLocks` 已含 `order` 类型（R16），打开报单标签后合约锁定订阅，报价卡片/对手价可用 |
| 测试质量 | ✅ 新增测试覆盖开标签链路；既有测试覆盖平仓参数与对手价；769 tests 全通过 |
| 代码质量 | ✅ 改动最小（+8 行），复用 `setOrderForm`/`openTab` 现有 API，注释说明清晰 |
| 范围控制 | ✅ 仅改动 Position.tsx + 测试 + 任务文档，无越界 |
| 文档同步 | ✅ task-redesign.md PR-R20 状态已更新为「开发完成，待审查」 |
| 潜在风险 | 无 🔴；🟡 建议 + 🔵 疑问见上 |

---

# PR-R20 二次审查反馈（审查窗口 · 第二轮）

- **审查日期**: 2026-08-04
- **审查范围**: 反馈处理 commit `f997f5d`（`Position.test.tsx` +16/-4、`review-reply-redesign-r20.md`）
- **验证**: Position 11 tests ✅；完整前端套件 **769 tests / 76 files ✅**

## 结论

✅ **通过**（🟡 建议已全部修复并验证，无新增问题）

## 修复核验

| 反馈编号 | 内容 | 处理核验 |
|------|------|------|
| 🟡1 | 完整链路断言 + `volumeTotalOriginal` 覆盖 | ✅ 新测试追加 `form.direction='sell'` / `form.combOffsetFlag='close_today'` / `form.volumeTotalOriginal=2`，与持仓数据（多仓 2 手 + 今仓）一致，「点击平仓 → 填参数 + 开标签」锁定同一用例 |
| 🟡2 | 工作区 `windowManager.cjs` 行尾噪音 | ✅ 已 `git checkout --` 丢弃，工作区干净 |
| 🔵1 | MAX_TABS 静默失败 | ⏸️ 确认可接受，另立独立 PR 处理（openTab 失败 toast）——决定合理，超出 R20 范围 |
| 🔵2 | `beforeEach` 重置 tabStore | ✅ `Position.test.tsx` beforeEach 统一重置 tabStore 为默认 market 标签；原新测试内冗余 setState 已移除，用例顺序无关 |

## 新增审查点

- 反馈文件已重命名为 `review-feedback-redesign-r20.md`（符合命名规范，与审查回复建议一致）。审查回复内部对旧名 `r17` 的引用为过时文件名，回复自身已注明，不影响追溯。
- `Position.tsx` 实现代码本轮无改动（🟡 均为测试/卫生类），功能行为与第一轮审查一致，无需复评。

## 潜在风险

无新增风险。遗留项：按审查回复决定，将「openTab 达上限 toast 提示」作为独立 PR 排期处理。
