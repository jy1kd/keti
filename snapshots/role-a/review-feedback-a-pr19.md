# PR-19 Code Review 反馈

## 第 1 轮审查

审查分支：`feature/pr-19-instrument-query-api`
审查 commit：`a4686a3..ab386a0`（6 commits）
审查时间：2026-07-20

---

### 🔴 阻断性问题（必须修改）

1. **【field_mapping.py:192-204】return 后有不可达死代码**
   - 第 192 行 `return result` 之后，第 193-204 行还有一段完整的函数体（docstring + for 循环），永远不会执行。
   - 原因：复制 `map_trade()` 时遗留的粘贴残余。`return` 后面的代码是死代码。
   - 建议：删除第 193-204 行。
   ```python
   # 当前（错误）：
       return result
       """Map a CTP CThostFtdcTradeField to a camelCase dict.
       ...（12行死代码）
   
   # 应改为：
       return result
   ```

---

### 🟡 改进建议

1. **【market_service.py:282】`hasattr` 检查冗余**
   - `if hasattr(self, '_on_instruments_callback') and self._on_instruments_callback:` 中 `hasattr` 不需要，因为 `__init__` 已初始化 `_on_instruments_callback = None`。
   - 建议简化为：`if self._on_instruments_callback:`

2. **【market_service.py:250】类型注解冗余重声明**
   - `self._pending_instruments: List[dict] = []` 在 `__init__` 中已声明类型。此处重新标注类型虽无害，但不一致（其他方法中使用 `self._pending_instruments = []` 即可）。
   - 建议改为：`self._pending_instruments = []`

3. **【ctp_startup.py:115-126 / 136-147】回调接线代码重复**
   - `_on_rsp_qry_instrument` 在 `start_ctp_trading_connection()` 和 `connect_trading()` 中完全重复定义（含 `from pathlib import Path`）。
   - 建议：提取为模块级辅助函数，两处复用。

4. **【callback.py:68-76】OnRspQryInstrument 未检查 pRspInfo 错误**
   - 其他回调（如 `_td_on_rsp_order_insert`）会检查 `pRspInfo.ErrorID`。此处直接分发，若 CTP 返回错误（如未登录、频率限制），会被当作正常数据处理。
   - 建议：添加 `pRspInfo` 错误检查，错误时 log warning 但仍分发（让上层决定是否处理）。

5. **【api/market.py:130-138】`import asyncio` 在闭包内**
   - `_on_complete` 函数体内 `import asyncio`。虽然 Python 会缓存 import，但与其他文件风格不一致（通常在模块顶部导入）。
   - 建议：移到文件顶部或函数外部。

6. **【api/market.py:133】`from pathlib import Path` 在函数内**
   - 同上，`pathlib` import 在函数体内，与其他文件风格不一致。
   - 建议：移到文件顶部。

---

### 🔵 疑问确认

1. **【test_market_service.py:629】回调签名不匹配**
   - 测试中 `callback=lambda instruments: received.extend(instruments)` 接收的是一个列表参数，但 `on_instruments_result()` 实际调用 `self._on_instruments_callback(count)` 传入的是整数 count。
   - 这意味着测试只验证了 callback 被存储（`assert svc._on_instruments_callback is not None`），没有验证 callback 被正确调用。如果后续有人修改 callback 签名，测试不会捕获。
   - 确认：这是有意为之（只测存储）还是应补充 callback 调用验证？

2. **【api/market.py:141-146】set_instruments_callback + refresh_instruments_from_ctp(callback=) 双重设置**
   - 第 141 行 `svc.set_instruments_callback(_on_complete)` 设置了 callback，然后第 147 行 `refresh_instruments_from_ctp(trader_api, callback=_on_complete)` 又通过参数再次设置。
   - 两次设置指向同一个 callback，功能无害，但逻辑冗余。
   - 确认：是否有意保留两种设置路径？

---

### 审查结论

❌ **需要修改后再审**

阻断性问题 1 条（field_mapping.py 死代码）必须修复。改进建议 6 条建议修复。疑问 2 条需确认。

---

### 下一步

请切回开发窗口：
1. 修复 field_mapping.py 死代码（🔴 必须）
2. 处理改进建议（🟡 建议）
3. 确认疑问（🔵 回复后可不改）
4. 修复完成后切审查窗口进行二次审查
