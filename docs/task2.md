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
| **状态** | ⏳ 待开始 |

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
| **状态** | ⏳ 待开始 |

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
