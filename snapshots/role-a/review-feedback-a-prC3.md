# PR-C3 审查反馈

**审查人**：角色A（审查窗口）
**审查日期**：2026-07-27
**PR分支**：fix/consistency-c3-reverse-lock
**PR范围**：实现一键反向/一键锁仓接口

---

## 改动概览

| 文件 | 改动 |
|------|------|
| `server/api/order.py` | reverse_position() 和 lock_position() 从 501 占位改为实际实现 |
| `server/tests/test_order_api.py` | 新增 8 个测试覆盖 reverse 和 lock 功能 |
| `snapshots/role-a/dev-record-a.md` | 开发记录更新 |
| `snapshots/role-a/progress.md` | 进度更新 |

**改动行数**：+290（代码+文档）

---

## 代码审查

### 逻辑正确性

**一键反向（reverse）**：
- ✅ 查询当前持仓（从 query_service.positions）
- ✅ 平仓：反方向 + offset_flag="1"（平仓）
- ✅ 开仓：同原方向 + offset_flag="0"（开仓）
- ✅ CTP 方向映射正确：
  - posiDirection "2"=多头 → 平仓用 direction="1"（卖），开仓用 direction="1"（卖）
  - posiDirection "3"=空头 → 平仓用 direction="0"（买），开仓用 direction="0"（买）

**一键锁仓（lock）**：
- ✅ 查询当前持仓
- ✅ 反方向开仓（offset_flag="0"）
- ✅ 不平原有持仓

### 错误处理

- ✅ TD 未连接检查（trader_api is None 或 login_status != "logged_in"）
- ✅ 无持仓检查（target 为空）
- ✅ volume <= 0 检查

### 测试覆盖

新增 8 个测试：
1. `test_reverse_with_long_position` — 反向多头持仓
2. `test_reverse_with_short_position` — 反向空头持仓
3. `test_reverse_no_position` — 无持仓返回错误
4. `test_reverse_td_not_connected` — TD 未连接返回错误
5. `test_lock_with_long_position` — 锁仓多头
6. `test_lock_with_short_position` — 锁仓空头
7. `test_lock_no_position` — 无持仓返回错误
8. `test_lock_td_not_connected` — TD 未连接返回错误

---

## 审查发现

### 🟡 改进建议

**S1. 代码重复可提取公共函数**
- 位置：`server/api/order.py:166-230` 和 `server/api/order.py:233-280`
- 现状：reverse 和 lock 的开头部分（TD 检查、持仓查询、遍历持仓）完全重复
- 建议：提取为私有函数 `_get_valid_positions(request, instrumentID)` 减少重复
- 严重等级：🟡 改进建议（不阻塞合并）

**S2. reverse 操作原子性风险**
- 位置：`server/api/order.py:197-220`
- 现状：reverse 先平仓再开仓，如果平仓成功但开仓失败，会导致只有平仓没有开仓
- 建议：在 docstring 中提示用户风险，或考虑添加"反向失败自动回滚"逻辑（复杂度较高）
- 严重等级：🟡 改进建议（不阻塞合并，但需用户知晓）

**S3. docstring 可补充 reverse 和 lock 区别说明**
- 位置：`server/api/order.py:168-171` 和 `server/api/order.py:234-237`
- 现状：docstring 说明了功能，但没有明确区分两者的使用场景
- 建议：补充说明 reverse 是"先平后开"（适合快速切换方向），lock 是"只开不平"（适合对冲风险）
- 严重等级：🟡 改进建议（不阻塞合并）

---

## 审查结论

**✅ 审查通过**

- 🔴 阻断性问题：0 个
- 🟡 改进建议：3 个（非阻塞）
- 🔵 疑问：0 个

**评价**：
代码逻辑正确，测试覆盖完整（8 个新测试覆盖正常+异常场景），错误处理到位。改进建议均为非阻塞性代码优化，不影响功能正确性。

**下一步**：开发窗口可直接进入人工验证阶段。
