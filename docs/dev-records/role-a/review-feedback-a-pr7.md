# PR-7 Code Review 反馈

**审查分支**：`feature/pr-7-websocket-manager`
**审查 commit**：`443a6c5` (HEAD)
**审查时间**：2026-07-15
**审查范围**：5 commits / 10 files / +1018 -66 lines
**测试结果**：276 passed / 2 failed (pre-existing) / 46 skipped

---

## 审查范围确认

| 文件 | 变更 | 类型 |
|------|------|------|
| `ws/handlers.py` | 5个占位handler → 统一`handle_ws()` | 重写 |
| `ws/manager.py` | +心跳机制 | 扩展 |
| `services/reconnect.py` | 新文件：断线重连服务 | 新增 |
| `services/ctp_startup.py` | +OnFrontDisconnected处理 | 扩展 |
| `main.py` | 统一handler+心跳生命周期 | 修改 |
| `tests/test_ws_handlers.py` | 9 tests | 新增 |
| `tests/test_ws_heartbeat.py` | 7 tests | 新增 |
| `tests/test_reconnect.py` | 12 tests | 新增 |
| `tests/test_ws_integration.py` | 7 tests | 新增 |

**progress.md 状态不一致**：progress.md 写 "⏳ 待开始"，dev-record-a.md 写 "✅ 开发完成，待合并"。需同步更新 progress.md。

---

## 🔴 阻断性问题（必须修改）

### B1: `_attempt_reconnect()` 调用 `md_api.create()` 未清理旧实例

**文件**: `server/services/ctp_startup.py:259-266`

```python
def _attempt_reconnect(app, md_api):
    md_api.create()  # ← 重新创建 CTP API 实例
    import time
    time.sleep(2.0)
    return md_api.login_status == "logged_in"
```

**问题**：`MdUserApi.create()` 内部调用 `ctp.CThostFtdcMdApi.CreateFtdcMdApi()` + `RegisterSpi()` + `RegisterFront()` + `Init()`。在已断开的旧实例上再次调用 `create()` 会导致：
- 旧 CTP API 实例未 Release，资源泄漏（DLL handle、线程）
- SWIG 层面可能出现未定义行为（重复 RegisterSpi）
- `time.sleep(2.0)` 硬编码等待不可靠——CTP 回调是异步的，2秒不够或太多

**建议**：在 `create()` 前先调用 `md_api.release()` 清理旧实例，或重构为新建 `MdUserApi` 实例。等待机制应使用 `threading.Event` + `OnFrontConnected` 回调，而非 `time.sleep`。

### B2: `update_subscriptions()` 未在 reconnect 路径中调用

**文件**: `server/services/ctp_startup.py:229-236` + `server/services/reconnect.py:80-87`

**问题**：`ReconnectService.update_subscriptions()` 只在 `handle_ws()` 收到客户端 subscribe 消息时调用。但 CTP 断线重连后，需要重新订阅所有已订阅的合约。当前 `try_reconnect()` 调用 `subscribe_fn` 时，`_subscriptions` 列表可能为空（从未有客户端通过 WS 发送 subscribe 消息）。

**实际场景**：
1. 前端通过 REST `POST /api/market/subscribe` 订阅了 IF2608（不经过 WS handler）
2. CTP 断线
3. 重连后 `try_reconnect()` 调用 `subscribe_fn([])` — 空列表，IF2608 不会被重新订阅

**建议**：在 `_wire_bridge` 中，将 `MarketService.subscribe` 包装一层，每次 subscribe 时同步更新 `ReconnectService.update_subscriptions()`。或直接从 `MarketService.subscribed_instruments` 读取当前订阅列表。

---

## 🟡 改进建议

### 1. `handle_ws()` subscribe/unsubscribe 无错误响应

**文件**: `server/ws/handlers.py:53-63`

当 `subscribe_fn` 抛异常时，handler 静默忽略，客户端不知道订阅是否成功。建议 try/except 包装并返回 `{"type": "error", "message": "..."}` 给客户端。

### 2. 心跳 ping 与 handler ping 语义重叠

**文件**: `server/ws/manager.py:93-104` + `server/ws/handlers.py:49-50`

- `WebSocketManager._heartbeat_tick()` 向所有连接发送 `{"type": "ping"}`
- `handle_ws()` 收到 `{"action": "ping"}` 时回复 `{"type": "pong"}`

这两套 ping 机制独立运作：心跳 ping 由服务端定期发送，handler ping 由客户端主动发送。建议在 handler 中也处理 `{"type": "ping"}`（来自心跳），回复 `{"type": "pong"}`，避免客户端收到心跳 ping 后无法识别。

### 3. `_on_front_disconnected` 中线程直接读 `_retry_count`

**文件**: `server/services/ctp_startup.py:253`

```python
delay = reconnect_svc._get_delay(reconnect_svc._retry_count - 1)
```

虽然 Python GIL 保证 int 读写原子性，但直接访问 `_` 前缀的内部属性违反封装。建议将 `_get_delay` 改为使用内部计数器（`_get_delay_for_current_retry()`）。

### 4. `ReconnectService.on_disconnect()` 命名歧义

**文件**: `server/services/reconnect.py:47-49`

`on_disconnect()` 先 `_retry_count += 1` 再返回。调用方在 `on_disconnect()` 后检查 `should_retry()` 和 `_get_delay(_retry_count - 1)` 时需要理解计数器已经自增。建议拆为 `increment_retry()` 和 `get_current_delay()` 使语义更清晰。

### 5. `test_ws_integration.py` 集成深度不足

**文件**: `server/tests/test_ws_integration.py`

7 个测试中有 5 个只检查属性/方法存在性（smoke test），不测试实际行为。例如 `test_heartbeat_starts_on_startup` 只检查 `start_heartbeat` 是否 callable，不验证心跳是否真正启动。建议补充 lifespan 启动后心跳 task 确实 running 的断言。

### 6. `dev-record-a.md` 状态需同步到 `progress.md`

**文件**: `snapshots/role-a/progress.md:16`

progress.md 写 PR-7 "⏳ 待开始"，但 dev-record-a.md 已标记 "✅ 开发完成，待合并"。需更新 progress.md。

---

## 🔵 疑问确认

### Q1: `_attempt_reconnect` 是否需要重新注册 SPI？

`MdUserApi.create()` 内部会 `RegisterSpi(self.spi)`。断线后重连时，如果 CTP 底层已经清理了 SPI 注册，需要重新注册；如果没有，重复注册是否有副作用？建议确认 CTP 文档或实测验证。

### Q2: 心跳间隔 15 秒是否合适？

当前心跳间隔 15 秒，意味着最坏情况下死连接需要 15 秒才能被清理。对于行情系统，这是否可接受？如果缩短到 5 秒，对带宽/性能的影响？

---

## 审查结论

**❌ 需要修改后再审**

2 个阻断性问题需修复：
- B1: `_attempt_reconnect` 资源泄漏 + 硬编码 sleep
- B2: 重连后订阅列表可能为空

建议修复后重新提交审查。

---

| 维度 | 评价 |
|------|------|
| 功能正确性 | ⚠️ 核心功能正确，reconnect 路径有缺陷 |
| 测试质量 | ✅ 35 tests 覆盖正常/异常/边界，FakeWebSocket 设计合理 |
| 代码质量 | ✅ 统一 handle_ws 消除重复，ReconnectService 职责清晰 |
| 范围控制 | ✅ 仅改动 PR-7 相关文件 |
| 文档同步 | ⚠️ progress.md 未更新 |
| 潜在风险 | ⚠️ reconnect 资源泄漏 + 订阅恢复缺失 |
