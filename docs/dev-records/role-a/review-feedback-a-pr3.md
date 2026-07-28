# PR-3 Code Review 反馈

**审查分支**：`feature/pr-3-fastapi-framework`
**审查时间**：2026-07-10
**审查范围**：4 commits / 19 files / +1083 -328 lines
**审查状态**：0 阻断 + 6 建议

---

## 审查概要

| 维度 | 结果 | 阻断 | 建议 | 疑问 |
|------|------|------|------|------|
| 1. 功能正确性 | ✅ 符合需求 | 0 | 0 | 0 |
| 2. 测试质量 | ✅ 覆盖合理 | 0 | 1 | 0 |
| 3. 代码质量 | ⚠️ 有改进空间 | 0 | 3 | 0 |
| 4. 范围控制 | ✅ 范围正确 | 0 | 0 | 0 |
| 5. 文档同步 | ⚠️ 一处不一致 | 0 | 1 | 0 |
| 6. 潜在风险 | ⚠️ 需关注 | 0 | 1 | 0 |

**总览**：架构干净、工厂模式合理、150 tests 全部通过。与 task.md 要求完全对齐 — 数据模型、5 端点 WebSocket 框架、连接管理 API、占位路由、全局异常处理、CORS 全部实现。

---

## 1. 功能正确性

✅ **通过**。对照 task.md PR-3 需求逐项验证：

| 需求 | 实现 | 状态 |
|------|------|------|
| CORS、路由注册 | `create_app()` — CORSMiddleware + 4 个 APIRouter | ✅ |
| 连接管理接口 | `api/connection.py` — POST /login, POST /logout, GET /status | ✅ |
| WebSocket 分端点 | `main.py:46-64` — 5 个 `/ws/*` 端点 | ✅ |
| 连接管理器基础框架 | `ws/manager.py` — 5 端点连接池 + connect/disconnect/broadcast | ✅ |
| Pydantic 数据模型 | `models/` — 7 个模型，camelCase，与 ctp-api-structure.txt 对齐 | ✅ |
| 全局异常处理 | `main.py:70-81` — `@app.exception_handler(Exception)` | ✅ |
| 占位路由 | `api/market.py`, `api/order.py`, `api/query.py` — 返回 "Not implemented" | ✅ |

**关于 PR-7 边界**：task.md 标注 PR-3 不包含「消息广播」和「断线重连」。`broadcast()` 方法已提前实现（比 task 多），但这属于基础工具方法，为测试提供便利，不构成越界。

---

## 2. 测试质量

✅ **整体良好**。150 tests (108 回归 + 42 新增)，覆盖模型创建、连接 API 端到端、WebSocket 连接池/广播/断线清理。

### 🟡 [建议] 缺少 WebSocket handler 的端到端测试

**文件**：`server/ws/handlers.py`

五个 handler 函数 (`handle_market_ws`, `handle_order_ws`, 等) 没有对应的测试文件。虽然它们是占位实现（接收消息 → 丢弃），但至少应验证：
- WebSocket 端点能正常建立连接
- 客户端断开时 handler 正常退出

`test_ws_manager.py` 测试了 `WebSocketManager` 的单元逻辑（使用 `_FakeWebSocket`），但没有通过 FastAPI `TestClient` 测试实际 `/ws/market` 等端点的连接建立。可在 PR-7 完善 handler 时一并补充。

---

## 3. 代码质量

### 🟡 [建议] 五个 WS handler 函数完全重复

**文件**：`server/ws/handlers.py`

`handle_market_ws` / `handle_order_ws` / `handle_position_ws` / `handle_stop_ws` / `handle_system_ws` 五个函数体完全相同（仅函数名不同）。当前作为占位实现可接受，PR-7 实现差异逻辑时如果仍有共性代码，建议提取公共函数：

```python
async def _handle_ws(websocket: WebSocket, endpoint: str):
    await websocket.accept()
    while True:
        try:
            _ = await websocket.receive_text()
        except Exception:
            break
```

---

