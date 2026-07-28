# PR-3 Code Review — WebSocket 深度审查

**审查分支**：`feature/pr-3-fastapi-framework`
**审查 commit**：`2bb9b69`
**审查时间**：2026-07-13
**聚焦范围**：`ws/manager.py`、`ws/handlers.py`、`main.py` WS 端点、`tests/test_ws_manager.py`

---

## 审查概要

| 维度 | 结果 | 阻断 | 建议 | 疑问 |
|------|------|------|------|------|
| 连接池设计 | ⚠️ 有隐患 | 0 | 2 | 0 |
| 广播机制 | ⚠️ 有隐患 | 0 | 1 | 0 |
| Handler 设计 | ⚠️ 占位实现 | 0 | 1 | 0 |
| 测试覆盖 | ✅ 充分 | 0 | 1 | 0 |
| 架构一致性 | ⚠️ 有矛盾 | 0 | 1 | 0 |

---

## 🔴 阻断性问题

（无）

---

## 🟡 改进建议

### 1. 【ws/manager.py:55】broadcast() 在迭代期间存在并发修改风险

```python
# 当前实现
for ws in self.connections[endpoint]:
    try:
        await ws.send_json(message)  # ← 这里会 yield 控制权
    except Exception:
        dead.append(ws)
```

`await ws.send_json()` 是一个挂起点。如果在 `send_json` 期间另一个协程调用了 `disconnect()`，`self.connections[endpoint]` 列表可能在迭代中被修改，导致 `RuntimeError: list changed size during iteration`。

虽然在当前单 handler 的架构下不会触发（没有并发调用 `disconnect` 的路径），但 PR-7 引入多 handler 并发后就可能出问题。

**建议**：迭代前拷贝列表：
```python
for ws in list(self.connections[endpoint]):
    try:
        await ws.send_json(message)
    except Exception:
        dead.append(ws)
```
一行改动，防御未来。这个模式在 asyncio 官方文档和 starlette 源码中都是标准做法。

---

### 2. 【ws/manager.py:28】connect() 无去重 — 同一 WebSocket 可被重复添加

```python
async def connect(self, endpoint: str, websocket: WebSocket) -> None:
    if endpoint not in self.connections:
        return
    await websocket.accept()
    self.connections[endpoint].append(websocket)  # ← 无去重检查
```

如果同一个 `WebSocket` 被 `connect()` 两次（例如误调用或重连 bug），它会出现在列表两次。`disconnect()` 使用 `list.remove()` 只移除第一次出现，导致残留。

**建议**：添加去重或改为 Set 语义：
```python
if websocket not in self.connections[endpoint]:
    self.connections[endpoint].append(websocket)
```

---

### 3. 【ws/manager.py:53】broadcast() 消息无类型约束

```python
async def broadcast(self, endpoint: str, msg_type: str, data: Any) -> None:
    message = {"type": msg_type, "data": data}
```

`data: Any` 允许传入任意对象。如果调用方误传了不可 JSON 序列化的对象（如 `datetime`、`Decimal`），`send_json()` 会抛异常，导致该连接被标记为 dead 并从池中移除 — 但实际上连接是健康的，问题出在消息构造方。

**建议**：最低限度 — 在 `broadcast` 内部 `try/except` 包装 `json.dumps` 做预检，或记录异常到日志而非标记连接为 dead。更好的方案是让 `data` 参数接受 Pydantic BaseModel，调用 `.model_dump()` 获取 dict：
```python
async def broadcast(self, endpoint: str, msg_type: str, data: BaseModel) -> None:
    message = {"type": msg_type, "data": data.model_dump()}
```
这样类型错误在调用方编译期就暴露了。

---

### 4. 【ws/handlers.py:23-24】所有 handler 使用裸 `except Exception` 吞掉异常

```python
while True:
    try:
        _ = await websocket.receive_text()
    except Exception:
        break
```

`except Exception` 会捕获所有异常，包括：
- `starlette.websockets.WebSocketDisconnect`（正常断开）— 应该 break ✅
- `starlette.websockets.WebSocketClose`（收到 close 帧）— 应该 break ✅
- 其他意外异常（如 `RuntimeError`）— 也被静默吞掉 ❌

