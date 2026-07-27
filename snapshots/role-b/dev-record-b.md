# 角色B 开发记录

## PR-2: 前端项目初始化

**分支**：`feature/pr-2-frontend-init`
**开始时间**：2026-07-09
**状态**：✅ 已完成

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | connection store | connection.test.ts | 4 | ✅ 全部通过 |
| 2 | contracts store | contracts.test.ts | 7 | ✅ 全部通过 |
| 3 | userPrefs store | userPrefs.test.ts | 8 | ✅ 全部通过 |
| 4 | format utils | format.test.ts | 14 | ✅ 全部通过 |
| 5 | validators utils | validators.test.ts | 12 | ✅ 全部通过 |
| 6 | api service | api.test.ts | 5 | ✅ 全部通过 |
| 7 | ws service | ws.test.ts | 7 | ✅ 全部通过 |

**总计**：57个测试，全部通过

---

### 实现文件清单

| 文件 | 说明 |
|------|------|
| `package.json` | 项目依赖配置（react, vtable, zustand, axios, echarts, vitest） |
| `tsconfig.json` | TypeScript 配置 |
| `vite.config.ts` | Vite 构建配置（含 API 代理） |
| `vitest.config.ts` | Vitest 测试配置 |
| `index.html` | HTML 入口 |
| `.env` | 环境变量（API_BASE, WS_BASE） |
| `src/vite-env.d.ts` | Vite 类型声明 |
| `src/main.tsx` | React 入口 |
| `src/App.tsx` | 主应用（基础布局骨架） |
| `src/assets/styles/global.css` | 全局样式（暗色主题） |
| `src/services/types.ts` | TypeScript 类型定义（与 design.md 一致） |
| `src/services/api.ts` | Axios REST API 封装 |
| `src/services/ws.ts` | WebSocket 管理器（分端点连接） |
| `src/stores/connection.ts` | 连接状态 Store |
| `src/stores/contracts.ts` | 合约列表 Store |
| `src/stores/userPrefs.ts` | 用户偏好 Store（localStorage 持久化） |
| `src/utils/format.ts` | 格式化工具（价格/数量/时间/涨跌） |
| `src/utils/validators.ts` | 表单校验工具（价格/数量/合约代码） |

---

### 遇到的问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `create-vite@9.x` 安装失败 | Node.js v20.0.0 版本过低，需要 ^20.19.0 | 手动创建项目结构和 package.json |
| ws.test.ts 1个测试失败 | MockWebSocket 未定义静态常量 OPEN/CLOSED | 添加 static CONNECTING/OPEN/CLOSING/CLOSED |
| TypeScript 编译报错 | ws.ts 导入了未使用的 WSMessageType | 删除未使用的导入 |

---

### PR-2 改进：字段命名统一为 camelCase

**时间**：2026-07-10
**原因**：docs 文档基于真实 API 更新后，发现 types.ts 使用 snake_case 与 CTP 回调数据的 camelCase 不一致

**变更内容**：

| 变更项 | 说明 |
|--------|------|
| types.ts 全部接口 | snake_case → camelCase，与 CTP 回调字段名一致 |
| MarketSnapshot | 补充 20 个 CTP 标准字段（closePrice, settlementPrice, upperLimitPrice 等） |
| OrderRequest | 字段重命名（offset→combOffsetFlag, price→limitPrice, volume→volumeTotalOriginal），补充 orderPriceType |
| OrderRecord/OrderStatus | 字段重命名对齐 CTP |
| StopOrderRequest/StopOrder | 字段重命名对齐 CTP |
| TradeRecord | offset→offsetField, trade_time→tradeTime |
| PositionRecord | 补充 openCost, useMargin, tradingDay；direction→posiDirection |
| AccountInfo | 补充 currMargin, deposit, withdraw, preBalance, tradingDay；移除 frozen_cash, risk_ratio |
| ContractInfo | 字段重命名对齐 CTP（volumeMultiple, priceTick, isTrading） |
| VolatilityData | 补充 underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType |
| ConnectionStatusData | md_connected→mdConnected, td_connected→tdConnected |
| ApiResponse.error | ctp_error_id→ctpErrorID, ctp_error_msg→ctpErrorMsg |
| connection.ts store | md_connected→mdConnected, td_connected→tdConnected |
| 测试文件 | 同步更新字段名（connection, contracts, ws） |

**验证**：57 个测试全部通过，TypeScript 编译无错误

---

## PR-4: 前端多面板布局框架

**分支**：`feature/pr-4-layout-framework`
**开始时间**：2026-07-13
**状态**：✅ 已完成

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | ConnectionStatus | ConnectionStatus/index.test.tsx | 4 | ✅ 全部通过 |
| 2 | MarketStore | market/store.test.ts | 3 | ✅ 全部通过 |
| 3 | OrderStore | order/store.test.ts | 2 | ✅ 全部通过 |
| 4 | QueryStore | query/store.test.ts | 3 | ✅ 全部通过 |
| 5 | ContractSearch | ContractSearch/index.test.tsx | 2 | ✅ 全部通过 |
| 6 | MarketPanel | market/MarketPanel.test.tsx | 2 | ✅ 全部通过 |
| 7 | OrderPanel | order/OrderPanel.test.tsx | 2 | ✅ 全部通过 |
| 8 | QueryPanel | query/QueryPanel.test.tsx | 5 | ✅ 全部通过 |
| 9 | App Layout | App.test.tsx | 5 | ✅ 全部通过 |

**总计**：28个测试，全部通过

---

### 实现文件清单

| 文件 | 说明 |
|------|------|
| `src/components/ConnectionStatus/index.tsx` | 连接状态指示器（MD/TD 绿灯/红灯） |
| `src/components/ConnectionStatus/styles.css` | 连接状态样式 |
| `src/components/ContractSearch/index.tsx` | 合约搜索框（基础框架） |
| `src/components/ContractSearch/styles.css` | 搜索框样式 |
| `src/modules/market/store.ts` | 行情 Store（selectedInstrument） |
| `src/modules/market/MarketPanel.tsx` | 行情面板容器（左侧 70%） |
| `src/modules/market/styles.css` | 行情面板样式 |
| `src/modules/order/store.ts` | 报单 Store（selectedInstrument） |
| `src/modules/order/OrderPanel.tsx` | 报单面板容器（右侧 30%） |
| `src/modules/order/styles.css` | 报单面板样式 |
| `src/modules/query/store.ts` | 查询 Store（activeTab 切换） |
| `src/modules/query/QueryPanel.tsx` | 查询面板容器（底部 Tab 切换） |
| `src/modules/query/styles.css` | 查询面板样式 |
| `src/App.tsx` | 主应用（集成布局） |
| `src/assets/styles/global.css` | 全局布局样式（CSS Grid/Flex） |
| `src/setupTests.ts` | 测试设置（jest-dom 匹配器） |

---

### 验证结果

- ✅ 85个单元测试全部通过（PR-2: 57 + PR-4: 28）
- ✅ TypeScript 编译无错误
- ✅ 三栏布局正确（行情 70%、报单 30%、查询底部 250px）
- ✅ 连接状态指示器实时响应 Store 变化
- ✅ 查询面板 Tab 切换正常
- ✅ 暗色主题样式统一

---

### 提交记录

