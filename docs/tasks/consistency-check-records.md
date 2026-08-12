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
| **状态** | ✅ 已完成 |
| **修复commit** | 623d36a |

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
| **状态** | ✅ 已完成 |
| **修复commit** | 86c7e6c |

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
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C7): useMarketWs 单例化 — 消除双重 WebSocket 连接` |

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
- [x] 只有一个 WebSocket 连接到 /ws/market
- [x] 切换 K 线周期后数据正确
- [x] 行情表格和 K 线图同时正常工作

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
| **状态** | ✅ 已完成 |

**问题描述**：
- ~~`refreshAll` 总耗时 11-16 秒，但 interval 每 10 秒触发~~
- ✅ 已修复：增加 `isRefreshing` 重入保护，改为递归 `setTimeout`
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
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C8): refreshAll 防重入 — isRefreshing + 递归 setTimeout` |

**问题描述**：
- `refreshAll` 总耗时 11-16 秒，但 interval 每 10 秒触发
- 不检查上一次是否完成，并发调用导致 CTP 查询冲突

**修复方案**：
1. 前端 `query/store.ts`：增加 `isRefreshing` 标志，`refreshAll` 开始时检查，跳过重入
2. 前端 `query/QueryPanel.tsx`：改为递归 setTimeout：`refreshAll` 完成后再调度下一次

**涉及文件**：
```
frontend/src/modules/query/store.ts       # 防重入逻辑
frontend/src/modules/query/QueryPanel.tsx  # interval 改 setTimeout
```

**验收标准**：
- [x] 快速切换 Tab 不会触发并发查询
- [x] CTP 查询无超时错误

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
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C9): 止损单触发竞态条件修复 — TRIGGERING 中间状态` |

**问题描述**：
- `on_market_data` 释放锁后才执行触发循环，已取消的止损单仍可能被触发
- 快速行情变动可能重复触发同一止损单
- 竞态窗口：两个线程都通过 PENDING 检查后，都会调用 insert()，导致重复报单

**修复方案**：
1. `stop_order.py`：添加 `TRIGGERING` 中间状态
2. `_trigger_order` 检查通过后立即设置为 `TRIGGERING`，防止并发触发

**涉及文件**：
```
server/services/stop_order.py              # 添加 TRIGGERING 状态 + 原子性状态转换
```

**验收标准**：
- [x] 取消的止损单不会被触发
- [x] 快速行情变动不会重复触发
- [x] 并发触发只会执行一次

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
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C10): reverse 平仓失败时不开新仓` |

**问题描述**：
- 平仓和开仓独立发送，平仓被拒时开仓仍执行

**修复方案**：
1. `order.py` reverse 逻辑：平仓单提交后检查 `insert()` 返回的 `success` 字段，失败则不开新仓

**涉及文件**：
```
server/api/order.py                        # reverse 增加依赖检查
```

**验收标准**：
- [x] 平仓失败时不开新仓
- [x] 一键反向不会增加仓位

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
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C11): design.md 文档对齐 — API 端点、数据结构、productClass` |

**修复内容**：
1. ✅ 补充 4 个缺失的 API 端点（kline、depth、options/underlyings、volatility）- 已存在
2. ✅ 更新 reverse 请求参数：`{order_ref}` → `{instrumentID}`
3. ✅ 更新 lock 请求参数：`{instrument_id, volume}` → `{instrumentID}`
4. ✅ 更新 stop/cancel 请求参数：`{stop_order_ref}` → `{stopOrderID}`
5. ✅ 更新 StopOrderRequest 字段名
6. ✅ 更新 StopOrder 数据结构（接口定义 + 持久化格式）
7. ✅ 更新 direction/offset 编码说明 - 已存在
8. ✅ 修正 PR-14 的 productClass 值：`'1'` → `'2'`
9. ✅ 删除 progress.md 重复条目 - 无重复
10. ✅ 补充开发日志

**涉及文件**：
```
docs/design.md                             # API 端点、数据模型、编码说明
docs/task.md                               # PR-14 productClass 修正
```

**验收标准**：
- [x] design.md 中所有 API 端点与代码一致
- [x] 数据模型字段名与代码一致
- [x] 无重复的 progress 条目

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
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C12): 代码质量清理 — 死代码、类型修正、未使用导入` |

**修复内容**：
1. ✅ 删除 `server/main.py` 的 `wire_ctp_market_bridge` 死代码
2. ✅ 删除 `frontend/src/services/ws.ts` 的空 onopen
3. ✅ 修正 `types.ts` 的 `PositionRecord.posiDirection` 类型为 `string`
4. ✅ 修正 `types.ts` 的 `OrderRecord.orderStatus` 类型为 `string`
5. ✅ 合并 `OrderRecord` 和 `OrderStatus` 重复类型（OrderStatus = OrderRecord）
6. ✅ 删除 `server/api/query.py` 的未使用 `Optional` 导入
7. ✅ 修正 `useSystemWs.ts` 的 MD/TD 重连计数共用问题

**涉及文件**：
```
server/main.py                             # 删除死代码
frontend/src/services/ws.ts                # 删除空 onopen
frontend/src/services/types.ts             # 类型修正 + 合并
server/api/query.py                        # 删除未使用导入
frontend/src/hooks/useSystemWs.ts          # 重连计数分离
```

**验收标准**：
- [x] 无死代码
- [x] 类型定义与实际数据一致
- [x] TypeScript 编译无错误
- [x] Python 无未使用导入警告

---

