# Task3: 交易指令合规性修复

> 本文档记录交易指令合规性审查发现的问题及修复计划。
> 按 PR 逐个修复，实时记录完成进度。

---

## 问题总览

| # | 优先级 | 问题 | 状态 |
|---|--------|------|------|
| 1 | 🔴 P0 | 市价指令缺少保护价输入 | ✅ 已完成 |
| 2 | 🔴 P0 | 市价指令数量无上限校验 | ✅ 已完成 |
| 3 | 🔴 P0 | 限价指令数量无上限校验 | ✅ 已完成 |
| 4 | 🔴 P1 | 保护价缺少涨跌停/最小变动校验 | ✅ 已完成 |
| 5 | 🟡 P2 | 止损单触发不支持市价 | ✅ 已完成 |
| 6 | 🟡 P2 | 止损单缺 exchangeID | ✅ 已完成 |
| 7 | 🟡 P3 | 套利指令未实现 | ⏳ 待开始 |
| 8 | — | 市价转限价状态展示（CTP 柜台行为） | ❌ 不需要实现 |
| 9 | 🟢 P4 | 投保"套利"与套利指令易混淆 | ✅ 已完成 |
| 10 | 🟢 P5 | TAS 指令未实现 | ⏳ 待开始 |
| 11 | 🟢 P5 | 合约信息缺少品种类型判断 | ✅ 已完成 |

---

## PR 拆分

### PR-A: 交易指令合规性校验修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-A |
| **PR标题** | 交易指令合规性校验修复 — 保护价/数量上限/涨跌停/止损市价/exchangeID |
| **PR分支名** | `fix/trade-compliance` |
| **负责角色** | 角色A（server/）+ 角色B（frontend/） |
| **依赖PR** | 无 |
| **来源** | 交易指令合规性审查 |
| **严重等级** | 🔴 P0 ~ 🟢 P4 |
| **状态** | ✅ 已完成 |
| **包含问题** | #1, #2, #3, #4, #5, #6, #9, #11 |

**涉及文件**：

| 文件 | 改动说明 |
|------|----------|
| `frontend/src/modules/order/OrderForm.tsx` | 市价时显示"保护价"输入框 + tooltip；数量上限 hint；投保"套利"加 title |
| `frontend/src/modules/order/StopOrderForm.tsx` | 增加"触发类型"切换（限价/市价）；市价时显示保护价；投保"套利"加 title |
| `frontend/src/utils/orderMapping.ts` | `convertOrderRequest()` 增加 `stopPrice` 字段 |
| `frontend/src/utils/validators.ts` | 增加 `validateVolumeWithLimit()` 函数 |
| `frontend/src/stores/order/store.ts` | `submitOrder()` 增加保护价校验 + 数量上限校验 + 涨跌停校验 |
| `frontend/src/services/types.ts` | `StopOrderRequest` 增加 `triggerPriceType` 字段 |
| `frontend/src/services/api.ts` | `submitStopOrder` 参数增加 `triggerPriceType` |
| `server/api/order.py` | `InsertOrderRequest` 增加 `stopPrice` 字段 + `volumeTotalOriginal` 校验器；`SubmitStopOrderRequest` 增加 `triggerPriceType` |
| `server/services/order_manager.py` | `insert()` 透传 `stop_price` 参数 |
| `server/services/stop_order.py` | `StopOrder` 增加 `trigger_price_type` 字段；`_trigger_order()` 使用该字段；补充 `exchange_id` |

**修复详情**：

#### 问题 1：市价指令缺少保护价（P0）

现状：选择"市价"时价格输入框被隐藏，CTP 的 StopPrice 字段为 0。
违反规则：交易所要求"市价指令必须填写保护价"。

修复链路：
```
前端 stopPrice → orderMapping → POST /api/order/insert
  → InsertOrderRequest → OrderManager.insert(stop_price=...)
    → TraderApi.insert_order(stop_price=...) → CTP order.StopPrice
```