- `3feccf9` feat(PR-4): 前端多面板布局框架
- `ffedb9f` docs(PR-4): 更新进度快照和开发流程文档
- `e6077c6` refactor(PR-4): 设计系统优化 — CSS变量统一、无障碍、样式去重
- `13f956d` fix(PR-4): 移除 .con 敏感文件，添加到 .gitignore

---

## PR-6: 前端行情表格（vtable）

**分支**：`feature/pr-6-market-table`
**开始时间**：2026-07-13
**状态**：🔄 开发中

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | MarketStore | market/store.test.ts | 9 | ✅ 全部通过 |
| 2 | usePointOrder | hooks/usePointOrder.test.ts | 5 | ✅ 全部通过 |
| 3 | ContractSearch | ContractSearch/index.test.tsx | 9 | ✅ 全部通过 |
| 4 | MarketTable | market/MarketTable.test.tsx | 4 | ✅ 全部通过 |

**总计**：27个测试，全部通过（含全局 vtable mock）

---

### 实现文件清单

| 文件 | 说明 |
|------|------|
| `src/modules/market/store.ts` | 行情 Store 增强：snapshots Map、updateSnapshot、batchUpdate |
| `src/modules/market/MarketTable.tsx` | vtable 行情表格组件（列定义、涨跌计算、点击事件） |
| `src/modules/market/MarketPanel.tsx` | 行情面板集成（MarketTable + ContractSearch + 点价Hook） |
| `src/hooks/usePointOrder.ts` | 点价报单 Hook（单击报单、双击填充） |
| `src/components/ContractSearch/index.tsx` | 合约搜索框完善（模糊搜索、结果列表、点击选择） |
| `src/setupTests.ts` | 全局 vtable mock（canvas 库无法在 jsdom 运行） |

---

### 提交记录

- `762bfa0` feat(PR-6): MarketStore 增加 snapshots Map 和 updateSnapshot
- `80249bc` feat(PR-6): usePointOrder Hook 基础框架 — 单击报单、双击填充
- `46b2419` feat(PR-6): ContractSearch 模糊搜索 — 支持合约代码/名称搜索、结果列表、点击选择
- `4f5b52a` feat(PR-6): MarketTable 组件 — vtable 行情表格、列定义、涨跌计算、点击事件
- `51745d8` feat(PR-6): MarketPanel 集成 — MarketTable + ContractSearch + 点价Hook，全局 vtable mock
- `95234d4` feat(PR-6): MarketStore batchUpdate — 批量更新行情快照
- `921c7f7` fix(PR-6): ContractSearch 测试 mock 数据补全 ContractInfo 必填字段，修复 TypeScript 编译错误
- `080b551` fix(PR-6): vtable 容器高度为 0 — .market-table-container 样式 + panel-content flex 列 + stale closure 修复
- `3c3b64f` feat(PR-6): 开发环境 mock 行情数据 — 5 个合约（au/ag/cu/rb/IF）初始化到 store
- `38cebf2` fix(PR-6): mock 数据字段名对齐 MarketSnapshot 类型 — highPrice→highestPrice, lowPrice→lowestPrice，补全五档盘口和必填字段
- `c405f63` feat(PR-6): 开发环境 mock 合约数据 — 16 个合约覆盖 SHFE/CFFEX/DCE/CZCE，搜索功能可用
- `cdb4823` fix(PR-6): 搜索结果过滤 — 只显示有行情数据的合约，避免点击后无反应
- `694cb76` feat(PR-6): 选中合约高亮 — 搜索选择后表格自动高亮并滚动到对应行
- `0f6b55f` fix(PR-6): 高亮修正 — selectCell→selectRow，整行高亮而非单列
- `7657bce` fix(PR-6): 滚动修正 — scrollToRow→scrollToCell，精确定位选中行
- `c02794e` fix(PR-6): 滚动索引修正 — vtable 行索引从 1 开始（0 是表头），scrollToCell row+1
- `fba344e` fix(PR-6): 滚动 API 替换 — scrollToCell→makeVisible，避免索引偏移问题

---

## PR-6a: 前端行情表格接入真实API

**分支**：`feature/pr-6a-market-real-api`
**开始时间**：2026-07-15
**状态**：🔄 开发中

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | Market API 函数 | services/api.test.ts | 6 | ✅ 全部通过 |
| 2 | useMarketWs Hook | hooks/useMarketWs.test.ts | 4 | ✅ 全部通过 |
| 3 | MarketStore API 集成 | market/store.test.ts | 4 | ✅ 全部通过 |
| 4 | MarketPanel 启动 | market/MarketPanel.test.tsx | 1 | ✅ 全部通过 |

**总计**：15个新增测试，全部通过（全量 122/122）

---

### 实现文件清单

| 文件 | 说明 |
|------|------|
| `src/services/api.ts` | 新增 getInstruments、subscribeMarket、getSnapshots |
| `src/hooks/useMarketWs.ts` | WebSocket 行情推送 Hook（market_data → updateSnapshot） |
| `src/modules/market/store.ts` | 去掉 mock，新增 fetchInstruments、subscribeInstruments |
| `src/modules/market/MarketPanel.tsx` | useEffect 调用 fetchInstruments |
| `src/modules/market/mockData.ts` | 已删除（mock 数据不再需要） |

---

### 提交记录

- `a2d767d` test(task-6a): failing tests for market API functions
- `30091a9` feat(task-6a): implement useMarketWs WebSocket hook
- `b18370c` feat(task-6a): remove mock data, add API integration to market store
- `863e6a0` feat(task-6a): MarketPanel calls fetchInstruments on mount
- `c5a00a2` refactor(task-6a): delete mockData.ts — no longer referenced

---

### 审查反馈修复

- `8ac415e` fix(task-6a): review反馈 - fetchInstruments同步到contracts store
- `5326be4` fix(task-6a): review反馈 - MarketPanel集成useMarketWs WebSocket推送
- `c05b4e1` fix(task-6a): review反馈 - 移除contracts store mock数据
- `269a0f1` fix(task-6a): review反馈 - 改进建议批量修复

---

## PR-8: 前端五档行情展示

**分支**：`feature/pr-8-depth-quote`
**开始时间**：2026-07-15
**状态**：🔄 开发中

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | DepthQuote 组件 | DepthQuote.test.tsx | 7 | ✅ 全部通过 |
| 2 | SpreadDisplay 组件 | SpreadDisplay.test.tsx | 4 | ✅ 全部通过 |
| 3 | MarketPanel 集成 | MarketPanel.test.tsx | 6 | ✅ 全部通过 |
| 4 | store 测试修复 | store.test.ts | 13 | ✅ 全部通过 |

**总计**：137 tests / 21 files 全部通过

---

### TDD 循环记录

**循环 #1：DepthQuote 基础渲染**
- 红灯：组件不存在 → 测试失败
- 绿灯：实现 DepthQuote 组件（instrumentID、lastPrice、5档买/卖、placeholder）
- Commit：`04809be`

**循环 #2：五档行情点价报单**
- 红灯：onClick 回调未接入 → 测试失败
- 绿灯：bid 行绑定 onSellClick，ask 行绑定 onBuyClick
- Commit：`17a444e`

**循环 #3：SpreadDisplay 价差显示**
- 红灯：组件不存在 → 测试失败
- 绿灯：实现 SpreadDisplay（ask1-bid1 价差、placeholder）
- Commit：`fb8182d`

