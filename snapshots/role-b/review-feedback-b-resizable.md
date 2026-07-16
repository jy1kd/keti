# Resizable Panels Code Review 反馈

## 第 1 轮审查（初审）

**审查分支**：`feature/pr-12-kline-chart`（resizable commits）
**审查 commit**：`c81f79b` ~ `fdaceb5`（6 commits）
**审查时间**：2026-07-16

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

1. **【panelStorage.ts】定义了持久化工具但未被使用**
   - 现状：`savePanelSizes` 和 `loadPanelSizes` 已实现，但 `App.tsx` 和 `MarketPanel.tsx` 中未调用
   - 问题：面板尺寸调整后刷新页面会重置为默认值，用户体验不完整
   - 建议：在 Panel 组件上添加 `onResize` 回调，调用 `savePanelSizes`；在 `defaultSize` 处改为从 `loadPanelSizes` 读取：
     ```typescript
     // App.tsx
     const savedSizes = loadPanelSizes('app')
     <Panel defaultSize={savedSizes?.['market'] ?? 70} minSize={20} onResize={(size) => savePanelSizes('app', { 'market': size })}>
     ```

2. **【App.tsx:17-42】Panel 缺少 id 属性**
   - 现状：`<Panel defaultSize={70}>` 未设置 `id`
   - 问题：react-resizable-panels 的持久化功能需要 Panel 有唯一 `id`
   - 建议：为每个 Panel 添加 `id`：
     ```typescript
     <Panel id="market" defaultSize={70} minSize={20}>
     <Panel id="order" defaultSize={30} minSize={15}>
     <Panel id="query" defaultSize={25} minSize={10}>
     ```

3. **【App.tsx:16】Group 命名建议**
   - 现状：`<Group orientation="vertical" className="main-content">`
   - 建议：考虑添加 `autoSaveId` 属性支持自动持久化：
     ```typescript
     <Group orientation="vertical" className="main-content" autoSaveId="app-layout">
     ```

4. **【global.css】ResizeHandle 样式使用硬编码颜色**
   - 现状：`.resize-handle:active .resize-handle__indicator { background: var(--accent); }` — 已使用 CSS 变量，但部分样式如 `opacity: 0.4` 是硬编码
   - 建议：考虑将 opacity 也定义为 CSS 变量，便于主题切换

---

### 🔵 疑问确认

1. **【MarketPanel.tsx:77-123】内部布局 vs 外部布局**
   - 现状：MarketPanel 内部使用 `Group/Panel/Separator` 实现主区域/侧边栏可调
   - 疑问：这是否与 App.tsx 的外部布局（行情/报单/查询）形成嵌套可调面板？
   - 确认：两层可调面板的交互是否符合预期？

2. **【ResizeHandle/index.tsx:9】direction 默认值**
   - 现状：`direction = 'horizontal'` 默认为水平方向
   - 疑问：是否需要根据父容器的 `orientation` 自动推断方向？

---

### 审查结论

**✅ 通过**

**理由**：
1. 无阻断性问题，TypeScript 编译通过（0 errors）
2. 173 个测试全部通过（26 文件），新增：
   - ResizeHandle 组件测试（3 个）
   - ResizeHandle 样式测试（2 个）
   - panelStorage 测试（4 个）
   - App 布局测试（新增 1 个 resize handle 验证）
   - MarketPanel 集成测试（新增 1 个 resize handle 验证）
3. 功能完整性：可调整面板布局、暗色主题样式、localStorage 持久化工具 — 均已实现
4. 代码质量：组件职责清晰、样式使用 CSS 变量、测试覆盖充分

**改进建议**：
- 上述 🟡 改进建议可在后续 PR 中逐步完善
- 特别是 `panelStorage` 的实际调用（建议在 PR-10 或单独小 PR 中实现）

**下一步**：
建议将这 6 个 commit 合并到 main，或作为 PR-12 的一部分提交。

**人工验证内容**：
```bash
# 1. 启动前端
cd frontend && npm run dev

# 2. 浏览器访问 http://localhost:5173

# 3. 验证以下内容：
#    - 行情面板与报单面板之间有拖拽手柄
#    - 拖拽手柄可左右调整行情/报单比例
#    - 主区域与查询面板之间有拖拽手柄
#    - 拖拽手柄可上下调整主区域/查询比例
#    - 行情面板内部主区域与侧边栏之间有拖拽手柄
#    - 拖拽手柄可左右调整主区域/侧边栏比例
#    - 拖拽手柄 hover 时高亮显示
#    - 刷新后面板比例重置（panelStorage 未接入）
#    - 控制台无报错
```
