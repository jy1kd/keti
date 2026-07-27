# Task2: 一致性检查代码修复计划

> 本文档由 simnow-consistency-check skill 自动生成，记录一致性检查发现的代码问题。
> 由专门角色按 PR 逐个修复。

---

## PR列表

### PR-C1: 修复 TimeCondition 枚举值错误（CTP 标准值对齐）

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C1 |
| **PR标题** | 修复 TimeCondition 枚举值错误 — 对齐 CTP 标准 |
| **PR分支名** | `fix/consistency-c1-time-condition` |
| **负责角色** | 角色A（server/）+ 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck01 第 1 项 |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |
| **修复commit** | dfb20ad |

**问题描述**：

当前代码中 TimeCondition 枚举值全部错误，与 CTP 标准不一致。已通过 `python -c "import ctp"` 实测验证：

| 常量 | CTP 标准值 | 当前代码值 | 说明 |
|------|-----------|-----------|------|
| `THOST_FTDC_TC_IOC` | `'1'` | — | Immediately or Cancel（代码中缺失） |
| `THOST_FTDC_TC_GFS` | `'2'` | — | Good For Session（代码中缺失） |
| `THOST_FTDC_TC_GFD` | `'3'` | `'1'` ❌ | Good For Day |
| FOK | 非 TimeCondition | `'2'` ❌ | FOK = TimeCondition(IOC) + VolumeCondition(CV) |
| FAK | 非 TimeCondition | `'3'` ❌ | FAK = TimeCondition(IOC) + VolumeCondition(AV) |

**FOK/FAK 的正确实现方式**：

FOK 和 FAK 不是 TimeCondition 的独立值，而是 TimeCondition 与 VolumeCondition 的组合：
- **FOK** (Fill or Kill): `TimeCondition=IOC('1')` + `VolumeCondition=CV('3')`
- **FAK** (Fill and Kill): `TimeCondition=IOC('1')` + `VolumeCondition=AV('1')`
- **GFD** (Good For Day): `TimeCondition=GFD('3')` + `VolumeCondition=AV('1')`（默认）

**修复方案**：

#### 1. 后端修复（角色A）

**1.1 `server/ctp_wrapper/types.py` — 修复 TimeCondition 枚举**

```python
# 修改前
class TimeCondition:
    """有效期类型."""
    GFD: str = "1"  # 当日有效
    FOK: str = "2"  # 全部成交或全部撤销（Fill or Kill）
    FAK: str = "3"  # 部分成交，剩余撤销（Fill and Kill）

# 修改后
class TimeCondition:
    """有效期类型.
    CTP 标准值:
    - IOC ('1'): Immediately or Cancel
    - GFS ('2'): Good For Session
    - GFD ('3'): Good For Day
    注意: FOK/FAK 不是 TimeCondition，而是 TimeCondition(IOC) + VolumeCondition 的组合
    """
    IOC: str = "1"
    GFS: str = "2"
    GFD: str = "3"
```

**1.2 `server/api/order.py` — 修复描述和校验器**

```python
# 修改前 (line 30-31)
timeCondition: str = Field(default="1", pattern=r"^[123]$",
                           description="1=当日有效GFD, 2=即时FOK, 3=即时FAK")

# 修改后
timeCondition: str = Field(default="3", pattern=r"^[123]$",
                           description="1=IOC, 2=GFS, 3=GFD(当日有效)")

# 修改校验器 (line 39-58)
# 修改前：tc == "2" → FOK, tc == "3" → FAK
# 修改后：FOK = tc=="1" and vc=="3", FAK = tc=="1" and vc=="1"
@model_validator(mode="after")
def validate_time_volume_condition(self):
    """Validate FOK/FAK volume condition constraints.

    CTP convention:
    - FOK (Fill or Kill) → TimeCondition=IOC('1') + VolumeCondition=CV('3')
    - FAK (Fill and Kill) → TimeCondition=IOC('1') + VolumeCondition=AV('1')
    - GFD ('3') accepts any volume condition.
    """
    tc = self.timeCondition
    vc = self.volumeCondition
    # FOK: IOC + CV
    if tc == "1" and vc == "3":
        pass  # Valid FOK
    # FAK: IOC + AV
    elif tc == "1" and vc == "1":
        pass  # Valid FAK
    # GFD: accepts any volume condition
    elif tc == "3":
        pass  # Valid GFD
    # IOC with MV: also valid
    elif tc == "1":
        pass  # Valid IOC variant
    # GFS: also valid
    elif tc == "2":
        pass  # Valid GFS
    return self
```