**循环 #4：MarketPanel 集成**
- 红灯：DepthQuote + SpreadDisplay 未集成 → 测试失败
- 绿灯：MarketPanel 新增 side panel，集成两个组件
- Commit：`3c0d640`

**循环 #5：样式 + 布局**
- 实现 DepthQuote 样式（琥珀主题、涨跌色、hover 效果）
- 实现 SpreadDisplay 样式
- MarketPanel 新增 .panel-content flex 布局（main + side）
- Commit：`c1d53ce`

**修复：store 测试对齐**
- 修复 subscribeInstruments 测试（不再调用 getSnapshots，依赖 WS 推送）
- Commit：`b1b5bb4`

---

### 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/modules/market/DepthQuote.tsx` | 新增 | 五档行情组件（5档买/卖、点价回调） |
| `src/modules/market/DepthQuote.test.tsx` | 新增 | 7 个测试用例 |
| `src/components/SpreadDisplay/index.tsx` | 新增 | 价差显示组件 |
| `src/components/SpreadDisplay/SpreadDisplay.test.tsx` | 新增 | 4 个测试用例 |
| `src/modules/market/MarketPanel.tsx` | 修改 | 集成 DepthQuote + SpreadDisplay 到 side panel |
| `src/modules/market/MarketPanel.test.tsx` | 修改 | 新增 2 个集成测试 |
| `src/modules/market/styles.css` | 修改 | 新增 .panel-content flex 布局 |
| `src/assets/styles/global.css` | 修改 | 新增 DepthQuote + SpreadDisplay 样式 |
| `src/modules/market/store.test.ts` | 修改 | 修复 subscribeInstruments 测试 |

---

### 提交记录

- `04809be` test(PR-8): DepthQuote component - renders instrument, price, 5 bid/ask levels, placeholder
- `8356c65` test(PR-8): failing tests for bid/ask click → point order callbacks
- `17a444e` feat(PR-8): DepthQuote point order - bid rows bind onSellClick, ask rows bind onBuyClick
- `f80d138` test(PR-8): failing tests for SpreadDisplay - spread calculation, placeholder, negative spread
- `fb8182d` feat(PR-8): implement SpreadDisplay - ask1-bid1 spread, placeholder for zero prices
- `b298585` test(PR-8): failing tests for MarketPanel integration - DepthQuote + SpreadDisplay for selected instrument
- `3c0d640` feat(PR-8): integrate DepthQuote + SpreadDisplay into MarketPanel side panel
- `c1d53ce` feat(PR-8): DepthQuote + SpreadDisplay styles, MarketPanel side panel layout
- `b1b5bb4` fix(PR-8): update store test - subscribeInstruments no longer calls getSnapshots (relies on WS push)

---

### 审查反馈修复

- `3239188` fix(PR-8): review反馈 - destructure onBuyClick/onSellClick in DepthQuote
- `980047a` fix(PR-8): review反馈 - unused imports, mock types, SpreadDisplay zero-price check
- `6755460` docs(PR-8): review reply - fix summary and question responses

---

## PR-12: 前端K线图实现

**分支**：`feature/pr-12-kline-chart`
**开始时间**：2026-07-16
**状态**：✅ 已合并

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | market store klineData | store.test.ts | 5 | ✅ 全部通过 |
| 2 | getKlineData API | api.test.ts | 2 | ✅ 全部通过 |
| 3 | KLineChart 组件 | KLineChart.test.tsx | 11 | ✅ 全部通过 |
| 4 | KLineChart 样式 | KLineChart.style.test.tsx | 5 | ✅ 全部通过 |
| 5 | MarketPanel 集成 | MarketPanel.test.tsx | 2 | ✅ 全部通过 |

**总计**：161 passed / 23 files

### TDD 循环记录

| # | 功能 | 红灯 | 绿灯 | Commit |
|---|------|------|------|--------|
| 1 | store: klineData + setKlineData + appendKline | ✅ 5 fail | ✅ 19 pass | `2423a6c` |
| 2 | API: getKlineData | ✅ 2 fail | ✅ 13 pass | `cd09466` |
| 3 | KLineChart 基础渲染 | ✅ module not found | ✅ 7 pass | `318c63e` |
| 4 | KLineChart ECharts 渲染 | ✅ 4 fail | ✅ 11 pass | `df57c9e` |
| 5 | 样式 + MarketPanel 集成 | ✅ 5 fail | ✅ 161 pass | `b0203ef` |
| 6 | TypeScript 修复 | - | ✅ 157 pass | `df57be6` |
| 7 | MA 均线指标 | ✅ 1 fail | ✅ 13 pass | `af62b88` |
| 8 | MACD 指标 | ✅ 3 fail | ✅ 16 pass | `e58cb3b` |

### 文件变更记录

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| frontend/src/modules/market/store.ts | 修改 | 新增 klineData state, setKlineData/appendKline actions |
| frontend/src/modules/market/store.test.ts | 修改 | 新增 5 个 klineData 测试用例 |
| frontend/src/services/api.ts | 修改 | 新增 getKlineData 函数 |
| frontend/src/services/api.test.ts | 修改 | 新增 2 个 getKlineData 测试 |
| frontend/src/modules/market/KLineChart.tsx | 新增 | K线图组件（ECharts candlestick + volume） |
| frontend/src/modules/market/KLineChart.test.tsx | 新增 | 11 个组件测试 |
| frontend/src/modules/market/KLineChart.style.test.tsx | 新增 | 5 个样式测试 |
| frontend/src/modules/market/styles.css | 修改 | 新增 kline-chart 样式 |
| frontend/src/modules/market/MarketPanel.tsx | 修改 | 集成 KLineChart + 周期切换 + K线数据获取 |
| frontend/src/modules/market/MarketPanel.test.tsx | 修改 | 新增 getKlineData mock |

### 审查反馈修复

- `dc64da4` fix(PR-12): review反馈 - 日期格式化根据周期(1m/5m/1d)调整
- `2f50134` fix(PR-12): review反馈 - setOption首次全量替换，后续合并更新

---

## PR-12a: 前端补缺补差

**分支**：`feature/pr-12a-frontend-gaps`
**开始时间**：2026-07-17
**状态**：✅ 已完成

### 完成内容

| # | 功能 | 说明 |
|---|------|------|
| 1 | WebSocket断线重连 | useReconnect hook，指数退避（1s→16s），最多5次 |
| 2 | 行情WebSocket Hook | useMarketWs集成重连，snapshotToKline时间对齐 |
| 3 | PerfMonitor | FPS监控，状态栏按钮，低FPS警告 |
| 4 | K线图修复 | dataZoom保持、getOption空值保护、排序修复 |
| 5 | 涨跌幅计算修正 | `||` → `??`，结算价优先 |
| 6 | 合约搜索键盘导航 | ↑↓选择、Enter确认、Escape关闭、循环导航 |
| 7 | 行情表格修复 | 闭包陷阱、off-by-one、widthMode adaptive |
| 8 | 布局优化 | 上表格+五档，下K线全宽 |

### 提交记录

