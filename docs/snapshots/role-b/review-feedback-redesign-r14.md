# 审查反馈 — PR-R14: 报单标签页

**审查时间**: 2026-08-03
**审查分支**: `feature/redesign-r14-order-page`
**审查范围**: 5 files, +46 / -16 lines

---

## 审查结论

**✅ 通过** — 无误性阻断问题。2 条改进建议，1 条疑问。

---

## 🔴 阻断性问题

无。

---

## 🟡 改进建议

### 🟡1 — TabContent 类型断言不够安全

**文件**: `frontend/src/components/TabContent/index.tsx:18`
**级别**: 🟡 改进建议

```typescript
// 当前代码：
return <OrderPage instrumentID={tab.props.instrumentID as string | undefined} />
```

`tab.props` 的类型是 `Record<string, unknown>`（来自 Tab 接口），使用 `as string | undefined` 直接断言跳过了运行时类型检查。如果未来某个调用方意外传入了非字符串值（如 `{instrumentID: 12345}`），这个断言会掩藏 bug，导致 `instrumentID` 被传入 `OrderPage` 时实际为 number 类型，进而 `contracts.find((c) => c.instrumentID === instrumentID)` 永远不会匹配（number !== string）。

**建议**: 添加运行时类型守卫：

```typescript
const instrumentID = typeof tab.props.instrumentID === 'string'
  ? tab.props.instrumentID
  : undefined;
return <OrderPage instrumentID={instrumentID} />
```

或提取为工具函数以便其他页面组件复用（PR-R15/R16 等也有类似场景）。

---

### 🟡2 — 缺少边界条件测试

**文件**: `frontend/src/pages/__tests__/OrderPage.test.tsx`
**级别**: 🟡 改进建议

当前测试覆盖了正常路径（合约存在、快照存在），但以下边界条件未覆盖：

| 场景 | instrumentID | contract | snapshot | 预期行为 |
|------|:-----------:|:--------:|:--------:|----------|
| 合约不存在 | "IF9999" | ❌ | ❌ | 显示 instrumentID，不显示名称和价格 |
| 快照不存在 | "IF2608" | ✅ | ❌ | 显示 instrumentID + 名称，不显示价格 |
| 未传 instrumentID | undefined | — | — | 仅显示 "报单" 标题 |

这些场景是 `OrderPage.tsx` 中条件渲染逻辑 (`{contract && ...}`, `{snapshot && ...}`) 的核心目的，应有测试保护以防回归。

**建议**: 在 `OrderPage.test.tsx` 中补充 2-3 条边界条件测试。

---

## 🔵 疑问

### 🔵1 — isElectron 分支无测试覆盖

**文件**: `frontend/src/pages/OrderPage.tsx:62-66`

```tsx
<div className="order-page__footer">
  {isElectron() && (
    <div className="order-page__electron-info">
      <span>独立窗口模式</span>
    </div>
  )}
</div>
```

`isElectron()` 在 jsdom 环境下返回 `false`（`window.electronAPI` 为 `undefined`），因此这段代码在测试中永远不会渲染。虽然 `isElectron()` 本身已在 `electron.ts` 中有动态检查逻辑，但 OrderPage 的 Electron 分支在单元测试中完全未覆盖。

**确认**: 这部分是否计划在人工验证阶段（Electron 实际环境）覆盖？之前的 PR (PR-R11 等) 是否有相同的处理惯例？

---

## 审查维度检查清单

| 维度 | 状态 | 备注 |
|------|:----:|------|
| 功能正确性 | ✅ | 条件渲染逻辑正确，contract/snapshot 空值处理安全 |
| 测试质量 | 🟡 | 正常路径覆盖充分，边界条件有缺口 (🟡2) |
| 代码质量 | 🟡 | 类型断言可加强 (🟡1)，整体结构清晰 |
| 范围控制 | ✅ | 修改严格限定在 PR-R14 范围：OrderPage + TabContent 集成 |
| 文档同步 | ✅ | task-redesign.md 验收标准已全部勾选，文件列表已更新 |
| 潜在风险 | ✅ | 改动量小 (46 行)，影响面可控 |
| 任务文件完整性 | ✅ | 状态、提交文件列表、验收标准均已同步更新 |

---

## 二次审查（Round 2）

**审查时间**: 2026-08-03
**审查范围**: 1 commit (`525abe6`), 6 files, +148 / -15 lines (含审查回复文件)

### 逐条验证

#### 🟡1 — 类型守卫 ✅ 已修复

**TabContent/index.tsx:11-13** — 提取 `getInstrumentID()` 函数：
```typescript
function getInstrumentID(props: Record<string, unknown>): string | undefined {
  return typeof props.instrumentID === 'string' ? props.instrumentID : undefined
}
```

- ✅ `typeof` 运行时检查替代了 `as string` 断言
- ✅ JSDoc 注释说明设计意图
- ✅ 可复用设计，适合 PR-R15/R16 后续集成
- ✅ 调用处已替换为 `getInstrumentID(tab.props)`

#### 🟡2 — 边界条件测试 ✅ 已修复

**OrderPage.test.tsx** — 新增 3 条边界测试 (lines 72-98)：

| 测试 | 验证点 | 断言策略 |
|------|--------|----------|
| 未传 instrumentID | 仅显示标题，无最新价 | `queryByText(/最新价/)` → null |
| 合约不存在 (IF9999) | 显示 ID，不显示名称/价格 | `getByText('IF9999')` + `queryByText('沪深300')` → null |
| 快照不可用 | 显示 ID + 名称，不显示价格 | `getByText('IF2608')` + `getByText('沪深300')` + `queryByText(/最新价/)` → null |

- ✅ 使用 `queryByText` (不抛异常) 验证元素不存在，而非 `expect().not.toBeDefined()` 等模糊断言
- ✅ **Store 泄漏修复**: `beforeEach` 新增 `useMarketStore.setState({ snapshots: new Map() })` 防止快照状态跨测试污染
- ✅ 注释标注每步验证的语义

#### 🔵1 — Electron 惯例 ✅ 已解释

- ✅ 确认为项目既有惯例 (PR-R11, PR-R12 同策略)
- ✅ 影响面小（仅展示提示文本）
- ✅ 人工验证阶段覆盖

### 全量测试

```
Test Files  66 passed (66)
     Tests  696 passed (696)
```

### 二次审查结论

**✅ 通过** — 所有反馈项均已妥善处理，无新增问题。

| 项目 | 初查 | 复查 |
|------|:----:|:----:|
| 🟡1 类型守卫 | 改进建议 | ✅ 已修复 |
| 🟡2 边界测试 | 改进建议 | ✅ 已修复 |
| 🔵1 Electron | 疑问 | ✅ 已解释 |