**1.3 `server/models/order.py` — 修复默认值和注释**

```python
# 修改前 (line 16)
timeCondition: str = "1"  # "1"=GFD, "2"=FOK, "3"=FAK

# 修改后
timeCondition: str = "3"  # "1"=IOC, "2"=GFS, "3"=GFD
```

**1.4 `server/ctp_wrapper/trader_api.py` — 修复文档注释**

```python
# 修改前 (line 113)
time_condition: TimeCondition.GFD ("1"), FOK ("2"), or FAK ("3").

# 修改后
time_condition: TimeCondition.GFD ("3"), IOC ("1"), or GFS ("2").
FOK = IOC("1") + VolumeCondition.CV("3"), FAK = IOC("1") + VolumeCondition.AV("1").
```

默认值 `TimeCondition.GFD` 不变（因为 GFD 枚举值会从 "1" 改为 "3"）。

**1.5 `server/services/field_mapping.py` — 修复默认值**

```python
# 修改前 (line 116, 163)
("TimeCondition", "timeCondition", "1"),

# 修改后
("TimeCondition", "timeCondition", "3"),  # GFD
```

**1.6 `server/services/order_manager.py` — 修复默认值**

```python
# 修改前 (line 114)
time_condition: str = "1",

# 修改后
time_condition: str = "3",  # GFD
```

**1.7 `server/utils/ctp_mapping.py` — 修复映射函数和文档**

```python
# 修改前 (line 26-31)
TIME_CONDITION_MAP = {
    'gfd': '1',  # Good For Day
    'fok': '2',  # Fill or Kill
    'fak': '3',  # Fill and Kill
}

# 修改后 — FOK/FAK 需要同时设置 timeCondition 和 volumeCondition
TIME_CONDITION_MAP = {
    'gfd': '3',  # Good For Day → TimeCondition=GFD('3')
    'fok': '1',  # Fill or Kill → TimeCondition=IOC('1')
    'fak': '1',  # Fill and Kill → TimeCondition=IOC('1')
}

# FOK/FAK 对应的 VolumeCondition 映射
VOLUME_CONDITION_FOR_TC = {
    'gfd': '1',  # GFD → AV (any volume)
    'fok': '3',  # FOK → CV (complete volume)
    'fak': '1',  # FAK → AV (any volume)
}
```

同时修复 `convert_order_request_to_ctp` 函数（line 100-129），在转换 timeCondition 时同步设置 volumeCondition：

```python
def convert_order_request_to_ctp(data: dict) -> dict:
    # ... existing code ...
    if 'timeCondition' in result:
        tc_frontend = result['timeCondition']  # 'gfd' | 'fok' | 'fak'
        result['timeCondition'] = time_condition_to_ctp(tc_frontend)
        # 自动设置 volumeCondition
        if 'volumeCondition' not in result or result['volumeCondition'] is None:
            result['volumeCondition'] = VOLUME_CONDITION_FOR_TC.get(tc_frontend, '1')
    # ... rest ...
```

**1.8 `server/tests/test_types.py` — 修复测试断言**

```python
# 修改前 (line 67-74)
def test_gfd_value(self):
    assert TimeCondition.GFD == "1"
def test_fok_value(self):
    assert TimeCondition.FOK == "2"
def test_fak_value(self):
    assert TimeCondition.FAK == "3"

# 修改后
def test_gfd_value(self):
    assert TimeCondition.GFD == "3"
def test_ioc_value(self):
    assert TimeCondition.IOC == "1"
def test_gfs_value(self):
    assert TimeCondition.GFS == "2"
```

**1.9 `server/tests/test_trader_api.py` — 修复测试**

```python
# 修改前 (line 260-281)：测试 FOK/FAK 作为 TimeCondition
# 修改后：测试 FOK/FAK 作为 TimeCondition + VolumeCondition 组合
def test_fok_time_condition(self):
    api = self._make_api()
    api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                     offset_flag=OffsetFlag.OPEN,
                     time_condition=TimeCondition.IOC,  # FOK uses IOC
                     volume_condition=VolumeCondition.CV)  # + CV
    order = api._api.ReqOrderInsert.call_args[0][0]
    assert order.TimeCondition == TimeCondition.IOC
    assert order.VolumeCondition == VolumeCondition.CV

def test_fak_time_condition(self):
    api = self._make_api()
    api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                     offset_flag=OffsetFlag.OPEN,
                     time_condition=TimeCondition.IOC,  # FAK uses IOC
                     volume_condition=VolumeCondition.AV)  # + AV
    order = api._api.ReqOrderInsert.call_args[0][0]
    assert order.TimeCondition == TimeCondition.IOC
    assert order.VolumeCondition == VolumeCondition.AV
```