| Commit | 类型 | 说明 |
|--------|------|------|
| `bccca93` | feat | useReconnect hook |
| `1c2f665` | feat | useMarketWs集成useReconnect |
| `d9caa1c` | feat | 实时K线更新 |
| `7c5f88c` | feat | PerfMonitor组件 |
| `088554a` | fix | 涨跌幅计算基准修正 |
| `e531b77` | fix | review反馈修复 |
| `86c5c10` | fix | PerfMonitor快捷键 |
| `0c804ef` | feat | PerfMonitor改为状态栏按钮 |
| `6e2e986` | feat | K线周期对齐 |
| `15606e4` | fix | K线缩放保持 |
| `509208f` | fix | getOption空值保护 |
| `a666393` | fix | 历史K线时间对齐 |
| `4b165e1` | fix | K线时间戳修复 |
| `171f429` | fix | appendKline修复 |
| `f00d066` | fix | setKlineData排序 |

### 测试结果

- 测试文件：28 passed
- 测试用例：186 passed
- TypeScript：0 errors

---

## PR-10: 前端报单表单实现

**分支**：`feature/pr-10-order-form`
**开始时间**：2026-07-20
**状态**：✅ 已完成（待合并）

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | orderMapping 字段映射 | utils/orderMapping.test.ts | 21 | ✅ 全部通过 |
| 2 | Order API 函数 | services/api.test.ts | 15 (+2) | ✅ 全部通过 |
| 3 | Toast 提示组件 | components/Toast/index.test.tsx | 6 | ✅ 全部通过 |
| 4 | Order Store 增强 | order/store.test.ts | 11 (+9) | ✅ 全部通过 |
| 5 | usePriceStep Hook | hooks/usePriceStep.test.ts | 8 | ✅ 全部通过 |
| 6 | useHotKeys Hook | hooks/useHotKeys.test.ts | 9 | ✅ 全部通过 |
| 7 | OrderForm 组件 | order/OrderForm.test.tsx | 10 | ✅ 全部通过 |
| 8 | StopOrderForm 组件 | order/StopOrderForm.test.tsx | 7 | ✅ 全部通过 |
| 9 | OrderPanel 集成 | order/OrderPanel.test.tsx | 5 (+3) | ✅ 全部通过 |

**总计**：274 tests / 34 files 通过（新增 88 tests），0 failures

---

### TDD 循环记录

| # | 功能 | 红灯 | 绿灯 | Commit |
|---|------|------|------|--------|
| 1 | 字段映射工具 orderMapping.ts | ✅ 21 fail | ✅ 21 pass | `3f2941c` |
| 2 | Order API submitOrder/cancelOrder | ✅ 2 fail | ✅ 15 pass | `3f2941c` |
| 3 | Toast 组件 | ✅ 6 fail | ✅ 6 pass | `3f2941c` |
| 4 | Order Store 增强 | ✅ 9 fail | ✅ 11 pass | `3f2941c` |
| 5 | usePriceStep Hook | ✅ 8 fail | ✅ 8 pass | `3f2941c` |
| 6 | useHotKeys Hook | ✅ 9 fail → 1 logic fail | ✅ 9 pass | `3f2941c` |
| 7 | OrderForm 组件 | ✅ 10 fail | ✅ 10 pass | `3f2941c` |
| 8 | StopOrderForm 组件 | ✅ 7 fail | ✅ 7 pass | `3f2941c` |
| 9 | OrderPanel Tab 集成 | ✅ 3 fail | ✅ 5 pass | `3f2941c` |

---

### 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/utils/orderMapping.ts` | 新增 | 前端字符串↔CTP字符码映射（direction/offset/priceType/timeCondition/orderStatus） |
| `src/utils/orderMapping.test.ts` | 新增 | 21 个测试用例 |
| `src/services/api.ts` | 修改 | 新增 submitOrder（自动转换字段）、cancelOrder |
| `src/services/api.test.ts` | 修改 | 新增 submitOrder/cancelOrder 测试 |
| `src/components/Toast/index.tsx` | 新增 | 轻量 Toast 组件（success/error，3秒消失，独立计时） |
| `src/components/Toast/index.test.tsx` | 新增 | 6 个测试用例 |
| `src/components/Toast/styles.css` | 新增 | Toast 样式 |
| `src/hooks/usePriceStep.ts` | 新增 | 价格步进 Hook（stepUp/stepDown/alignToTick） |
| `src/hooks/usePriceStep.test.ts` | 新增 | 8 个测试用例 |
| `src/hooks/useHotKeys.ts` | 新增 | 快捷键 Hook（B/S/C，仅报单面板焦点时生效） |
| `src/hooks/useHotKeys.test.ts` | 新增 | 9 个测试用例 |
| `src/modules/order/store.ts` | 修改 | 新增 orderForm 状态、setOrderForm、submitOrder、resetOrderForm |
| `src/modules/order/store.test.ts` | 修改 | 新增 9 个测试用例 |
| `src/modules/order/OrderForm.tsx` | 新增 | 报单表单组件（方向/开平/限价市价/有效期切换、步进器） |
| `src/modules/order/OrderForm.test.tsx` | 新增 | 10 个测试用例 |
| `src/modules/order/StopOrderForm.tsx` | 新增 | 止损单表单组件（含止损价输入） |
| `src/modules/order/StopOrderForm.test.tsx` | 新增 | 7 个测试用例 |
| `src/modules/order/OrderPanel.tsx` | 修改 | 集成 OrderForm/StopOrderForm Tab 切换 |
| `src/modules/order/OrderPanel.test.tsx` | 修改 | 新增 3 个集成测试 |
| `src/modules/order/styles.css` | 修改 | 新增表单、步进器、提交按钮样式 |

---

### 提交记录

- `3f2941c` feat(task-10): implement PR-10 前端报单表单 — 20 files, 248 tests
- `26da56c` docs(task-10): update dev-record-b with PR-10 TDD record
- `423fadc` docs(task-10): 自验证通过 — 更新progress.md和dev-record-b状态
- `ba2c6d7` fix(task-10): review反馈 - stopPrice透传到CtpOrderRequest
- `6346c79` fix(task-10): review反馈 - cancelOrder接入Store
- `6ba0262` fix(task-10): review反馈 - useHotKeys集成到OrderPanel
- `fb20393` fix(task-10): review反馈 - usePriceStep集成到表单组件
- `a7caf33` fix(task-10): review反馈 - 前端校验+注释补充
- `dcf38ce` docs(task-10): review回复 — 修复记录+状态更新
- `6c11ef9` fix(task-10): CtpOrderRequest字段重命名(combOffsetFlag→offsetFlag, orderPriceType→priceType) + volumeCondition映射
- `cb31c1d` fix(task-10): 集成接入 — ToastContainer挂载 + MarketPanel报单联动 + StopOrderForm有效期切换
- `b75561c` chore(task-10): add pnpm lock and workspace files

---

## PR-20: 前端合约刷新功能

**分支**：`feature/pr-20-instrument-refresh-ui`
**开始时间**：2026-07-21
**状态**：✅ 已完成（审查通过，待合并）

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | refreshInstruments API | services/api.test.ts | 17 (+2) | ✅ 全部通过 |
| 2 | store refreshInstruments | market/store.test.ts | 23 (+4) | ✅ 全部通过 |
| 3 | useMarketWs instruments_refreshed | hooks/useMarketWs.test.ts | 10 (+3) | ✅ 全部通过 |
| 4 | MarketPanel 刷新按钮 | market/MarketPanel.test.tsx | 11 (+4) | ✅ 全部通过 |

**总计**：287 tests / 34 files 通过（新增 13 tests），0 failures

---

### TDD 循环记录

