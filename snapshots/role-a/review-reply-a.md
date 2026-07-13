# PR-1 Code Review 反馈处理记录

**审查分支**：`feature/pr-1-ctp-verify`
**处理时间**：2026-07-10

---

## 🔴 阻断性问题修复（3 条）

| # | 问题 | 修复 Commit | 处理说明 |
|---|------|------------|----------|
| 1 | 市价单验证缺失 | `e6bc245` | 在 main.py 增加 Step 5: `verify_market_order()`，提交 `OrderPriceType.ANY` 市价单并检查回报 |
| 2 | API 测试 mock 覆盖不足 | `2e7f11a` | 用 `unittest.mock` 重写 41 个测试，覆盖 subscribe/unsubscribe/release/insert_order/cancel_order 的状态管理、空列表、bytes→str 转换、order_ref 自增等逻辑 |
| 3 | dev-record-a.md 状态不一致 | `34c5c9d` | 状态改为「✅ 开发完成，待审查」，补全 `282ecaf`/`fa0a872` commit 记录 |

---

## 🟡 改进建议处理（5 条）

| # | 建议 | 采纳 | 处理说明 |
|---|------|------|----------|
| 4 | time.sleep → 事件轮询 | ✅ 采纳 | 新增 `wait_for_event()` 函数，轮询 SPI events 列表，支持超时 |
| 5 | BaseSpi 基类抽取 | ✅ 采纳 | 抽取 `BaseSpi`（共享 `__init__`/`_log`/`on`/`_dispatch` 及 4 个通用回调），`MdSpi`/`TraderSpi` 分别继承，约减少 50 行重复代码 |
| 6 | _dispatch 静默吞异常 | ✅ 采纳 | 改为 `logger.warning(...)` 记录异常，便于调试 |
| 7 | test_config_repr 永真断言 | ✅ 采纳 | 改为直接断言 `cfg.password not in r` |
| 8 | au2506 硬编码过期风险 | ✅ 采纳 | 改为环境变量 `CTP_TEST_INSTRUMENT`，默认 `au2506` |

---

## 🔵 疑问确认回复（2 条）

### 疑问-9：trader_api.py 硬编码字段是否需要补充枚举

**回复**：`TimeCondition` 和 `VolumeCondition` 已有对应的枚举类（`TimeCondition.GFD` 等），已改用枚举引用。`CombHedgeFlag`（投机 `"1"`/套利 `"2"`/套保 `"3"`）、`ContingentCondition`（立即 `"1"`/止损 `"2"`/止盈 `"3"`）、`ForceCloseReason`（非强平 `"0"`）这三个字段在 PR-1 验证阶段固定使用默认值，不需要选择。PR-9（交易 API 完善）时会根据报单类型动态设置，届时一并补充枚举定义。

### 疑问-10：Config 多实例创建是否有意

**回复**：是有意为之。各验证步骤独立创建实例是为了保持函数隔离性（每个函数可独立运行）。Config 本身无状态、无副作用（只读环境变量），多次创建不影响正确性。如果需要改为单例，可在 PR-3（FastAPI 框架）中引入依赖注入时统一处理。

---

## 测试记录

```
108 passed in 0.15s
```

全部测试通过，无回归。

---

## 二次审查修复记录（2026-07-10）

| # | 问题 | 等级 | 处理 |
|---|------|------|------|
| 1 | main.py 缺少 `import os` | 🔴 | 添加 `import os`，修复运行时崩溃 |
| 2 | `wait_for_event()` 死代码 | 🟡 | 在 `verify_md_connection`/`verify_td_connection`/`verify_market_order` 三个函数中集成替换所有 `time.sleep` |
| 3 | dev-record-a.md 测试数未更新 | 🟡 | 更新为 108 tests，各文件测试数同步 |
| 4 | `au2506` 硬编码遗漏 | 🟡 | print 信息中的硬编码 `au2506` 也改为 `_TEST_INSTRUMENT` |

