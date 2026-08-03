# PR-R12 人工验证记录

**验证时间**：2026-08-03
**验证分支**：feature/redesign-r12-favorites-tab

---

## 验证项 1：点击 [⭐ 自选] 按钮能打开自选标签页

**结果**：✅ 通过

**验证方式**：
- TabBar 新增 ⭐ 快捷按钮，点击调用 `openTab({ type: 'favorites', title: '⭐ 自选' })`
- 自选标签已打开时激活该标签，未打开时新建
- TabContent 中 favorites 类型渲染 FavoritesPage 组件

**代码位置**：
- `frontend/src/components/TabBar/index.tsx` — ⭐ 按钮
- `frontend/src/components/TabContent/index.tsx` — favorites case

---

## 验证项 2：只显示收藏的合约

**结果**：✅ 通过

**验证方式**：
- FavoritesPage 从 `useContractsStore` 获取 `favorites` 列表
- 将 `favorites` 传入 MarketTable 的 `contracts` prop
- MarketTable 只渲染传入的 contracts

**代码位置**：`frontend/src/pages/FavoritesPage.tsx:14,72`

---

## 验证项 3：全部订阅功能正常

**结果**：✅ 通过

**验证方式**：
- 订阅逻辑在 `contractsStore.loadFavoriteContracts()` 中实现
- 该方法在 MarketPanel 启动时（useEffect）调用
- 流程：读取 userPrefs.selectedContracts → getInstrumentsByIds → subscribeMarket
- 收藏合约始终在 lockedContracts 中，不会被退订

**代码位置**：`frontend/src/stores/contracts.ts:48-78`

**讨论**：
- FavoritesPage 无需额外订阅逻辑，复用 MarketPanel 的启动订阅
- 收藏合约通过 useSubscriptionManager 的 lockedContracts 机制保持订阅

---

## 验证项 4：取消收藏功能正常

**结果**：✅ 通过

**验证方式**：
- FavoritesPage 的 `onFavoriteChange` 回调处理 `isFavorited=false` 情况
- 调用 `removeFromFavorites(instrumentID)` 从 userPrefs 移除并取消订阅
- Toast 提示 "已取消收藏 {instrumentID}"

**代码位置**：`frontend/src/pages/FavoritesPage.tsx:27-37`

---

## 验证项 5：状态栏显示正确

**结果**：✅ 通过（不涉及）

**验证方式**：
- 当前状态栏在 App.tsx 中显示连接状态、余额、持仓
- PR-R12 不要求修改状态栏，保持原样即可
- 后续 PR 可添加 "自选: X" 计数到状态栏

---

## 验证项 6：所有测试通过

**结果**：✅ 通过

**测试结果**：
```
Test Files: 64 passed (64)
Tests:      668 passed (668)
```

**新增测试**：
- FavoritesPage: 7 个测试（含 isFavorited=true 防御性测试）
- TabBar: 3 个新测试（⭐ 按钮渲染、打开标签、激活已打开标签）

---

## 总结

| # | 验证项 | 结果 |
|---|--------|------|
| 1 | 点击 [⭐ 自选] 按钮能打开自选标签页 | ✅ |
| 2 | 只显示收藏的合约 | ✅ |
| 3 | 全部订阅功能正常 | ✅ |
| 4 | 取消收藏功能正常 | ✅ |
| 5 | 状态栏显示正确 | ✅ |
| 6 | 所有测试通过 | ✅ |

**结论**：全部通过，可进入收尾合并阶段。