**1.10 `server/tests/test_order_api.py` — 修复 FOK/FAK 校验测试**

```python
# 修改前：timeCondition="2" 表示 FOK, timeCondition="3" 表示 FAK
# 修改后：FOK = timeCondition="1" + volumeCondition="3"
#        FAK = timeCondition="1" + volumeCondition="1"

# test_fok_requires_cv (line 116-130)
"timeCondition": "1",   # IOC (was "2")
"volumeCondition": "3", # CV — should be accepted for FOK

# test_fak_requires_av (line 132-147)
"timeCondition": "1",   # IOC (was "3")
"volumeCondition": "1", # AV — should be accepted for FAK

# test_fok_with_cv_accepted (line 149-164)
"timeCondition": "1",   # IOC
"volumeCondition": "3", # CV

# test_fak_with_av_accepted (line 166-181)
"timeCondition": "1",   # IOC
"volumeCondition": "1", # AV

# test_gfd_any_volume_condition_accepted (line 183-198)
"timeCondition": "3",   # GFD (was "1")
"volumeCondition": "2", # MV
```

#### 2. 前端修复（角色B）

**2.1 `frontend/src/utils/orderMapping.ts` — 修复映射和转换逻辑**

```typescript
// 修改前 (line 24-28)
const TIME_CONDITION_TO_CTP: Record<string, string> = {
  gfd: '1',
  fok: '2',
  fak: '3',
}

// 修改后 — FOK/FAK 的 timeCondition 部分
const TIME_CONDITION_TO_CTP: Record<string, string> = {
  gfd: '3',  // GFD
  fok: '1',  // FOK uses IOC
  fak: '1',  // FAK uses IOC
}

// 新增 — FOK/FAK 对应的 volumeCondition
const VOLUME_CONDITION_FOR_TC: Record<string, string> = {
  gfd: '1',  // AV (any volume)
  fok: '3',  // CV (complete volume)
  fak: '1',  // AV (any volume)
}
```

修改 `convertOrderRequest` 函数（line 115-135）：

```typescript
// 修改前 (line 116-118)
const timeCondition = toCtpTimeCondition(form.timeCondition)
const volumeCondition = timeCondition === '2' ? '3' : '1'

// 修改后
const timeCondition = toCtpTimeCondition(form.timeCondition)
const volumeCondition = VOLUME_CONDITION_FOR_TC[form.timeCondition] ?? '1'
```

**2.2 `frontend/src/utils/orderMapping.test.ts` — 修复测试断言**

```typescript
// 修改前 (line 49-58)
it("converts 'gfd' to '1'", () => {
  expect(toCtpTimeCondition('gfd')).toBe('1')
})
it("converts 'fok' to '2'", () => {
  expect(toCtpTimeCondition('fok')).toBe('2')
})
it("converts 'fak' to '3'", () => {
  expect(toCtpTimeCondition('fak')).toBe('3')
})

// 修改后
it("converts 'gfd' to '3'", () => {
  expect(toCtpTimeCondition('gfd')).toBe('3')
})
it("converts 'fok' to '1' (IOC)", () => {
  expect(toCtpTimeCondition('fok')).toBe('1')
})
it("converts 'fak' to '1' (IOC)", () => {
  expect(toCtpTimeCondition('fak')).toBe('1')
})
```

同时修复 `convertOrderRequest` 相关测试（line 125+），确保 FOK 时 volumeCondition='3'，FAK 时 volumeCondition='1'，GFD 时 volumeCondition='1'。

#### 3. 文档修复（直接修改，不需要 PR）

**3.1 `docs/task.md` — 修复 PR-10 映射表**

```markdown
# 修改前 (line 1025)
| timeCondition | `'gfd'` / `'fok'` / `'fak'` | `"1"` / `"2"` / `"3"` |

# 修改后
| timeCondition | `'gfd'` / `'fok'` / `'fak'` | `"3"` / `"1"`+VC=`"3"` / `"1"`+VC=`"1"` |
```