### PR-C13: types.ts 类型定义修复（isTrading、optionType、StopOrderRequest、OrderRecord）

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C13 |
| **PR标题** | types.ts 类型定义修复 — isTrading/optionType/StopOrderRequest/OrderRecord |
| **PR分支名** | `fix/consistency-c13-types-cleanup` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | check/docsCheck04 第 1/2/3/6/7 项 |
| **严重等级** | 🟡 不一致 |
| **状态** | ✅ 已完成 |
| **修复commit** | `fix(task-C13): types.ts 类型定义修复 — isTrading/optionType/StopOrderRequest/OrderRecord` |

**问题描述**：

5 个类型定义问题合并为一个 PR：

1. `isTrading` 类型不匹配 — 前端 `boolean`，后端返回 `int`（0/1）
2. `optionType` / `optionsType` 枚举值不匹配 — 前端 `'call' | 'put'`，后端返回 `'1' | '2'`
3. `StopOrderRequest` 类型定义与实际 API 不匹配 — 使用了错误的字段名
4. `optionType` 命名不一致 — VolatilityData 用单数，OptionContract 用复数
5. `OrderRecord` 字段覆盖不全 — 仅 10 个字段，后端返回 27 个

**修复方案**：

**1. `isTrading: boolean` → `isTrading: number`**
```typescript
// types.ts:185 ContractInfo
isTrading: number  // 0=不可交易, 1=可交易

// types.ts:208 OptionContract
isTrading: number  // 0=不可交易, 1=可交易
```

**2. optionType 枚举值对齐 CTP**
```typescript
// types.ts:75 VolatilityData
optionType: string  // '1'=看涨(call), '2'=看跌(put)

// types.ts:203 OptionContract — 统一为 optionType（单数）
optionType: string  // '1'=看涨(call), '2'=看跌(put)
```

**3. StopOrderRequest 类型对齐实际 API**
```typescript
// types.ts:109-118 修改为：
export interface StopOrderRequest {
  instrumentID: string
  exchangeID?: string
  direction: string      // '0'=买, '1'=卖
  offsetFlag: string     // '0'=开仓, '1'=平仓, '3'=平今
  limitPrice: number
  volume: number
  stopPrice: number
}
```

**4. OrderRecord 补充缺失字段**
```typescript
// types.ts:93-104 补充后端 map_order() 返回的完整字段：
export interface OrderRecord {
  orderRef: string
  orderSysID: string
  orderLocalID: string
  instrumentID: string
  exchangeID: string
  direction: string
  combOffsetFlag: string
  combHedgeFlag: string
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded: number
  volumeTotal: number
  orderStatus: string
  orderSubmitStatus: string
  statusMsg: string
  insertDate: string
  insertTime: string
  cancelTime: string
  updateTime: string
  tradingDay: string
  frontID: number
  sessionID: number
  stopPrice: number
}
```

**涉及文件**：
```
frontend/src/services/types.ts    # 修改 5 处类型定义
```

**验收标准**：
- [x] `isTrading` 类型为 `number`
- [x] `optionType` 统一使用单数，值为 `string`
- [x] `StopOrderRequest` 字段名与后端 `SubmitStopOrderRequest` 一致
- [x] `OrderRecord` 包含 `map_order()` 返回的全部字段
- [x] TypeScript 编译无错误
- [x] 前端运行正常

---

### PR-C14: 前端 WS 重连计数永不重置修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C14 |
| **PR标题** | useReconnect 重连计数成功重连后重置 |
| **PR分支名** | `fix/consistency-c14-reconnect-reset` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔴-1 |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |
| **修复commit** | 6c8e1db |

**问题描述**：

`frontend/src/hooks/useReconnect.ts:44-48` 中 `retryCountRef.current = 0` 仅在 `ws.isConnected(endpoint)` 为真时执行，但 WebSocket 不会自行恢复连接，唯一重连路径是 `:49` 的 `ws.connect()`。因此每次走 `ws.connect()` 重连成功后计数并不归零，断线满 5 次（`MAX_RETRIES`）后 `scheduleReconnect`（`:32-36`）直接放弃，行情/系统 WS 在整个应用生命周期内不再重连。对 7×24 终端，SimNow 重启 / 网络抖动 / 笔记本休眠唤醒 5 次之后行情与连接状态推送永久失效。`useReconnect.test.ts:79-99` 只覆盖「连续失败 5 次放弃」，未覆盖「成功后重置」。

**修复方案**：

1. `frontend/src/services/ws.ts` — `WSManager.connect()` 增加 `onOpen` 回调，连接建立成功时通知调用方。
2. `frontend/src/hooks/useReconnect.ts` — 在 onOpen 回调里 `retryCountRef.current = 0; setIsReconnecting(false)`；删除 timer 内 `:44-47` 的无效重置分支（该分支实际永不生效）。
3. `frontend/src/hooks/useReconnect.test.ts` — 补充「重连成功后再次断线，计数归零」用例。

**涉及文件**：

```
frontend/src/hooks/useReconnect.ts      # 角色B — 重连成功后重置计数
frontend/src/services/ws.ts             # 角色B — connect 增加 onOpen 回调
frontend/src/hooks/useReconnect.test.ts # 角色B — 补充成功重置用例
```

**验收标准**：

- [ ] 断线→重连成功→再次断线，仍能继续重连（第 6 次及以上）
- [ ] 连续失败 5 次后停止重连（原有行为不变）
- [ ] 前端测试通过：`cd frontend && npm test`

**相关测试**：

