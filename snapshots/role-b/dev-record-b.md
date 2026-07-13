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
