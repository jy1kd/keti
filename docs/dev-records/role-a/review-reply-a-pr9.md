# PR-9 Code Review 反馈处理记录

**审查分支**：`feature/pr-9-trader-api`
**审查文件**：`review-feedback-a-pr9.md`
**处理时间**：2026-07-16
**审查结论**：1 阻断 + 6 建议 + 1 疑问

---

### 🔴 阻断性问题修复（1 条）

| # | 问题 | 修复 Commit | 处理说明 |
|---|------|------------|----------|
| B1 | TD login 流程不完整 — OnFrontConnected/OnRspUserLogin 未接线 | `1769162` | 参照 MD 的 `_connect_ctp()` 模式，添加 `_on_front_connected`（设置 `connection_status="connected"` + 调用 `login()`）和 `_on_rsp_user_login`（设置 `login_status`）。同时添加 `login_done.wait(timeout)` 等待登录结果。S6（OnRspOrderInsert/OnRspOrderAction）也在此 commit 一并接入，错误信息通过 logger.warning 记录 |

---

### 🟡 改进建议处理（6 条）

| # | 建议 | 采纳 | 处理说明 |
|---|------|------|----------|
| S1 | cancel_all 硬编码字符串 | ✅ 采纳 | 改用 `OrderStatus.NO_TRADED` 和 `OrderStatus.PART_TRADED` 替代 `"2"` 和 `"1"`。`"pending"` 保留（为 OrderManager 自定义状态，非 CTP 枚举值） |
| S2 | cancel() 未传递 exchange_id/instrument_id | ✅ 采纳 | 从订单记录中提取 `exchangeID` 和 `instrumentID` 传给 `TraderApi.cancel_order()` |
| S3 | reverse/lock 返回 200 | ✅ 采纳 | 改为 `HTTPException(status_code=501)`，API 直接 raise，不再调用 OrderManager 的占位方法 |
| S4 | broadcast 回调路径无测试 | ✅ 采纳 | 新增 3 个测试：`test_broadcast_called_on_rtn_order` / `test_broadcast_called_on_rtn_trade` / `test_broadcast_not_called_when_not_set` |
| S5 | _attempt_reconnect 仅重连 MD | ✅ 采纳 | 在 `start_ctp_trading_connection()` 末尾添加 TODO(PR-17) 注释，标注 TD 需要独立的断线重连机制 |
| S6 | OnRspOrderInsert/OnRspOrderAction 未接线 | ✅ 采纳 | 与 B1 同 commit 修复。错误信息通过 logger.warning 输出，后续 PR 可通过 broadcast 推送给前端 |

---

### 🔵 疑问确认回复（1 条）

**Q1**：TD 登录是否应像 MD 一样使用 `wait=True` 阻塞等待结果？

**回复**：TD 使用 fire-and-forget 是刻意设计。理由：
1. MD 登录必须阻塞 — 行情数据是系统核心依赖，没有 MD 整个应用无意义。lifespan 必须确认 MD 成功或失败
2. TD 登录不阻塞 — 即使 TD 登录失败，应用仍可提供行情查看、K线图等功能。用户可通过 `/api/connection/status` 的 `tdConnected` 字段了解 TD 状态，后续通过 `/api/connection/login` 重新连接
3. 如果 TD 也阻塞，启动时间翻倍（两次 CTP 连接各 30s 超时）。期货交易中，行情先就绪 + 交易后就绪是合理的启动顺序

B1 修复后，TD 的 `_run()` 线程内部会等待 `login_done.wait(timeout=LOGIN_TIMEOUT)`，如果超时或失败会记录日志。`/api/connection/status` 的 `tdConnected` 字段会正确反映实际状态。

---

### 测试记录

```
358 passed, 15 failed (4 test_config + 11 trio), 46 skipped
```

无回归。

---

已更新：`review-reply-a-pr9.md`