**3.2 `docs/design.md` — 修复报单请求格式示例**

```json
// 修改前 (line 454)
"timeCondition": "3"

// 修改后 — GFD 报单的正确值
"timeCondition": "3"  // GFD，不变（但含义从 FAK 改为 GFD）
```

实际上 design.md 中的示例值 "3" 恰好是 GFD 的正确值，但需要确认注释说明。

**涉及文件**：

```
server/ctp_wrapper/types.py              # 角色A — 枚举定义
server/api/order.py                      # 角色A — 描述和校验器
server/models/order.py                   # 角色A — 默认值和注释
server/ctp_wrapper/trader_api.py         # 角色A — 文档注释
server/services/field_mapping.py         # 角色A — 默认值
server/services/order_manager.py         # 角色A — 默认值
server/utils/ctp_mapping.py             # 角色A — 映射函数
server/tests/test_types.py              # 角色A — 测试断言
server/tests/test_trader_api.py         # 角色A — 测试断言
server/tests/test_order_api.py          # 角色A — 测试断言
frontend/src/utils/orderMapping.ts      # 角色B — 映射和转换
frontend/src/utils/orderMapping.test.ts # 角色B — 测试断言
docs/task.md                            # 直接修改 — PR-10 映射表
docs/design.md                          # 直接修改 — 报单请求格式
```

**验收标准**：

- [ ] `python -c "from ctp_wrapper.types import TimeCondition; assert TimeCondition.GFD == '3'"` 通过
- [ ] `python -c "from ctp_wrapper.types import TimeCondition; assert TimeCondition.IOC == '1'"` 通过
- [ ] 后端 FOK 校验：`timeCondition="1" + volumeCondition="3"` → 200
- [ ] 后端 FAK 校验：`timeCondition="1" + volumeCondition="1"` → 200
- [ ] 后端 GFD 校验：`timeCondition="3"` + 任意 volumeCondition → 200
- [ ] 前端 `toCtpTimeCondition('gfd')` 返回 `'3'`
- [ ] 前端 `convertOrderRequest({timeCondition:'fok', ...})` 的 volumeCondition 为 `'3'`
- [ ] 前端 `convertOrderRequest({timeCondition:'fak', ...})` 的 volumeCondition 为 `'1'`
- [ ] 所有后端测试通过：`cd server && python -m pytest tests/ -v`
- [ ] 所有前端测试通过：`cd frontend && npm test`

**相关测试**：

- [ ] `server/tests/test_types.py` — TestTimeCondition 类（3 个测试）
- [ ] `server/tests/test_trader_api.py` — test_fok/fak_time_condition（2 个测试）
- [ ] `server/tests/test_order_api.py` — TestOrderInsertFokFakValidation（5 个测试）
- [ ] `frontend/src/utils/orderMapping.test.ts` — toCtpTimeCondition + convertOrderRequest（6+ 个测试）

---

### PR-C2: VolatilityData 补充 updateTime 字段

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C2 |
| **PR标题** | VolatilityData 补充 updateTime 字段 |
| **PR分支名** | `fix/consistency-c2-volatility-updatetime` |
| **负责角色** | 角色A |
| **依赖PR** | 无 |
| **来源** | check/docsCheck01 第 6 项 |
| **严重等级** | 🟡 不一致 |
| **状态** | ✅ 已完成 |

**问题描述**：

dev.md 和 design.md 定义 VolatilityData 有 8 个字段（含 `updateTime`），但代码实现只有 7 个字段，缺少 `updateTime`。前端无法知道波动率数据的计算时间。

涉及文件：
```
server/models/options.py:98-107         # to_dict() 缺少 updateTime
server/models/options.py:110-119        # from_dict() 缺少 updateTime
server/services/options_service.py:157-165  # get_volatility() 返回字典缺少 updateTime
```

**修复方案**：

**1. `server/models/options.py` — VolatilityData 补充 updateTime**

```python
# 在 dataclass 中新增字段 (line 96 之后)
updateTime: str = ""  # 数据计算时间 (HH:MM:SS)

# to_dict() 中新增 (line 106 之后)
"updateTime": self.updateTime,

# from_dict() 中新增 (line 118 之后)
updateTime=d.get("updateTime", ""),
```

**2. `server/services/options_service.py` — get_volatility() 返回字典补充 updateTime**

