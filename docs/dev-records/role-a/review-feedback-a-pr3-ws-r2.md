# PR-3 Code Review — WebSocket 二次审查

**审查分支**：`feature/pr-3-fastapi-framework`
**审查 commit**：`1d28ea8`（WS 审查反馈修复）
**审查时间**：2026-07-13
**上次 WS 审查**：0 阻断 + 6 建议，本次验证 3 项修复

---

## 修复验证

### ✅ broadcast() 并发防护

**文件**：`server/ws/manager.py:55`

```python
# 修复前
for ws in self.connections[endpoint]:

# 修复后
for ws in list(self.connections[endpoint]):
```

✅ 迭代列表的副本，`send_json` 挂起期间即使有并发 `disconnect` 也不会触发 `RuntimeError`。

### ✅ ws_manager 移入 create_app() 工厂

**文件**：`server/main.py:66-68` + `server/ws/manager.py`（底部删除）

```python
# main.py — 工厂内部创建
ws_manager = WebSocketManager()
app.state.ws_manager = ws_manager
```

- `ws/manager.py` 底部 `ws_manager = WebSocketManager()` 已删除 ✅
- `main.py` import 改为 `from ws.manager import WebSocketManager` ✅
- 所有引用点验证：无残留单例导入 ✅
- 测试套件（`_make_app()` 自行创建 `WebSocketManager()`）无影响 ✅

### ✅ WS 端点参数类型注解

**文件**：`server/main.py:47-64`

```python
# 修复前
async def ws_market(ws):

# 修复后
async def ws_market(websocket: WebSocket):
```

5 个端点全部添加类型注解，同时补了 `from fastapi import WebSocket` ✅

---

## 测试

```
150 passed in 0.49s
```

无回归 ✅

---

## 审查结论

**✅ 通过**

三项修复全部正确执行。WebSocket 部分架构已收敛：工厂模式一致、并发安全、类型完整。
