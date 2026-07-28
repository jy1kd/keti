# PR-13 审查反馈 — 第1轮

**审查时间**：2026-07-23
**审查分支**：feature/pr-13-stop-order
**审查范围**：8 files, +1219/-1 (4 commits)
**测试结果**：44 passed, 0 failed

---

## 改动概要

| 文件 | 改动 | 说明 |
|------|------|------|
| `services/stop_order.py` | +326 (new) | StopOrderService 核心逻辑 |
| `api/order.py` | +67 | 止损单 API 端点 |
| `services/ctp_bridge.py` | +19/-1 | 行情回调 → 止损单检查 |
| `services/ctp_startup.py` | +27 | StopOrderService 初始化 + 广播接线 |
| `main.py` | +5 | Import + app.state 注册 |
| `tests/test_stop_order_service.py` | +549 (new) | 服务层单测 |
| `tests/test_stop_order_api.py` | +159 (new) | API 端点测试 |
| `tests/test_stop_order_integration.py` | +68 (new) | 集成测试 |

---

## task.md 验收标准对照

| 验收标准 | 实现状态 | 说明 |
|----------|:--------:|------|
| 止损单提交正常 | ✅ | `submit()` 创建 + 持久化 + 广播 |
| 止损单取消正常 | ✅ | `cancel()` 仅允许 PENDING 状态取消 |
| 止损单查询正常 | ✅ | `list_orders()` 返回全部状态 |
| 止损单触发逻辑正确 | ✅ | 多头 ≤止损价、空头 ≥止损价，价格跳空仍触发 |
| 触发后自动报单正常 | ✅ | `_trigger_order()` → `OrderManager.insert()` |
| WebSocket推送正常 | ✅ | submit/cancel/trigger 三处广播 |
| 持久化正常 | ✅ | JSON 文件 + 启动加载 + GFD 过期过滤 |

task.md 要求的 7 项验收标准全部覆盖，无遗漏。

---

## 审查发现

### 🟡 改进建议（不阻塞合入）

**S1. GFD 过期判断在月初可能崩溃**
`stop_order.py:298-300` — `test_does_not_load_orders_from_previous_day` 测试使用：
```python
yesterday = datetime.now().replace(day=datetime.now().day - 1)
```
当 `day=1` 时，`day-1=0` 会抛 `ValueError`。虽然这是测试代码而非生产代码，但 `_load_from_disk()` 中的日期比较逻辑（`startswith(today)`）是字符串前缀匹配，实际是安全的。建议修复测试避免月初崩溃。

**S2. `_save_to_disk()` 非原子写入**
`stop_order.py:280-286` — 直接 `open(file_path, "w")` 写入。如果写入过程中进程崩溃（如断电），文件可能被截断为 0 字节或部分写入，导致所有止损单丢失。建议使用原子写入（先写临时文件再 rename）：
```python
tmp_path = file_path + ".tmp"
with open(tmp_path, "w") as f:
    json.dump(data, f)
os.replace(tmp_path, file_path)  # 原子操作
```

**S3. `StopOrder` 类可用 `@dataclass` 简化**
`stop_order.py:38-70` — StopOrder 的 `__init__` 和 `to_dict`/`from_dict` 共 ~90 行。使用 `@dataclass` 可减少样板代码，但当前实现功能正确，非阻塞。

**S4. `market_service` 参数未使用**
`stop_order.py:118-120` — 构造函数接收 `market_service` 参数并存储为 `self._market_service`，但整个类中从未使用。`on_market_data()` 直接接收 `last_price` 参数，不依赖 market_service。建议：
- 移除未使用的参数（如果后续不需要）
- 或在类文档中说明保留原因

**S5. API 字段命名与 task.md 手动验证不一致**
`task.md:1474` 手动验证使用 `combOffsetFlag` 和 `volumeTotalOriginal`，但 API 模型使用 `offsetFlag` 和 `volume`。功能正确（前端使用 camelCase 简化名），但手动验证 curl 命令需要同步更新。

**S6. 无止损单数量上限**
当前实现不限制止损单数量。大量止损单可能影响 `on_market_data()` 性能（每次行情推送遍历全部订单）。建议增加上限（如 100 个）并在超过时返回错误。

