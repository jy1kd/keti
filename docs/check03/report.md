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
| **状态** | ⏳ 待处理 |

**问题描述**：
- 前端 `CancelAllResponse` 期望字段：`cancelled`(int) / `failed`(int) / `errors`(string[])
- 后端 `cancel_all()` 返回字段：`attempted`(int) / `succeeded`(int) / `failedRefs`(string[])
- `result.cancelled` 为 `undefined`，toast 显示异常

---

### 2. K 线时间戳前后端不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P0 |
| **影响** | K 线图表数据错位/重复，REST 和 WebSocket 路径产生不同时间戳 |
| **后端文件** | `server/services/kline_service.py:58` |
| **前端文件** | `frontend/src/hooks/useMarketWs.ts:23-25`、`frontend/src/modules/query/QueryPanel.tsx:66-69` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 后端 `calendar.timegm()` 将 CTP 的中国时间（UTC+8）当作 UTC 处理，时间戳快 8 小时
- 前端 WebSocket 路径直接用 CTP 原始时分秒，REST 路径用 `new Date()` 按浏览器本地时区解析
- 同一根 K 线，两条路径产生不同的 `timestamp`，导致图表上出现重复/错位蜡烛

---

### 3. submitOrder 缺少 exchangeID

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | 非 CFFEX 合约（SHFE/CZCE/DCE/INE/GFEX）报单使用错误交易所代码，CTP 可能拒绝 |
| **前端文件** | `frontend/src/utils/orderMapping.ts:120-134` |
| **后端文件** | `server/api/order.py:36` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 前端 `convertOrderRequest()` 不包含 `exchangeID` 字段
- 后端 `InsertOrderRequest` 默认 `exchangeID="CFFEX"`
- 对于 au2506(SHFE)、rb2510(SHFE) 等非 CFFEX 合约，报单会带错误交易所代码

---

### 4. 止损单缺少 exchangeID

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | 止损触发后，非 CFFEX 合约的报单 exchange_id=""，CTP 可能拒绝 |
| **前端文件** | `frontend/src/services/api.ts:458-468` |
| **后端文件** | `server/api/order.py:80-92`、`server/services/stop_order.py:247-254` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `SubmitStopOrderRequest` 无 `exchangeID` 字段
- `_trigger_order()` 调用 `order_manager.insert()` 时未传 `exchange_id`，默认为空字符串
- 止损单的 `StopOrder` 数据结构也不存储 exchangeID

---

### 5. useMarketWs 被重复调用，K 线周期冲突

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | 两个不同周期的 K 线数据混入同一个 store，图表数据错乱 |
| **前端文件** | `frontend/src/modules/market/MarketPanel.tsx:58`、`frontend/src/modules/query/QueryPanel.tsx:57` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `MarketPanel` 调用 `useMarketWs(..., '5m')`
- `QueryPanel` 调用 `useMarketWs(..., period)` — period 可由用户切换
- 两个 hook 各自创建独立 WebSocket 连接，各自调用 `appendKline` 写入同一个 store
- 当 QueryPanel 的 period 不是 '5m' 时，不同周期的 K 线数据混在一起

---

### 6. refreshAll 无防重入

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P1 |
| **影响** | CTP 查询并发冲突，可能导致查询超时或数据丢失 |
| **前端文件** | `frontend/src/modules/query/store.ts:190-208`、`frontend/src/modules/query/QueryPanel.tsx:50-53` |
| **后端文件** | `server/services/query_service.py` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `setInterval` 每 10 秒调用 `refreshAll()`
- `refreshAll` 总耗时约 11-16 秒（5 次查询 × 1.2s 延迟 + 查询时间）
- 不检查上一次是否完成，导致两个 `refreshAll` 并发执行
- CTP 单线程，~1 次/秒频率限制，并发查询会冲突

---

