# PR-19 审查反馈处理记录

## 第 1 轮反馈处理

**处理时间**：2026-07-20
**审查文件**：`review-feedback-a-pr19.md`

---

### 🔴 阻断性问题（1 条）

1. **field_mapping.py:192-204 死代码** → ✅ 已修复
   - 删除 `map_instrument()` 中 `return result` 后的 12 行粘贴残余（`map_trade()` 的副本）
   - Commit: `99c8c06`

---

### 🟡 改进建议（6 条）

1. **market_service.py hasattr 冗余** → ✅ 采纳
   - `__init__` 已初始化 `_on_instruments_callback = None`，`hasattr` 检查多余
   - 简化为 `if self._on_instruments_callback:`

2. **market_service.py 类型注解冗余** → ✅ 采纳
   - `refresh_instruments_from_ctp()` 中 `self._pending_instruments: List[dict] = []` 改为 `self._pending_instruments = []`

3. **ctp_startup.py 回调接线重复** → ✅ 采纳
   - 提取 `_wire_instrument_query(app, trader_spi)` 模块级辅助函数
   - `start_ctp_trading_connection()` 和 `connect_trading()` 两处复用

4. **callback.py OnRspQryInstrument 未检查 pRspInfo** → ✅ 采纳
   - 添加 `pRspInfo.ErrorID` 检查，错误时 log warning（`OnRspQryInstrument_error`）
   - 仍然分发事件（让上层决定是否处理）

5. **api/market.py import asyncio 在闭包内** → ✅ 采纳
   - `import asyncio` 移至文件顶部

6. **api/market.py from pathlib import Path 在函数内** → ✅ 采纳
   - `from pathlib import Path` 移至文件顶部

---

### 🔵 疑问确认（2 条）

1. **test_market_service.py 回调签名不匹配** → ✅ 无需修改
   - 审查时描述的 `lambda instruments: received.extend(instruments)` 与实际代码不符
   - 实际测试代码为 `lambda count: received.append(count)`，签名与 `self._on_instruments_callback(count)` 匹配
   - 测试已验证 callback 被正确调用：`assert received == [2]`

2. **set_instruments_callback + refresh_instruments_from_ctp(callback=) 双重设置** → ✅ 已修复
   - 删除 `svc.set_instruments_callback(_on_complete)` 调用
   - 仅保留 `refresh_instruments_from_ctp(callback=_on_complete)` 参数传递

---

### Commit 记录

- `99c8c06` fix(task-19): review反馈 - 死代码清理+import规范化+回调错误检查+重复代码提取
