# PR-9 Code Review 反馈

## 第 1 轮审查

审查分支：`feature/pr-9-trader-api`
审查 commit：`c58651e` (HEAD)，共 7 commits（b3fbec5 ~ c58651e）
审查时间：2026-07-16
测试结果：155 passed / 11 failed (trio 环境，非回归) / 46 skipped

---

### 🔴 阻断性问题（必须修改）

#### B1: TD 连接/login 流程不完整 — 状态永远卡在 `connecting`，且未调用 login

**【文件】`server/services/ctp_startup.py:405-413`**

`start_ctp_trading_connection()` 中的 `_run()` 线程只调用了 `trader.create()`，但缺少三个关键步骤：

```python
# 当前代码（不完整）
def _run():
    try:
        trader.create()
        logger.info("CTP trading connection initiated ...")
    except Exception:
        logger.warning("CTP TraderApi.create() failed", exc_info=True)
```

**缺失步骤**：
1. 未注册 `OnFrontConnected` handler → `trader.connection_status` 永远为 `"connecting"`，不会变成 `"connected"`
2. `OnFrontConnected` 回调中未调用 `trader.login()` → CTP 认证从未发起
3. 未注册 `OnRspUserLogin` handler → `trader.login_status` 永远为 `"not_logged_in"`

**因果链**：
```
_run() → trader.create() → connection_status = "connecting"
  → CTP OnFrontConnected 回调触发 → 无 handler → 状态不变
  → /api/connection/status → tdConnected: false（永久）
```

**对比 MD 流程**（`_connect_ctp()` 中正确处理）：
```python
def _on_front_connected():
    md_api.connection_status = "connected"  # ← 状态更新
    front_connected.set()
    md_api.login()                          # ← 发起登录

def _on_rsp_user_login(...):
    md_api.login_status = "logged_in"       # ← 登录状态
```

**建议修复**：在 `start_ctp_trading_connection()` 中，参照 `_connect_ctp()` 的 MD 模式：
```python
def _on_front_connected():
    trader.connection_status = "connected"
    try:
        trader.login()
    except Exception:
        logger.warning("TD login request failed", exc_info=True)

def _on_rsp_user_login(pRspUserLogin, pRspInfo, nRequestID, bIsLast):
    if not bIsLast:
        return
    if pRspInfo is None or getattr(pRspInfo, "ErrorID", -1) == 0:
        trader.login_status = "logged_in"

trader.spi.on("OnFrontConnected", _on_front_connected)
trader.spi.on("OnRspUserLogin", _on_rsp_user_login)
```

---

### 🟡 改进建议

#### S1: `cancel_all` 状态判断使用硬编码字符串

**【文件】`server/services/order_manager.py:160`**

```python
active_refs = [
    ref for ref, o in self._orders.items()
    if o["orderStatus"] in ("pending", "2", "1")  # 硬编码
]
```

建议：使用 `types.py` 中已有的 `OrderStatus` 常量，或提取 `_is_active()` 辅助方法。

---

#### S2: `OrderManager.cancel()` 未传递 `exchange_id`/`instrument_id`

**【文件】`server/services/order_manager.py:147`**

```python
return self._trader.cancel_order(order_ref=order_ref)
```

`TraderApi.cancel_order()` 已支持 `exchange_id` 和 `instrument_id` 参数（commit `842e772`），OrderManager 拿到 order 对象后可以提取这些字段传给 CTP，提高撤单准确性。

---

#### S3: `reverse`/`lock` 占位返回 200 而非 501

**【文件】`server/services/order_manager.py:177-193`，`server/api/order.py:98-115`**

`reverse()` 和 `lock()` 返回 `{"success": False, "message": "Not implemented — ..."}`，HTTP 状态码为 200。建议返回 HTTP 501 Not Implemented，语义更清晰。

---

#### S4: OrderManager 的 broadcast 回调路径无测试覆盖

**【文件】`server/tests/test_order_manager.py`**

`on_rtn_order()` 和 `on_rtn_trade()` 中的 `_broadcast_fn` 调用路径（`set_broadcast_fn` → callback）无测试。建议添加 mock broadcast_fn 验证。

---

#### S5: `_attempt_reconnect` 仅重连 MD，不重连 TD

**【文件】`server/services/ctp_startup.py:288-350`**

MD 断线重连后，TD 连接不受影响（TD 是独立连接）。但如果 TD 也断线，当前无重连机制。建议至少添加 TODO 标注，PR-17 统一处理。