```python
# 在 result.append 的字典中新增 (line 164 之后)
from datetime import datetime
# ...
"updateTime": datetime.now().strftime("%H:%M:%S"),
```

**涉及文件**：
```
server/models/options.py                # 角色A — dataclass + to_dict + from_dict
server/services/options_service.py      # 角色A — get_volatility 返回值
server/tests/test_options_models.py     # 角色A — 补充 updateTime 测试断言
```

**验收标准**：
- [ ] `VolatilityData.to_dict()` 返回包含 `updateTime` 键
- [ ] `VolatilityData.from_dict()` 正确读取 `updateTime`
- [ ] `GET /api/market/volatility` 响应中每条数据包含 `updateTime` 字段
- [ ] 所有相关测试通过

---

### PR-C3: 实现一键反向 / 一键锁仓接口

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C3 |
| **PR标题** | 实现一键反向 / 一键锁仓接口 |
| **PR分支名** | `fix/consistency-c3-reverse-lock` |
| **负责角色** | 角色A |
| **依赖PR** | 无 |
| **来源** | check/docsCheck02 |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |

**问题描述**：

task.md PR-11 定义了 `POST /api/order/reverse`（一键反向）和 `POST /api/order/lock`（一键锁仓），但代码中两者都是 501 占位符，未实现任何逻辑。

注释声称 "position data needed"，但持仓查询（QueryService.query_positions）已在 PR-12 实现，条件已具备。

涉及文件：
```
server/api/order.py:166-187         # reverse 和 lock 都是 raise HTTPException(501)
```

**修复方案**：

**1. `server/api/order.py` — 实现 reverse 逻辑**

```python
@router.post("/reverse")
async def reverse_position(request: Request, body: ReverseOrderRequest):
    """一键反向：平掉当前持仓，再以相反方向开仓。"""
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return {"success": False, "message": "TD not connected"}

    query_svc = request.app.state.query_service
    om = request.app.state.order_manager
    positions = query_svc.positions

    # 找到该合约的持仓
    target = [p for p in positions if p.get("instrumentID") == body.instrumentID]
    if not target:
        return {"success": False, "message": f"No position for {body.instrumentID}"}

    results = []
    for pos in target:
        # pos 包含 direction, position(数量), exchangeID 等
        pos_dir = pos.get("direction", "0")     # "0"=多, "1"=空
        volume = pos.get("position", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        # 平仓：反方向
        close_dir = "1" if pos_dir == "0" else "0"
        close_result = om.insert(
            instrument_id=body.instrumentID,
            exchange_id=exchange_id,
            direction=close_dir,
            offset_flag="1",        # 平仓
            price_type="1",         # 市价
            limit_price=0.0,
            volume=volume,
            time_condition="1",     # GFD
            volume_condition="1",
            hedge_flag="1",
        )
        results.append({"action": "close", **close_result})

        # 开仓：同原方向（反向后的新仓位）
        open_result = om.insert(
            instrument_id=body.instrumentID,
            exchange_id=exchange_id,
            direction=pos_dir,      # 原方向开仓 = 反向
            offset_flag="0",        # 开仓
            price_type="1",         # 市价
            limit_price=0.0,
            volume=volume,
            time_condition="1",
            volume_condition="1",
            hedge_flag="1",
        )
        results.append({"action": "open", **open_result})

    return {"success": True, "orders": results}
```

**2. `server/api/order.py` — 实现 lock 逻辑**

```python
@router.post("/lock")
async def lock_position(request: Request, body: LockOrderRequest):
    """一键锁仓：在反方向开同等数量仓位，不平原有持仓。"""
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return {"success": False, "message": "TD not connected"}

    query_svc = request.app.state.query_service
    om = request.app.state.order_manager
    positions = query_svc.positions

    target = [p for p in positions if p.get("instrumentID") == body.instrumentID]
    if not target:
        return {"success": False, "message": f"No position for {body.instrumentID}"}

    results = []
    for pos in target:
        pos_dir = pos.get("direction", "0")
        volume = pos.get("position", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        # 锁仓：反方向开仓
        lock_dir = "1" if pos_dir == "0" else "0"
        result = om.insert(
            instrument_id=body.instrumentID,
            exchange_id=exchange_id,
            direction=lock_dir,
            offset_flag="0",        # 开仓
            price_type="1",         # 市价
            limit_price=0.0,
            volume=volume,
            time_condition="1",
            volume_condition="1",
            hedge_flag="1",
        )
        results.append({"action": "lock_open", **result})

    return {"success": True, "orders": results}
```

