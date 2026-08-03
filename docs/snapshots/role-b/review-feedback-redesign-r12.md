# PR-R12 审查反馈

**审查时间**：2026-08-03
**审查分支**：feature/redesign-r12-favorites-tab
**初次审查结论**：🔴 不通过（1 个阻断性问题）
**二次审查结论**：✅ 通过（2026-08-03）

---

## 🔴 阻断性问题（1 个）

### 1. `onFavoriteChange` 回调逻辑不完整

**文件**：`frontend/src/pages/FavoritesPage.tsx:29-33`

**问题**：
```tsx
const handleFavoriteChange = (instrumentID: string, isFavorited: boolean) => {
  if (!isFavorited) {
    removeFromFavorites(instrumentID)
    toast.success(`已取消收藏 ${instrumentID}`)
  }
  // isFavorited === true 时无响应
}
```

只处理取消收藏，没有处理收藏操作。

**场景**：MarketTable 触发 `onFavoriteChange(id, true)` 时无响应。

**修复建议**：
- 方案 A：添加 `addToFavorites` 逻辑
- 方案 B：添加注释说明此处只处理取消收藏的原因（如果 MarketTable 在 FavoritesPage 中不会触发收藏操作）

---

## 🟡 改进建议（2 个）

### 2. 内联样式硬编码

**文件**：`frontend/src/pages/FavoritesPage.tsx:80-112`

**问题**：
- 样式全部使用内联 `React.CSSProperties`
- 硬编码颜色值 `#8b949e`（出现 3 次）

**建议**：
- 抽取为 CSS 模块（`FavoritesPage.module.css`）或独立 CSS 文件
- 使用 CSS 变量（`var(--text-secondary)`）替代硬编码颜色

---

### 3. 测试文件位置不一致

**文件**：`frontend/src/pages/__tests__/FavoritesPage.test.tsx`

**问题**：
- 测试放在 `__tests__/` 子目录
- 项目其他测试（如 `MarketTable.test.tsx`、`TabBar/index.test.tsx`）与组件同目录

**建议**：
- 移至 `frontend/src/pages/FavoritesPage.test.tsx` 保持一致

---

## 🔵 疑问（1 个）

### 4. 「全部订阅」实现方式

PR 描述提到「全部订阅（数量少，通常 < 50）」，但 FavoritesPage 中未见显式订阅逻辑。

**疑问**：
- 是否依赖 MarketTable 的 `onVisibleRangeChange` 自动订阅？
- 还是需要单独实现订阅逻辑？
- 如果是前者，是否需要确保 FavoritesPage 中的合约全部可见？

---

## 初次审查结论

**🔴 审查不通过**

阻断性问题 #1 需修复后重新提交审查。

---

## 二次审查（2026-08-03）

**修复 commit**：`397219c`

### 修复验证

| 问题 | 修复状态 | 验证详情 |
|------|----------|----------|
| 🔴 #1 `onFavoriteChange` 回调不完整 | ✅ 已修复 | 添加 `addToFavorites` 逻辑，从 `contracts` 中查找合约并收藏 |
| 🟡 #2 内联样式硬编码 | ✅ 已修复 | 抽取为 `FavoritesPage.css`，使用 CSS 变量 `var(--text-secondary)` |
| 🟡 #3 测试文件位置不一致 | ✅ 已修复 | 移至 `src/pages/FavoritesPage.test.tsx`，与项目规范一致 |
| 🔵 #4 「全部订阅」实现方式 | ✅ 已解释 | 复用 `contractsStore.loadFavoriteContracts()` 启动订阅 |

### 测试覆盖

新增测试：`should call addToFavorites when favoriting` — 覆盖 `isFavorited === true` 场景

```
Test Files: 64 passed (64)
Tests:      665 passed (665)
```

### 二次审查结论

**✅ 审查通过**

所有问题已修复，测试覆盖完整。

---

**下一步**：
1. 开发窗口执行人工验证（第 5 步）
2. 验证通过后执行收尾合并（第 6 步）