### 7. 止损单触发存在竞态条件

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔴 P2 |
| **影响** | 已取消的止损单仍可能触发报单；快速行情变动可能导致重复触发 |
| **后端文件** | `server/services/stop_order.py:216-274` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `on_market_data` 在构建 candidates 列表后释放锁，触发循环在锁外执行
- 如果在释放锁和 `_trigger_order` 之间，另一个线程取消了止损单，取消的止损单仍会被触发
- `_trigger_order` 不检查 `order.status` 就直接调用 `insert()`
- 快速连续行情变动可能两个线程同时触发同一止损单，导致重复报单

---

## 🟡 不一致问题（建议修复）

### 8. reverse/lock 操作平仓和开仓无依赖检查

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P2 |
| **影响** | 平仓被拒时开仓仍执行，仓位不减反增 |
| **后端文件** | `server/api/order.py:206-249` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 先发平仓单，再发开仓单，两者独立
- 如果平仓被拒（如保证金不足），开仓仍会执行

---

### 9. design.md 缺少 4 个已实现的 API 端点

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **影响** | 文档与代码不一致，新开发者无法从文档了解完整 API |
| **文档文件** | `docs/design.md` 4.2/4.4 节 |
| **代码文件** | `server/api/market.py` |
| **状态** | ⏳ 待处理 |

**缺失端点**：
- `GET /api/market/kline`（line 144）
- `GET /api/market/depth`（line 214）
- `GET /api/market/options/underlyings`（line 258）
- `GET /api/market/volatility`（line 318）

---

### 10. /api/order/reverse 请求参数：design.md vs 代码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:706` |
| **代码文件** | `server/api/order.py:68-71` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- design.md：`{order_ref}` — 按报单引用查找持仓
- 代码：`{instrumentID}` — 按合约代码查找持仓

---

### 11. /api/order/lock 请求参数：design.md vs 代码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:707` |
| **代码文件** | `server/api/order.py:74-77` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- design.md：`{instrument_id, volume}`
- 代码：仅 `{instrumentID}`，volume 从持仓自动推导

---

### 12. /api/order/stop/cancel 请求参数命名不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:710` |
| **代码文件** | `server/api/order.py:95-98` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- design.md：`{stop_order_ref}`
- 代码：`{stopOrderID}`

---

### 13. StopOrderRequest 字段名不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:1124-1133` |
| **代码文件** | `server/api/order.py:80-92` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- design.md：`combOffsetFlag` / `volumeTotalOriginal` / `timeCondition`
- 代码：`offsetFlag` / `volume`（无 timeCondition，内部硬编码）

---

### 14. StopOrder 数据结构多处不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:1136-1149`、`docs/design.md:529-547` |
| **代码文件** | `server/services/stop_order.py:68-82` |
| **状态** | ⏳ 待处理 |

**字段映射**：

| design.md 接口 | design.md 持久化 | 代码实际 |
|---|---|---|
| `stopOrderRef` | `stop_order_ref` | `stopOrderID` |
| `combOffsetFlag` | `offset` | `offsetFlag` |
| `volumeTotalOriginal` | `volume` | `volume` |
| `triggeredOrderRef` | `triggered_order_ref` | `orderRef` |

---

### 15. direction/offset 值编码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/design.md:554` |
| **代码文件** | `server/services/stop_order.py:233-235` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- design.md：`direction: "buy"/"sell"`, `offset: "open"/"close"/"close_today"`
- 代码：CTP 字符码 `"0"/"1"` 和 `"0"/"1"/"3"`

---

### 16. 期权合约筛选 productClass 值不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/task.md` PR-14 第 1684 行 |
| **代码文件** | `server/services/options_service.py` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- PR-18 task.md：`productClass='2'`（正确）
- PR-14 task.md：`productClass='1'`（错误）
- 代码实际使用 `'2'`

---

### 17. progress.md 存在重复条目

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `snapshots/role-b/progress.md:312-330` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- PR-15 有两个条目：第 246 行标记"已完成"（正确），第 312 行标记"待开始"（重复/过时）

