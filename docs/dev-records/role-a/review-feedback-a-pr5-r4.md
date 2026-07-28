# PR-5 Code Review 反馈（四次审查 — 人工验证确认）

**审查分支**：`feature/pr-5-market-api`
**审查 commit**：`b7d5e7b`（CTP startup修复）
**审查时间**：2026-07-14
**触发原因**：人工验证 5 个问题，其中第 5 个 "CTP OnFrontConnected timeout after 30s" 直接确认 B4

---

## 人工验证问题分析

| # | 问题 | 结论 |
|---|------|------|
| 1 | `GET /` → 404 | ✅ 非 bug（无根路由，文档在 `/docs`） |
| 2 | `/api/market/snapshots` → `{}` | 🔴 B4 导致（CTP 超时，桥接未接通） |
| 3 | `/api/market/kline` → `bars:[]` | ✅ 设计占位（B2 已确认） |
| 4 | `/api/market/depth` → 空 bids/asks | 🔴 B4 导致（无 snapshot 数据） |
| 5 | "CTP OnFrontConnected timeout after 30s" | 🔴 **直接确认 B4** |

---

## 🔴 阻断性问题

### B4. 【ctp_startup.py:74-82】`front_connected.set()` 缺失 — 未修复

**确认**：用户日志 `"CTP OnFrontConnected timeout after 30s — market data will not be available"` 精确对应 `ctp_startup.py:119-122` 的超时日志。这不是网络问题或配置问题，是代码 bug。

```python
# ctp_startup.py:74-82 — 当前代码
def _on_front_connected() -> None:
    try:
        md_api.login()
        logger.info("CTP front connected, login sent (user=%s)", config.user_id)
    except Exception:
        logger.warning("CTP login request failed", exc_info=True)
        login_done.set()
    # ❌ front_connected.set() 缺失 — 主线程 30s 后超时退出
```

**因果链**：
```
CTP 线程: OnFrontConnected → login() → OnRspUserLogin → _wire_bridge() ✅
主线程:    front_connected.wait(30s) → 超时 → return → "market data will not be available" ❌
```

CTP 后台线程最终连接成功并调用 `_wire_bridge()`，但主线程已放弃等待。`/api/market/snapshots` 返回 `{}` 因为数据流入晚于主线程放弃。

**修复**（1 行）：
```python
def _on_front_connected() -> None:
    front_connected.set()  # ← 加这一行
    try:
        md_api.login()
```

---

## 本轮新增代码审查

本轮有 3 个新 commit（`a583dae`, `51c7639`, `b7d5e7b`），其中 2 个是新功能代码：

### 新增文件：`services/ctp_startup.py` (164 行)

| 项 | 评估 |
|----|------|
| 架构设计 | ✅ 后台 daemon 线程 + 线程同步 Event + asyncio 桥接，方案合理 |
| 事件循环捕获 | ✅ `asyncio.get_running_loop()` 在 lifespan 内调用，安全 |
| CTP 回调注册 | ✅ OnFrontConnected → login → OnRspUserLogin 链路正确 |
| 桥接函数 | ✅ `_wire_bridge()` 复用 `wire_market_data_callback()`，无重复 |
| 超时机制 | ✅30s 超时后不阻塞 HTTP 服务器启动 |
| **`front_connected.set()`** | **❌ 缺失（B4）** |
| 单元测试 | ❌ 无（S7） |

### 修改文件：`api/connection.py`

```python
# 新增：从 app.state.md_api 读取真实 CTP 状态
md_api = getattr(request.app.state, "md_api", None)
if md_api is not None:
    return {
        "loggedIn": md_api.login_status == "logged_in",
        "mdConnected": md_api.connection_status == "connected",
        "tdConnected": False,  # TD not started until PR-9
    }
```

✅ 正确 — 优先读 CTP 真实状态，回退到模块级状态。

### 修改文件：`api/market.py`

`list[str]` → `List[str]` — Python 3.8 兼容性修复 ✅

### 修改文件：`main.py`

- `lifespan` 替代已废弃的 `@app.on_event("startup")` ✅
- `asynccontextmanager` + `yield` 模式正确 ✅

---

## 测试

无法运行测试套件（环境缺少 pytest），但根据代码分析：
- 原有 235 tests 不受新代码影响
- `ctp_startup.py` 无测试（S7 未修复）

---

## 审查结论

**🔴 不通过（1 阻断 / 0 建议）**

| # | 严重度 | 问题 | 修复代价 |
|---|--------|------|---------|
| B4 | 🔴 阻断 | `front_connected.set()` 缺失，导致 CTP 永远超时 | 1 行 |

B4 是所有人工验证问题（#2, #4, #5）的唯一根因。修复后：
- CTP 连接在 30s 内完成
- `_wire_bridge()` 在主线程等待期间被调用
- `/api/market/snapshots` 有数据流入
- `/api/market/depth` 从 snapshot 提取五档数据
