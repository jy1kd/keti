# PR-11 Code Review 反馈

## 第 1 轮审查

审查分支：`feature/pr-11-query-api`
审查 commit：`b883764..a882f33`（8 commits）
审查时间：2026-07-21

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

1. **【api/query.py】GET 端点直接访问私有成员**
   - `get_positions` 使用 `svc._positions`，`get_account` 使用 `svc._account`，`get_orders` 使用 `svc._orders`，`get_trades` 使用 `svc._trades`。
   - 这些是 `_` 前缀的私有属性，API 层不应直接访问。
   - 建议：为 QueryService 添加公开属性（`positions`, `orders`, `trades`, `account`），或使用 `@property`。

2. **【api/query.py】refresh 端点未检查登录状态**
   - `refresh_positions`, `refresh_orders`, `refresh_trades`, `refresh_account` 都检查了 `trader_api is None`，但没有检查 `trader.login_status != "logged_in"`。
   - 虽然 QueryService 内部会检查，但 API 层应先拦截并返回有意义的错误消息（如 "TraderApi not logged in"），而非让内部方法静默返回空列表。
   - 建议：在每个 refresh 端点添加 `if trader.login_status != "logged_in": return {"success": False, "message": "TraderApi not logged in"}`。

3. **【trader_api.py】`import ctp` 重复 4 次**
   - `query_orders`, `query_trades`, `query_positions`, `query_account` 方法内各有 `import ctp`。
   - PR-19 的 `query_instruments` 也有同样问题。虽然 Python 缓存 import，但 5 个方法重复同样的 import 不一致。
   - 建议：在模块顶部 import，或在已有 `import ctp` 的地方统一。

4. **【tests】缺少 refresh 端点测试**
   - `test_query_api.py` 覆盖了 GET 端点（positions/account/orders/trades/contracts），但没有覆盖 POST refresh 端点（`/positions/refresh`, `/account/refresh`, `/orders/refresh`, `/trades/refresh`）。
   - refresh 端点包含 `run_in_executor` + WebSocket 广播逻辑，属于重要路径。
   - 建议：补充 refresh 端点的基础测试（mock trader_api，验证返回格式）。

5. **【callback.py】4 个查询回调高度重复**
   - `_td_on_rsp_qry_order`, `_td_on_rsp_qry_trade`, `_td_on_rsp_qry_investor_position`, `_td_on_rsp_qry_trading_account` 结构完全相同（error_id 检查 + log + dispatch），仅事件名不同。
   - 建议：提取工厂函数 `_make_qry_callback(event_name)`，4 处复用。（非阻塞，可后续优化）

6. **【query_service.py】pending 列表线程安全**
   - `on_*_result` 在 CTP 回调线程中 append 到 `_pending_*` 列表，`query_*` 在 API 线程中 clear + read。
   - Python GIL 保证单个 append/clear 原子，但 `self._pending_orders = []` 和 `self._orders = list(self._pending_orders)` 之间存在窗口期：CTP 回调可能在 clear 之后、wait 之前触发，导致 `event.set()` 在 `wait()` 之前执行——结果正确但可能丢失后续数据。
   - 当前设计可接受（10s 超时兜底），但建议在 docstring 中标注线程模型。

---

### 🔵 疑问确认

1. **【market_service.py】subscribe/unsubscribe 失败语义变更**
   - PR-11 附带修复了 subscribe/unsubscribe 的遗留问题：CTP 调用失败时返回 `{"success": False}`。
   - 但当前逻辑是：失败时仍然修改了本地订阅状态（`subscription_count` 已增加/减少），返回的 `success: False` 与本地状态不一致。
   - 确认：这是有意为之（本地状态先记录，CTP 失败不回滚）还是应改为不修改本地状态？

2. **【api/query.py】get_account 返回格式不一致**
   - `get_positions` 返回 `{"positions": [...], "count": N}`，`get_orders` 返回 `{"orders": [...], "count": N}`。
   - 但 `get_account` 直接返回 account dict（无外层包装），且无数据时返回 `{"balance": 0.0, "available": 0.0}` 硬编码默认值。
   - 确认：是否有意让 account 端点格式与其他端点不同？

---

### 测试验证

- PR-11 新增 87 测试：✅ 全部通过
- 全量测试：454 passed / 14 failed（全部为 pre-existing 失败，与 PR-11 无关）

### 范围控制

- ✅ 仅修改 server/ + snapshots/ 目录
- ✅ 无无关文件改动
- ⚠️ market_service.py 的 subscribe/unsubscribe 修复属于 PR-11 范围外的附带修复（task.md 遗留问题），但合理

### 文档同步

- ✅ progress.md 已更新为「开发完成，待审查」
- ✅ dev-record-a.md 已更新（6 次 TDD 循环，87 tests）

---

### 审查结论

✅ **通过**（附带 6 条改进建议 + 2 条疑问确认）

无阻断性问题。代码架构清晰：QueryService 封装 CTP 回调累积模式，API 层通过 `run_in_executor` 避免阻塞事件循环，测试覆盖充分。改进建议均为代码质量优化，不阻塞合入。

---

### 下一步

请确认 2 条疑问后，完成人工验证（交易时段运行 refresh 端点），然后切回开发窗口生成 PR 描述。

---

## 第 2 轮审查（复审）

审查分支：`feature/pr-11-query-api`
审查 commit：`d6eb313`（修复提交）
审查时间：2026-07-21

### 第 1 轮反馈修复验证

| # | 等级 | 问题 | 修复状态 |
|---|------|------|----------|
| 1 | 🟡 | GET 端点直接访问私有成员 | ✅ 添加 `orders/trades/positions/account` 公开属性，API 层改用 |
| 2 | 🟡 | refresh 端点未检查登录状态 | ✅ 4 个 refresh 端点均添加 `login_status` 检查 |
| 3 | 🟡 | `import ctp` 重复 4 次 | ⏭️ 保留（SWIG 测试模式需要，理由充分） |
| 4 | 🟡 | 缺少 refresh 端点测试 | ✅ 新增 9 个测试覆盖 4 个 refresh 端点 |
| 5 | 🟡 | 4 个查询回调高度重复 | ✅ 提取 `_make_qry_callback(event_name)` 工厂函数 |
| 6 | 🟡 | pending 列表线程安全 | ✅ QueryService docstring 详细标注线程模型 |
| Q1 | 🔵 | subscribe 失败语义 | ✅ 确认：有意为之（本地状态记录用户意图） |
| Q2 | 🔵 | get_account 返回格式 | ✅ 确认：Account 是单一对象，格式不同合理 |

### 🔴 阻断性问题（必须修改）

无

### 🟡 改进建议

无

### 🔵 疑问确认

无

### 测试验证

- PR-11 相关测试（query_api + query_service + callback）：✅ 81/81 全部通过
- callback.py 的 `_make_qry_callback` 工厂函数正确替代了 4 个独立函数

### 审查结论

✅ **通过**

所有改进建议已处理（6 采纳 + 1 保留理由充分），2 条疑问已确认。代码质量优秀，测试覆盖充分。

### 下一步

请完成人工验证后切回开发窗口生成 PR 描述。
