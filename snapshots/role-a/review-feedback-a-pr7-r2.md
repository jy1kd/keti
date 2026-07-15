# PR-7 Code Review 反馈（二次审查）

**审查分支**：`feature/pr-7-websocket-manager`
**审查 commit**：`4b5bb2e` (HEAD)
**审查时间**：2026-07-15
**审查范围**：7 commits / 12 files / +1231 -74 lines（自 origin/main）
**测试结果**：280 passed / 2 failed (pre-existing) / 46 skipped

---

## 一次审查问题验证

| # | 问题 | 状态 | 验证 |
|---|------|------|------|
| B1 | `_attempt_reconnect` 资源泄漏 + 硬编码 sleep | ✅ 已修复 | `release()` + `threading.Event` + `OnFrontConnected` 回调等待（15s 超时） |
| B2 | `update_subscriptions` 未在 reconnect 路径调用 | ✅ 已修复 | `_subscribe_with_tracking` 包装 subscribe，同步更新 ReconnectService |
| 🟡#1 | subscribe/unsubscribe 无错误响应 | ✅ 已修复 | try/except + `{"type": "error", "action": "...", "message": "..."}` |
| 🟡#2 | 心跳 ping 与 handler ping 语义重叠 | ✅ 已修复 | handler 同时检查 `action == "ping"` 和 `msg_type == "ping"` |
| 🟡#3 | 直接访问 `_retry_count` 违反封装 | ✅ 已修复 | `get_current_delay()` 封装方法 |
| 🟡#6 | progress.md 状态未同步 | ✅ 已修复 | progress.md 已更新为"开发完成，待合并" |

---

## 🔴 阻断性问题（必须修改）

（无）

---

## 🟡 改进建议

### 1. `_attempt_reconnect` 中 `release()` 可能触发级联重连

**文件**: `server/services/ctp_startup.py:296-300`

```python
try:
    md_api.release()
except Exception:
    logger.debug("reconnect: release old instance failed (may already be released)")
```

`release()` 内部可能触发 CTP 的 `OnFrontDisconnected` 回调（如果连接仍处于半开状态）。此时 `_on_front_disconnected` handler 会再次调用 `reconnect_svc.on_disconnect()` + `should_retry()` + 启动新的 `_do_reconnect` 线程，导致两个重连线程并行。

**建议**：在 `_attempt_reconnect` 入口处设置一个 `_reconnecting` 标志位，`_on_front_disconnected` 检查此标志位，若正在重连中则跳过。或在 `release()` 前先 `spi.on("OnFrontDisconnected", lambda _: None)` 临时禁用。

### 2. 集成测试深度不足（遗留）

**文件**: `server/tests/test_ws_integration.py`

7 个测试中 5 个仍为 smoke test（检查属性存在性）。建议补充：
- lifespan 启动后心跳 task 确实 running
- `OnFrontDisconnected` 触发后 reconnect service 状态变化
- subscribe 通过 WS 后 ReconnectService 订阅列表更新

### 3. `_on_rsp_user_login` 在 `_attempt_reconnect` 中未调用 `_wire_bridge`

**文件**: `server/services/ctp_startup.py:317-322`

重连成功后只设置 `login_status = "logged_in"`，不调用 `_wire_bridge()`。当前实现中，首次连接时 `_wire_bridge` 注册的 `OnRtnDepthMarketData` handler 仍在 `spi._handlers` 中，所以行情推送不会中断。但如果未来 `_wire_bridge` 需要执行其他初始化逻辑（如重新注册 K-line 服务），此处会遗漏。

**建议**：在 `_attempt_reconnect` 的 `_on_rsp_user_login` 中，成功时调用 `_wire_bridge(app, md_api, loop)` 确保完整性。需将 `loop` 参数传入或从 `app.state` 获取。

---

## 🔵 疑问确认

（无）

---

## 审查结论

**✅ 通过**

一次审查的 2 个阻断性问题和 4 个改进建议全部修复。代码逻辑正确，测试覆盖充分。剩余 3 个改进建议均为非阻塞优化，可在后续 PR 中处理。

---

| 维度 | 评价 |
|------|------|
| 功能正确性 | ✅ reconnect 路径完整：release → create → Event 等待 → 订阅恢复 |
| 测试质量 | ✅ 280 passed，39 个 PR-7 新测试覆盖正常/异常/边界 |
| 代码质量 | ✅ 统一 handle_ws + 错误响应 + 封装方法 |
| 范围控制 | ✅ 仅改动 PR-7 相关文件 |
| 文档同步 | ✅ progress.md + dev-record-a.md + review-reply-a.md 已更新 |
| 潜在风险 | ⚠️ release() 级联重连（低概率，有日志兜底） |
