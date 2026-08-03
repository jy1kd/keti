# PR-R12 审查回复

**回复时间**：2026-08-03
**修复 commit**：待提交

---

## 🔴 阻断性问题

### 1. `onFavoriteChange` 回调逻辑不完整

**处理**：✅ 已修复

**修复方式**：
- 添加 `addToFavorites` 逻辑，处理 `isFavorited === true` 的情况
- 从全量合约 `contracts` 中查找合约并调用 `addToFavorites`
- 虽然 FavoritesPage 只显示已收藏合约，理论上不会触发收藏操作，但防御性补全逻辑更健壮

**修改文件**：`frontend/src/pages/FavoritesPage.tsx:27-37`

---

## 🟡 改进建议

### 2. 内联样式硬编码

**处理**：✅ 认同，已修复

**修复方式**：
- 抽取为独立 CSS 文件 `FavoritesPage.css`
- 使用 CSS 变量 `var(--text-secondary)` 替代硬编码颜色 `#8b949e`

### 3. 测试文件位置不一致

**处理**：✅ 认同，已修复

**修复方式**：
- 从 `src/pages/__tests__/FavoritesPage.test.tsx` 移至 `src/pages/FavoritesPage.test.tsx`
- 与项目其他组件测试（如 `MarketTable.test.tsx`）保持一致

---

## 🔵 疑问

### 4. 「全部订阅」实现方式

**回复**：订阅逻辑在 `contractsStore.loadFavoriteContracts()` 中实现，该方法在 `MarketPanel` 启动时（`useEffect`）调用。流程：

1. 从 `userPrefs.selectedContracts` 读取收藏合约 ID
2. 调用 `getInstrumentsByIds()` 获取合约详情
3. 调用 `subscribeMarket()` 批量订阅

FavoritesPage 无需额外订阅逻辑，复用 MarketPanel 的启动订阅即可。

---

## 测试结果

```
Test Files: 64 passed (64)
Tests:      665 passed (665)  (+1 新增 isFavorited=true 测试)
```
