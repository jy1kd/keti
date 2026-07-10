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
