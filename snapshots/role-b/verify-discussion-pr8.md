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
