# Resizable Panels 审查反馈处理记录

**PR**：Resizable Panels（可调整面板布局）
**处理时间**：2026-07-16
**审查轮次**：第 1 轮

---

## 修复统计

- 🔴 阻断性问题：无
- 🟡 改进建议：采纳 3 条，保留 1 条
- 🔵 疑问确认：已回复 2 条

---

## 🟡 改进建议处理

### 1. panelStorage 未被使用

**状态**：✅ 采纳

**修复内容**：
- 使用 react-resizable-panels 内置的 `autoSaveId` 功能替代自定义 `panelStorage`
- `autoSaveId` 自动将布局保存到 localStorage，无需手动调用
- `panelStorage.ts` 已不再需要，可保留作为备用工具

**Commit**：`484031b`

### 2. Panel 缺少 id 属性

**状态**：✅ 采纳

**修复内容**：
- 为每个 Panel 添加唯一 `id`：
  - App: `main`, `market`, `order`, `query`
  - MarketPanel: `market-main`, `market-side`

**Commit**：`484031b`

### 3. Group autoSaveId

**状态**：✅ 采纳

**修复内容**：
- 为每个 Group 添加 `autoSaveId`：
  - App 外层: `app-layout`
  - App 内层: `main-layout`
  - MarketPanel: `market-layout`

**Commit**：`484031b`

### 4. ResizeHandle 样式硬编码 opacity

**状态**：⏳ 保留

**保留理由**：`opacity: 0.4` 是设计细节，当前暗色主题下效果良好。如需支持亮色主题切换，可在后续统一处理 CSS 变量，不影响当前功能。

---

## 🔵 疑问确认

### 1. 嵌套可调面板

**回复**：是的，两层可调面板是预期设计：
- 外层：行情/报单/查询（整体布局）
- 内层：行情表格+K线图 / 五档行情+价差（行情面板内部）

这符合交易系统常见布局（如 TradingView、文华财经），用户可按需调整各区域大小。

### 2. direction 默认值

**回复**：`direction` 默认 `horizontal` 是合理的选择：
- 大部分分割是水平方向（左右分割：行情/报单、主区域/侧边栏）
- 垂直分割（上下分割：主区域/查询）较少，显式指定更清晰
- 减少使用时的认知负担

---

## Commit 列表

- `484031b` fix(resizable): review反馈 - 添加Panel id和autoSaveId实现自动持久化
