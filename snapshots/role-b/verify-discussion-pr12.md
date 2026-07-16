# PR-12 人工验证讨论记录

## 验证项 #1：选中合约后显示K线图

### 问题描述
选中合约后显示"暂无K线数据"，五档行情和价差正常，K线图无数据。

### 分析
后端 `/api/market/kline` 已实现，返回格式为 `{"instrumentID", "period", "bars"}`。
前端 `KlineResponse` 期望字段名为 `kline`，与后端 `bars` 不一致，导致数据读取失败。

### 解决方案
1. 方案A：修改前端字段名 `kline` → `bars`（匹配后端）
2. 方案B：修改后端返回字段名 `bars` → `kline`（匹配前端）

### 最终决定
采用方案A：修改前端。后端 API 已上线，改动前端更安全。

### 处理结果
- 已修复
- Commit：`9631f43`
- 修改文件：`api.ts`、`api.test.ts`、`MarketPanel.tsx`、`MarketPanel.test.tsx`