**Commit**: `b081b50`
**测试**: 108 passed

---

## PR-3 Code Review 反馈处理记录

**审查分支**：`feature/pr-3-fastapi-framework`
**审查文件**：`review-feedback-a-pr3.md`
**处理时间**：2026-07-13
**审查结论**：0 阻断 + 6 建议

---

### 🔴 阻断性问题

无。

---

### 🟡 改进建议处理（6 条）

| # | 建议 | 采纳 | 处理说明 |
|---|------|------|----------|
| 1 | WS handler 端到端测试缺失 | ⏳ 延期 | PR-7 将重写全部 handler，届时补充 TestClient 端到端测试 |
| 2 | 五个 handler 函数重复 | ⏳ 延期 | PR-7 将实现差异逻辑（消息路由/dispatch），若仍有共性再提取 |
| 3 | connection.py `request: Request` 未使用 | ✅ 采纳 | 移除 3 个路由函数中的 `request` 参数及 import |
| 4 | password/userID 无 min_length | ✅ 采纳 | 添加 `Field(..., min_length=1)`，与 brokerID 一致 |
| 5 | dev-record-a.md / progress.md 不一致 | ✅ 采纳 | 统一状态为「开发完成，待审查」，补全 progress.md 详细记录区 |
| 6 | handler→manager 集成 gap 加注释 | ✅ 采纳 | handlers.py docstring 添加 PR-7 TODO 块，说明当前 gap |

---

### 🔵 疑问确认回复

无。

---

### 测试记录

```
150 passed in 0.49s
```

全部测试通过，无回归。

---

## PR-3 二次审查反馈处理记录（WebSocket 深度审查）

**审查文件**：`review-feedback-a-pr3-ws.md`
**处理时间**：2026-07-13
**审查结论**：0 阻断 + 6 建议 + 1 疑问

---

### 🔴 阻断性问题

无。但发现运行时 WS 端点返回 403 bug（根因：main.py WS 路由参数 `ws` 缺少 `WebSocket` 类型注解，Starlette 依赖注入失败）。已在本次修复中一并解决。

---

### 🟡 改进建议处理（6 条）