| # | 功能 | 红灯 | 绿灯 | Commit |
|---|------|------|------|--------|
| 1 | refreshInstruments API 函数 | ✅ 2 fail | ✅ 17 pass | `2a4d682` |
| 2 | store refreshInstruments + isRefreshing | ✅ 3 fail | ✅ 23 pass | `8e9bc8a` |
| 3 | useMarketWs instruments_refreshed 消息处理 | ✅ 3 fail → 1 fix | ✅ 10 pass | `ac84927` |
| 4 | MarketPanel 刷新按钮集成 | ✅ 4 fail | ✅ 11 pass | `51ae660` |

---

### 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/services/api.ts` | 修改 | 新增 refreshInstruments() → POST /api/market/instruments/refresh |
| `src/services/api.test.ts` | 修改 | 新增 2 个测试用例 |
| `src/modules/market/store.ts` | 修改 | 新增 isRefreshing 状态 + refreshInstruments 方法 |
| `src/modules/market/store.test.ts` | 修改 | 新增 4 个测试用例 |
| `src/hooks/useMarketWs.ts` | 修改 | 新增 instruments_refreshed 消息处理 → fetchInstruments + toast |
| `src/hooks/useMarketWs.test.ts` | 修改 | 新增 3 个测试用例 + mock toast |
| `src/modules/market/MarketPanel.tsx` | 修改 | 新增"刷新合约"按钮（loading 状态 + disabled） |
| `src/modules/market/MarketPanel.test.tsx` | 修改 | 新增 4 个测试用例 + mock refreshInstruments |
| `src/modules/market/styles.css` | 修改 | 新增 .btn-refresh-instruments + .panel-header__actions 样式 |

---

### 提交记录

- `2a4d682` feat(task-20): implement refreshInstruments API function
- `8e9bc8a` feat(task-20): add refreshInstruments + isRefreshing to market store
- `ac84927` feat(task-20): handle instruments_refreshed WS message with toast + refetch
- `51ae660` feat(task-20): add refresh contracts button to MarketPanel with loading state
- `52cc723` docs(task-20): update dev-record-b with PR-20 TDD records
- `0106342` docs(task-20): update progress.md — PR-20 开发完成，待审查
- `736b1ea` fix(task-20): review反馈 - selector位置统一 + count=0防御 + 测试重命名 + 旧条目清理

---

### 审查反馈修复（第 1 轮）

| # | 类型 | 内容 | 处理 |
|---|------|------|------|
| 🟡1 | 改进建议 | progress.md PR-20 旧条目未清理 | 删除旧"⏳ 待开始"条目 |
| 🟡2 | 改进建议 | fetchInstruments selector 位置不一致 | 移至第 55 行与其他 selector 统一 |
| 🔵1 | 疑问确认 | 测试命名"未知字段"误导 | 重命名为"不响应非 instruments_refreshed 类型的 WS 消息" |
| 🔵2 | 疑问确认 | count=0 时 toast 尴尬 | 添加 `if (data.count > 0)` 防御 + 测试 |

**Commit**：`736b1ea`

---

### 人工验证

**验证时间**：2026-07-21
**验证结果**：✅ 通过

**讨论要点**：
- 前端行情数据链路梳理：确认刷新按钮依赖 TD 连接，`instruments.json` 缺失会导致启动无数据
- 自动订阅策略讨论：对比无限易方案，确认当前 300 自动 + 200 手动订阅方案合理，但需确保后端 `ReqQryInstrument` 能正确返回全量合约
- 类型修复：`WSMessageType` 遗漏 `instruments_refreshed`，已在 `8ebaf1f` 修复

**后续待定**：
- `ReqQryInstrument` 空查询是否能返回全量合约需实际验证
- 启动时自动订阅策略（300 主力合约）取决于后端合约查询结果
- 建议 PR-21 实现自选列表驱动订阅，模仿无限易模式

---

## 投机/套保/套利 — 前端报单表单投保选择

**分支**：`feature/pr-20-hedge-flag`
**开始时间**：2026-07-21
**状态**：✅ 已完成

---

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | orderMapping hedge flag | utils/orderMapping.test.ts | 29 (+8) | ✅ 全部通过 |
| 2 | store default combHedgeFlag | order/store.test.ts | 16 (+1) | ✅ 全部通过 |
| 3 | OrderForm hedge toggle | order/OrderForm.test.tsx | 15 (+2) | ✅ 全部通过 |
| 4 | StopOrderForm hedge toggle | order/StopOrderForm.test.tsx | 9 (+2) | ✅ 全部通过 |
| 5 | api.test expected hedgeFlag | api.test.ts | 17 (1 更新) | ✅ 全部通过 |

**总计**：297 tests / 34 files 通过（新增 9 tests），0 failures

---

### TDD 循环记录

| # | 功能 | 红灯 | 绿灯 | Commit |
|---|------|------|------|--------|
| 1 | orderMapping: COMB_HEDGE_TO_CTP + toCtpHedgeFlag + convertOrderRequest | ✅ 7 fail | ✅ 29 pass | `805b420` |
| 2 | store: DEFAULT_ORDER_FORM.combHedgeFlag = 'speculation' | ✅ 1 fail | ✅ 16 pass | `2155c3c` |
| 3 | OrderForm: 投机/套保/套利 三选一切换 | ✅ 2 fail | ✅ 15 pass | `79bba22` |
| 4 | StopOrderForm: 同上切换 | ✅ 2 fail | ✅ 9 pass | `ff68c78` |
| 5 | types.ts + api.test 同步 | - | ✅ 297 pass | `892d419` |

---

### 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/utils/orderMapping.ts` | 修改 | 新增 COMB_HEDGE_TO_CTP 映射、toCtpHedgeFlag 函数、OrderRequestForm/CtpOrderRequest 新增 hedge flag 字段、convertOrderRequest 默认输出 hedgeFlag: '1' |
| `src/utils/orderMapping.test.ts` | 修改 | 新增 5 个 toCtpHedgeFlag 测试 + 更新 4 个 convertOrderRequest 测试 |
| `src/modules/order/store.ts` | 修改 | DEFAULT_ORDER_FORM 新增 combHedgeFlag: 'speculation' |
| `src/modules/order/store.test.ts` | 修改 | 新增 1 个默认值断言 |
| `src/modules/order/OrderForm.tsx` | 修改 | 新增"投保"行，投机/套保/套利 三选一切换按钮 |
| `src/modules/order/OrderForm.test.tsx` | 修改 | 新增 2 个测试（渲染 + 点击交互） |
| `src/modules/order/StopOrderForm.tsx` | 修改 | 同上 |
| `src/modules/order/StopOrderForm.test.tsx` | 修改 | 新增 2 个测试 + fireEvent import |
| `src/services/types.ts` | 修改 | OrderRequest 和 StopOrderRequest 新增 combHedgeFlag? 可选字段 |
| `src/services/api.test.ts` | 修改 | submitOrder 期待值新增 hedgeFlag: '1' |

---

### 提交记录

- `805b420` feat(hedge-flag): add combHedgeFlag mapping + toCtpHedgeFlag + convertOrderRequest hedgeFlag output
- `2155c3c` feat(hedge-flag): add combHedgeFlag 'speculation' to DEFAULT_ORDER_FORM
- `79bba22` feat(hedge-flag): add hedge flag toggle (投机/套保/套利) to OrderForm
- `ff68c78` feat(hedge-flag): add hedge flag toggle (投机/套保/套利) to StopOrderForm
- `892d419` fix(hedge-flag): update api.test expected hedgeFlag + types.ts OrderRequest/StopOrderRequest combHedgeFlag