- [ ] `useReconnect.test.ts` — 新增「重连成功后重置计数」用例

---

### PR-C15: 后端异步路由阻塞事件循环整改

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C15 |
| **PR标题** | 异步路由阻塞事件循环整改 — login/cancel_all/reverse/lock 移出事件循环 |
| **PR分支名** | `fix/consistency-c15-async-blocking` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔴-2 |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |
| **修复commit** | 7e958c5 |

**问题描述**：

异步路由直接调用阻塞式 CTP 同步调用，阻塞 asyncio 事件循环所在 OS 线程，期间所有 HTTP 请求与行情 WebSocket 广播全部停摆：

- `/login`：`server/api/connection.py:78` → `services/ctp_startup.py:1125-1126` `td_login_done.wait(timeout=LOGIN_TIMEOUT*2)`，最长阻塞 60s。
- 撤单/批量撤单：`server/api/order.py:214` → `order_manager.py:407` `cancel_all()` 对每个活动单 `cancel(ref, wait_response=True, wait_timeout=...)` 串行等待 ≤1s/单，50 个活动单锁 50s。
- `reverse`/`lock`（`api/order.py:528/566`）内部多次 `om.insert`（默认 `event.wait(3.0)`，`order_manager.py:197`）同样阻塞。

**修复方案**：

1. 参考已有正确示范 `server/api/query.py:64`（查询刷新路由已用 `run_in_executor`）：登录、insert、cancel、cancel_all、reverse、lock 中的阻塞 CTP 调用统一移入 `asyncio.to_thread` / `loop.run_in_executor(None, ...)`。
2. `cancel_all` 改为每单 `wait_response=False` 之后统一批量确认回报，避免逐单串行阻塞。

**涉及文件**：

```
server/api/connection.py             # 角色A — login 阻塞调用 to_thread
server/api/order.py                  # 角色A — insert/cancel/cancel_all/reverse/lock to_thread
server/services/order_manager.py     # 角色A — cancel_all 批量非阻塞提交
server/tests/test_order_api.py       # 角色A — 补充异步不阻塞用例
```

**验收标准**：

- [ ] 登录/批量撤单进行中，行情 WS 广播与其它 REST 请求不被阻塞（可用 time.sleep 模拟验证事件循环空闲）
- [ ] 原有报单/撤单功能与测试通过

**相关测试**：

- [ ] `test_connection_api.py` / `test_order_api.py` — 断言阻塞调用在 executor 中执行

---

### PR-C16: 止损触发阻塞行情回调线程整改

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C16 |
| **PR标题** | 止损触发不阻塞行情回调线程 |
| **PR分支名** | `fix/consistency-c16-stop-order-nonblocking` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔴-3 |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |
| **修复commit** | f02fd7c |

**问题描述**：

`server/services/stop_order.py:272` `_trigger_order` 调用 `self._order_manager.insert(...)`，`OrderManager.insert` 默认 `wait_response=True`（`order_manager.py:118,197`，内部 `event.wait(3.0)`）。调用链为 MD CTP 线程 → `OnRtnDepthMarketData`（`ctp_bridge.py:55`）→ `_check_stop_orders`（`ctp_startup.py:304`）→ `_trigger_order`。止损触发瞬间该线程被卡最长 3s，期间**所有合约**的行情 tick 均无法处理（延迟/丢 tick），多头止损同时触发时逐串行叠加。

**修复方案**：

1. `_trigger_order` 改 `wait_response=False` 提交报单，状态经 `OnRtnOrder` 回报回调更新为 `TRIGGERED`（不阻塞等待回报）。
2. 或将 `insert` 放入独立线程执行；至少调小 `wait_timeout` 并记录触发后回调补丁。

**涉及文件**：

```
server/services/stop_order.py     # 角色A — _trigger_order 改异步提交
server/services/order_manager.py  # 角色A — 确认 wait_response=False 路径状态更新
server/tests/test_stop_order.py   # 角色A — 补充不阻塞/异步回报用例
```

**验收标准**：

- [ ] 止损触发时行情 tick 不阻塞（可模拟多合约同时触发验证）
- [ ] 止损单状态最终正确更新为 TRIGGERED / TRIGGER_FAILED

**相关测试**：

- [ ] `test_stop_order.py` — 断言触发不阻塞、状态经回调更新

---

### PR-C17: connection status 接口回归修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C17 |
| **PR标题** | /api/connection/status mock 脆弱性修复 + 2 个回归测试 |
| **PR分支名** | `fix/consistency-c17-status-fragile` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔴-4（PR #102 引入） |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |
| **修复commit** | fe01e0c |

**问题描述**：

`server/api/connection.py:132,137` `md_front = getattr(md_api, "front", "")` — `getattr` 的默认值 `""` 仅在属性**不存在**时生效，MagicMock/未初始化对象会自动创建属性并返回 MagicMock（非字符串），`StatusResponse.mdFront: str` Pydantic 校验失败 → 接口 500。实测 2 个测试失败：

```
test_status_with_ctp_connected / test_status_with_ctp_disconnected
ResponseValidationError: {'type':'string_type','loc':('response','mdFront'),
  'input': <MagicMock name='mock.front' ...>}
```

**修复方案**：

```python
front = getattr(md_api, "front", None)
md_front = front if isinstance(front, str) else ""
# trader_api 同理（td_front）
```

**涉及文件**：

```
server/api/connection.py     # 角色A — 防御性写法
server/tests/test_connection_api.py # 角色A — 2 个 TestStatus 测试恢复绿
```

**验收标准**：

