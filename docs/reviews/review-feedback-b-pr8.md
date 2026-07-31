# PR-R8 TabStore 审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-30
**审查范围**：`frontend/src/stores/tabs.ts` + `frontend/src/stores/tabs.test.ts`

---

## 🔴 阻断性问题（必须修复）

### 1. 测试数量记录不准确

- **位置**：`docs/dev-records/role-b/report-dev-b-pr8.md` 第47行
- **问题**：报告记录"24个测试全部通过"，实际 vitest 运行结果为 **20个测试全部通过**
- **验证**：`npx vitest run src/stores/tabs.test.ts --reporter=verbose` 输出 "Tests 20 passed"
- **无跳过测试**：文件中无 `it.skip` / `test.skip` / `describe.skip`
- **建议**：修正报告中测试数量为 20

---

## 🟡 改进建议（认同则改，不认同记录理由）

### 2. `MAX_TABS` 超限行为静默拒绝，与设计不符

- **位置**：`tabs.ts:95-97`
- **当前实现**：
  ```typescript
  if (state.tabs.length >= MAX_TABS) {
    return state  // 静默拒绝
  }
  ```
- **设计要求**（`task-redesign.md` PR-R8 验收标准 #3）："超限提示"
- **差距**：无用户提示，用户无法感知已达上限
- **建议**：`openTab` 返回 `boolean` 表示成功/失败，或通过 callback 通知 UI 层

### 3. 去重逻辑只考虑 `type + instrumentID`，非全 props

- **位置**：`tabs.ts:73-76` (`generateTabId`)
- **当前实现**：ID 仅由 `type` + `instrumentID` 生成
- **设计要求**："相同 type+props 去重"
- **差距**：同 type 无 `instrumentID` 时，不同 `props` 的标签页会错误去重
  - 例：打开两个不同标的的期权链（均无 `instrumentID`），第二个会被去重
- **测试验证**：`tabs.test.ts:53-71` 的测试名称声称验证去重，但实际仅验证了 `type + instrumentID` 场景
- **建议**：明确文档中"相同 type+props"的语义为"相同 type+instrumentID"，或扩展 `generateTabId` 纳入更多关键 props

---

## 📋 审查结论

- 🔴 阻断性：1 项（报告测试数量不准确）
- 🟡 改进建议：2 项

**状态**：需修复后二次审查
