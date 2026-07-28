# 代码审查 Bug 报告

**审查日期**：2026-07-28
**修复日期**：2026-07-28
**审查范围**：前端全部模块 + 后端全部模块
**审查方法**：4 路并行 agent 逐文件审查

**修复状态**：✅ 全部已修复（BUG-29 跳过，为低优先级类型标注问题；BUG-35 跳过，设计约束；BUG-37~39 复查收回）

---

## 🔴 严重（CRITICAL）— 6 个

### BUG-01：WebSocket 重连一次失败后永久断开

- **文件**：`frontend/src/hooks/useReconnect.ts:32-74`、`frontend/src/services/ws.ts:55-61`
- **问题**：`scheduleReconnect()` 递增 `retryCountRef.current` 后调用 `ws.connect()`。若连接失败，`ws.ts` 的 `onclose` 仅打日志，不触发 `scheduleReconnect()`。轮询 `setInterval` 检查 `retryCountRef.current === 0`，此时已非 0，也不触发。系统卡死，无法再重连。
- **影响**：任何瞬断后行情/报单/系统状态永久丢失，唯一恢复方式是刷新页面。
- **修复**：WSManager 的 `onclose` 需通知 `useReconnect` 调度下次重试。方案：给 WSManager 加重连回调，或在 `useReconnect` 中覆盖 `onclose`。

### BUG-02：OrderFlow 订单状态码映射完全错误

- **文件**：`frontend/src/modules/query/OrderFlow.tsx:5-10`
- **问题**：
  - `'0' → '已提交'` ❌ 应为 `'全部成交'`（ALL_TRADED）
  - `'3' → '全部成交'` ❌ 应为 `'未成交(不在队列)'`（NO_TRADED_NOT_QUEUING）
- **参考**：`server/ctp_wrapper/types.py:49-56`
- **影响**：用户看到的订单状态与实际完全相反。
- **修复**：
  ```typescript
  const STATUS_MAP: Record<string, string> = {
    '0': '全部成交',
    '1': '部分成交',
    '2': '未成交(排队)',
    '3': '未成交',
    '5': '已撤单',
  }
  ```

### BUG-03：已成交订单显示撤单按钮

- **文件**：`frontend/src/modules/query/OrderFlow.tsx:29-31`
- **问题**：`isActiveOrder` 返回 `true` 对 status `'0'`（全部成交），导致已完成订单出现撤单按钮。
- **修复**：
  ```typescript
  function isActiveOrder(status: string): boolean {
    return status === '1' || status === '2'
  }
  ```

### BUG-04：缺少 OnErrRtnOrderInsert 回调

- **文件**：`server/ctp_wrapper/callback.py`、`server/services/ctp_startup.py`
- **问题**：CTP 有 `OnErrRtnOrderInsert`（交易所级拒绝），代码处理了 `OnErrRtnOrderAction` 但未处理 `OnErrRtnOrderInsert`。交易所拒绝已接受的订单时，订单状态停留在 "accepted"。
- **影响**：用户以为报单成功，实际已被交易所拒绝。
- **修复**：在 `callback.py` 添加 `OnErrRtnOrderInsert` 处理，更新 `orderSubmitStatus` 为 `"error"` 或 `"4"`（InsertRejected）。

### BUG-05：订阅状态先于 CTP 调用写入

- **文件**：`server/services/market_service.py:237-238`
- **问题**：`subscribe()` 先将合约加入 `_subscriptions`（237-238 行），再调用 `self._subscribe_fn()`（242 行）。若 CTP 调用失败，`_subscriptions` 已被修改但实际未订阅。
- **影响**：订阅失败但系统认为已订阅，行情不会到达，后续退订也会异常。
- **修复**：将 `_subscriptions.add()` 移到 CTP 调用成功之后。

### BUG-06：批量撤单永远显示空列表

- **文件**：`frontend/src/modules/order/OrderPanel.tsx:62`、`server/services/field_mapping.py:153`
- **问题**：前端 `handleBatchCancel` 过滤 `orderStatus === 'no_traded'`，但后端 `/api/query/orders` 返回原始 CTP 码 `'2'`，不匹配。
- **影响**：批量撤单功能完全不可用。
- **修复**：后端返回前应用 `order_status_from_ctp()` 转换，或前端同时匹配 `'2'`。

---

## 🟠 高（HIGH）— 8 个

### BUG-07：SHFE 今仓/昨仓平仓标志错误