- [ ] `python -m pytest tests/test_connection_api.py::TestStatus -v` 通过
- [ ] `pytest tests/ -q` 中该 2 项恢复通过

**相关测试**：

- [ ] `test_connection_api.py` — TestStatus 2 项

---

### PR-C18: 后端权威合规校验补齐

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C18 |
| **PR标题** | productClass 传递 + 保护价/限价服务端条件校验 |
| **PR分支名** | `fix/consistency-c18-compliance-server` |
| **负责角色** | 角色A（server/）+ 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-1 |
| **严重等级** | 🔴 阻断 |
| **状态** | ✅ 已完成 |
| **修复commit** | bf3c009 |

**问题描述**：

- 前端 `CtpOrderRequest`/`convertOrderRequest()`（`frontend/src/utils/orderMapping.ts:108-150`）无 `productClass` 字段，仅在本地从合约表取做上限校验（`modules/order/store.ts:118-124`）。
- 后端 `InsertOrderRequest.productClass` 默认 `"1"`（`server/api/order.py:38-39`），`validate_volume` 用 `info.data.get("productClass", "1")`（order.py:43-55）——期权合约（productClass='2'）的限价上限 100/市价 30 服务端永不生效，恶意客户端可绕过前端直接提交 500 手期权限价单。
- `stopPrice`/`limitPrice` 仅 `ge=0`（order.py:27-30），市价单「必须填保护价」、限价单「价格>0」在服务端均无条件校验。与 CLAUDE.md「后端权威校验：Pydantic field_validator 兜底」声明不符。

**修复方案**：

1. 前端 `convertOrderRequest` 传入 `productClass`（从合约数据取）。
2. 后端 `validate_volume` 按实际 `productClass` 校验期权上限。
3. 后端补条件校验（field_validator）：市价单必须 `stopPrice>0`；限价单必须 `limitPrice>0`。

**涉及文件**：

```
server/api/order.py                     # 角色A — productClass 校验 + 价格条件校验
frontend/src/utils/orderMapping.ts      # 角色B — 传递 productClass
frontend/src/modules/order/store.ts     # 角色B — 提交时带 productClass
server/tests/test_order_api.py          # 角色A — 期权超限/缺保护价拒绝用例
```

**验收标准**：

- [ ] 直接 POST 期权 500 手限价单被后端拒绝
- [ ] 市价单缺保护价被后端拒绝
- [ ] 前端 + 后端测试通过

**相关测试**：

- [ ] `test_order_api.py` — 期权数量上限、市价保护价必填

---

### PR-C19: 后端重连韧性修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C19 |
| **PR标题** | 重连循环修复 — 断线后按指数退避多次重试 |
| **PR分支名** | `fix/consistency-c19-reconnect-loop` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-2 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

`server/services/ctp_startup.py:358-375`（MD）、`:646-663 / :835-849 / :1084-1098`（TD）、`reconnect.py:73-94`：`on_disconnect()` 把 `_retry_count` 置 1，`should_retry()` 返回 True 后，`_do_reconnect` 线程执行**一次** `try_reconnect()`；若失败，`_retry_count` 不再增长、无人重新调度，系统停留在断开状态直到人工重启。`max_retries=5`、`base_delay*2^n` 退避、`get_current_delay` 全部形同虚设。

**修复方案**：

`_do_reconnect` 内部加循环：失败时 `on_disconnect()` 递增计数 → `sleep(get_current_delay())` → 再试，直到成功或 `not should_retry()`。

**涉及文件**：

```
server/services/ctp_startup.py     # 角色A — MD/TD 重连循环
server/services/reconnect.py       # 角色A — 退避状态
server/tests/test_reconnect.py     # 角色A — 多次失败重试用例
```

**验收标准**：

- [ ] 模拟断线后连续多次失败能按退避多次重连，成功即停
- [ ] 重连测试通过

**相关测试**：

- [ ] `test_reconnect.py` — 多次重试、退避间隔

---

### PR-C20: 后端查询/状态防护补全

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C20 |
| **PR标题** | /api/order/status 未防护 + 合约刷新纳入查询锁 |
| **PR分支名** | `fix/consistency-c20-status-guard` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-3/🟡-4 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

- `server/api/order.py:198-199` `/api/order/status/{ref}` 未防护 `order_manager=None`（TD 未连接时为 None），直接 `om.get_order()` → AttributeError → 全局 handler 500（且泄露内部异常串，`main.py:157-168`）。同文件 insert/cancel/cancel_all 均先校验 `trader_api.login_status`。
- `server/services/market_service.py:380` `query_instruments()` 未持有 `QueryService._query_lock`，可与持仓/资金查询并发发 `ReqQryInstrument`，CTP 前置串行处理下后发请求响应可能被丢弃/超时。

**修复方案**：

1. status 路由先判 `order_manager is None` / `trader_api.login_status != "logged_in"`，返回 `{"success": False, "message": "TD not connected"}`。
2. `query_instruments` 纳入 `_query_lock`（或统一查询门闩）串行化。

**涉及文件**：

```
server/api/order.py               # 角色A — status 路由防护
server/services/market_service.py # 角色A — query_instruments 加锁
server/tests/test_order_api.py    # 角色A — 未登录 status 返回明确错误
```

**验收标准**：

- [ ] 未登录查询报单状态返回明确错误而非 500
- [ ] 合约刷新与持仓/资金查询并发无超时

**相关测试**：

- [ ] `test_order_api.py` — status 未防护场景

---

