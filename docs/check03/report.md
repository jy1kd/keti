# 一致性检查报告 — check/docsCheck03

> 生成日期：2026-07-27
> 检查维度：文档一致性 + 前后端数据流 + 运行时行为 + 代码质量

---

## 🔴 阻断性问题（会导致功能异常）

### 1. cancelAllOrders 前后端响应字段不匹配

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P0 |
| **影响** | 批量撤单 toast 显示 "已撤销 undefined 笔报单" |
| **前端文件** | `frontend/src/services/api.ts:275-280` |
| **后端文件** | `server/services/order_manager.py:401-404` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~前端 `CancelAllResponse` 期望字段：`cancelled`(int) / `failed`(int) / `errors`(string[])~~
- ~~后端 `cancel_all()` 返回字段：`attempted`(int) / `succeeded`(int) / `failedRefs`(string[])~~
- ✅ 已修复：前端字段已对齐为 `attempted` / `succeeded` / `failedRefs`，与后端一致

---

### 2. K 线时间戳前后端不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P0 |
| **影响** | K 线图表数据错位/重复，REST 和 WebSocket 路径产生不同时间戳 |
| **后端文件** | `server/services/kline_service.py:58` |
| **前端文件** | `frontend/src/hooks/useMarketWs.ts:23-25`、`frontend/src/modules/query/QueryPanel.tsx:66-69` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~后端 `calendar.timegm()` 将 CTP 的中国时间（UTC+8）当作 UTC 处理，时间戳快 8 小时~~
- ~~前端 WebSocket 路径直接用 CTP 原始时分秒，REST 路径用 `new Date()` 按浏览器本地时区解析~~
- ✅ 已修复：后端改用 `datetime(..., tzinfo=timezone(timedelta(hours=8)))`，前端两条路径均用时分秒构造偏移量，一致

---

### 3. submitOrder 缺少 exchangeID

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | 非 CFFEX 合约（SHFE/CZCE/DCE/INE/GFEX）报单使用错误交易所代码，CTP 可能拒绝 |
| **前端文件** | `frontend/src/utils/orderMapping.ts:120-134` |
| **后端文件** | `server/api/order.py:36` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~前端 `convertOrderRequest()` 不包含 `exchangeID` 字段~~
- ~~后端 `InsertOrderRequest` 默认 `exchangeID="CFFEX"`~~
- ✅ 已修复：`store.ts` 选合约时从 `contractsStore` 自动获取 `exchangeID`，`convertOrderRequest` 传递给后端

---

### 4. 止损单缺少 exchangeID

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | 止损触发后，非 CFFEX 合约的报单 exchange_id=""，CTP 可能拒绝 |
| **前端文件** | `frontend/src/services/api.ts:458-468` |
| **后端文件** | `server/api/order.py:80-92`、`server/services/stop_order.py:247-254` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~`SubmitStopOrderRequest` 无 `exchangeID` 字段~~
- ~~`_trigger_order()` 调用 `order_manager.insert()` 时未传 `exchange_id`，默认为空字符串~~
- ✅ 已修复：`SubmitStopOrderRequest` 有 `exchangeID`，`StopOrder` 存储 `exchange_id`，`_trigger_order` 正确传递

---

### 5. useMarketWs 被重复调用，K 线周期冲突

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | 两个不同周期的 K 线数据混入同一个 store，图表数据错乱 |
| **前端文件** | `frontend/src/modules/market/MarketPanel.tsx:58`、`frontend/src/modules/query/QueryPanel.tsx:57` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~`MarketPanel` 调用 `useMarketWs(..., '5m')`~~
- ~~`QueryPanel` 调用 `useMarketWs(..., period)` — period 可由用户切换~~
- ✅ 已修复：`useMarketWs` 改为模块级单例（`globalWs`），`QueryPanel` 不再调用，周期从 `store.currentPeriod` 读取

---

### 6. refreshAll 无防重入

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | CTP 查询并发冲突，可能导致查询超时或数据丢失 |
| **前端文件** | `frontend/src/modules/query/store.ts:190-208`、`frontend/src/modules/query/QueryPanel.tsx:50-53` |
| **后端文件** | `server/services/query_service.py` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~`setInterval` 每 10 秒调用 `refreshAll()`~~
- ~~不检查上一次是否完成，导致两个 `refreshAll` 并发执行~~
- ✅ 已修复：`refreshAll` 增加 `isRefreshing` 重入保护，`QueryPanel` 改为递归 `setTimeout` 完成后再调度

---

### 7. 止损单触发存在竞态条件

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P2 |
| **影响** | 已取消的止损单仍可能触发报单；快速行情变动可能导致重复触发 |
| **后端文件** | `server/services/stop_order.py:216-274` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~`_trigger_order` 不检查 `order.status` 就直接调用 `insert()`~~
- ~~快速连续行情变动可能两个线程同时触发同一止损单，导致重复报单~~
- ✅ 已修复：`_trigger_order` 锁内检查 PENDING 后立即设置 `TRIGGERING` 中间状态，防止并发触发

---

## 🟡 不一致问题（建议修复）

### 8. reverse/lock 操作平仓和开仓无依赖检查

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P2 |
| **影响** | 平仓被拒时开仓仍执行，仓位不减反增 |
| **后端文件** | `server/api/order.py:206-249` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~先发平仓单，再发开仓单，两者独立~~
- ~~如果平仓被拒（如保证金不足），开仓仍会执行~~
- ✅ 已修复：`order.py:238-240` — 平仓失败时 `continue`，跳过开仓

---