**S7. `_trigger_order` 中锁的获取模式**
`stop_order.py:235-243` — `_trigger_order` 在 `on_market_data` 释放锁后重新获取锁更新状态。理论上在释放→重获之间，另一个线程可能 cancel 了该订单。实际上因为 GFD + 单线程行情回调，风险极低。当前实现可接受。

---

## 代码质量评价

**优点**：
- 架构清晰：StopOrderService 纯业务逻辑，API 层薄封装，ctp_startup 负责接线
- 线程安全：所有公开方法用 `_lock` 保护
- 持久化设计合理：JSON 文件 + 状态变更即时写入 + GFD 过期过滤
- 测试覆盖全面：44 个测试覆盖模型、提交、取消、列表、触发、广播、持久化、多合约、GFD
- 与现有代码集成顺畅：ctp_bridge 新增 stop_order_callback 参数，ctp_startup 延迟初始化

**总体评价**：实现质量高，task.md 7 项验收标准全部覆盖，44 测试全通过。改进项均为非阻塞建议。

---

## 审查结论

**✅ 通过** — 可以合入。建议处理 S1（测试月初崩溃）和 S5（手动验证 curl 命令同步），其余可后续优化。

---
---

# PR-13 审查反馈 — 第2轮（二次审查）

**审查时间**：2026-07-23
**审查分支**：feature/pr-13-stop-order
**修复 commit**：`09b256b fix(task-13): review反馈 - S1月初测试+S2原子写入+S4移除未用参数+S5手动验证命令`
**测试结果**：44 passed, 0 failed

---

## 第1轮发现修复验证

| # | 等级 | 建议 | 修复状态 | 验证 |
|---|------|------|:--------:|------|
| S1 | 🟡 | GFD 测试月初崩溃 | ✅ 已修复 | `timedelta(days=1)` 替代 `replace(day=day-1)`，月初不再崩溃 |
| S2 | 🟡 | `_save_to_disk()` 非原子写入 | ✅ 已修复 | 先写 `.tmp` 再 `os.replace()`，异常时清理临时文件 |
| S3 | 🟡 | StopOrder 可用 @dataclass | ⏭️ 保留 | 合理，当前实现功能正确 |
| S4 | 🟡 | market_service 参数未使用 | ✅ 已修复 | 改为 `Optional[MarketService] = None`，保留扩展性 |
| S5 | 🟡 | 手动验证 curl 命令字段名不一致 | ✅ 已修复 | task.md 已更新为 `offsetFlag`/`volume` |
| S6 | 🟡 | 无止损单数量上限 | ⏭️ 后续优化 | 当前场景性能可接受 |
| S7 | 🟡 | 锁获取模式 | ⏭️ 当前可接受 | 单线程行情回调风险极低 |

**修复质量评价**：
- S1：`timedelta(days=1)` 是标准做法，正确处理月末/月初边界 ✅
- S2：原子写入实现完整，含异常清理（`os.remove(tmp_path)`）✅
- S4：改为可选参数后，`ctp_startup.py` 和测试代码同步移除了 `market_service` 传参 ✅
- S5：curl 命令字段名与 API 模型一致 ✅

---

## 新引入代码检查

修复 commit 改动了 5 个文件（+21/-16），逐文件检查：

| 文件 | 改动 | 新问题 |
|------|------|:------:|
| `docs/tasks/task.md` | curl 命令字段名修正 | 无 |
| `server/services/stop_order.py` | 原子写入 + market_service 可选化 | 无 |
| `server/services/ctp_startup.py` | 移除 market_service 传参 | 无 |
| `server/tests/test_stop_order_service.py` | timedelta 修复 + 移除 market_service fixture | 无 |
| `server/tests/test_stop_order_integration.py` | 移除 market_service 传参 | 无 |

未引入新问题。

---

## 审查结论

**✅ 二次审查通过** — 第1轮 4 项修复全部正确验证，未引入新问题。剩余 3 项保留建议（S3/S6/S7）均为非阻塞优化，可后续处理。

**可以合入。**