### PR-C21: start.py 地址选择边界修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C21 |
| **PR标题** | start.py 夜盘跨日/周末边界修复 |
| **PR分支名** | `fix/consistency-c21-start-boundary` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-5 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

`server/start.py:57-74` `_is_commodity_trading_time` 中 `if t >= dtime(21,0) or t < dtime(2,30)` 的夜盘尾段**无工作日校验**；配合 `:95` `use_primary = is_weekday and _is_commodity_trading_time(now)`：

- 周一 00:00-02:30 被判定为 PRIMARY（实为上周五夜盘结束后，无行情）→ 应连 7x24。
- 周六 00:00-02:30（周五贵金属夜盘尾段）因 `is_weekday=False` 落到 SECONDARY。

**修复方案**：

夜盘条件改为「前一自然日为交易日」的跨日校验：
`(t >= 21:00 and 当日为工作日) or (t < 2:30 and 前一自然日为工作日)`。

**涉及文件**：

```
server/start.py           # 角色A — 跨日校验
server/tests/test_start.py # 角色A — 周一凌晨/周六凌晨边界用例
```

**验收标准**：

- [ ] 周一 00:00-02:30 → SECONDARY
- [ ] 周二 01:00（周一夜盘尾段）→ PRIMARY（不回归）
- [ ] `test_start.py` 全部通过

**相关测试**：

- [ ] `test_start.py` — 周末/跨日边界用例

---

### PR-C22: 前端展示与类型小修

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C22 |
| **PR标题** | 前端展示/类型修正 — formatPrice 精度、updateTime、死类型、usePriceStep 纯化 |
| **PR分支名** | `fix/consistency-c22-frontend-display` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-6/🟡-7/🟡-9 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

1. **formatPrice 精度错误**（`frontend/src/pages/KLinePage.tsx:27-31`）：`tick<1 ? String(tick).length-1 : 0`，tick=0.02 得 3、0.01 得 3、0.1 得 2，多显示一位。沪金(0.02)、原油(0.1) K线页最新价显示 `412.300`/`412.30`。同文件体系 `MarketDepth.tsx:47-51` 已有正确写法。
2. **OptionChain.updateTime 声明必填**（`types.ts:274-280`），后端 `options_service.py:64-101` 返回无此字段 → 运行时 undefined，类型契约失真。
3. **OrderRequest 死类型**（`types.ts:81-91`）：字段名（direction:'buy'|'sell' 等）与实际 API 契约不符，生产零引用，误导。实际报单走 `utils/orderMapping.ts` 的 `CtpOrderRequest`。
4. **orderStatus 注释过期**（`types.ts:110`）：漏 `'2'=未成交(排队)`（`server/ctp_wrapper/types.py:49-56`）。
5. **usePriceStep updater 副作用**（`usePriceStep.ts:11-29`）：`setPrice` updater 内写外部变量 `result`，非纯函数，StrictMode 下脆弱。

**修复方案**：

1. `formatPrice` 改用 `MarketDepth` 的 `tickDecimals` 逻辑（`str.split('.')[1].length`）。
2. `types.ts` `OptionChain.updateTime?: string`。
3. 删除或注释 `OrderRequest`（注明等价 `OrderRequestForm`）。
4. `types.ts:110` 注释补 `'2'=未成交(排队)`。
5. `usePriceStep` 改为基于闭包当前 `price` 计算返回，updater 内不做副作用。

**涉及文件**：

```
frontend/src/pages/KLinePage.tsx         # 角色B — formatPrice
frontend/src/services/types.ts           # 角色B — updateTime/OrderRequest/orderStatus
frontend/src/hooks/usePriceStep.ts       # 角色B — updater 纯化
frontend/src/hooks/usePriceStep.test.ts  # 角色B — 纯化用例
```

**验收标准**：

- [ ] 0.02/0.01/0.1 tick 合约 K线页价格位数正确
- [ ] TypeScript 编译无错误
- [ ] 前端测试通过

**相关测试**：

- [ ] `usePriceStep.test.ts` — stepUp/stepDown 纯化后行为不变

---

### PR-C23: K线 REST/WS 覆盖竞态修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C23 |
| **PR标题** | K线 REST 晚到覆盖实时聚合 bar 修复 |
| **PR分支名** | `fix/consistency-c23-kline-race` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-5 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

`frontend/src/pages/KLinePage.tsx:69-86`：`getKlineData()` → `setKlineData()` 全量替换 `klineData`；`useMarketWs.ts:181-182` 的 `appendKline` 实时追加同 store。REST 响应若晚于 WS 实时聚合到达，会用较旧的服务端缓冲覆盖已聚合的新 bar（被吞掉的周期 bar 缺失）。瞬态且下一 tick 自愈。

**修复方案**：

`setKlineData` 与现有数据合并（保留晚到时间戳更晚的 bar），而非全量替换；或 REST 到达后与 WS 缓冲合并。

**涉及文件**：

```
frontend/src/pages/KLinePage.tsx     # 角色B — setKlineData 合并
frontend/src/pages/KLinePage.test.tsx # 角色B — 覆盖竞态用例
```

**验收标准**：

- [ ] REST 晚到时新聚合 bar 不被覆盖
- [ ] K线页测试通过

**相关测试**：

- [ ] `KLinePage.test.tsx` — REST/WS 合并场景

---

### PR-C24: 四类 WS 推送前端消费

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C24 |
| **PR标题** | 前端接入 /ws/order /ws/position /ws/stop 实时推送 |
| **PR分支名** | `fix/consistency-c24-ws-consumers` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-8 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

