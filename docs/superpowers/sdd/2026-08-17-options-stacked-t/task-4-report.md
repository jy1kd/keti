# Task 4 Report — OptionsPanel 重写为堆叠可折叠 T 型链

## Status: DONE

## Commit
- `b8963e6` — feat(options): 期权页重构为堆叠可折叠 T 型链（P1）

## Files Changed
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（重写：平铺 QuoteTable → 堆叠 OptionChainGroup[]）
- Modify: `frontend/src/modules/options/OptionsPanel.test.tsx`（重写核心测试：14 cases）
- Modify: `frontend/src/components/InstrumentSearchModal/index.tsx`（适配新增 expandGroup 回调）

## Implementation Summary
1. OptionsPanel 数据管道：baseOptions → filterByExchangeAndProduct → groupOptionsByUnderlying → visibleGroups（搜索过滤组名/品种名）。
2. 渲染：`<div className="options-groups">{visibleGroups.map(g => <OptionChainGroup ... />)}</div>`；平铺 QuoteTable 完全移除。
3. 工具栏：ContractFilter（组粒度）+ ContractSearch（搜索过滤组 + 选中展开定位组）+ 🔍 高级搜索（选中合约 → 定位并展开组）；⭐ 收藏按钮移除（P2 恢复）。
4. onSelectContract：setSelectedInstrument + setOrderInstrument + 非期货时 setOrderForm({limitPrice})。
5. InstrumentSearchModal：回调增加 expandGroup 能力，定位选中合约所在组。

## Test Summary
`vitest run src/modules/options/OptionsPanel.test.tsx` → **14 passed / 0 failed**
Cover: 默认折叠、指数期权组头可见、搜索过滤组、合约选中展开定位。

## Concerns
- None. Clean implementation per brief.
