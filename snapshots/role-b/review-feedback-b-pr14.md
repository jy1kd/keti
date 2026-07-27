# PR-14 审查反馈 — 前端期权T型报价实现

**审查日期**: 2026-07-24
**审查分支**: `feature/pr-14-option-tquote`
**审查范围**: 12 files, +1065 / -5 lines (22d8b4d → b6946f5, 5 commits)

---

## 初审 (2026-07-24)

### 🔴 阻断性问题（必须修复）

#### 1. `lazy` / `Suspense` 未使用的导入
**文件**: `App.tsx:1`
```typescript
import { useCallback, useState, useEffect, lazy, Suspense } from 'react'
```
`lazy` 和 `Suspense` 被导入但从未使用，属于 dead code。应删除这两个导入。

#### 2. 测试 mock 数据缺少 `updateTime` 字段（类型不安全）
**文件**: `OptionPanel.test.tsx`, `TQuoteTable.test.tsx`, `store.test.ts`

`OptionChain` 类型定义包含 `updateTime: string`（types.ts:237），但以下测试的 mock 数据均缺失此字段：
- `OptionPanel.test.tsx` — 所有 `optionChains` mock
- `TQuoteTable.test.tsx` — `chain` 和 `chainWithGaps`
- `store.test.ts` — `makeChain()` 工厂函数

TypeScript 应报错，除非测试 tsconfig 配置较宽松。需补充 `updateTime` 字段或在类型中标记为可选。

#### 3. OptionPanel 选择器硬编码颜色值
**文件**: `OptionPanel.tsx:428-463`

两个 `<select>` 元素的样式直接硬编码：
- `background: '#1a1a2e'`
- `color: '#e6edf3'`
- `border: '1px solid #30363d'`

项目其他组件使用 CSS 变量（`var(--bg-secondary)`、`var(--text-primary)`、`var(--border-color)` 等）。应使用 CSS 变量保持主题一致性。

### 🟡 改进建议（认同则改，不认同记录理由）

#### 4. OptionPanel 全部使用内联样式
**文件**: `OptionPanel.tsx:420-495`

整个组件使用 `style={{...}}` 内联样式，而项目中其他面板（如 MarketPanel）使用 CSS 类。建议提取为 CSS 类，与 `global.css` 中的 `.market-tabs` / `.market-tab` 风格保持一致。

#### 5. 错误 catch 块无日志
**文件**: `store.ts:55`
```typescript
} catch {
  set({ loading: false, error: 'Failed to load option chains' })
}
```
静默吞掉错误，生产环境调试困难。建议至少 `console.error` 保留错误链。

#### 6. unmount 测试未实际验证 release 调用
**文件**: `TQuoteTable.test.tsx:128-132`
```typescript
it('releases vtable instance on unmount', () => {
  const { unmount } = render(<TQuoteTable chain={chain} />)
  unmount()
  expect(true).toBe(true)  // ← 永远通过，未验证
})
```
应 mock `@visactor/vtable` 并验证 `table.release()` 被调用。

#### 7. OptionPanel 测试缺少部分交互场景
- 选择标的合约后触发 `fetchOptionChains` 的交互测试缺失
- 选择到期日后触发 `fetchOptionChains` 的交互测试缺失
- `optionChains.length > 0` 但未选中 chain 时显示"请选择标的合约和到期日"的测试缺失

#### 8. `buildRecords` 类型混合问题
当 call 或 put 缺失时，字段值为 `'--'`（string），而有值时为 `number`。vtable 列未配置 `columnType`，依赖隐式类型推断。建议显式设置列类型或统一数据格式。

### 🔵 疑问

#### 9. `OptionChain.updateTime` 未在 TQuoteTable 中使用
类型定义了 `updateTime` 但组件未展示。是否计划在后续 PR 中使用？如不需要，考虑从类型中移除。

#### 10. 到期日显示为原始格式
到期日选择器直接显示 `20260815` 原始字符串，用户可读性差。建议格式化为 `2026-08-15` 或 `08/15`。可留作后续优化。

---

## 二审 (2026-07-24)

**修复 commit**: `fa98112`
**修复内容**: 删除 lazy/Suspense 未用导入 + updateTime 字段补充 + CSS 变量替换硬编码 + 错误日志 + release 验证 + 日期格式化

### 🔴 阻断性问题验证

| # | 问题 | 状态 | 验证详情 |
|---|------|------|----------|
| 1 | `lazy`/`Suspense` 未使用导入 | ✅ 已修复 | App.tsx:1 已删除，仅保留 `useCallback, useState, useEffect` |
| 2 | 测试 mock 缺少 `updateTime` | ✅ 已修复 | OptionPanel.test.tsx (2处)、TQuoteTable.test.tsx (4处)、store.test.ts (`makeChain()`) 全部补充 |
| 3 | 选择器硬编码颜色 | ✅ 已修复 | 新建 `options/styles.css`，使用 `var(--bg-secondary)` / `var(--text-primary)` / `var(--border-color)` 等 CSS 变量 |

### 🟡 改进建议验证

| # | 建议 | 状态 | 说明 |
|---|------|------|------|
| 4 | 内联样式 → CSS 类 | ✅ 已改 | 提取为 `.options-panel` / `.options-toolbar` / `.options-content` / `.options-empty` / `.options-error` |
| 5 | 错误 catch 无日志 | ✅ 已改 | `console.error('[OptionsStore] fetchOptionChains failed:', err)` 已添加，测试 stderr 输出可见 |
| 6 | unmount 测试未验证 | ✅ 已改 | 改为从 `ListTable.mock.results[0].value` 取实例，验证 `instance.release.toHaveBeenCalled()` |
| 7 | 交互测试缺失 | ⏸️ 确认推迟 | 开发者回复：mock 模式不支持完整 DOM+store 联动，通过 store 单元测试覆盖核心逻辑，PR-17 联调补充 E2E。可接受。 |
| 8 | 类型混合问题 | ⏸️ 确认推迟 | 开发者回复：vtable 隐式转换运行正常，后续遇问题再显式配置。可接受。 |

### 🔵 疑问确认

| # | 疑问 | 结论 |
|---|------|------|
| 9 | updateTime 用途 | 保留字段定义，后续可扩展展示。合理。 |
| 10 | 到期日格式化 | ✅ 已改。新增 `formatExpireDate()` 函数，`20260815` → `2026-08-15` |

### 测试验证

```
Test Files  3 passed (3)   (options 模块)
             1 passed (1)   (App.test.tsx)
Tests      40 passed (40)  (options)
             7 passed (7)   (App)
Duration   1.38s + 2.59s
```

全部 47 个测试通过，包含 `console.error` 输出的预期 stderr。

---

## 审查结论

**✅ 二审通过** — 所有 🔴 阻断性问题已修复，🟡 改进建议 6/8 已采纳，2 项合理推迟。

| 级别 | 初审 | 二审 |
|------|------|------|
| 🔴 阻断性 | 3 | 0 ✅ |
| 🟡 改进建议 | 5 | 2 ⏸️ (合理推迟) |
| 🔵 疑问 | 2 | 0 (已确认) |

**备注**: `store.test.ts` 有未提交的 `updateTime` 补充改动（`makeChain()` 工厂函数），需开发窗口一并提交。
