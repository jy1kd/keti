# PR-7 Code Review 反馈（人工验证后补充审查）

**审查分支**：`feature/pr-7-websocket-manager`
**审查 commit**：`4b5bb2e` (HEAD)
**审查时间**：2026-07-15
**审查来源**：人工手动验证发现

---

## 🔴 阻断性问题（必须修改）

### B1: `handlers.py` 对同步函数使用 `await` — subscribe/unsubscribe 返回错误消息

**文件**: `server/ws/handlers.py:56` + `server/ws/handlers.py:74`

**现象**：
```
客户端发送: {"action": "subscribe", "instruments": ["IF2608"]}
服务端返回: {"type": "error", "action": "subscribe", "message": "object dict can't be used in 'await' expression"}
```

**原因**：`subscribe_fn` 和 `unsubscribe_fn` 是 `MarketService` 的同步方法（普通 `def`），但 `handle_ws` 中用 `await` 调用：

```python
await subscribe_fn(instruments)   # ← await 同步函数 → TypeError
await unsubscribe_fn(instruments) # ← 同上
```

Python 中 `await` 只能用于协程对象，对同步函数的返回值使用 `await` 会抛出 `TypeError`。

**副作用**：订阅实际上已生效（CTP 已收到指令，market_data 数据正常推送），但客户端收到的是错误消息，造成混淆。

**建议修复**：使用 `asyncio.iscoroutine` 判断，兼容同步和异步函数：

```python
# subscribe
result = subscribe_fn(instruments)
if asyncio.iscoroutine(result):
    await result

# unsubscribe
result = unsubscribe_fn(instruments)
if asyncio.iscoroutine(result):
    await result
```

---

### B2: `connection_status` 永远为 `"connecting"` — status 接口返回 `mdConnected: false`

**文件**: `server/services/ctp_startup.py:121-128` + `server/ctp_wrapper/md_user_api.py:55`

**现象**：
```json
GET /api/connection/status
{
  "loggedIn": true,
  "mdConnected": false,    // ← 应该为 true
  "tdConnected": false
}
```

**原因**：CTP 回调链中缺少 `connection_status = "connected"` 的设置：

```
MdUserApi.__init__()    → connection_status = "disconnected"
MdUserApi.create()      → connection_status = "connecting"    ← 卡在这里
CTP OnFrontConnected    → 只调用 md_api.login()，未更新 connection_status
CTP OnRspUserLogin      → 只设置 login_status = "logged_in"
```

`login_status` 被正确设置为 `"logged_in"`，所以 `loggedIn: true`。但 `connection_status` 从未从 `"connecting"` 变为 `"connected"`，所以 `mdConnected: false`。

**建议修复**：在 `_on_front_connected` 中添加一行：

```python
def _on_front_connected() -> None:
    md_api.connection_status = "connected"  # ← 补上
    front_connected.set()
    try:
        md_api.login()
        ...
```

---

## 🟡 改进建议

（无）

## 🔵 疑问确认

（无）

---

## 审查结论

**❌ 需要修改后再审**

2 个阻断性问题需修复：
- B1: `await` 同步函数导致 subscribe/unsubscribe 返回错误消息
- B2: `connection_status` 缺少 `"connected"` 状态设置

建议修复后重新验证。