- [x] OrderForm.tsx：市价时显示"保护价"输入框（用 usePriceStep 对齐 priceTick），加 tooltip 说明
- [x] order/store.ts：submitOrder() 增加市价单保护价 > 0 校验
- [x] orderMapping.ts：convertOrderRequest() 增加 stopPrice 字段（已有，无需改动）
- [x] api/order.py：InsertOrderRequest 增加 stopPrice: float = Field(default=0.0, ge=0.0)
- [x] order_manager.py：insert() 透传 stop_price 到 trader_api.insert_order()（已有，无需改动）
- [x] trader_api.py：已有 order.StopPrice = stopPrice，无需改动

UI 效果：选择"限价"→ 显示"价格"输入框；选择"市价"→ 显示"保护价"输入框 + 说明文字。

#### 问题 2 & 3：报单数量上限校验（P0）

现状：数量输入只有 min={1}，无上限。
违反规则：市价期货≤60手/期权≤30手；限价期货≤500手/期权≤100手。

- [x] validators.ts：增加 `validateVolumeWithLimit(volume, orderType, productClass)` 函数
- [x] order/store.ts：submitOrder() 提交前调用校验
- [x] api/order.py：InsertOrderRequest 增加 `productClass` 字段 + `@field_validator("volumeTotalOriginal")` 校验器

#### 问题 4：保护价涨跌停校验（P1）

现状：无涨跌停范围校验，无最小变动价位对齐。
违反规则：保护价必须在涨跌停板价格范围内，且为最小变动价位的整数倍。

- [x] order/store.ts：submitOrder() 中从行情快照获取 upperLimitPrice/lowerLimitPrice 做范围校验
- [x] OrderForm.tsx：保护价输入用 usePriceStep 对齐 priceTick

#### 问题 5：止损单支持市价触发（P2）

现状：stop_order.py 硬编码 price_type="2"（限价）。

- [x] stop_order.py：StopOrder 增加 trigger_price_type 字段（"1"=市价/"2"=限价）
- [x] stop_order.py：_trigger_order() 使用 trigger_price_type 字段
- [x] api/order.py：SubmitStopOrderRequest 增加 triggerPriceType: str = Field(default="2")
- [x] StopOrderForm.tsx：增加"触发类型"切换（限价/市价），市价时显示保护价输入框
- [x] api.ts：submitStopOrder 参数增加 triggerPriceType
- [x] types.ts：StopOrderRequest 增加 triggerPriceType

#### 问题 6：止损单缺 exchangeID（P2）

现状：止损单触发后调用 OrderManager.insert() 时 exchange_id=""，非 CFFEX 合约会被拒绝。

- [x] stop_order.py：_trigger_order() 从 StopOrder 中获取 exchange_id 并传入 insert()（已有 exchange_id 参数，已透传）

#### 问题 9：投保"套利"标签重命名（P4）

现状：OrderForm 有"投机/套利/套保"三个选项，"套利"指套利保证金优惠，易与套利指令混淆。
决策：将投保栏"套利"改为"套利优惠"，加 tooltip 说明，避免与报单类型的"套利指令"混淆。

- [x] OrderForm.tsx："套利"按钮文本改为"套利优惠"，加 title="按套利保证金标准计算（非套利指令）"
- [x] StopOrderForm.tsx：同上

#### 问题 11：合约信息缺少品种类型判断（P5）

现状：ContractInfo 有 productClass 字段，但前端数量校验未使用它区分上限。

- [x] validators.ts：validateVolumeWithLimit() 已通过 productClass 参数处理
- [x] OrderForm.tsx：从合约信息获取 productClass 传入校验函数

---

### PR-B: 套利指令 + TAS 占位

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-B |
| **PR标题** | 套利指令支持（CTP原生套利合约）+ TAS 指令占位 |
| **PR分支名** | `feature/arbitrage-tas` |
| **负责角色** | 角色A（server/）+ 角色B（frontend/） |
| **依赖PR** | PR-A（需要数量校验逻辑） |
| **来源** | 交易指令合规性审查 |
| **严重等级** | 🟡 P3 ~ 🟢 P5 |
| **状态** | ⏳ 待开始 |
| **包含问题** | #7, #10 |

