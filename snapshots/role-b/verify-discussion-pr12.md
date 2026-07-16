# PR-12 人工验证讨论记录

## 验证项 #1：选中合约后显示K线图

### 问题描述
选中合约后显示"暂无K线数据"，五档行情和价差正常，K线图无数据。

### 分析
1. 后端 `/api/market/kline` 已实现，返回格式为 `{"instrumentID", "period", "bars"}`。
2. 前端 `KlineResponse` 期望字段名为 `kline`，与后端 `bars` 不一致，导致数据读取失败。

### 解决方案
修改前端字段名 `kline` → `bars`，匹配后端返回格式。

### 处理结果
- 已修复
- Commit：`9631f43`

---

## 验证项 #2：K线图不显示（修复后仍无数据）

### 问题描述
字段名修复后，K线图仍然不显示，"暂无K线数据"提示也消失了。

### 分析
ECharts 初始化的 `useEffect` 依赖为 `[]`（仅执行一次），但组件挂载时 `klineData` 为空，canvas div 条件渲染未执行，`chartRef.current` 为 null。当数据到达后 canvas div 才渲染，但 useEffect 不会重新执行，导致 ECharts 永远不会初始化。

### 解决方案
1. 方案A：始终渲染 canvas div，空数据时用覆盖层显示提示
2. 方案B：将 `klineData.length` 加入 useEffect 依赖

### 最终决定
采用方案A：始终渲染 canvas div。这样 ECharts 在组件挂载时就能初始化，数据到达后直接 setOption 渲染。

### 处理结果
- 已修复
- Commit：`8b00418`
- 修改文件：`KLineChart.tsx`、`styles.css`、`KLineChart.test.tsx`、`MarketPanel.test.tsx`