后端已广播 order/trade/position/stop 四类 WS 消息（`ctp_startup.py:496-500`、`order_manager.py:498-502 / 543-547`、`query.py:69-76`、`stop_order.py:180-184 / 210-214 / 296-301`），但前端生产代码只连接 `market`（`useMarketWs.ts:135,211`）和 `system`（`useSystemWs.ts:54`）。`query/store.ts:223-247` 的 `upsertOrder/upsertTrade` 只被测试引用。`/ws/order`、`/ws/position`、`/ws/stop` 三个端点零连接客户端 → 报单/成交/持仓/资金全部依赖 10s 轮询，回报延迟最多 10s，与 design.md 的 WS 推送设计不符。

**修复方案**：

1. 新增 hook 连接 `/ws/order`、`/ws/position`、`/ws/stop`。
2. 消息经 `order_return/trade_return/position_update/stop_order_update` 实时更新 query store（接线已存在的 `upsertOrder/upsertTrade`）。
3. 保留轮询作为兜底，实时推送到达时刷新。

**涉及文件**：

```
frontend/src/hooks/useOrderWs.ts        # 角色B — 新建 order/position/stop 消费 hook
frontend/src/hooks/useOrderWs.test.ts   # 角色B — 消息解析用例
frontend/src/modules/query/store.ts     # 角色B — 接线 upsert
```

**验收标准**：

- [ ] 报单/成交回报实时更新（<1s），不依赖 10s 轮询
- [ ] 持仓/止损状态实时更新
- [ ] 前端测试通过

**相关测试**：

- [ ] `useOrderWs.test.ts` — 四类消息解析与 store 更新

---

### PR-C25: DBL_MAX 哨兵清洗对称

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C25 |
| **PR标题** | 持仓/资金 DBL_MAX 哨兵清洗 + 前端防护 |
| **PR分支名** | `fix/consistency-c25-dblmax-sanitize` |
| **负责角色** | 角色A（server/）+ 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-3 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

- 后端 `map_depth_market_data` 显式把 CTP `DBL_MAX` 替换为 0（`server/services/field_mapping.py:90-98`），但 `map_position`/`map_account`（`:295-307, :329-341`）未做 sanitize。
- 前端 `Position.tsx:86-90` 直接 `pos.positionProfit.toFixed(2)` / `openCost.toFixed(2)` / `useMargin.toFixed(2)`，无哨兵判断；`AccountQuery.tsx:3-8` 已有 `CTP_INVALID` 防护显示 `--`。
- 影响：CTP 对未结算/部分字段返回 DBL_MAX 时，持仓表渲染 `1.7976931348623157e+308` 级巨数。

**修复方案**：

1. `map_position` / `map_account` 对 CTP 哨兵值（如 `>= sys.float_info.max * 0.5`）置 0。
2. `Position.tsx` 加哨兵防护显示 `--`（参考 `AccountQuery.tsx`）。

**涉及文件**：

```
server/services/field_mapping.py   # 角色A — map_position/map_account sanitize
frontend/src/modules/query/Position.tsx # 角色B — 哨兵防护
server/tests/test_field_mapping.py # 角色A — DBL_MAX 清洗用例
```

**验收标准**：

- [ ] 持仓/资金接口返回 DBL_MAX 时前端显示 `--` 而非巨数
- [ ] 后端 + 前端测试通过

**相关测试**：

- [ ] `test_field_mapping.py` — map_position/map_account 哨兵

---

### PR-C26: 一键反向/锁仓空头取价方向修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C26 |
| **PR标题** | 反向/锁仓对价限价按持仓方向计算 |
| **PR分支名** | `fix/consistency-c26-reverse-price-dir` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-4 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

前端 `OrderPanel.tsx:116,129`（reverse）与 `:160`（lock）中 `calcCounterpartyPrice('1', snap, ...)` 方向硬编码 `'1'`（卖出），用于平仓与开仓两个价格；默认配置即对价模式（`userPrefs.ts:20-40`，`priceMode:'counterparty'`，`offsetTicks:1`）。后端反向/锁仓实际报单方向按持仓方向决定，空头持仓（posiDirection='3'）时 `close_dir = open_dir = '0'`（买入）（`server/api/order.py:371-372, 449-450, 602`）。空头用户执行反向/锁仓时，委托限价按「卖一价-跳数」计算而实际是买单（应取「卖一价+跳数」），限价低于对手价难成交或按错误价格成交。

**修复方案**：

`calcCounterpartyPrice` 方向按持仓方向选择：买单用卖一价+跳数、卖单用买一价-跳数。

**涉及文件**：

```
frontend/src/modules/order/OrderPanel.tsx    # 角色B — 按持仓方向算对价
frontend/src/modules/order/OrderPanel.test.tsx # 角色B — 空头/多头取价用例
```

**验收标准**：

- [ ] 空头持仓一键反向/锁仓的委托限价方向正确（买单取卖一+跳数）
- [ ] 多头持仓行为不回归
- [ ] 前端测试通过

**相关测试**：

- [ ] `OrderPanel.test.tsx` — 空头/多头对价取价

---

### PR-C27: 止损单 triggering 状态映射修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C27 |
| **PR标题** | 止损单 triggering 中间态映射 + 方向样式判断 |
| **PR分支名** | `fix/consistency-c27-stop-triggering` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-6/🔵-10 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