---

## PR-15: 前端快捷功能实现

**分支**：`feature/pr-15-quick-actions`
**状态**：✅ 开发完成
**依赖PR**：PR-9 ✅ / PR-10 ✅ / PR-11 ✅

### TDD 循环记录

#### Cycle 1: API 函数

- `feat(task-15): add API functions for cancelAll, reverse, lock, query positions/orders`
- 新增 5 个 API 函数：`cancelAllOrders`, `reversePosition`, `lockPosition`, `getPositions`, `getOrders`
- 测试：27 passed（17 existing + 10 new）

#### Cycle 2: BatchCancel 组件

- `feat(task-15): implement BatchCancel component with select/cancel flow`
- 批量撤单列表，全选/取消全选，逐个撤单，进度展示
- 测试：9 passed

#### Cycle 3: QuickActions 组件

- `feat(task-15): implement QuickActions component (reverse, lock, batch cancel)`
- 一键反向、一键锁仓、批量撤单三个按钮，loading 状态，501 错误处理
- 测试：8 passed

#### Cycle 4: QuickKeys 快捷键配置组件

- `feat(task-15): implement QuickKeys hotkey configuration component`
- 快捷键配置面板，key 捕获（忽略修饰键），保存/重置
- 测试：7 passed

#### Cycle 5: useHotKeys 增强

- `feat(task-15): enhance useHotKeys with custom key bindings support`
- 支持自定义快捷键映射，动态切换，保留现有 B/S/C 默认
- 测试：13 passed（9 original + 4 new）

#### Cycle 6: OrderPanel 集成

- `feat(task-15): integrate QuickActions, BatchCancel, QuickKeys into OrderPanel`
- QuickActions 内嵌面板头部下方，BatchCancel/QuickKeys 浮动覆盖
- 快捷键按钮（"快捷键"tab）集成到 tab 栏
- 测试：343 passed（2 pre-existing failures）

### 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/api.ts` | 修改 | 新增 5 个 API 函数 |
| `src/services/api.test.ts` | 修改 | 新增 10 个测试 |
| `src/components/BatchCancel/index.tsx` | 新增 | 批量撤单组件 |
| `src/components/BatchCancel/index.test.tsx` | 新增 | 9 个测试 |
| `src/components/BatchCancel/styles.css` | 新增 | 样式 |
| `src/components/QuickActions/index.tsx` | 新增 | 快捷操作组件 |
| `src/components/QuickActions/index.test.tsx` | 新增 | 8 个测试 |
| `src/components/QuickActions/styles.css` | 新增 | 样式 |
| `src/components/QuickKeys/index.tsx` | 新增 | 快捷键配置组件 |
| `src/components/QuickKeys/index.test.tsx` | 新增 | 7 个测试 |
| `src/components/QuickKeys/styles.css` | 新增 | 样式 |
| `src/hooks/useHotKeys.ts` | 修改 | 支持自定义 hotKeys 映射 |
| `src/hooks/useHotKeys.test.ts` | 修改 | 新增 4 个测试 |
| `src/modules/order/OrderPanel.tsx` | 修改 | 集成 PR-15 组件 |
| `src/modules/order/OrderPanel.test.tsx` | 修改 | 新增 4 个集成测试 |
| `src/modules/order/styles.css` | 修改 | 新增 overlay 样式 |

### 提交记录

- `684d49c` feat(task-15): add API functions for cancelAll, reverse, lock, query positions/orders
- `2784b0c` feat(task-15): implement BatchCancel component with select/cancel flow
- `1537653` feat(task-15): implement QuickActions component (reverse, lock, batch cancel)
- `3b84f7b` feat(task-15): implement QuickKeys hotkey configuration component
- `0b3085f` feat(task-15): enhance useHotKeys with custom key bindings support
- `35a89fa` feat(task-15): integrate QuickActions, BatchCancel, QuickKeys into OrderPanel
- `d23d783` docs(task-15): update dev-record-b with PR-15 TDD records

### 审查反馈修复（第 1 轮）

- `2c6a4fd` fix(task-15): review反馈 - 扩展getOrders返回类型，移除BatchCancel hardcode假值
- `5f0d51c` fix(task-15): review反馈 - QuickKeys恢复默认不再自动保存，需手动确认
- `b4c0c83` fix(task-15): review反馈 - 提取executeAction公共函数，消除handleReverse/handleLock重复代码
- `b2e9b4e` fix(task-15): review反馈 - 并发撤单 + setHotKeys批量更新 + cancelAllOrders加TODO + 快捷键去重 + hotKeys回退默认

---

## PR-22: 连接状态指示器完善 + 行情表格涨跌着色

**分支**：`feature/pr-22-connection-status`
**开始时间**：2026-07-24
**状态**：✅ 已完成（审查通过）

---

### 完成内容

**后端（角色A 部分，本次由角色B 代为完成）**：
- `server/services/ctp_startup.py`：MD 断线/重连 3 处广播从 `{status}` 改为 `{mdConnected}` 格式

**前端（角色B）**：
- `frontend/src/hooks/useSystemWs.ts`：删除 `status === 'disconnected'` 兜底分支
- `frontend/src/hooks/useMarketWs.ts`：删除 `setMdPhase('connected')` 行情 hack
- `frontend/src/modules/market/MarketTable.tsx`：
  - 涨跌着色（6 列 vtable theme bodyStyle 回调，红涨绿跌）
  - 新增合约名称、交易所、到期日 3 列
  - productID → 中文名本地映射（50+ 品种）

### 实现文件清单

| 文件 | 变更 | 说明 |
|------|------|------|
| `server/services/ctp_startup.py` | 修改 | 3 处广播格式统一 |
| `frontend/src/hooks/useSystemWs.ts` | 修改 | 删除兜底分支 + status 类型字段 |
| `frontend/src/hooks/useMarketWs.ts` | 修改 | 删除 hack + useConnectionStore 导入 |
| `frontend/src/modules/market/MarketTable.tsx` | 修改 | 涨跌着色 + 3 新列 + 映射表 |

### 提交记录

- `9a8ebd6` fix(task-22): 统一MD断线/重连广播格式为mdConnected，删除前端demo方案和兜底逻辑
- `ed7d01c` feat(task-22): 行情表格涨跌着色 + 新增交易所/到期日列
- `43ed2e1` feat(task-22): 合约名称列 — productID本地映射中文名
- `ad924f7` fix(task-22): 补全产品映射表 — 132品种全覆盖（5交易所）
- `ef11135` refactor(task-22): 合约名称改为合约品种，取消月份后缀
- `6126ae1` docs(task-22): 文档更新
- `41f3af1` fix(task-22): 昨结算价为0时fallback到昨收价，修复红绿着色错乱

