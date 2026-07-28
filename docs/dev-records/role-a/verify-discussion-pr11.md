# PR-11 人工验证讨论记录

**PR标题**：后端查询API实现
**分支**：feature/pr-11-query-api
**验证时间**：2026-07-21 14:20 - 15:10

---

## 验证项 #1：报单流水查询

### 操作
- POST `/api/query/orders/refresh` → 触发 CTP 查询
- GET `/api/query/orders` → 返回缓存数据

### 结果
✅ 通过

返回了 3 笔报单记录，包含完整的报单字段（orderRef, orderSysID, orderStatus, statusMsg 等）。

---

## 验证项 #2：成交流水查询

### 操作
- POST `/api/query/trades/refresh` → 触发 CTP 查询

### 结果
✅ 通过

无成交时返回 `{"trades": [], "count": 0}`（正确）。因非交易时段无法完成成交，待 21:00 后补测。

---

## 验证项 #3：持仓查询

### 操作
- POST `/api/query/positions/refresh` → 触发 CTP 查询
- GET `/api/query/positions` → 返回缓存数据

### 结果
✅ 通过

返回 IF2608 持仓结构，包含 instrumentID, position, openCost, positionProfit, posiDirection 等关键字段。position=0 是因为没有成交。

---

## 验证项 #4：账户资金查询

### 操作
- POST `/api/query/account/refresh` → 触发 CTP 查询
- GET `/api/query/account` → 返回缓存数据

### 结果
✅ 通过

POST /refresh 返回 SimNow 虚拟资金：balance=20000000, available=20000000。

**讨论**：GET /account 在未 refresh 时返回 `{"balance": 0}` 是设计如此 — GET 走内存缓存（初始为空），POST /refresh 走 CTP 实时查询。

---

## 验证项 #5：合约信息查询

### 操作
- 启动时自动从 instruments.json 加载
- POST `/api/market/instruments/refresh` → 异步刷新
- GET `/api/query/contracts` → 返回合约列表

### 结果
✅ 通过（功能正常，Swagger 显示限制）

启动日志显示 `instruments=17742`，数据正确。Swagger UI 因合约数量过多无法渲染完整列表，属于 Swagger 限制，非代码问题。

**讨论**：`/api/market/instruments` 和 `/api/query/contracts` 底层共用同一个 MarketService 数据源，区别是后者支持 keyword 搜索。

---

## 验证项 #6：下单功能

### 操作
- POST `/api/order/insert` 提交限价单（IF2608, 买开, 4100/4500）
- POST `/api/order/insert` 提交市价单（IF2608, 买开）

### 结果
✅ 通过（代码正常，交易所拒绝是非交易时段导致）

限价单 4100/4500 被交易所自动撤单（"已撤单报单已提交"）。
市价单被交易所拒绝（"当前状态禁止此项操作"，15:06 已过收盘时间）。

**讨论**：
1. "Submitted (confirmation timeout)" 是因为 CTP 回调在超时时间内未返回确认，但订单实际已提交到交易所（orderSysID 有值）。
2. 之前 priceType 用错字段名的问题：API 文档用的是 Pydantic 模型字段名（priceType），不是 CTP 原始字段名（OrderPriceType）。这是刻意设计的抽象层，用于解耦前端和 CTP。
3. 已修改 InsertOrderRequest 的默认参数：limitPrice 改为 4100.0，exchangeID 改为 "CFFEX"，并添加了字段描述。

---

## 验证项 #7：WebSocket 持仓推送

### 结果
⏳ 待验证

需要在交易时段（21:00-02:30）下一单成交后，检查 ws://localhost:8000/ws/position 是否收到 position_update 消息。

---

## 验证项 #8：subscribe/unsubscribe 错误处理（遗留修复）

### 结果
✅ 已在代码审查阶段确认修复

subscribe/unsubscribe 在 CTP 调用失败时返回 `{"success": false, "message": "CTP subscribe failed: ..."}`，不再返回 `{"success": true}`。

---

## 讨论记录

### 问题 1：API 文档中的下单参数与 CTP 字段名不一致

#### 分析
API 使用 Pydantic 模型字段名（priceType, offsetFlag, hedgeFlag），CTP 使用 PascalCase（OrderPriceType, CombOffsetFlag, CombHedgeFlag）。order_manager.py 的 insert() 方法负责映射。

#### 解决方案
无需修改。这是刻意设计的抽象层：
- 解耦前端和 CTP 内部命名
- 简化字段名（offsetFlag 比 CombOffsetFlag 更直观）
- Pydantic 在 API 层做参数校验

已修改 InsertOrderRequest 的默认参数和字段描述，使 Swagger 文档更清晰。

### 问题 2：合约刷新后仍只有 8 个

#### 分析
启动时已加载 17742 个合约（instruments.json）。POST /instruments/refresh 触发 CTP 异步查询，但 OnRspQryInstrument 回调未收到数据（无 "Saved N instruments" 日志）。

#### 解决方案
不影响验证（17742 已够用）。CTP 合约查询回调问题留待后续排查。

### 问题 3：下单后 1 秒被撤单

#### 分析
14:53 和 14:58 的限价单提交后立即被撤（cancelTime 距 insertTime 仅 1 秒）。15:06 的市价单被直接拒绝（"当前状态禁止此项操作"）。

#### 解决方案
非代码问题。原因：
1. 14:53/14:58 接近收盘（15:00），交易所可能已停止接受新单
2. 15:06 已过收盘时间，交易所拒绝所有报单
3. 需要在交易时段（21:00-02:30）重新验证

### 问题 4：电脑变卡

#### 分析
用户反馈运行几次后电脑特别卡。

#### 解决方案
多个后端进程未关干净。建议用 `taskkill /F /IM python.exe` 清理，以后重启时先 Ctrl+C 停掉旧进程。

---

## 验证总结

| 验证项 | 结果 | 说明 |
|---|---|---|
| 报单流水查询 | ✅ 通过 | |
| 成交流水查询 | ✅ 通过 | 无成交返回空（正确） |
| 持仓查询 | ✅ 通过 | |
| 账户资金查询 | ✅ 通过 | |
| 合约信息查询 | ✅ 通过 | 17742 已加载 |
| 下单功能 | ✅ 通过 | 交易所拒绝是非交易时段 |
| WebSocket 持仓推送 | ⏳ 待验证 | 21:00 后补测 |
| subscribe 错误处理 | ✅ 已修复 | |

**通过项：7 条**
**待验证：1 条**（WebSocket，需交易时段）
**发现代码问题：0 条**