- **文件**：`frontend/src/modules/query/Position.tsx:13-15`
- **问题**：有今仓时对全部仓位发 `close_today`，但昨仓需用 `close`。上期所会拒绝 `close_today` 超出今仓数量的报单。
- **修复**：区分今仓 `close_today` + 昨仓 `close` 分别下单。

### BUG-08：MarketTable 未校验 DBL_MAX 价格

- **文件**：`frontend/src/modules/market/MarketTable.tsx:109-145`
- **问题**：`lastPrice`、`bidPrice1`、`askPrice1` 直接使用，未检查 CTP 的 DBL_MAX 哨兵值（1.7976931348623157e+308）。`change` 和 `changePercent` 计算会产生 Infinity/NaN。
- **修复**：加 `isValidPrice` 校验，无效值显示为 0 或 `--`。

### BUG-09：资金字段未校验 DBL_MAX

- **文件**：`frontend/src/modules/query/AccountQuery.tsx:3,22-63`
- **问题**：`fmt(n)` 直接 `.toFixed(2)`，DBL_MAX 值会产生 300+ 位数字串，撑破布局。
- **修复**：
  ```typescript
  const CTP_INVALID = 1.7976931348623157e+308
  function fmt(n: number): string {
    if (n == null || n >= CTP_INVALID || n <= -CTP_INVALID) return '--'
    return n.toFixed(2)
  }
  ```

### BUG-10：一键反向用 IOC+FAK 可能部分成交

- **文件**：`server/api/order.py:230-233`
- **问题**：反向平仓用 `time_condition="1"`（IOC）+ `volume_condition="1"`（AV/FAK），部分成交后仍开反向仓，持仓暴露不对称。
- **示例**：持多 10 手，平仓只成交 8 手，又开空 10 手 → 实际净仓暴露与预期不符。
- **修复**：改用 FOK（`volume_condition="3"`），全部成交或全部失败。

### BUG-11：一键反向/锁仓未处理上期所今仓

- **文件**：`server/api/order.py:188-194`
- **问题**：始终用 `offset_flag="1"`（平仓），上期所今仓需 `offset_flag="3"`（平今）。
- **影响**：SHFE 今仓报单被交易所拒绝。
- **修复**：检查 `exchange_id` 和 `todayPosition`/`ydPosition`，分拆下单。

### BUG-12：OrderStatus.NO_TRADED_QUEUING = "4" 错误

- **文件**：`server/ctp_wrapper/types.py:55-56`
- **问题**：CTP 的 OrderStatus 无 `"4"` 值，`"4"` 是 OrderPriceType 的值。`_ACTIVE_STATUSES` 中的 `"4"` 永远匹配不到。
- **修复**：移除 `NO_TRADED_QUEUING` 或改值为 `"2"`（已被 `NO_TRADED` 覆盖，建议移除）。

### BUG-13：QueryService 计数属性返回 0

- **文件**：`server/services/query_service.py:65-74`
- **问题**：`order_count`/`trade_count`/`position_count` 返回 `len(self._pending_orders)` 等（查询后清零），应返回 `len(self._orders)`。
- **修复**：改为 `return len(self._orders)` 等。

### BUG-14：QuickActions 一键反向/锁仓失败仍显示成功

- **文件**：`frontend/src/components/QuickActions/index.tsx:27-28`
- **问题**：`executeAction` 不检查响应体，后端 HTTP 200 + `success: false` 时仍显示绿色成功 toast。
- **修复**：检查 `result.success` 和 `result.orders` 中子订单的成功状态。

---

## 🟡 中等（MEDIUM）— 15 个

### BUG-15：pRspInfo=None 默认 error_id=-1

- **文件**：`server/services/ctp_startup.py:571,767,989`
- **问题**：`pRspInfo is None` 时默认 `error_id = -1`，`-1 != 0` 触发错误分支。CTP 中 `pRspInfo=None` 表示无错误，应默认 0。
- **修复**：改为 `error_id = getattr(pRspInfo, "ErrorID", 0) if pRspInfo is not None else 0`

### BUG-16：一键锁仓同样有部分成交风险

- **文件**：`server/api/order.py:291-301`
- **问题**：同 BUG-10，IOC+FAK 模式下锁仓可能部分成交，对冲不完整。

### BUG-17：MD 重连丢失所有订阅