### 遇到的问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| vtable 列 style 回调中 `args.rowData` 不存在 | vtable `StylePropertyFunctionArg` 无 `rowData` 属性 | 改用 `args.table?.records?.[args.row]` |
| theme `bodyStyle` 不支持函数 | vtable `bodyStyle` 类型为静态 `ThemeStyle` | 对每个需要着色的列配置 `style: coloredStyle` 回调 |
| 部分合约涨跌颜色错乱 | CTP `PreSettlementPrice` 返回 DBL_MAX 被 sanitize 为 0，`??` 对 0 不触发 fallback | 改为显式判断 `> 0`，0 时 fallback 到 `preClosePrice` |
| SimNow 返回 `InstrumentName` 等于 `InstrumentID` | SimNow 测试环境不返中文名 | 前端 productID → 中文名本地映射（132 品种全覆盖） |

### 已知未完成

- 角色A 后端登录流程重构（connect_ctp→connect_md 重命名、startup 只连 MD 等）留待角色A 处理

---

## PR-14: 前端期权 T 型报价 — 人工验证修复（卡死/黑屏）

**分支**：`feature/pr-14-option-tquote`
**修复时间**：2026-07-24
**状态**：✅ 已修复

---

### 问题现象

- 点击顶部“期权”标签页后，前端直接卡死，期间无法执行任何操作。
- 加载完成后不显示 T 型报价表格，只显示纯黑面板。

### 根因分析

| 问题 | 原因 | 影响 |
|------|------|------|
| 行情推送导致表格反复重建 | `TQuoteTable` 的 `useEffect` 依赖 `snapshots`，而 `MarketStore.batchUpdate` 每 100ms 创建新的 `Map` 引用 | 每次行情批量更新都 `new ListTable(...)` 并 `release`，大量期权合约时主线程被占满 |
| 单 chain 时表格高度缺失 | `visibleChains.length > 1` 才设置 `chainHeight`，单个 chain 时高度为 `undefined` | vtable 容器无明确高度，可能渲染为黑屏 |
| 订阅 effect 被行情 tick 重复触发 | `visibleChains` useMemo 原计划不含 `snapshots`，但注释暗示可能误加 | 每次 tick 重新调用 `subscribeMarket` + `fetchVolatility`，网络/CPU 双重压力 |

### 修复内容

- `frontend/src/modules/options/TQuoteTable.tsx`
  - 将 `columns` 提升为组件外常量，避免每次渲染重新创建。
  - 拆分为两个 `useEffect`：
    - mount 时只创建一次 `ListTable`；
    - `chain`/`snapshots`/`volatility` 变化时通过 `table.setRecords(...)` 增量更新，不再重建表格。
  - 新增回归测试：行情快照变化时 `ListTable` 构造次数不变且调用 `setRecords`。

- `frontend/src/modules/options/OptionPanel.tsx`
  - 明确 `visibleChains` useMemo 不依赖 `snapshots`，避免行情 tick 触发订阅 effect。
  - 单 chain 与多 chain 统一使用 `chainHeight(chain)` 设置表格容器高度，解决黑屏。

### 测试

- `src/modules/options/TQuoteTable.test.tsx`：11 个测试全部通过（含新增回归测试）。
- `src/modules/options/OptionPanel.test.tsx`：15 个测试全部通过。
- 完整前端测试：`400 passed, 2 failed`；2 个失败位于 `useMarketWs.test.ts`（instruments_refreshed toast/重载合约），与本次修改无关。

### 提交记录

- `d34307d` `fix(task-14): 期权面板卡死修复 — vtable 增量更新 + 单 chain 高度修复`
- `server/tests/test_ws_integration.py` 仍有旧格式引用，需跟随重建测试

---

## PR-14: 前端期权 T 型报价 — 人工验证修复2（后端阻塞）

**分支**：`feature/pr-14-option-tquote`
**修复时间**：2026-07-24
**状态**：✅ 已修复

---

### 问题现象

- 点击"期权"标签后，前端卡死在"加载中"页面，无响应。
- 不传 `underlying`/`expire_date` 参数时必现，传参数时正常。

### 根因分析

`server/api/market.py` 中 `/options`、`/option_chain`、`/volatility` 三个端点是 `async def`，但内部调用的 `get_instruments()`、`get_option_chains()`、`get_volatility()` 都是**同步函数**。

在 FastAPI 的 `async def` 中执行同步阻塞代码会**阻塞事件循环**，导致：
- 该请求 hang 住，前端一直等待响应
- 其他请求也无法处理
- 不传参数时返回全部期权合约（几千个），遍历+分组耗时更长，更容易触发

### 修复内容

- `server/api/market.py`：将 `/options`、`/option_chain`、`/volatility` 三个端点从 `async def` 改为 `def`。
- FastAPI 对 `def` 端点会自动放到线程池执行，不再阻塞事件循环。

### 测试

- `server/tests/test_options_api.py`：11 个测试全部通过。

### 提交记录

- `0d71c66` `fix(task-14): 期权API阻塞事件循环 — async def改为def`
- `723003d` `fix(task-14): 期权面板默认只加载预设合约的期权链`

---

## PR-14: 前端期权 T 型报价 — 面板简化重构

**分支**：`feature/pr-14-option-tquote`
**重构时间**：2026-07-24
**状态**：✅ 已完成

---

### 重构需求

1. 面板名称从"期权"改为"T型期权报价"
2. 整个面板只能看一个合约的信息，删除堆叠多合约设计
3. 点击按钮后不自动加载合约，必须手动选择标的和到期日

### 修改内容

- `frontend/src/App.tsx`
  - 标签名称从"期权"改为"T型期权报价"

- `frontend/src/modules/options/OptionPanel.tsx`
  - 删除自动加载逻辑（useEffect on mount）
  - 删除堆叠多合约设计，改为只显示一个选中的 chain（`selectedChain`）
  - 用户必须手动选择标的和到期日才能加载数据
  - 选择标的后自动重置到期日，避免残留旧选择
  - 下拉框默认文本改为"请选择标的"/"请选择到期日"
  - 空状态提示根据选择状态显示不同文案

- `frontend/src/modules/options/styles.css`
  - 删除 `.options-chain-block` 和 `.options-chain-title` 样式（多合约堆叠相关）

- `frontend/src/modules/options/OptionPanel.test.tsx`
  - 重写测试：验证不自动加载、验证单表格渲染、验证空状态提示

### 测试

- `src/modules/options/OptionPanel.test.tsx`：13 个测试全部通过
- `src/modules/options/TQuoteTable.test.tsx`：11 个测试全部通过
- 完整前端测试：`398 passed, 2 failed`（2 个失败在 `useMarketWs.test.ts`，与本次修改无关）

### 提交记录

- `423003d` `refactor(task-14): 期权面板简化 — 改为T型期权报价，只显示单个合约`
- `1ea2ad5` `feat(task-14): 添加期权标的列表API + 前端挂载时加载下拉框选项`
- `bf3b543` `feat(task-14): 期权标的列表加载重试机制 + 手动刷新按钮`

---

## PR-14: 标的搜索功能

**分支**：`feature/pr-14-option-tquote`
**开发时间**：2026-07-24
**状态**：✅ 已完成

---

### 需求

标的下拉框增加搜索过滤功能，支持输入关键字实时过滤标的列表。

### 修改内容

- `frontend/src/modules/options/OptionPanel.tsx`
  - 将标的 `<select>` 替换为可搜索输入框 + 下拉列表
  - 新增 `underlyingSearch`、`showUnderlyingDropdown` 状态
  - 输入框获焦时展开下拉列表，输入文字实时过滤
  - 点击选项后自动选中并加载期权链
  - 点击外部区域自动关闭下拉列表

