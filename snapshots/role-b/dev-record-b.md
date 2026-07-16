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
**状态**：🔄 开发中

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