**涉及文件**：
```
server/api/order.py             # 角色A — 替换 501 占位符为实际逻辑
server/tests/test_order_api.py  # 角色A — 新增 reverse/lock 测试用例
```

**验收标准**：
- [ ] `POST /api/order/reverse` 根据持仓平仓+反向开仓，不再返回 501
- [ ] `POST /api/order/lock` 根据持仓反向开仓（锁仓），不再返回 501
- [ ] 无持仓时返回明确错误信息
- [ ] 新增测试覆盖：有持仓/无持仓两种场景

---

### PR-C4: cancelAllOrders 前后端响应字段对齐

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C4 |
| **PR标题** | cancelAllOrders 响应字段前后端对齐 |
| **PR分支名** | `fix/consistency-c4-cancel-all-response` |
| **负责角色** | 角色B（前端修改） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 1 项 |
| **严重等级** | 🔴 P0 |
| **状态** | ✅ 已完成 |
| **修复commit** | a15cd73 |

**问题描述**：
- 前端 `CancelAllResponse`（`api.ts:275-280`）期望 `cancelled`/`failed`/`errors`
- 后端 `cancel_all()`（`order_manager.py:401-404`）返回 `attempted`/`succeeded`/`failedRefs`
- `result.cancelled` 为 `undefined`，toast 显示 "已撤销 undefined 笔报单"

**修复方案**：
1. 修改 `frontend/src/services/api.ts`，`CancelAllResponse` 改为：
   ```typescript
   interface CancelAllResponse {
     success: boolean
     attempted: number
     succeeded: number
     failedRefs: string[]
   }
   ```
2. 修改 `frontend/src/modules/query/store.ts:265`，toast 改为：
   ```typescript
   toast.success(`已撤销 ${result.succeeded} 笔报单`)
   ```

**涉及文件**：
```
frontend/src/services/api.ts             # CancelAllResponse 类型修改
frontend/src/modules/query/store.ts      # toast 消息修改
```

**验收标准**：
- [ ] 批量撤单后 toast 正确显示撤销数量
- [ ] TypeScript 编译无错误

---

### PR-C5: K 线时间戳统一

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C5 |
| **PR标题** | K 线时间戳统一 — 消除 UTC+8 偏移 |
| **PR分支名** | `fix/consistency-c5-kline-timestamp` |
| **负责角色** | 角色A（后端修改） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 2 项 |
| **严重等级** | 🔴 P0 |
| **状态** | ⏳ 待开始 |

**问题描述**：
- `kline_service.py:58` 用 `calendar.timegm()` 将 CTP 的 UTC+8 时间当 UTC 处理，时间戳快 8 小时
- 前端 WebSocket 路径直接用 CTP 原始时分秒，REST 路径用 `new Date()` 按浏览器时区解析
- 同一根 K 线，两条路径产生不同的 timestamp

**修复方案**：
1. 修改 `server/services/kline_service.py:58`，将 `calendar.timegm` 改为使用 `datetime` + 固定 UTC+8 偏移：
   ```python
   from datetime import datetime, timezone, timedelta
   china_tz = timezone(timedelta(hours=8))
   dt = datetime(year, month, day, hour, minute, second, tzinfo=china_tz)
   return int(dt.timestamp())
   ```
2. 前端 REST 路径（`QueryPanel.tsx:66-69`）改为与 WebSocket 路径一致，直接解析时分秒字符串

**涉及文件**：
```
server/services/kline_service.py          # 时间戳计算修复
frontend/src/modules/query/QueryPanel.tsx # REST 路径时间解析对齐
```

**验收标准**：
- [ ] API 返回的 K 线 timestamp 与 WebSocket 推送的 timestamp 对齐
- [ ] 不同时区浏览器下 K 线图表无重复/错位

---

### PR-C6: 报单和止损单补充 exchangeID

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C6 |
| **PR标题** | 报单和止损单补充 exchangeID |
| **PR分支名** | `fix/consistency-c6-exchange-id` |
| **负责角色** | 角色B（前端） + 角色A（后端止损单） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 3、4 项 |
| **严重等级** | 🔴 P1 |
| **状态** | ⏳ 待开始 |