- **文件**：`server/services/ctp_startup.py:318-331`
- **问题**：`_wire_bridge()` 创建新 `ReconnectService`，`_subscriptions` 清空。重连后不重新订阅。
- **修复**：保留已有 `ReconnectService` 或从 `MarketService.get_subscriptions()` 恢复。

### BUG-18：release() 异常时状态不清理

- **文件**：`server/ctp_wrapper/md_user_api.py:122-129`、`server/ctp_wrapper/trader_api.py:303-310`
- **问题**：`Release()` 抛异常后，`connection_status` 停留在 "connected"，`login_status` 停留在 "logged_in"。
- **修复**：用 `finally` 块，或先清理状态再调 `Release()`。

### BUG-19：空字符串凭据回退到环境变量

- **文件**：`server/config.py:29-31`
- **问题**：`user_id or os.getenv(...)` 中空字符串为 falsy，回退到环境变量。
- **修复**：改为 `if user_id is not None`。

### BUG-20：ORDER_STATUS_FROM_CTP 缺少 '3' 和 'a'

- **文件**：`frontend/src/utils/orderMapping.ts:49-54`
- **问题**：缺少 `'3'`（NO_TRADED_NOT_QUEUING）和 `'a'`（UNKNOWN），返回 undefined。
- **修复**：补充映射。

### BUG-21：toCtpDirection 等函数无 fallback

- **文件**：`frontend/src/utils/orderMapping.ts:58-72`
- **问题**：`toCtpDirection`、`toCtpOffsetFlag`、`toCtpPriceType`、`toCtpTimeCondition` 无 fallback，意外输入返回 undefined。
- **修复**：加 `?? '默认值'`。

### BUG-22：useEffect 依赖缺失

- **文件**：`frontend/src/modules/order/OrderForm.tsx:22-26`、`frontend/src/modules/order/StopOrderForm.tsx:23-26,29-32`
- **问题**：effect 内读 `orderForm.limitPrice` 但依赖数组只有 `[price]`，可能读到过期值。
- **修复**：提取变量到 effect 外，加到依赖数组。

### BUG-23：NaN 可作为价格/数量提交

- **文件**：`frontend/src/modules/order/store.ts:72`、`frontend/src/modules/order/OrderForm.tsx:172,204`
- **问题**：清空输入框 `Number('')` → 0，输入 `'-'` → NaN。NaN 通过 `<= 0` 校验。
- **修复**：加 `Number.isFinite()` 校验。

### BUG-24：K 线实时数据时间戳与历史不兼容

- **文件**：`frontend/src/hooks/useMarketWs.ts:24-41`、`frontend/src/modules/query/QueryPanel.tsx:65-80`
- **问题**：`snapshotToKline()` 用时分秒构造时间戳（epoch=0），历史 K 线用完整 epoch。实时 K 线不追加到历史末尾，显示在图表起始位置。
- **修复**：用 `updateTime` + `actionDay` 构造完整 epoch 时间戳，再对齐周期。

### BUG-25：删除的预置合约下次加载又出现

- **文件**：`frontend/src/stores/contracts.ts:59-71,73-106`
- **问题**：`removeContractById()` 未从 `presetIds` 移除，`loadSubscribedContracts()` 合并时又加回来。
- **修复**：同步移除 `presetIds` 中的对应项。

### BUG-26：SpreadDisplay 未校验 DBL_MAX

- **文件**：`frontend/src/components/SpreadDisplay/index.tsx:6-23`
- **问题**：仅检查 `=== 0`，DBL_MAX 值会作为价差显示。
- **修复**：加 `isValidPrice` 校验。

### BUG-27：formatPrice 未校验 DBL_MAX 上界

- **文件**：`frontend/src/utils/format.ts:4-7`
- **问题**：`price <= 0` 过滤不了 DBL_MAX。
- **修复**：加 `price >= CTP_INVALID_PRICE` 检查。

### BUG-28：on_rtn_order 在锁外读 _rsp_events

- **文件**：`server/services/order_manager.py:474-477`
- **问题**：`with self._lock` 块外读 `self._rsp_events.get(ref)`，CPython GIL 保护下安全，但架构脆弱。
- **修复**：将 `event.set()` 移入锁内，或用锁内捕获的本地引用。

### BUG-29：insert_order() 返回类型标注错误

- **文件**：`server/ctp_wrapper/trader_api.py:103`
- **问题**：标注 `-> str` 但调用方当 `bool` 用。靠 truthy 兼容，易误用。
- **修复**：统一返回类型。

---

## 🟢 低（LOW）— 10 个