- `frontend/src/modules/options/styles.css`
  - 新增 `.options-searchable-select`、`.options-search-input`、`.options-search-dropdown`、`.options-search-option` 等样式

### 测试

- `src/modules/options/OptionPanel.test.tsx`：13 个测试全部通过

---

## PR-14 总结

**状态**：✅ 开发完成，待合并

**完成内容**：
1. TQuoteTable 组件 — T型布局（看涨/行权价/看跌），vtable 增量更新
2. OptionPanel 组件 — 可搜索标的选择器、到期日选择器、单合约显示
3. Options Store — optionChains、volatility、fetchOptionChains、fetchVolatility
4. 后端 API — /options、/option_chain、/volatility、/options/underlyings
5. 代码审查 — 二审通过
6. 人工验证 — 卡死/黑屏/后端阻塞均已修复

**测试覆盖**：
- 前端：49/49 通过（OptionPanel 13、TQuoteTable 11、store 23）
- 后端：14/14 通过

**遗留问题**：
- `store.ts` 及 `store.test.ts` 存在 4 个 TypeScript 类型错误，运行时正常

---

## PR-16: 前端查询面板实现

**分支**：`feature/pr-16-query-panel`
**开始时间**：2026-07-27
**状态**：✅ 开发完成，待审查

### TDD 测试用例清单

| # | 模块 | 测试文件 | 测试数 | 状态 |
|---|------|----------|--------|------|
| 1 | QueryStore | store.test.ts | 21 | ✅ 全部通过 |
| 2 | OrderFlow | OrderFlow.test.tsx | 11 | ✅ 全部通过 |
| 3 | TradeFlow | TradeFlow.test.tsx | 5 | ✅ 全部通过 |
| 4 | Position | Position.test.tsx | 5 | ✅ 全部通过 |
| 5 | AccountQuery | AccountQuery.test.tsx | 4 | ✅ 全部通过 |
| 6 | StopOrderList | StopOrderList.test.tsx | 6 | ✅ 全部通过 |
| 7 | ContractQuery | ContractQuery.test.tsx | 6 | ✅ 全部通过 |
| 8 | QueryPanel | QueryPanel.test.tsx | 13 | ✅ 全部通过 |
| **合计** | | | **71** | **✅ 全部通过** |

### Commit 记录

| Commit | 类型 | 说明 |
|--------|------|------|
| b4fd085 | feat | 查询API函数 + QueryStore增强 — fetch/pause/cancel/incremental-update |
| ffb1112 | feat | OrderFlow 报单流水组件 — 表格/撤单/批量撤单/高亮 |
| 7451399 | feat | TradeFlow/Position/AccountQuery/StopOrderList 四个查询组件 |
| 7b9e6c4 | feat | QueryPanel集成 — 7个Tab/暂停刷新/C键快捷撤单 |
| cf60a7a | feat | ContractQuery 合约详情组件 + QueryPanel 集成 |
| 0ad1d78 | docs | progress.md 更新 — PR-16 开发完成 |

### 完成内容

1. **新增 API 函数**（5个）：getTrades, getAccount, getStopOrders, cancelStopOrder, getContracts
2. **QueryStore 增强**：orders/trades/positions/account/stopOrders 数据管理、暂停/恢复、全量刷新、增量更新、撤单操作、新数据高亮追踪
3. **OrderFlow**：报单流水表格（10列）、撤单按钮（活跃报单）、撤销全部按钮、新数据高亮（2s fade）
4. **TradeFlow**：成交流水表格（7列）、新数据高亮
5. **Position**：持仓表格（9列）、平仓按钮（预填报单表单）、盈亏着色
6. **AccountQuery**：资金信息网格展示（10项）、盈亏着色
7. **StopOrderList**：止损单列表（10列）、取消按钮（仅 pending 状态）
8. **ContractQuery**：合约详情展示（8项）、加载/错误/未找到状态处理
9. **QueryPanel 集成**：7个Tab、暂停/刷新按钮、3秒自动刷新、C键快捷撤单

### 验收标准对照

全部 14 项验收标准通过（详见 task.md PR-16 验收标准）

---

## PR-16: 审查反馈修复

**修复日期**：2026-07-27

### 修复项

| # | 问题 | 等级 | 修复内容 |
|---|------|------|----------|
| F1 | 报价 Tab 传 snapshot={null}，始终显示空数据 | 🔴 阻断 | QueryPanel 从 marketStore 取 selectedInstrument 对应的 snapshot 传给 DepthQuote |
| F2 | store.ts import 顺序混乱 | 🟡 改进 | import { toast } 移到文件顶部 |
| F3 | 乐观更新 orderStatus: 'canceled' 不匹配 CTP 编码 | 🟡 改进 | 改为 '5'（CTP 已撤单编码） |
| Q1 | 平仓始终用 close，今仓需 close_today | 🔵 疑问 | Position onClose 根据 todayPosition > 0 判断使用 'close_today' 或 'close' |
| Q2 | as unknown as 类型断言 | 🔵 疑问 | 保持现状，加注释说明 CTP 格式与前端类型不匹配的原因 |

### 附加修复（PR-14 遗留）

| # | 问题 | 修复内容 |
|---|------|----------|
| 1 | options store.ts TS 错误 | fetchOptionChains 改用 api.get 直接调用，绕过 ApiResponse 包装 |
| 2 | options store.test.ts TS 错误 | mock 从 get 改为 api.get，返回值改为 { data: { chains } } 格式 |
| 3 | useHotKeys.test.ts TS 错误 | 补全 HotKeyConfig 缺失的 sell/cancel 字段 |

### 测试结果

```
Test Files  45 passed (45), 1 failed (pre-existing useMarketWs)
     Tests  463 passed (463), 2 failed (pre-existing)
TypeScript: 0 errors
```

---

## PR-16: 人工验证修复

**修复日期**：2026-07-27

### 修复项

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 查询面板成交/持仓/资金/止损单无数据 | GET 端点只读缓存（初始为空） | store fetch 改用 POST /refresh 触发 CTP 查询 |
| 2 | 点击资金 Tab 前端崩溃 | 后端 account or {balance:0,available:0} 返回缺8字段的部分对象 | 后端 None 时返回 success:false；前端加字段校验 |
| 3 | 合约详情交易所数据异常 | 前端传 instruments 参数，后端期望 keyword | getContracts 参数名修正 |
| 4 | 止损单无数据 | 后端响应字段名 orders，前端期望 stopOrders | 后端返回 key 改为 stopOrders |
| 5 | CTP 并发查询超时 | Promise.all 同时发5个CTP查询，限频导致后续超时 | refreshAll 改为串行，间隔1.2s；刷新间隔3s→10s |
| 6 | 后端 len(None) 崩溃 | query_trades/positions 返回 None 时 len(None) TypeError | 4个 POST /refresh 端点加 None 检查 |

### 提交记录

- acf7e00 fix: 查询数据改用POST /refresh + 合约详情2×4网格布局
- 635ba37 fix: 资金Tab崩溃修复 + 合约查询参数修正
- 076a7d3 fix: 后端查询API None处理
- 40cd7fd fix: 止损单响应字段名 orders → stopOrders
- e4a96ec fix: CTP查询串行执行 + 刷新间隔3s→10s

### 最终测试结果

```
Test Files  8 passed (8) (query module)
     Tests  73 passed (73)
TypeScript: 0 errors
```
