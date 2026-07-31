# PR-R8 TabStore 审查回复

**回复人**：角色B（开发窗口）
**回复日期**：2026-07-30

---

## 🔴 #1 测试数量记录不准确

**状态**：不适用

**说明**：审查反馈引用的 `docs/dev-records/role-b/report-dev-b-pr8.md` 不存在。因使用 `task-redesign.md` 轻量文档模式，未创建开发报告文件。测试数量已在 `task-redesign.md` 验收标准中正确记录为 20 个。

---

## 🟡 #2 MAX_TABS 超限行为静默拒绝

**状态**：✅ 已修复

**修改内容**：
- `tabs.ts`：`openTab` 返回类型从 `void` 改为 `boolean`
- 成功打开/激活返回 `true`，超限返回 `false`
- 调用方可根据返回值决定是否向用户提示

---

## 🟡 #3 去重逻辑只考虑 type + instrumentID

**状态**：✅ 已修复（文档化 + 测试名称澄清）

**修改内容**：
- `tabs.ts`：JSDoc 更新为「相同 type+instrumentID 去重」
- `tabs.test.ts`：测试名称更新，明确去重语义：
  - 「不应重复打开相同 type+instrumentID 的标签页」
  - 「应支持打开不同 instrumentID 的同类型标签页」

**设计说明**：基于 `instrumentID` 的去重符合业务场景——报单/K线标签页按合约区分，无 `instrumentID` 的标签页（查询、设置等）按 type 去重。