**涉及文件**：

| 文件 | 改动说明 |
|------|----------|
| `frontend/src/modules/order/OrderForm.tsx` | "类型"行增加"套利"选项；选择后显示两个 ContractSearch 选择器（腿1/腿2）+ 价差输入 |
| `frontend/src/components/ContractSearch/index.tsx` | 复用现有合约搜索组件，两个实例分别选择腿1和腿2 |
| `frontend/src/utils/validators.ts` | 套利合约格式校验（SP xxx&yyy）；数量按期货标准（限价500/市价60） |
| `frontend/src/utils/orderMapping.ts` | 套利合约映射（生成 SP leg1&leg2 格式，走普通报单流程） |
| `server/api/order.py` | InsertOrderRequest 预留套利相关字段 |

**修复详情**：

#### 问题 7：套利指令（P3）

实现方式：仅支持 CTP 原生套利合约（交易所已定义的套利合约），不支持自定义双腿。

- [ ] OrderForm.tsx：增加"套利"类型选项 + 套利合约输入框（如 SP cu2501&cu2502）
- [ ] validators.ts：套利合约格式校验（SP xxx&yyy 格式）
- [ ] orderMapping.ts：套利合约映射（与普通合约共用报单流程）
- [ ] api/order.py：InsertOrderRequest 预留套利相关字段
- [ ] 数量上限：套利合约按期货标准（限价500手/市价60手）

#### 问题 10：TAS 指令占位（P5）

实现方式：前端 UI 占位 + 后端接口预留，不实现完整逻辑。
原因：TAS 指令仅适用于能源中心原油期货，SimNow 测试环境可能不支持，且当前项目为模拟交易终端，优先级低。

- [ ] OrderForm.tsx：增加"TAS"类型选项（disabled 状态 + tooltip "暂未实现（仅适用于INE原油期货）"）
- [ ] 后端注释说明 TAS 未实现的原因

---

## 验收标准

### PR-A 验收

| 场景 | 预期结果 |
|------|----------|
| 市价单不填保护价 | 前端 toast "请输入保护价" |
| 市价单保护价 = 0 | 前端 toast "请输入保护价" |
| 市价单输入 61 手（期货） | 前端 toast "数量不能超过60手" |
| 市价单输入 31 手（期权） | 前端 toast "数量不能超过30手" |
| 限价单输入 501 手（期货） | 前端 toast "数量不能超过500手" |
| 限价单输入 101 手（期权） | 前端 toast "数量不能超过100手" |
| 保护价超过涨停价 | 前端 toast "保护价不能超过涨停价 X" |
| 保护价低于跌停价 | 前端 toast "保护价不能低于跌停价 X" |
| 保护价非 priceTick 整数倍 | 自动对齐到最近的 priceTick 整数倍 |
| 止损单选"市价触发" | 触发后后端日志 price_type="1" |
| 止损单触发时 exchange_id | 从 StopOrder 中获取，非空 |
| 投保栏"套利优惠"按钮 hover | tooltip 显示"按套利保证金标准计算（非套利指令）" |

### PR-B 验收

| 场景 | 预期结果 |
|------|----------|
| 选择"套利"类型 | 显示两个合约选择器（腿1/腿2）+ 价差输入框 |
| 腿1选择 cu2501，腿2选择 cu2502 | 自动生成合约代码 SP cu2501&cu2502 |
| 只选了一腿就提交 | 前端提示"请选择两腿合约" |
| 两腿合约品种不同 | 前端提示"两腿合约需为同一品种"（跨期套利）或允许（跨品种套利） |
| 选择"TAS"类型 | 按钮 disabled，tooltip 显示"暂未实现（仅适用于INE原油期货）" |
| 投保栏"套利优惠" | tooltip 显示"按套利保证金标准计算（非套利指令）" |

---

## 进度记录

| PR | 状态 | 开始时间 | 完成时间 | 提交commit |
|----|------|----------|----------|------------|
| PR-A | ✅ 已完成 | 2026-07-28 | 2026-07-28 | — |
| PR-B | ⏳ 待开始 | — | — | — |