- `frontend/src/modules/query/StopOrderList.tsx:4-9` 的 `STATUS_MAP` 只有 pending/triggered/trigger_failed/canceled，后端 `StopOrderStatus` 含 `triggering`（`server/services/stop_order.py:31-38,263`），触发过程中（阻塞等回报最长 3s）前端刷新会原样显示英文。
- `StopOrderList.tsx:59` `s.direction === 'buy' ? 'buy' : 'sell'` —— 后端存的是 CTP `'0'/'1'`（`stop_order.py:74-89`），判断恒 false，多单行也套 'sell' 样式（文字显示经 `DIRECTION_MAP` 正确，仅 CSS 类错）。

**修复方案**：

1. `STATUS_MAP` 补 `triggering: '触发中'`。
2. 方向样式判断改为 `s.direction === '0'`。

**涉及文件**：

```
frontend/src/modules/query/StopOrderList.tsx # 角色B — STATUS_MAP + 方向判断
frontend/src/modules/query/StopOrderList.test.tsx # 角色B — triggering/方向样式用例
```

**验收标准**：

- [ ] 止损触发中前端显示「触发中」
- [ ] 多单/空单行样式正确
- [ ] 前端测试通过

**相关测试**：

- [ ] `StopOrderList.test.tsx` — triggering 映射 + 方向样式

---

### PR-C28: 后端死代码与高频开销清理

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C28 |
| **PR标题** | 后端死代码清理 + SPI 事件日志开关 |
| **PR分支名** | `fix/consistency-c28-backend-cleanup` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔵 |
| **严重等级** | 🔵 改进 |
| **状态** | ⏳ 待开始 |

**问题描述**：

- 死代码：`server/utils/ctp_mapping.py`（182 行）production 无 import；`server/models/*`（account/contract/market/options/order.py）Pydantic 模型无生产引用（API 直接返回 dict）；`services/ctp_startup.py:130` `start_ctp_market_connection` 仅测试引用；`services/market_service.py:354` `set_instruments_callback` 仅测试引用；`server/start.py:127` `uvicorn_args` 列表仅用于 print；`server/main.py:176` `config = load_config()` 模块级变量未用。
- 高频开销：`server/ctp_wrapper/callback.py:42-50` SPI 事件日志对每个 `OnRtnDepthMarketData` 构造 dict 追加进 `self.events`（上限 10000），production 从不消费，纯高频 GC 开销。

**修复方案**：

1. 删除/标注死代码（保留 models 若计划未来使用需注释说明）。
2. SPI 事件日志加开关（默认关闭），或 production 关闭、仅调试开启。

**涉及文件**：

```
server/utils/ctp_mapping.py        # 角色A — 删除或标注
server/services/ctp_startup.py     # 角色A — 死函数
server/services/market_service.py  # 角色A — 死函数
server/start.py                    # 角色A — uvicorn_args
server/main.py                     # 角色A — config 变量
server/ctp_wrapper/callback.py     # 角色A — 事件日志开关
```

**验收标准**：

- [ ] 无未调用函数/未使用导入（pytest + grep 验证）
- [ ] 行情回调无每 tick dict 分配（性能观察）
- [ ] 全部测试通过

**相关测试**：

- [ ] 既有测试全量通过

---

### PR-C29: 前端死代码清理

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C29 |
| **PR标题** | 前端死代码清理 — 未引用映射函数与 API 函数 |
| **PR分支名** | `fix/consistency-c29-frontend-cleanup` |
| **负责角色** | 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔵 |
| **严重等级** | 🔵 改进 |
| **状态** | ⏳ 待开始 |

**问题描述**：

- `frontend/src/utils/orderMapping.ts:81-91` `fromCtpDirection/fromCtpOffsetFlag/fromCtpOrderStatus` 生产零引用（仅 `orderMapping.test.ts` 引用）。
- `frontend/src/services/api.ts` `getOrders`(:368)、`getTrades`(:443)、`getContracts`(:494)、`refreshPresetInstruments`(:209) 仅 `api.test.ts` 引用；查询面板实际用 POST `refresh*` 变体。

**修复方案**：

删除或注释这些仅测试引用的函数；若保留需注明。

**涉及文件**：

```
frontend/src/utils/orderMapping.ts  # 角色B — 3 个映射函数
frontend/src/services/api.ts        # 角色B — 4 个 API 函数
frontend/src/utils/orderMapping.test.ts # 角色B — 同步删除对应用例
```

**验收标准**：

- [ ] grep 确认无生产引用
- [ ] 前端测试通过

**相关测试**：

- [ ] 既有测试全量通过

---

### PR-C30: CTP 地址/环境配置文档同步

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C30 |
| **PR标题** | CTP 地址与环境变量文档同步（30011/30001 + CTP_* 变量名） |
| **PR分支名** | `fix/consistency-c30-ctp-docs` |
| **负责角色** | 文档修改（直接修改） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🔴-6 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

commit `b5342cb` 将默认环境改为标准仿真（30011/30001）后，以下文档未同步且互相矛盾：

- `docs/specs/design.md:99-102` 地址表只有 10130/10131 与 40001/40011，**无 30011/30001**。
- `docs/specs/design.md:1469-1470` .env 示例变量名是废弃的 `SIMNOW_MD_FRONT`/`SIMNOW_TD_FRONT`（实际是 `CTP_*`），地址是已废弃的第一套 10130/10131。
- `server/.env.sample:8,11` 默认 `CTP_MD_FRONT=40011`/`40001`，与 `config.py:35,38` 默认 `30011/30001` 冲突；按 README「cp .env.sample .env」后直接 `uvicorn main:app`（不走 start.py）会连 7x24 而非标准仿真。
- `server/.env.sample:25,29` 注释「工作日 09:00-16:00 / 16:00-次日09:00」与 `start.py:57-74` 精确时段（日盘 09:00-10:15/10:30-11:30/13:30-15:00 + 夜盘 21:00-02:30）不符。
- `README.md:220-222` 旧时段逻辑过时。

