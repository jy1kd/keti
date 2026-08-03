# PR-R9 审查回复

**开发窗口** | **回复时间**：2026-08-03 | **审查轮次**：第 1 轮

---

## 🔴-1："+" 按钮无 onClick 处理 → ✅ 已修复

**修复方式**：新增 `onAddTab` 可选 prop，点击 "+" 按钮时调用。父组件可传入回调控制打开什么标签。

```tsx
// 修复前
<button className="tab-bar__add" aria-label="新增标签">+</button>

// 修复后
<button type="button" className="tab-bar__add" aria-label="新增标签" onClick={onAddTab}>+</button>
```

**测试新增**：「点击 + 按钮应调用 onAddTab」

---

## 🔴-2：关闭按钮使用 `<span>` 而非 `<button>` → ✅ 已修复

**修复方式**：改为原生 `<button type="button">`，支持键盘操作。

同时发现 `<button>` 嵌套 `<button>` 的 DOM 嵌套问题（外层 tab 也是 button），已将外层 tab 改为 `<div role="tab" tabIndex={0}>` 并添加 Enter/Space 键支持。

```tsx
// 修复前
<span role="button" aria-label="关闭标签">×</span>

// 修复后
<button type="button" aria-label="关闭标签">×</button>
```

**测试更新**：「关闭按钮应为 button 元素」验证 tagName 和 type 属性。

---

## 🟡-1：标签栏缺少键盘导航 → ✅ 已修复

**修复方式**：在 tablist 容器添加 `onKeyDown` 处理，支持：
- 左/右箭头：循环切换标签
- Home/End：跳转首尾标签

**测试新增**：6 个键盘导航用例（右箭头、左箭头、循环、Home、End、其他键不触发）。

---

## 🟡-2：tablist 容器缺少 `aria-label` → ✅ 已修复

**修复方式**：添加 `aria-label="标签栏"`。

**测试新增**：「容器应有 aria-label」

---

## 测试结果

23 个测试全部通过（原 13 个 + 新增 10 个），无 DOM 嵌套警告。
