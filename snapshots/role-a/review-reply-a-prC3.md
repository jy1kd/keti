# PR-C3 审查反馈处理记录

**处理人**：角色A（开发窗口）
**处理日期**：2026-07-27
**PR分支**：fix/consistency-c3-reverse-lock

---

## 反馈处理

| # | 严重度 | 问题 | 处理 | Commit |
|---|--------|------|------|--------|
| S1 | 🟡 | 代码重复可提取公共函数 | ✅ 已采纳 — 提取 `_get_valid_positions()` 函数 | `5c6f64f` |
| S2 | 🟡 | reverse 操作原子性风险 | ✅ 已采纳 — docstring 添加风险提示 | `5c6f64f` |
| S3 | 🟡 | docstring 可补充 reverse 和 lock 区别说明 | ✅ 已采纳 — 补充适用场景说明 | `5c6f64f` |

---

## 修复详情

### S1. 提取公共函数

```python
def _get_valid_positions(request: Request, instrument_id: str):
    """获取有效持仓，检查 TD 连接状态和持仓是否存在。

    Returns:
        tuple: (positions_list, error_response)
        - 成功时 error_response 为 None
        - 失败时 positions_list 为空列表，error_response 为错误信息
    """
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return [], "TD not connected"

    query_svc = request.app.state.query_service
    positions = query_svc.positions

    target = [p for p in positions if p.get("instrumentID") == instrument_id]
    if not target:
        return [], f"No position for {instrument_id}"

    return target, None
```

### S2. reverse 风险提示

```python
@router.post("/reverse")
async def reverse_position(request: Request, body: ReverseOrderRequest):
    """一键反向：平掉当前持仓，再以相反方向开仓。

    适用场景：快速切换持仓方向（多→空或空→多）。
    操作顺序：先平仓，再以相反方向开仓。

    ⚠️ 风险提示：平仓和开仓是两笔独立报单，如果平仓成功但开仓失败，
    会导致持仓被平掉但没有反向开仓。建议在非行情剧烈波动时使用。

    CTP posiDirection: "2"=多头(买), "3"=空头(卖)
    """
```

### S3. lock 区别说明

```python
@router.post("/lock")
async def lock_position(request: Request, body: LockOrderRequest):
    """一键锁仓：在反方向开同等数量仓位，不平原有持仓。

    适用场景：对冲风险，保留原有持仓的同时建立反向仓位。
    操作顺序：仅反方向开仓，不平原有持仓。

    CTP posiDirection: "2"=多头(买), "3"=空头(卖)
    """
```

---

## 测试验证

- ✅ 22 tests passed（全部通过）
- ✅ 修复后回归测试通过

---

**下一步**：开发窗口可直接进入人工验证阶段。
