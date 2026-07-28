# PR-5 Code Review — 后端行情API实现

**审查分支**：`feature/pr-5-market-api`
**审查 commit**：`4490a7c`（自验证通过）
**审查时间**：2026-07-13
**审查范围**：`git diff main...feature/pr-5-market-api` — 12 文件，+1702/-18

---

## 审查概要

| 维度 | 结果 | 阻断 | 建议 | 疑问 |
|------|------|------|------|------|
| 功能完整性 | 🔴 核心流程缺失 | 2 | 0 | 1 |
| 代码正确性 | 🟡 有小问题 | 0 | 3 | 0 |
| 测试覆盖 | 🟡 有死代码 | 0 | 1 | 0 |
| 架构一致性 | 🟡 有小问题 | 0 | 1 | 0 |
| 文档一致性 | ✅ 良好 | 0 | 0 | 0 |

---

## 🔴 阻断性问题

### B1. CTP 回调链路未接通 — MarketService 与 CTP 完全隔离

**影响**：行情 API 的核心价值是返回 CTP 实时行情数据。当前实现中：

```
CTP OnRtnDepthMarketData ─→ ??? → MarketService.update_snapshot() ─→ API
                            ↑
                      这段链路不存在
```

具体缺失：
1. **CTP 回调未注册到 MarketService**：`MdUserApi` 的 `MdSpi` 没有在 `OnRtnDepthMarketData` 回调中调用 `map_depth_market_data()` → `market_service.update_snapshot()`
2. **WebSocket 推送未实现**：PR-5 需求明确写「行情回调 → WebSocket 广播（market_data）」，但 `ws_manager.broadcast()` 从未在行情路径上被调用
3. **CTP 线程→asyncio 事件循环桥接不存在**：CTP 回调在 CTP 工作线程执行，需要 `asyncio.run_coroutine_threadsafe()` 或类似机制才能安全地调用 `ws_manager.broadcast()`

**现状**：`/api/market/snapshots` 永远返回 `{}`，`/api/market/subscribe` 只在内存中标记订阅但不产生任何行情数据。无论 CTP 是否连接、交易时段是否有行情，API 都不会返回实时数据。

**对比 PR-5 需求**（task.md）：
- 「行情回调处理（OnRtnDepthMarketData）」— ❌ 未实现
- 「行情数据缓存（内存，Map<string, MarketSnapshot>）」— ⚠️ 缓存容器存在，但无数据流入
- 「WebSocket 行情推送 — 行情回调 → WebSocket 广播（market_data）」— ❌ 未实现

**建议**：在当前 PR 中至少完成最小可行链路 — 在 `create_app()` 或独立初始化函数中，向 `MdUserApi.spi` 注册 `OnRtnDepthMarketData` handler，其中调用 `field_mapping.map_depth_market_data()` → `market_service.update_snapshot()` → `ws_manager.broadcast("market", "market_data", snapshot)`。如果 CTP 线程安全问题需要更多设计，至少用注释明确标注当前 gap 和 PR-7 的接管计划。

---

### B2. K 线端点仅返回空数据

**文件**：`api/market.py:108-124`

```python
@router.get("/kline")
async def get_kline(request: Request, instrument: str, period: str):
    return {
        "instrumentID": instrument,
        "period": period,
        "bars": [],  # ← 永远为空
    }
```

**问题**：PR-5 验收标准包含「K线数据获取正常（多周期）」。当前实现是一个硬编码占位符。如果 K 线依赖 CTP 历史数据查询接口（`ReqQryDepthMarketData` 或类似），且该接口在 simnow 环境不可用，应以注释说明并在验收标准中标注为延期。如果延期，应与 B1 的 WebSocket 推送一起明确归入 PR-7。

---

## 🟡 改进建议

### S1. 【api/market.py:6】`Optional` 导入但未使用

```python
from typing import Optional  # ← 全文无使用
```

与 PR-3 审查中 `Request` 未使用问题同类。删除即可。

---

### S2. 【api/market.py:110】`request: Request` 在 `get_kline` 中未使用

```python
async def get_kline(
    request: Request,  # ← 函数体中从未引用
    instrument: str = Query(..., min_length=1),
    period: str = Query("1m"),
):
```

PR-3 审查曾修复 `connection.py` 中同类问题（3 个路由函数都移除了 `request: Request`）。此处应同样处理：移除 `request` 参数和对应的 `from fastapi import Request`（如果仅 `get_kline` 使用的话 — 实际上 `_get_service` 和 `get_depth` 等其他端点仍需要 `Request`）。