### 🟡 [建议] connection.py 中 `request: Request` 参数未使用

**文件**：`server/api/connection.py:39, 48, 57`

三个路由函数都接收 `request: Request` 参数但从未引用。FastAPI 提供 `Request` 作为请求上下文入口，但当前未使用时可移除，或加注释说明保留原因（供后续 PR 访问 headers/session）。

---

### 🟡 [建议] LoginRequest.password 无校验

**文件**：`server/api/connection.py:15-17`

```python
class LoginRequest(BaseModel):
    brokerID: str = Field(..., min_length=1)
    userID: str
    password: str  # ← 无 min_length，空字符串可通过校验
```

`brokerID` 有 `min_length=1`，但 `userID` 和 `password` 没有同等校验。建议至少添加 `min_length=1`，或在 PR-9 实际对接 CTP 登录时统一补充。

---

## 4. 范围控制

✅ **通过**。diff 仅涉及 `server/api/`、`server/models/`、`server/ws/`、`server/main.py`、`server/tests/`（新增）+ `snapshots/role-a/`。未修改 PR-1 的 `ctp/` / `config.py` 等已有文件。main.py 的重写属于 task 明确要求（「FastAPI应用入口（完善）」）。

---

## 5. 文档同步

### 🟡 [建议] dev-record-a.md PR-3 状态与 progress.md 不一致

**文件**：`snapshots/role-a/dev-record-a.md`

| 位置 | 状态 |
|------|------|
| dev-record-a.md PR-3 标题 | `🔄 开发完成，待自验证` |
| progress.md 总览表 | `✅ 开发完成，待审查` |

dev-record 落后于 progress。此外 progress.md 的 PR-3 详细记录区（lines 64-83）仍为旧状态「⏳ 待开始 / 待开发」，与总览表不一致。建议统一为「✅ 开发完成，待审查」并补全详细记录内容。

---

## 6. 潜在风险

### 🟡 [建议] WebSocket handler 与 WebSocketManager 未集成

**文件**：`server/main.py:67` + `server/ws/handlers.py`

`main.py` 将 `ws_manager` 存入 `app.state`，但 `ws/handlers.py` 的五个 handler 直接调用 `websocket.accept()` 和 `websocket.receive_text()`，完全不经过 `WebSocketManager`：

- 当前 `/ws/*` 端点的连接没有被 `ws_manager` 跟踪
- `ws_manager.connect()` 从未被生产代码调用（仅测试使用）
- PR-7 需要重新设计 handler → manager 的集成方式

**这是按 task 预期的临时状态**（handler 标注 "placeholder — full implementation in PR-7"），但建议在 handler 文件或 main.py 中添加明确注释标注这个 gap，避免后续开发者误以为当前已正确集成。

---

## 审查结论

**✅ 通过（无阻断性问题）**

6 条建议均为非阻断性，可在当前 PR 顺手修复或延期：

| 优先级 | 建议 | 建议处理时机 |
|--------|------|------------|
| 推荐 | dev-record-a.md / progress.md 详细记录区同步 | 当前 PR |
| 可选 | WebSocket handler 端到端测试 | PR-7 |
| 可选 | handler 函数提取公共逻辑 | PR-7 |
| 可选 | connection.py request 参数清理 | 当前 PR |
| 可选 | password/userID min_length 校验 | 当前 PR 或 PR-9 |
| 可选 | handler→manager 集成 gap 加注释 | 当前 PR |

---

**优点总结**：

- `create_app()` 工厂函数设计合理（测试可调用工厂创建隔离实例，避免模块级 `app` 单例干扰）
- Pydantic 模型字段完整且带合理默认值，camelCase 对齐 ctp-api-structure.txt
- WebSocket 连接池按端点分组清晰，`broadcast()` 自带断线自动清理
- `_FakeWebSocket` stub 设计精巧，使得 14 个 WS 测试无需实际网络连接
- 测试覆盖 150 tests：回归 108 + 模型 20 + WS 14 + 连接 API 8
