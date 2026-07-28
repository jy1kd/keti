# PR-5 Code Review 反馈（二次审查）

**审查分支**：`feature/pr-5-market-api`
**审查 commit**：`036410e`（审查反馈修复）
**审查时间**：2026-07-13
**上次审查**：2 阻断 + 6 建议 + 1 疑问，本次聚焦验证 8 项修复

---

## 修复验证清单

| # | 上次问题 | 目标 | 验证结果 |
|---|---------|------|---------|
| B1 | CTP 回调链路未接通 | MdSpi→field_mapping→MarketService→WS | ✅ 已修复 |
| B2 | K线端点硬编码空数据 | 文档标注延期 | ✅ 已修复 |
| S1 | `Optional` 未使用 import | 删除 | ✅ 已修复 |
| S2 | `request: Request` 未使用 | 移除参数 | ✅ 已修复 |
| S3 | 内联 `import os as _os` | → pathlib | ⚠️ 改动引入新 bug |
| S4 | `_FakeMdApi` 死代码 | 删除 | ✅ 已修复 |
| S5 | 裸 `list` 类型注解 | → `List[Tuple[...]]` | ✅ 已修复 |
| S6 | `min_length=0` 语义模糊 | → `min_length=1` | ✅ 已修复 |
| Q1 | WS 推送是否延期 | 在 PR-5 实现 | ✅ 已实现 |

---

## 🔴 阻断性问题

### B3. 【main.py:74,115,119】`Path` 和 `asyncio` 未导入 — 运行时 `NameError`

**文件**：`server/main.py`

S3 修复将 `import os as _os` + `os.path.join()` 改为更清晰的 `Path(__file__).parent / "data"`，但**漏掉了 `from pathlib import Path`**。同时新增的 `wire_ctp_market_bridge()` 使用了 `asyncio.get_event_loop()` 和 `asyncio.run_coroutine_threadsafe()`，但**漏掉了 `import asyncio`**。

**复现**：
```
$ python -c "from main import create_app"
NameError: name 'Path' is not defined
```

`asyncio` 的问题在 `wire_ctp_market_bridge()` 首次调用时才触发，但同样会导致运行时崩溃。

**根因**：测试套件（235 tests）不导入 `main.py`，所以漏检。这是 PR-1 审查中 `import os` 遗漏的同类问题。

**修复**：在 `main.py` 顶部添加：
```python
import asyncio
from pathlib import Path
```

---

## ✅ 修复验证（通过项）

### B1: CTP 回调链路 ✅

| 组件 | 文件 | 验证 |
|------|------|------|
| 桥接函数 | `services/ctp_bridge.py` (69行) | ✅ `wire_market_data_callback()` 注册 OnRtnDepthMarketData handler |
| 线程安全 | `services/market_service.py:27,162` | ✅ `threading.Lock()` 保护 `update_snapshot()` |
| WS 桥接 | `main.py:95-128` | ✅ `wire_ctp_market_bridge()` 含 `asyncio.run_coroutine_threadsafe` |
| 测试覆盖 | `tests/test_ctp_bridge.py` (186行, 8 tests) | ✅ 回调注册、快照更新、字段映射、广播、合并、空ID、无broadcast |

完整链路：`MdSpi.OnRtnDepthMarketData → _on_depth_market_data → map_depth_market_data() → market_service.update_snapshot() [Lock] → broadcast_fn() → ws_manager.broadcast()`
### B2: K线文档化 ✅

`api/market.py:96-107` docstring 清晰标注：
- 需要 `ReqQryDepthMarketData` CTP 历史查询
- 延期至 PR-7 或后续 CTP 集成 PR
- 前后端契约（响应格式 `{instrumentID, period, bars[...]}`）稳定

### S1-S6: 代码清理 ✅

6 条建议全部正确修复。`min_length=1` 变更已同步更新测试（`test_market_api.py:157-165`，空列表返回 422）。

---

## 测试

```
235 passed in 0.70s
```

无回归 ✅。但需注意：**无测试覆盖 `main.py` 的 import 路径**，B3 需要手动验证或补充冒烟测试。

---

## 审查结论

**🔴 不通过（1 阻断 / 0 建议 / 0 疑问）**

| # | 严重度 | 问题 | 修复代价 |
|---|--------|------|---------|
| B3 | 🔴 阻断 | `main.py` 缺少 `import asyncio` 和 `from pathlib import Path` | 2 行 |

除 B3 外，8 项修复全部正确。CTP 回调链路架构设计清晰，ctp_bridge 模块职责单一，MarketService 线程安全方案合理。B3 修复后可直接通过。