### BUG-30：CancelOrderRequest.orderSysID 类型语义混乱

- **文件**：`server/api/order.py:72`
- **问题**：`Optional[str] = ""` 允许 None 和 ""，语义不一致。
- **修复**：改为 `str = ""` 或 `Optional[str] = None`。

### BUG-31：临时 SPI handler 未清理

- **文件**：`server/services/ctp_startup.py:224-225`
- **问题**：初始连接的 `_on_front_connected` 和 `_on_rsp_user_login` handler 在 `_wire_bridge` 后仍保留。
- **修复**：`_wire_bridge` 后显式移除临时 handler。

### BUG-32：重连重置退避计数器

- **文件**：`server/services/ctp_startup.py:428`
- **问题**：`_wire_bridge` 创建新 `ReconnectService`，`_retry_count` 重置为 0，指数退避失效。
- **修复**：保留已有 `ReconnectService`。

### BUG-33：批量撤单用缓存而非实时查询

- **文件**：`frontend/src/modules/order/OrderPanel.tsx:58`
- **问题**：`handleBatchCancel` 调 `getOrders()` 返回缓存数据，可能过期。
- **修复**：改用 `refreshOrders()`。

### BUG-34：submitStopOrder 重复定义 direction/offset map

- **文件**：`frontend/src/modules/order/store.ts:115-116`
- **问题**：与 `orderMapping.ts` 中的 map 重复，维护风险。
- **修复**：复用 `orderMapping.ts` 的导出。

### BUG-35：WSManager 单例 URL 不更新

- **文件**：`frontend/src/hooks/useMarketWs.ts:80-82`
- **问题**：全局单例创建后 URL 不变。低风险，URL 通常运行时不改。

### BUG-36：useSystemWs 可能重置连接状态

- **文件**：`frontend/src/hooks/useSystemWs.ts:66-69`
- **问题**：effect 依赖 `setMdPhase`/`setTdPhase`，若非引用稳定则每次渲染重置为 'connecting'。
- **修复**：改为空依赖数组 `[]`。

### BUG-37-39：复查收回

以下 bug 经复查确认非 bug，记录保留供参考：
- BUG-37：`order.py:245-246` 一键反向方向逻辑（注释与代码一致，正确）
- BUG-38：`trader_api.py:209` ActionFlag="0"（CTP 值正确）
- BUG-39：`order_manager.py:382-385` cancel_all() 快照方式（设计选择，文档化即可）

---

## 📊 统计汇总

| 严重程度 | 数量 | 占比 |
|----------|------|------|
| 🔴 CRITICAL | 6 | 15% |
| 🟠 HIGH | 8 | 21% |
| 🟡 MEDIUM | 15 | 38% |
| 🟢 LOW | 10 | 26% |
| **合计** | **39** | 100% |

### 按模块分布

| 模块 | CRITICAL | HIGH | MEDIUM | LOW | 合计 |
|------|----------|------|--------|-----|------|
| 后端交易 | 1 | 4 | 3 | 2 | 10 |
| 后端行情 | 1 | 0 | 5 | 2 | 8 |
| 前端交易 | 2 | 0 | 4 | 2 | 8 |
| 前端行情 | 0 | 2 | 2 | 2 | 6 |
| 前端查询 | 2 | 2 | 0 | 0 | 4 |
| 前端 WS | 1 | 0 | 1 | 2 | 4 |
| **合计** | **7** | **8** | **15** | **10** | **40** |

> 注：部分 bug 跨模块（如 BUG-06 涉及前后端），按主要归属归类。

---

## 🎯 推荐修复顺序

### 第一批：功能不可用（影响核心交易）

1. **BUG-01**：WS 重连永久断开
2. **BUG-06**：批量撤单空列表
3. **BUG-02 + BUG-03**：订单状态码映射错误 + 撤单按钮
4. **BUG-10 + BUG-11**：一键反向/锁仓部分成交 + SHFE 今仓

### 第二批：数据正确性

5. **BUG-08 + BUG-09 + BUG-26 + BUG-27**：DBL_MAX 价格防护
6. **BUG-14**：QuickActions 误报成功
7. **BUG-05**：subscribe 状态先写后调
8. **BUG-17**：MD 重连丢失订阅

### 第三批：健壮性

9. **BUG-04**：缺少 OnErrRtnOrderInsert
10. **BUG-15**：pRspInfo 默认值
11. **BUG-18**：release 异常处理
12. **BUG-24**：K 线时间戳兼容