### 9. design.md 缺少 4 个已实现的 API 端点

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **影响** | 文档与代码不一致，新开发者无法从文档了解完整 API |
| **文档文件** | `docs/design.md` 4.2/4.4 节 |
| **代码文件** | `server/api/market.py` |
| **状态** | ✅ 已修复 |

**缺失端点**：
- ✅ `GET /api/market/kline` — design.md:730
- ✅ `GET /api/market/depth` — design.md:731
- ✅ `GET /api/market/options/underlyings` — design.md:679
- ✅ `GET /api/market/volatility` — design.md:732

---

### 10. /api/order/reverse 请求参数：design.md vs 代码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:706` |
| **代码文件** | `server/api/order.py:68-71` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ design.md 已更新为 `{instrumentID}`，与代码一致

---

### 11. /api/order/lock 请求参数：design.md vs 代码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:707` |
| **代码文件** | `server/api/order.py:74-77` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ design.md 已更新为 `{instrumentID}`，与代码一致

---

### 12. /api/order/stop/cancel 请求参数命名不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:710` |
| **代码文件** | `server/api/order.py:95-98` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ design.md 已更新为 `{stopOrderID}`，与代码一致

---

### 13. StopOrderRequest 字段名不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:1124-1133` |
| **代码文件** | `server/api/order.py:80-92` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ API 端点表格已对齐，接口类型定义保留 `combOffsetFlag`（前端表单字段名）

---

### 14. StopOrder 数据结构多处不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:1136-1149`、`docs/design.md:529-547` |
| **代码文件** | `server/services/stop_order.py:68-82` |
| **状态** | ✅ 已修复 |

**字段映射**：

| design.md 接口 | design.md 持久化 | 代码实际 | 状态 |
|---|---|---|---|
| `stopOrderID` | `stop_order_ref` | `stopOrderID` | ✅ |
| `combOffsetFlag` | `offset` | `offsetFlag` | ✅ 接口/持久化分离 |
| `volumeTotalOriginal` | `volume` | `volume` | ✅ |
| `triggeredOrderRef` | `triggered_order_ref` | `orderRef` | ✅ |

---

### 15. direction/offset 值编码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:554` |
| **代码文件** | `server/services/stop_order.py:233-235` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ design.md 已更新为 CTP 字符码 `0=买,1=卖` / `0=开仓,1=平仓,3=平今`

---

### 16. 期权合约筛选 productClass 值不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/task.md` PR-14 第 1684 行 |
| **代码文件** | `server/services/options_service.py` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ PR-14 task.md 已修正为 `productClass='2'`

---

### 17. progress.md 存在重复条目

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `snapshots/role-b/progress.md:312-330` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ progress.md 重复条目已删除

---

## 🔵 改进建议（代码质量）

### 18. PositionRecord 类型定义与实际数据不符

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **前端文件** | `frontend/src/services/types.ts:159` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ `types.ts:149` 已改为 `posiDirection: string`，注释 `'2'=多头, '3'=空头`

---

### 19. OrderRecord.orderStatus 类型定义与实际数据不符

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **前端文件** | `frontend/src/services/types.ts:101` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ `types.ts:101` 已改为 `orderStatus: string`，注释 `'0'=全部成交, '1'=部分成交, '3'=未成交, '5'=已撤单`

---

### 20. 死代码：wire_ctp_market_bridge

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `server/main.py:173-211` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ `wire_ctp_market_bridge` 死代码已删除

---

### 21. 死代码：ws.ts onopen 重复赋值

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `frontend/src/services/ws.ts:34-36` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ 空 `onopen` 死代码已删除

---

### 22. 死代码：ctp_mapping.py 转换函数未调用

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `server/utils/ctp_mapping.py:100-171` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ 类型定义已改为 `string`，不再需要转换函数（或已集成到数据流中）

---

### 23. useSystemWs MD/TD 重连计数共用

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `frontend/src/hooks/useSystemWs.ts:66-69` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ MD/TD 重连计数已分离

---

### 24. 未使用的 import

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `server/api/query.py:9` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ 未使用的 `Optional` 导入已删除

---

### 25. OrderRecord 和 OrderStatus 类型重复定义

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `frontend/src/services/types.ts:93-117` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ `OrderStatus` 已改为 `OrderRecord` 的类型别名（`export type OrderStatus = OrderRecord`）

---

### 26. design.md 开发日志过时

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 改进 |
| **文档文件** | `docs/design.md` 开发日志 |
| **状态** | ✅ 已修复 |

**问题描述**：
- ✅ 开发日志已更新

---

## 汇总

| 优先级 | 编号 | 问题 | 状态 |
|--------|------|------|------|
| 🔴 P0 | 1 | cancelAllOrders 字段不匹配 | ✅ 已修复 |
| 🔴 P0 | 2 | K 线时间戳不一致 | ✅ 已修复 |
| 🔴 P1 | 3 | submitOrder 缺 exchangeID | ✅ 已修复 |
| 🔴 P1 | 4 | 止损单缺 exchangeID | ✅ 已修复 |
| 🔴 P1 | 5 | useMarketWs 双重调用 | ✅ 已修复 |
| 🔴 P1 | 6 | refreshAll 无防重入 | ✅ 已修复 |
| 🔴 P2 | 7 | 止损单触发竞态 | ✅ 已修复 |
| 🟡 P2 | 8 | reverse/lock 无依赖 | ✅ 已修复 |
| 🟡 文档 | 9-17 | 文档与代码不一致 | ✅ 已修复 |
| 🔵 P3 | 18-25 | 代码质量/死代码 | ✅ 已修复 |
| 🔵 改进 | 26 | 开发日志过时 | ✅ 已修复 |

> **全部 26 项已修复完成。** 检查日期：2026-07-27