**问题描述**：
- 报单：前端 `orderMapping.ts:120-134` 不发 exchangeID，后端默认 "CFFEX"
- 止损单：`SubmitStopOrderRequest` 无 exchangeID，触发时 `exchange_id=""`

**修复方案**：
1. 前端 `orderMapping.ts`：`convertOrderRequest()` 增加 `exchangeID` 字段（从合约信息中获取）
2. 前端 `api.ts`：`submitStopOrder` 增加 `exchangeID` 参数
3. 后端 `order.py`：`SubmitStopOrderRequest` 增加 `exchangeID` 字段
4. 后端 `stop_order.py`：`StopOrder` 增加 `exchange_id` 属性，`_trigger_order` 传递给 `insert()`

**涉及文件**：
```
frontend/src/utils/orderMapping.ts        # convertOrderRequest 增加 exchangeID
frontend/src/services/api.ts              # submitStopOrder 增加 exchangeID
server/api/order.py                       # SubmitStopOrderRequest 增加 exchangeID
server/services/stop_order.py             # StopOrder 增加 exchange_id
```

**验收标准**：
- [ ] SHFE 合约（如 au2506）报单成功
- [ ] 止损触发后非 CFFEX 合约报单成功
- [ ] exchangeID 从前端正确传递到 CTP

---

### PR-C7: useMarketWs 双重调用修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C7 |
| **PR标题** | useMarketWs 双重调用 — 单例化 WebSocket 连接 |
| **PR分支名** | `fix/consistency-c7-market-ws-singleton` |
| **负责角色** | 角色B |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 5 项 |
| **严重等级** | 🔴 P1 |
| **状态** | ⏳ 待开始 |

**问题描述**：
- MarketPanel 和 QueryPanel 各自调用 `useMarketWs`，创建两个独立 WebSocket 连接
- 两个 hook 用不同 period 写入同一个 store，K 线数据混在一起

**修复方案**：
1. 将 `useMarketWs` 改为单例模式：只在 MarketPanel 中调用一次，管理 WebSocket 连接和行情 store 更新
2. QueryPanel 不再调用 `useMarketWs`，改为从 store 读取 K 线数据
3. K 线周期切换时，通过 store 的方法切换周期，由单例 hook 统一处理

**涉及文件**：
```
frontend/src/hooks/useMarketWs.ts         # 单例化改造
frontend/src/modules/query/QueryPanel.tsx  # 移除 useMarketWs 调用
frontend/src/modules/market/store.ts       # 增加周期切换方法
```

**验收标准**：
- [ ] 只有一个 WebSocket 连接到 /ws/market
- [ ] 切换 K 线周期后数据正确
- [ ] 行情表格和 K 线图同时正常工作

---

### PR-C8: refreshAll 防重入

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C8 |
| **PR标题** | refreshAll 防重入 + CTP 查询串行化 |
| **PR分支名** | `fix/consistency-c8-refresh-reentry` |
| **负责角色** | 角色B（前端） + 角色A（后端） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 6 项 |
| **严重等级** | 🔴 P1 |
| **状态** | ⏳ 待开始 |

**问题描述**：
- `refreshAll` 总耗时 11-16 秒，但 interval 每 10 秒触发
- 不检查上一次是否完成，并发调用导致 CTP 查询冲突

**修复方案**：
1. 前端 `query/store.ts`：增加 `isRefreshing` 标志，`refreshAll` 开始时检查，跳过重入
2. 或改为递归 setTimeout：`refreshAll` 完成后再调度下一次
3. 后端 `query_service.py`：增加查询锁（`threading.Lock`），串行化 CTP 查询

**涉及文件**：
```
frontend/src/modules/query/store.ts       # 防重入逻辑
frontend/src/modules/query/QueryPanel.tsx  # interval 改 setTimeout
server/services/query_service.py          # 查询锁（可选）
```

**验收标准**：
- [ ] 快速切换 Tab 不会触发并发查询
- [ ] CTP 查询无超时错误

---

### PR-C9: 止损单触发竞态条件修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C9 |
| **PR标题** | 止损单触发竞态条件修复 |
| **PR分支名** | `fix/consistency-c9-stop-order-race` |
| **负责角色** | 角色A |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 7 项 |
| **严重等级** | 🔴 P2 |
| **状态** | ⏳ 待开始 |

**问题描述**：
- `on_market_data` 释放锁后才执行触发循环，已取消的止损单仍可能被触发
- 快速行情变动可能重复触发同一止损单