---

#### S6: TD 侧 `OnRspOrderInsert`/`OnRspOrderAction` 回调未接线

**【文件】`server/services/ctp_startup.py:393-403`**

当前只注册了 `OnRtnOrder` 和 `OnRtnTrade`，未注册 `OnRspOrderInsert` / `OnRspOrderAction`。如果 CTP 拒绝报单（如资金不足），错误信息将静默丢失，无法反馈给前端。

---

### 🔵 疑问确认

#### Q1: TD 登录是否应像 MD 一样使用 `wait=True` 阻塞等待结果？

**【文件】`server/main.py:52-53`**

当前 lifespan 中 MD 使用 `wait=True` 阻塞等待登录结果，TD 使用 fire-and-forget。如果 TD 登录失败（密码错误等），lifespan 不会感知。是否需要在 lifespan 中等待 TD 结果？还是留给 `/api/connection/status` 轮询？

---

### 审查结论

**❌ 需要修改后再审**

B1 是阻断性问题 — TD 连接的 OnFrontConnected/OnRspUserLogin 回调未接线，导致 `trader.connection_status` 永远卡在 `"connecting"` 且 `trader.login()` 从未被调用。这与 PR-7 中已修复的 B2 是同类问题。

**下一步**：请切回开发窗口修复 B1，使用 `/superpowers:receiving-code-review` 处理审查反馈。

---

已写入：`snapshots/role-a/review-feedback-a-pr9.md`

---

## 第 2 轮审查（二次审查）

审查分支：`feature/pr-9-trader-api`
审查 commit：`e5ee0f7` (HEAD)，3 个修复 commits（1769162 ~ e5ee0f7）
审查时间：2026-07-16
测试结果：158 passed / 11 failed (trio 环境，非回归) / 46 skipped

---

### R1 修复验证

| # | 问题 | 状态 | 验证 |
|---|------|------|------|
| B1 | TD login 流程不完整 | ✅ 已修复 | `_on_front_connected`（设置 `connection_status="connected"` + 调用 `login()`）+ `_on_rsp_user_login`（设置 `login_status`）+ `login_done.wait(timeout)` |
| S1 | cancel_all 硬编码字符串 | ✅ 已修复 | `OrderStatus.NO_TRADED` / `OrderStatus.PART_TRADED` 替代 `"2"` / `"1"` |
| S2 | cancel() 未传 exchange/instrument | ✅ 已修复 | 从 order 记录提取 `exchangeID` / `instrumentID` 传给 CTP |
| S3 | reverse/lock 返回 200 | ✅ 已修复 | 改为 `HTTPException(status_code=501)` |
| S4 | broadcast 回调无测试 | ✅ 已修复 | 新增 3 个 `TestOrderManagerBroadcast` 测试 |
| S5 | _attempt_reconnect 仅重连 MD | ✅ 已修复 | 添加 `TODO(PR-17)` 注释标注 TD 重连需求 |
| S6 | OnRspOrderInsert/OnRspOrderAction 未接线 | ✅ 已修复 | 已接线，错误通过 `logger.warning` 记录 |
| Q1 | TD 登录是否阻塞等待 | ✅ 已回复 | 刻意设计：fire-and-forget，行情优先不阻塞启动，状态通过 `/api/connection/status` 反馈 |

---

### 🔴 阻断性问题

（无 — R1 的 1 个阻断 + 6 个建议全部修复）

---

### 🟡 改进建议

#### S7: progress.md 状态未更新

**【文件】`snapshots/role-a/progress.md`**

PR-9 状态仍为「✅ 开发完成，待审查」，应更新为「✅ 修复完成，待二次审查」并补全 3 个修复 commits。`review-reply-a-pr9.md` 已创建但 progress.md 遗漏。

---

#### S8: 工作区不干净

`CLAUDE.md` 和 `server/api/market.py`（空白行删除）有未提交修改。审查前应确保全部改动已 commit 或 stash。

---

### 🔵 疑问确认

（无）

---

### 审查结论

**✅ 通过**

R1 的 1 个阻断 + 6 个建议全部修复，测试从 155→158 passed（+3 broadcast 测试），无回归。S7/S8 为非阻塞问题，不阻塞合入。

**下一步**：请完成人工验证后切回开发窗口生成 PR 描述，执行收尾合并。

---

已写入：`snapshots/role-a/review-feedback-a-pr9.md`（追加 R2 轮次）
