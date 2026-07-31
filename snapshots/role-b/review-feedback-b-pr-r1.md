# PR-R1 审查反馈：合约数据源重构

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-07-31
**审查轮次**: R1

---

## 改动范围

10 个文件，+207/-274 行：
- `frontend/src/stores/contracts.ts` — 核心重构：presetContracts/userContracts → contracts/favorites
- `frontend/src/stores/contracts.test.ts` — 测试更新
- `frontend/src/modules/market/MarketPanel.tsx` — 适配新 store API
- `frontend/src/modules/market/MarketPanel.test.tsx` — 测试更新
- `frontend/src/components/InstrumentSearchModal/index.tsx` — 移除 onSubscribeNew prop
- `frontend/src/hooks/useMarketWs.ts` — loadSubscribedContracts → loadAllInstruments
- `frontend/src/hooks/useMarketWs.test.ts` — 测试更新
- `frontend/src/pages/__tests__/KLinePage.test.tsx` — store state shape 更新
- `frontend/src/pages/__tests__/OrderPage.test.tsx` — store state shape 更新
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

60 test files, 590 tests passed ✅

---

## 发现问题

### 🔴 阻断性

**B1: `removeContractById` 行为退化 — "退订"功能变成死 UI**

- 位置: `contracts.ts:112-115`、`MarketPanel.tsx:80-86`、`InstrumentSearchModal/index.tsx:265-272`
- 问题: `removeContractById` 从原来的「CTP 退订 + 从预设/自选移除 + 持久化」变为仅 `contracts.filter()`（同步、本地、不持久化）。但 UI 仍然存在：
  - MarketPanel 的「退订」按钮（line 154-160）→ 调用 `removeContractById`，显示 toast「已退订」
  - InstrumentSearchModal 的「退订」列（line 265-272）→ 每个合约都显示「退订」按钮
- 影响: 用户点击「退订」后合约从当前视图消失，但刷新页面后重新出现。toast 提示「已退订」具有误导性。在全量合约模式下（~6000+），所有搜索结果都显示「退订」按钮，但实际上无任何持久化效果。
- 建议: 移除 MarketPanel 和 InstrumentSearchModal 中的「退订」按钮及相关代码，或将其改为与「移除收藏」合并。

---

### 🟡 改进建议

**S1: 死代码未清理**

- `api.ts:201` — `getPresetInstruments` 函数已无调用方，仅定义未使用
- `userPrefs.ts:40,56,85-86,91,95,98,109` — `manualPresetIds` 字段已无使用方（contracts store 不再引用）
- 建议: 在此 PR 中一并清理，避免后续 PR 累积技术债

**S2: `addToFavorites` 订阅失败时静默添加收藏**

- 位置: `contracts.ts:74-91`
- 问题: `subscribeMarket` 失败被 catch 静默忽略，但合约仍然添加到 `favorites`。用户看到收藏成功，但该合约可能没有行情数据。
- 建议: 订阅失败时考虑不添加到 favorites，或至少在 UI 层提示用户

**S3: `loadFavoriteContracts` 中无效 ID 未清理**

- 位置: `contracts.ts:60-61`
- 问题: `selectedIds` 可能包含已下架的合约 ID，`getInstrumentsByIds` 返回的结果不包含这些 ID，但它们仍留在 `userPrefs.selectedContracts` 中。
- 建议: 对比 `selectedIds` 与返回结果，清理无效 ID（可选，不阻断）

---

## 审查结论

❌ **需要修改** — B1 必须修复后再审

修复建议：
1. 移除 MarketPanel「退订」按钮 + `handleUnsubscribe` 函数
2. 移除 InstrumentSearchModal「退订」列 + `handleUnsubscribe` + `onUnsubscribe` prop
3. 移除 `contracts.ts` 中的 `removeContractById` 方法
4. （可选）清理 S1 死代码