**修复方案**：
1. `stop_order.py`：`_trigger_order` 开头增加状态检查：
   ```python
   with self._lock:
       if order.status != StopOrderStatus.PENDING:
           return
       order.status = StopOrderStatus.TRIGGERING  # 新增中间状态
   ```
2. 或将整个触发逻辑放在锁内

**涉及文件**：
```
server/services/stop_order.py              # 状态检查 + 锁范围调整
```

**验收标准**：
- [ ] 取消的止损单不会被触发
- [ ] 快速行情变动不会重复触发

---

### PR-C10: reverse/lock 平仓依赖检查

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C10 |
| **PR标题** | reverse/lock 平仓成功后再开仓 |
| **PR分支名** | `fix/consistency-c10-reverse-dep` |
| **负责角色** | 角色A |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 8 项 |
| **严重等级** | 🟡 P2 |
| **状态** | ⏳ 待开始 |

**问题描述**：
- 平仓和开仓独立发送，平仓被拒时开仓仍执行

**修复方案**：
1. `order.py` reverse 逻辑：平仓单提交后检查 `insert()` 返回的 `success` 字段，失败则不开新仓

**涉及文件**：
```
server/api/order.py                        # reverse/lock 增加依赖检查
```

**验收标准**：
- [ ] 平仓失败时不开新仓
- [ ] 一键反向不会增加仓位

---

### PR-C11: design.md 文档对齐

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C11 |
| **PR标题** | design.md 文档与代码对齐 |
| **PR分支名** | `fix/consistency-c11-docs-align` |
| **负责角色** | 文档修改（直接修改） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 9-17 项 |
| **严重等级** | 🟡 文档 |
| **状态** | ⏳ 待开始 |

**修复内容**：
1. 补充 4 个缺失的 API 端点（kline、depth、options/underlyings、volatility）
2. 更新 reverse 请求参数：`{order_ref}` → `{instrumentID}`
3. 更新 lock 请求参数：`{instrument_id, volume}` → `{instrumentID}`
4. 更新 stop/cancel 请求参数：`{stop_order_ref}` → `{stopOrderID}`
5. 更新 StopOrderRequest 字段名
6. 更新 StopOrder 数据结构（接口定义 + 持久化格式）
7. 更新 direction/offset 编码说明
8. 修正 PR-14 的 productClass 值
9. 删除 progress.md 重复条目
10. 补充开发日志

**涉及文件**：
```
docs/design.md                             # API 端点、数据模型、编码说明
docs/task.md                               # PR-14 productClass 修正
snapshots/role-b/progress.md               # 删除重复条目
```

**验收标准**：
- [ ] design.md 中所有 API 端点与代码一致
- [ ] 数据模型字段名与代码一致
- [ ] 无重复的 progress 条目

---

### PR-C12: 代码质量清理

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C12 |
| **PR标题** | 代码质量清理 — 死代码、类型修正、未使用导入 |
| **PR分支名** | `fix/consistency-c12-code-cleanup` |
| **负责角色** | 角色A（后端） + 角色B（前端） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck03 第 18-25 项 |
| **严重等级** | 🔵 P3 |
| **状态** | ⏳ 待开始 |

**修复内容**：
1. 删除 `server/main.py:173-211` 的 `wire_ctp_market_bridge` 死代码
2. 删除 `frontend/src/services/ws.ts:34-36` 的空 onopen
3. 修正 `types.ts` 的 `PositionRecord.posiDirection` 类型为 `string`
4. 修正 `types.ts` 的 `OrderRecord.orderStatus` 类型为 `string`
5. 合并 `OrderRecord` 和 `OrderStatus` 重复类型
6. 删除 `server/api/query.py:9` 的未使用 `Optional` 导入
7. 修正 `useSystemWs.ts:66-69` 的 MD/TD 重连计数共用问题

**涉及文件**：
```
server/main.py                             # 删除死代码
frontend/src/services/ws.ts                # 删除空 onopen
frontend/src/services/types.ts             # 类型修正 + 合并
server/api/query.py                        # 删除未使用导入
frontend/src/hooks/useSystemWs.ts          # 重连计数分离
```

**验收标准**：
- [ ] 无死代码
- [ ] 类型定义与实际数据一致
- [ ] TypeScript 编译无错误
- [ ] Python 无未使用导入警告
