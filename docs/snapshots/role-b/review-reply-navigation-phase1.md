# 审查回复 — navigation-redesign Phase 1

- **开发窗口**：角色 B（前端）
- **对应反馈**：`review-feedback-navigation-phase1.md`（有条件通过，无 🔴，🟡×3 + 🔵×2）
- **回复日期**：2026-08-07

## 处理结果

| 反馈项 | 处置 | 说明 |
|--------|------|------|
| 🟡-1 工具栏搜索区 max-width 360px + actions margin-left:auto 产生空隙 | ✅ 修复 | 移除搜索区 `max-width: 360px`（保留 `flex:1`），移除 actions `margin-left:auto` → 三段紧排，搜索区吃掉中间空间。新增 `MarketPanel.style.test.tsx` 断言锁定。宽屏/窄屏观感留待人工验证阶段走查。 |
| 🟡-2 KLineChart 标题栏 title 覆盖整行，误导悬停控件 | ✅ 修复 | `title` 从整行 header 移至 `.kline-chart__contract`（合约信息区），`data-drag-handle` 仍保留整行。更新 KLineChart 测试断言（header 无 title、contract 区有 title）。 |
| 🟡-3 死代码 `.query-panel .panel-header h2` | ✅ 修复 | 删除该死规则（全局 `.panel-header h2` 保留，供 OrderPanel 使用）。 |
| 🔵-1 market-toolbar data-drag-handle 惰性 | ✅ 回答 + 注释 | 确认惰性（market 为固定标签 `closable:false`，TabContent 直接 return），与旧 `market-tabs` 行为一致非回归。在 `MarketPanel.tsx` 工具栏加注释：保留以对齐 Phase 2 全局栏合并后的拖拽语义。 |
| 🔵-2 TabContent 断言改为「暂无自选合约」退化 | ✅ 采纳 | `FavoritesPage` 根元素加 `data-testid="favorites-page"`，TabContent 测试从 `it.each` 文本断言改为独立 `getByTestId` 断言，不再依赖空状态文案。 |

## 验证

- **全量测试**：`npm test` **1050 passed**（95 files），较修复前 1047 净增 3 项（KLineChart +1、MarketPanel.style +2）。
- **受影响测试**：KLineChart / MarketPanel.style / TabContent 三个文件 52 tests 通过。
- **修复代码均配测试**：🟡-1 新增样式断言测试；🟡-2 更新 KLineChart 测试；🔵-2 新增 testid 断言测试。

## 待二次审查

以上修复已提交，请审查窗口做二次审查（二次审查通过后进入人工验证阶段）。