**修复方案**：

1. design.md 地址表补 PRIMARY 30011/30001，注明 start.py 按时段切换。
2. design.md 7.4 .env 示例改 `CTP_*` 变量名 + 正确地址。
3. `.env.sample` 默认值对齐 config.py（30011/30001）或注明 start.py 会覆盖。
4. README 时段描述对齐 `start.py` 文档。

**涉及文件**：

```
docs/specs/design.md   # 地址表、.env 示例
server/.env.sample     # 默认值与注释
README.md              # 时段逻辑
```

**验收标准**：

- [ ] design.md / .env.sample / README 与 config.py + start.py 实际行为一致
- [ ] 无 SIMNOW_* 残留

---

### PR-C31: 规格文档同步批量

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C31 |
| **PR标题** | 规格文档同步 — 测试数量、查询面板、端点、响应格式、models、WS 协议 |
| **PR分支名** | `fix/consistency-c31-specs-sync` |
| **负责角色** | 文档修改（直接修改） |
| **依赖PR** | 无 |
| **来源** | 全库五维审查 2026-08-12 🟡-2~🟡-7/🔵 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

- **测试数量过时且互相矛盾**：CLAUDE.md「108/469」vs README「711/809」，实际 728/1143。
- **prd F3.5/F3.6 报价/合约查询**（`prd.md:102-103`、`design.md:164-165`、`dev.md:115-116,213-214`）前端 Tab 已删（`QueryPanel.tsx:10-16` 只有 5 个 Tab），后端接口仍在（`/api/market/depth` market.py:214、`/api/query/contracts` query.py:193）。
- **design.md 缺 `GET /api/market/options/underlyings`**（`market.py:258`），`docs/reviews/check03.md:158` 引用行号错误。
- **design.md 7 处接口响应格式不符**：snapshots/options/option_chain/kline/contracts/order_status/cancel_all 实际为包裹结构而非裸数组。
- **dev.md models 类名不符**：`market.py` DepthData 不存在；`order.py` OrderRecord/StopOrder 名不对；`account.py` PositionRecord→PositionInfo；`contract.py` ContractInfo→InstrumentInfo；`options.py` OptionContract→OptionQuote 等。
- **WS 消息协议偏差**：design.md 枚举缺 subscribed/unsubscribed/pong；position_update 实际为包裹结构；dev.md `account_update` 广播不存在（资金靠轮询）。
- **CLAUDE.md 服务清单漏** options_service/query_service/ctp_bridge/ctp_startup/field_mapping/reconnect。

**修复方案**：

按实际代码逐项同步 prd/design/dev/README/CLAUDE.md。

**涉及文件**：

```
docs/specs/prd.md       # F3.5/F3.6 查询面板
docs/specs/design.md    # 端点、响应格式、WS 协议
docs/specs/dev.md       # models 类名、WS 广播
CLAUDE.md               # 测试数量、服务清单
README.md               # 测试数量
docs/reviews/check03.md # 错误引用
```

**验收标准**：

- [ ] 三份规格文档与代码一致
- [ ] 测试数量与实际一致（728/1143）
- [ ] 无过时功能描述残留

---

### PR-C32: 后端测试套件修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-C32 |
| **PR标题** | 后端 15 个失败测试修复（重构同步） |
| **PR分支名** | `fix/consistency-c32-tests` |
| **负责角色** | 角色A（server/） |
| **依赖PR** | PR-C17（TestStatus 2 项） |
| **来源** | 全库五维审查 2026-08-12 🟡-4 |
| **严重等级** | 🟡 不一致 |
| **状态** | ⏳ 待开始 |

**问题描述**：

`python -m pytest tests/ -q` 实测 **15 failed, 713 passed**：

- `TestLogin`（6 个）：仍 `patch("api.connection.connect_ctp")`（`test_connection_api.py:46`），connection.py 已重构为 `connect_trading`（commit `07a08d9`），patch 目标不存在 → AttributeError。
- `TestLogout`（3 个）：断言 `md_api.release.assert_called_once()`（`:177`），但 logout 已改为只断 TD 不断 MD（commit `a39e65a`）。
- `TestStatus`（2 个）：PR #102 回归，见 PR-C17。
- `test_depth_returns_snapshot_depth`：期望 5 档，代码 `api/market.py:236-247` 已改为只返回非零档。
- `test_get_preset_returns_empty_initially`：仓库已有 `data/preset_instruments.json`，测试假设空文件。
- `test_list_stop_orders`：断言 key `"orders"`，API 现返回 `"stopOrders"`（`api/order.py:659`）。

**修复方案**：

逐项按实际行为更新测试断言/ mock 目标，使测试反映当前实现。

**涉及文件**：

```
server/tests/test_connection_api.py # TestLogin/TestLogout 同步新实现
server/tests/test_market_api.py     # depth 非零档
server/tests/test_market_service.py # preset 文件存在
server/tests/test_stop_order_api.py # stopOrders 键名
```

**验收标准**：

- [ ] `python -m pytest tests/ -q` 全部通过（0 failed）
- [ ] 无跳过真实行为的 mock

**相关测试**：

- [ ] 全量后端测试 728 项通过
