# 行情面板「收藏夹管理」入口按钮 设计文档

日期：2026-08-19
状态：已确认

## 目标

在行情面板顶部工具栏（合约搜索框左侧）新增一个收藏夹管理入口图标按钮，点击后打开与顶部原生菜单栏「📁 收藏夹」一致的收藏夹管理浮窗。无任何后端改动，纯前端小改动。

## 交互

- 位置：`frontend/src/modules/market/MarketPanel.tsx` 顶部工具栏 `.market-search-bar` 内，**合约搜索框左侧**。
- 行为：点击按钮 → 调用现成的 `openCollectionsFloating()`（`frontend/src/utils/openFloatingTab.ts`），弹出「📁 收藏夹」管理浮窗（900×600，可 ⇧ 停靠回标签栏）。
- 图标：使用项目内现有收藏夹图片素材渲染（`<img>` 优先；若无现成素材则用占位图标，后续替换）。
- 辅助：按钮加 `title="收藏夹管理"` 悬浮提示；样式与现有工具栏按钮（`btn-contract-filter` 风格）一致——透明背景、hover 高亮、统一 border/圆角。

## 实现范围

| 文件 | 改动 |
|------|------|
| `frontend/src/modules/market/MarketPanel.tsx` | 在 `.market-search-bar` 内搜索框前插入图标按钮；`onClick={() => openCollectionsFloating()}` |
| `frontend/src/modules/market/styles.css` | 新增 `.btn-collections-manage`（或等价）样式类，对齐现有按钮视觉 |
| `frontend/src/modules/market/MarketPanel.test.tsx` | 补 1 条测试：点击按钮 → `openFloatingTab` 以输入 `type:'collections'` 被调用 |

## 明确不做（YAGNI）

- 不加 Popover / 快捷订阅列表。
- 不改变现有收藏夹管理页与浮窗逻辑。
- 不改后端，不加新接口。