---

### S3. 【main.py:71-73】函数内联 `import os as _os` — 建议改用 pathlib

```python
# 当前实现
import os as _os
_instruments_path = _os.path.join(
    _os.path.dirname(__file__), "data", "instruments.json"
)
```

同一代码库的 `config.py` 已使用更清晰的 `pathlib` 模式：

```python
from pathlib import Path
_env_file = Path(__file__).parent / ".env"
```

**建议**：
```python
from pathlib import Path
_instruments_path = Path(__file__).parent / "data" / "instruments.json"
```

无需在函数内部 import，保持模块级 import 风格一致。

---

### S4. 【test_market_service.py:13-44】`_FakeMdApi` 定义了但从未被使用

```python
class _FakeMdApi:
    """Fake MdUserApi — no CTP DLL needed."""
    # ... 30 行实现 ...
```

全文 grep 确认：`_FakeMdApi` 仅在定义处出现，无任何测试引用它。这看起来是为 CTP 集成测试准备的，但集成未实现所以遗留。建议移除死代码，或在 CTP 回调链路（B1）修复后补上使用该 fake 的集成测试。

---

### S5. 【field_mapping.py:13】`_DEPTH_MARKET_DATA_FIELDS` 用裸 `list` 类型注解

```python
_DEPTH_MARKET_DATA_FIELDS: list = [
```

项目使用 Python 3 typing 风格（`from typing import List, Dict, ...`），应保持一致性：

```python
from typing import List, Tuple
_DEPTH_MARKET_DATA_FIELDS: List[Tuple[str, str, object]] = [
```

---

### S6. 【api/market.py:16-22】`SubscribeRequest.instruments` 的 `min_length=0` 无实际作用

```python
class SubscribeRequest(BaseModel):
    instruments: list[str] = Field(..., min_length=0)
```

`min_length=0` 是列表字段的默认行为（允许空列表），写出来只增加读者困惑（是否本意是要 `min_length=1`？）。当前实现能正确处理空列表，所以有两种合理选择：
- 保留 `min_length=0` → 无实际效果，可删
- 改为 `min_length=1` → 强制至少订阅 1 个合约，语义更清晰

建议后者，与 `connection.py` 的 `min_length=1` 保持一致。

---

## 🔵 疑问确认

### Q1. WebSocket 行情推送是否明确延期至 PR-7？

PR-5 的 task.md 需求列表明确包含「实现 WebSocket 行情推送 — 行情回调 → WebSocket 广播（market_data）」，但自验证记录标注「⚠️ WebSocket 行情推送未集成（需 CTP 连接 + 事件循环桥接，代码已就绪）」。

然而代码中**并未就绪** — CTP 回调 → field_mapping → market_service → ws_manager 的完整链路不存在。请确认：
- 这段链路是计划在 **PR-5 内补全**（当前审查后修复），还是**延期至 PR-7**？
- 如果是 PR-7，建议在 `api/market.py` 或 `main.py` 添加明确的 TODO 注释，类似 PR-3 `handlers.py` 的 gap 标注模式

---

## 测试

```
227 passed in 1.31s
```

无回归 ✅。但需注意：77 个新增测试全部在内存层面运行，不验证 CTP 回调链路。B1 修复后应补充至少 1 个模拟 CTP 回调→快照缓存→API 查询的端到端测试。

---

## 审查结论

**🔴 不通过（2 阻断 / 6 建议 / 1 疑问）**

核心问题：MarketService 和 CTP 之间缺少回调桥接，行情 API 无法产生真实数据。`field_mapping.py`（40 字段映射）和 `market_service.py`（缓存+订阅管理）代码质量良好，但它们目前是孤岛 — 没有数据流入。

| # | 严重度 | 问题 | 修复代价 |
|---|--------|------|---------|
| B1 | 🔴 阻断 | CTP 回调链路未接通（MdSpi→mapping→service→WS） | 中等 |
| B2 | 🔴 阻断 | K线端点硬编码返回空数据 | 小（标注延期 or 实现） |
| S1 | 🟡 低 | `Optional` 未使用 import | 1 行删除 |
| S2 | 🟡 低 | `request: Request` 未使用 | 1 行删除 |
| S3 | 🟡 低 | 函数内 `import os as _os` → pathlib | 3 行改动 |
| S4 | 🟡 低 | `_FakeMdApi` 死代码 | 30 行删除 |
| S5 | 🟡 低 | 裸 `list` 类型注解 | 1 行 + import |
| S6 | 🟡 低 | `min_length=0` 语义模糊 | 1 行 |