| # | 建议 | 采纳 | 处理说明 |
|---|------|------|----------|
| 1 | broadcast() 迭代并发风险 | ✅ 采纳 | `for ws in list(self.connections[endpoint])` — 一行防御 |
| 2 | connect() 无去重 | ⏳ 延期 PR-7 | PR-7 引入 handler 接入 manager 时一并处理 |
| 3 | broadcast data 类型约束 | ⏳ 延期 PR-7 | 届时配合消息协议 Pydantic 模型 (#7) 一起约束 |
| 4 | handler 裸 except Exception | ⏳ 延期 PR-7 | PR-7 重写全部 handler 时会区分 WebSocketDisconnect |
| 5 | ws_manager 单例 vs create_app() 工厂矛盾 | ✅ 采纳 | `WebSocketManager()` 移入 `create_app()` 内部，删除 `ws/manager.py` 全局单例 |
| 6 | _FakeWebSocket.send_json 无真正 yield | ⏳ 延期 PR-7 | #1 已用 `list()` 防御，PR-7 补充并发测试时加 `asyncio.sleep(0)` |

---

### 🔵 疑问确认回复（1 条）

**疑问-7**：是否需要在 PR-3 定义消息协议 Pydantic 模型？

**回复**：同意在 PR-7 前定义。但 PR-3 当前 handler 为纯占位（只 accept + receive + discard），尚未实现任何消息路由，提前定义模型会引入未使用代码。建议 PR-7 第一步定义 `ws/protocol.py`，PR-3 的 handlers.py TODO 注释已明确标注。

---

### Bug 修复（审查期间发现）

| 问题 | 修复 | Commit |
|------|------|--------|
| 5 个 WS 端点返回 403 | WS 路由参数添加 `WebSocket` 类型注解 + ws_manager 移入工厂函数 + broadcast 并发防护 | `1d28ea8` |

---

### 测试记录

```
150 passed in 0.51s
```

全部测试通过，无回归。5 个 WS 端点手动验证全部连通。

---

## PR-5 Code Review 反馈处理记录

**审查分支**：`feature/pr-5-market-api`
**审查文件**：`review-feedback-a-pr5.md`
**处理时间**：2026-07-13
**审查结论**：2 阻断 + 6 建议 + 1 疑问

---

### 🔴 阻断性问题修复（2 条）

| # | 问题 | 修复 Commit | 处理说明 |
|---|------|------------|----------|
| B1 | CTP 回调链路未接通（MdSpi→mapping→MarketService→WS） | `c286776` | 新建 `services/ctp_bridge.py`（wire_market_data_callback），MarketService 添加 `threading.Lock` 线程安全保护，main.py 添加 `wire_ctp_market_bridge()` 桥接函数（含 asyncio.run_coroutine_threadsafe WS 广播）。新增 8 个 ctp_bridge 测试。 |
| B2 | K线端点硬编码空数据 | `036410e` | `get_kline` docstring 添加详细的 CTP 历史查询依赖说明、延期 PR-7 标注、前后端契约稳定性声明。端点格式保持稳定。 |

---

### 🟡 改进建议处理（6 条）

| # | 建议 | 采纳 | 处理说明 |
|---|------|------|----------|
| S1 | `Optional` 导入未使用 | ✅ | 删除 `api/market.py` 中 `from typing import Optional` |
| S2 | `request: Request` 未使用 | ✅ | `get_kline` 移除 `request: Request` 参数 |
| S3 | `import os as _os` → pathlib | ✅ | 已在 B1 修复中一并改为 `Path(__file__).parent / "data" / "instruments.json"` |
| S4 | `_FakeMdApi` 死代码 | ✅ | 删除 `test_market_service.py` 中 30 行未使用代码 |
| S5 | 裸 `list` 类型注解 | ✅ | 改为 `List[Tuple[str, str, object]]`，添加 import |
| S6 | `min_length=0` 语义模糊 | ✅ | 改为 `min_length=1`，订阅/退订空列表返回 422；同步更新测试 |

---

### 🔵 疑问确认回复（1 条）

**Q1**：WebSocket 行情推送是否明确延期至 PR-7？

**回复**：已在本轮修复中实现，不延期。完整链路：`CTP OnRtnDepthMarketData → field_mapping.map_depth_market_data() → MarketService.update_snapshot() [thread-safe] → ws_manager.broadcast("market", "market_data", data) [asyncio.run_coroutine_threadsafe]`。`wire_market_data_callback()` 函数在 `services/ctp_bridge.py` 中，`wire_ctp_market_bridge()` 在 `main.py` 中提供开箱即用的集成。

---

### 测试记录

```
235 passed in 0.76s
```

全部测试通过，无回归。新增 8 个 ctp_bridge 测试覆盖回调注册、快照更新、字段映射、广播调用、合并语义、空 instrumentID、无 broadcast_fn 场景。

---

## PR-5 Code Review 二次审查反馈处理记录

**审查分支**：`feature/pr-5-market-api`
**审查文件**：`review-feedback-a-pr5-r2.md`
**处理时间**：2026-07-13
**审查结论**：1 阻断 + 0 建议 + 0 疑问

---

### 🔴 阻断性问题修复（1 条）

| # | 问题 | 修复 Commit | 处理说明 |
|---|------|------------|----------|
| B3 | `main.py` 缺少 `import asyncio` 和 `from pathlib import Path` | `40254cd` | S3 修复漏掉了模块顶部 import，导致运行时 `NameError`。验证：`from main import create_app` 可正常导入。 |

---

### ✅ 一次审查修复验证

全部 8 项（B1/B2/S1-S6/Q1）二次验证通过。

---

### 测试记录

```
235 passed in 0.83s
```

导入验证：`from main import create_app, wire_ctp_market_bridge` 成功。
