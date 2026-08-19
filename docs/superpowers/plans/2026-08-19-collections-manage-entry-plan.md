# 实施计划：行情面板「收藏夹管理」入口按钮

日期：2026-08-19

## 背景
按设计文档 `docs/superpowers/specs/2026-08-19-collections-manage-entry-design.md`，在行情面板顶部工具栏搜索框左侧新增一个收藏夹管理图标按钮，点击调用 `openCollectionsFloating()` 打开现成的「📁 收藏夹」管理浮窗。纯前端、无后端改动。

## 前置
在 `feature/collections-manage-entry` 分支上工作（从 main 切出）。

## 步骤

### 1. 确认图标素材
- 在前端查找是否已有收藏夹/文件夹图片素材（`frontend/src/assets`、`frontend/public` 或现有图标组件）。
- 有则用之；无则用一个内嵌 SVG/emoji（📁）占位，后续可换。

### 2. MarketPanel.tsx — 加按钮
- 在 `.market-search-bar` 内、`ContractSearch` 之前插入：
  ```tsx
  <button
    type="button"
    className="btn-collections-manage"
    title="收藏夹管理"
    data-testid="btn-collections-manage"
    onClick={() => openCollectionsFloating()}
  >
    {/* 图标 */}
  </button>
  ```
- 顶部 `import { openCollectionsFloating } from '@/utils/openFloatingTab'`。

### 3. styles.css — 样式
- 新增 `.btn-collections-manage`，对齐现有 `.btn-contract-filter` 视觉（透明、hover 高亮、统一 border/圆角），图标尺寸适中、居中。

### 4. MarketPanel.test.tsx — 测试
- 复用已有对 `openFloatingTab` 的 mock；补 1 条：`fireEvent.click` 该按钮 → 断言 `mockOpenFloatingTab` 收到 `{ type: 'collections', title: '📁 收藏夹' }`。

### 5. 验证
- `cd frontend && npm test`（全量前端测试通过）。
- `npm run build` 通过。

### 6. 提交
- 分两个 commit：`feat(market): 行情面板搜索框左侧新增收藏夹管理入口按钮`、`test(market): 收藏夹管理入口按钮用例`（或合并）。

## 验收
- 行情面板顶部、搜索框左侧出现收藏夹图标按钮。
- 点击弹出与顶部菜单一致的「📁 收藏夹」管理浮窗。
- 469 个前端测试全通过，build 无报错。
