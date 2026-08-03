# 审查回复 — PR-R14: 报单标签页

**回复时间**: 2026-08-03
**审查反馈**: review-feedback-redesign-r14.md

---

## 🟡1 — TabContent 类型断言不够安全

**结论**: ✅ 已修复

**修复方式**: 提取 `getInstrumentID()` 工具函数，使用 `typeof` 运行时类型守卫替代 `as string` 断言：

```typescript
function getInstrumentID(props: Record<string, unknown>): string | undefined {
  return typeof props.instrumentID === 'string' ? props.instrumentID : undefined
}
```

该函数可在后续 PR（R15/R16）中复用。

**Commit**: `fix(frontend): PR-R14 处理审查反馈`

---

## 🟡2 — 缺少边界条件测试

**结论**: ✅ 已修复

**新增 3 条边界条件测试**:

| 测试场景 | instrumentID | contract | snapshot | 验证点 |
|----------|:-----------:|:--------:|:--------:|--------|
| 未传 instrumentID | undefined | — | — | 仅显示"报单"标题，无最新价 |
| 合约不存在 | "IF9999" | ❌ | ❌ | 显示 instrumentID，不显示名称/价格 |
| 快照不可用 | "IF2608" | ✅ | ❌ | 显示 ID + 名称，不显示价格 |

同时修复了 `beforeEach` 中 `useMarketStore.setState` 未重置的问题（现在每次测试前清空 snapshots）。

**Commit**: `fix(frontend): PR-R14 处理审查反馈`

---

## 🔵1 — isElectron 分支无测试覆盖

**结论**: ✅ 已有惯例，人工验证覆盖

`isElectron()` 的分支在 jsdom 环境下始终为 `false`，无法在单元测试中覆盖。这是项目的既有惯例：
- PR-R11 (App.tsx)、PR-R12 (FavoritesPage) 等均采用相同策略
- Electron 相关代码在**人工验证阶段**通过 Electron 实际环境验证（第 5 步）
- 备注：独立窗口模式是后端功能，`OrderPage` 中的 `isElectron()` 检查仅用于展示提示文本，影响面极小

---

## 修复汇总

| 项目 | 状态 |
|------|:----:|
| 🟡1 类型守卫 | ✅ 已修复 |
| 🟡2 边界测试 | ✅ 已修复 |
| 🔵1 Electron | 已解释，沿用惯例 |
| 全量测试 | ✅ 696 passed |