**建议**：区分正常断开和异常：
```python
from starlette.websockets import WebSocketDisconnect

while True:
    try:
        _ = await websocket.receive_text()
    except WebSocketDisconnect:
        break  # 正常断开
    # 其他异常：记录日志或重新抛出
```
同时可以获取 `WebSocketDisconnect.code` 用于日志记录（1000=正常，1001=离开，1006=异常）。

---

### 5. 【main.py:46-64 vs ws/manager.py:66】单例 vs 工厂模式的架构矛盾

```python
# ws/manager.py:66 — 模块级单例
ws_manager = WebSocketManager()

# main.py:26-83 — 工厂函数，每次创建新 app
def create_app() -> FastAPI:
    ...
    app.state.ws_manager = ws_manager  # ← 所有 app 共享同一个 ws_manager!
```

`create_app()` 的设计意图是隔离（测试可用工厂创建独立 app），但所有 app 实例都绑定到同一个 `ws_manager` 单例。测试套件通过 `_make_app()` 创建独立 `WebSocketManager()` 绕过了这个问题，但生产代码的矛盾仍然存在：
- 如果有两个 `create_app()` 调用，它们的 WebSocket 连接会混在一起
- `ws_manager` 在 import 时就已创建（非 lazy）

**建议**：将 `ws_manager` 的创建移入 `create_app()` 内部：
```python
def create_app() -> FastAPI:
    app = FastAPI(...)
    ws_manager = WebSocketManager()
    app.state.ws_manager = ws_manager
    ...
    return app
```
模块级 `app = create_app()` 仍然只有一个单例 app，语义不变；但工厂函数本身变得可测试、可隔离。同时 `ws/manager.py` 底部的 `ws_manager = WebSocketManager()` 可以删除（或保留为 convenience default）。

---

### 6. 【test_ws_manager.py:152-164】_FakeWebSocket.send_json 非真正异步

```python
class _FakeWebSocket:
    async def send_json(self, data: dict):
        if self._raise:
            raise ConnectionError("disconnected")
        self.sent.append(data)
```

`send_json` 标记为 `async` 但没有 `await`，实际上同步执行。这意味着测试无法覆盖 `broadcast()` 中 `await` 挂起期间的并发行为（建议 #1 提到的场景在测试中不会触发）。

**建议**：添加一个最小化的 yield 点，让测试能覆盖并发路径：
```python
async def send_json(self, data: dict):
    await asyncio.sleep(0)  # 模拟网络 I/O 挂起
    if self._raise:
        raise ConnectionError("disconnected")
    self.sent.append(data)
```
这样 `broadcast()` 的 `await send_json()` 真正挂起，如果有并发修改列表的 bug 会被测试捕获。

---

## 🔵 疑问确认

### 7. 是否需要 now 定义消息协议格式？

当前各 handler 是占位实现，`broadcast()` 接受任意 `data`。但 `ws/handlers.py` 的 TODO 提到 PR-7 需要 "subscribe/unsubscribe/ping" 消息路由。建议在 PR-3 至少定义消息协议的 Pydantic 模型（`ClientMessage` / `ServerMessage`），即使不实现路由逻辑。原因是：
- 前端 PR-2 已经可以连接 WebSocket，缺少协议定义会导致前后端各自猜格式
- 在 PR-3 阶段定义协议，PR-7 只需实现路由，不需要回头改类型

是否考虑？

---

## 审查结论

**✅ 通过（0 阻断 / 6 建议 / 1 疑问）**

四个高优先级建议值得在合入前考虑：

| # | 严重度 | 问题 | 修复代价 |
|---|--------|------|---------|
| 5 | 🔶 中 | ws_manager 单例 vs create_app() 工厂矛盾 | 3 行挪动 |
| 1 | 🔶 中 | broadcast() 迭代并发风险 | 1 行 (`list()`) |
| 3 | 🟡 低 | broadcast data 类型约束 | 设计决策 |
| 4 | 🟡 低 | handler 裸 except Exception | 3 行改动 |
| 2 | 🟡 低 | connect() 去重 | 1 行 |
| 6 | 🟡 低 | _FakeWebSocket 无真正 yield | 1 行 (`asyncio.sleep(0)`) |

其中 #5 和 #1 建议当前 PR 修复（代价极小、收益大），其余可延期至 PR-7。