---

## 🔵 改进建议（代码质量）

### 18. PositionRecord 类型定义与实际数据不符

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **前端文件** | `frontend/src/services/types.ts:159` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `types.ts` 声明 `posiDirection: 'long' | 'short'`
- 实际 CTP 返回 `"2"`（多）/ `"3"`（空）
- Store 使用 `RawPosition` 绕过，但类型定义会误导开发者

---

### 19. OrderRecord.orderStatus 类型定义与实际数据不符

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **前端文件** | `frontend/src/services/types.ts:101` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `types.ts` 声明 `'submitted' | 'partial' | 'all_traded' | 'canceled' | 'rejected'`
- 实际 CTP 返回 `"0"`（全部成交）/ `"1"`（部分成交）/ `"5"`（已撤销）
- `ctp_mapping.py` 中的转换函数存在但从未被调用

---

### 20. 死代码：wire_ctp_market_bridge

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `server/main.py:173-211` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 函数定义 38 行但从未调用，实际桥接在 `ctp_startup._wire_bridge` 中完成

---

### 21. 死代码：ws.ts onopen 重复赋值

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `frontend/src/services/ws.ts:34-36` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 第 34 行设置空 `onopen`，第 55 行覆盖为带日志的 `onopen`，第一处是死代码

---

### 22. 死代码：ctp_mapping.py 转换函数未调用

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `server/utils/ctp_mapping.py:100-171` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `convert_order_return_from_ctp()` 和 `convert_position_from_ctp()` 定义但从未调用
- 这导致 CTP 枚举值（如 orderStatus、posiDirection）未被转换为前端期望的语义值

---

### 23. useSystemWs MD/TD 重连计数共用

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `frontend/src/hooks/useSystemWs.ts:66-69` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 同一个 `reconnectCount` 同时设置到 MD 和 TD，一个断线导致另一个的重连计数也被更新

---

### 24. 未使用的 import

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `server/api/query.py:9` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `from typing import Optional` 已导入但未使用

---

### 25. OrderRecord 和 OrderStatus 类型重复定义

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **文件** | `frontend/src/services/types.ts:93-117` |
| **状态** | ⏳ 待处理 |

**问题描述**：
- `OrderRecord`（93-104 行）和 `OrderStatus`（106-117 行）字段完全相同，应合并或建立别名

---

### 26. design.md 开发日志过时

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 改进 |
| **文档文件** | `docs/design.md` 开发日志 |
| **状态** | ⏳ 待处理 |

**问题描述**：
- 最后更新为 v2.0（2026-07-15），缺少 PR-22、PR-C2、PR-C3、PR-16 等后续记录

---

## 汇总

| 优先级 | 编号 | 问题 | 影响 |
|--------|------|------|------|
| 🔴 P0 | 1 | cancelAllOrders 字段不匹配 | toast 显示 undefined |
| 🔴 P0 | 2 | K 线时间戳不一致 | 图表数据错位/重复 |
| 🔴 P1 | 3 | submitOrder 缺 exchangeID | 非 CFFEX 报单被拒 |
| 🔴 P1 | 4 | 止损单缺 exchangeID | 非 CFFEX 止损失败 |
| 🔴 P1 | 5 | useMarketWs 双重调用 | K 线周期冲突 |
| 🔴 P1 | 6 | refreshAll 无防重入 | CTP 查询超时 |
| 🔴 P2 | 7 | 止损单触发竞态 | 已取消止损仍触发 |
| 🟡 P2 | 8 | reverse/lock 无依赖 | 仓位可能增加 |
| 🟡 文档 | 9-17 | 文档与代码不一致 | 维护困难 |
| 🔵 P3 | 18-25 | 代码质量/死代码 | 可维护性 |
| 🔵 改进 | 26 | 开发日志过时 | 文档完整性 |
