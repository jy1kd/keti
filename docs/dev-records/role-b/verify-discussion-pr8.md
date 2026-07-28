# PR-8 人工验证讨论记录

## 验证项 #1：五档行情显示

### 问题描述
行情表格消失了，只剩一个价差显示，数据还是 `--`。

### 分析
`.panel-content` 从 `flex-direction: column`（全局样式）被覆盖为 `display: flex`（默认 row），但 `.market-panel__main` 缺少 `height: 100%` 或 `display: flex; flex-direction: column`，导致内部的 MarketTable 无法撑开高度。

### 解决方案
1. 方案A：给 `.market-panel__main` 添加 `display: flex; flex-direction: column; min-height: 0`（让子元素继承高度）
2. 方案B：给 `.market-panel__main` 添加 `height: 100%`（简单但不够灵活）

### 最终决定
采用方案A — flex column 布局更可靠，`min-height: 0` 允许 flex 子元素收缩。

### 处理结果
- 已修复
- Commit：`54b4f1a`

---

## 验证项 #2：五档行情触发方式

### 问题描述
需要在合约搜索里点击才能显示五档行情，点击行情表格行不触发。

### 分析
MarketTable 的 `click_cell` 事件有保护逻辑：`record.lastPrice !== PLACEHOLDER`。当数据显示 `--` 时，点击不触发回调（无有效价格不可点价报单）。ContractSearch 的 `handleSelectContract` 直接调用 `setSelectedInstrument()`，不检查价格。

### 最终决定
**设计如此，无需修改。** 交易时段 WebSocket 推送数据后，表格显示真实价格，点击行也能触发五档行情。

### 处理结果
- 无需修复

---

## 验证项 #3：控制台输出 "买入 IF2608 0"

### 问题描述
F12 控制台显示 `买入 IF2608 0`，价格为 0。

### 分析
选中 IF2608 后，五档行情显示空数据（WebSocket 尚未推送），所有价格字段为 `0`。点击卖行时 `level.price = 0`，控制台输出 `买入 IF2608 0`。交易时段数据到达后价格变为真实值。

### 最终决定
**预期行为，无需修改。**

### 处理结果
- 无需修复
