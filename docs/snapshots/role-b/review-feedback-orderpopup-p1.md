# 审查反馈 · 报单弹窗重构 P1（task-order-popup-p1）

> 审查窗口：角色B
> 审查分支：`feature/order-popup-p1-depth`
> 任务来源：`docs/tasks/order-popup-redesign-tasks.md`（自定义任务文件）
> 审查基准：`main...feature/order-popup-p1-depth`（13 文件，+2259/−22）
> 审查日期：2026-08-06

## 审查前准备确认

- ✅ 工作区干净（仅 4 个未跟踪的非代码文件：周报脚本/docx）
- ✅ 前端全量回归复验：**928 passed / 85 files**（与最近提交「全量 928 回归全绿」声明一致）
- ✅ 改动范围：`MarketDepth.tsx/css/test`（新）、`TradeParams.tsx/css/test`（新）、`OrderPopup.tsx/css/test`（改）、`ConfirmDialog/index.tsx`（+1 data-testid）、`docs/specs/order-popup-redesign.md`（新）、`docs/tasks/order-popup-redesign-tasks.md`（新）、`snapshots/role-a/dev-record-a.md`（新）
- ✅ 保留文件确认：`OrderForm.tsx` / `DepthQuote.tsx` / `OrderQuotePanel.tsx` 均未改动
- ✅ 回退安全确认：`OrderPopup.css` 保留 `.order-popup__quote`/`__form` 类，`OrderPage` 浮动模式经 `.order-floating` 作用域覆盖回 5fr/7fr 布局，内容仍为 `OrderQuotePanel`+`OrderForm`，视觉不回退

---

## 审查维度结论（总览）

| 维度 | 结论 |
|---|---|
| 功能正确性 | 🔴 1 项（核心闭环多笔场景中断） |
| 测试质量 | 🟡 缺连续两单真实 submitOrder 路径覆盖；其余充分（928 全绿） |
| 代码质量 | 🟡 3 项（价格精度、DRY、改价框跟随） |
| 范围控制 | ✅ P1 七项任务全部落地，无越界 |
| 文档同步 | 🟡 任务文件缺状态列、验收数字滞后（469→928） |
| 潜在风险 | 🟡 见 🔴-1 / 🟡-1 |

---

## 🔴 阻断性问题（必须修复才能合入）

### 🔴-1 连续点价报单：第一单成功后第二单必失败「请选择合约」

**位置**
- `frontend/src/modules/order/store.ts:137` — submitOrder 成功后 `set({ orderForm: { ...DEFAULT_ORDER_FORM }, isSubmitting: false })`，把 `instrumentID` 重置为 `''`、`volumeTotalOriginal` 重置为 1
- `frontend/src/modules/order/OrderPopup.tsx:38-40` — `instrumentID → setOrderForm({ instrumentID })` 同步 effect，依赖 `[instrumentID, setOrderForm]`，弹窗会话内两者都不变 → **不会重新触发**
- `frontend/src/modules/order/MarketDepth.tsx:152-173` — `openIntent`/`handleConfirm` 组装的 `OrderIntent` 不含 `instrumentID`，确认后 `submitOrder()` 读到的 form.instrumentID 已是 `''`

**失败场景**
1. 打开弹窗（IF2608），点买档 → 确认 → 报单成功（`submitOrder` 将整个 orderForm 重置为 DEFAULT，instrumentID=''）
2. 再次点任意档 → 确认框（此时手数已回 1）→ 确认 → `submitOrder` 内 `if (!submitForm.instrumentID)` → toast「报单失败：请选择合约」，返回 false
3. 此后所有点价报单全部失败，直到用户关闭并重开弹窗

**连带影响**
- 设计 §5「手数记忆：切换合约保留上次手数与开平方式」失效（每次成功报单后手数/开平/有效期/投保全部回默认值）
- `TradeParams` 合约查找失败（`orderForm.instrumentID=''` → productClass 回退 `'1'`），期权合约上限提示错误显示「最大 500 手」

**为何测试没拦住**：`MarketDepth.test.tsx` 的「确认→提交」用例（L423-435）用 `submitSpy` 替换了真实 `submitOrder`，未走真实 store 的「成功→重置」路径；`OrderPopup.test.tsx` 也未做连续两单场景。

**修复方向（供开发窗口定夺）**
- 方案 A：`submitOrder` 成功重置时保留交易上下文，如 `{ ...DEFAULT_ORDER_FORM, instrumentID: submitForm.instrumentID, exchangeID: submitForm.exchangeID, combOffsetFlag, combHedgeFlag, timeCondition, volumeTotalOriginal }`（满足「手数记忆」）
- 方案 B：弹窗层在报单成功后主动 `setOrderForm({ instrumentID })` 重新同步（需考虑「手数记忆」仍被方案 A 覆盖，否则手数仍回 1）
- 必补测试：真实 `submitOrder` 成功路径下的**连续两单**集成用例（第一次成功 → 第二次仍能发起且参数保持）

---

## 🟡 改进建议（不阻塞合入，建议处理）

### 🟡-1 改价框被行情 tick 持续覆写，手动改价无法保持

- 位置：`MarketDepth.tsx:112-120`
- `quickDefault = useMemo(..., [snapshot])` + `useEffect(..., [quickDefault])` 在**任何** snapshot 更新且 askPrice1 变化时重置 `quickPrice`。WS 约每 500ms 推一条，用户手动输入改价、或点价格列（`onPriceClick={setQuickPrice}`）后，下一条 tick 即被覆盖回对手价，「可改价即限价单」（设计 §4.5）基本不可用。
- 建议：仅首帧/合约变更时初始化默认价，引入 `hasTouched` 标志——用户改价或点价格列后停止自动跟随；或仅在 `quickPrice === 0` 时同步。

### 🟡-2 价格列展示未按 tickSize 还原，真实档与合成档精度不一致

- 位置：`MarketDepth.tsx:354`（`priceText = level.valid ? String(level.price) : ...`）、`:181`（`lastText = String(last)`）
- 真实挂单价 `4696.0` 显示为「4696」，与合成档「4696.6」、确认框/改价框「4696.0」精度不一致，破坏 `tabular-nums` 列对齐（设计 §6「数字统一等宽 + tabular-nums 保证对齐」「展示时按 tickSize 还原」）；真实价直接 `String()` 也有浮点残留风险（设计 §4.4「禁止浮点直接比较/运算」）。
- 建议：统一 `formatTickPrice(level.price, tick)` 渲染所有档位价格与最新价，真实档与合成档同一精度。

### 🟡-3 数量上限规则三处重复定义（DRY）

- 位置：`TradeParams.tsx:31-33` 与 `validators.ts:44-47` 各自实现「市价 60/限价 500/期权 30/100」，`OrderForm.tsx:40-43` 还有第三处。三处一旦不同步即规则漂移。
- 建议：把上限规则抽为共享常量/纯函数（如 `getVolumeLimit(orderPriceType, productClass)`），三处统一引用。

### 🟡-4 TradeParams 手数 `+` 步进不受上限约束

- 位置：`TradeParams.tsx:120`（`onClick={() => setOrderForm({ volumeTotalOriginal: orderForm.volumeTotalOriginal + 1 })}`）
- `+` 可一直加到 999+，错误提示虽然展示但值不封顶。与 OrderForm 现状一致，但 TradeParams 已展示「最大 X 手」，建议 `+` 达上限时禁用（可随 🟡-3 一起处理）。

---

## 🔵 疑问确认（补充解释即可）

### 🔵-1 确认框弹出期间按 Esc 关闭整个弹窗而非取消确认

- `OrderPopup.tsx:93-100` 全局 Esc 监听优先于 `ConfirmDialog`。确认框打开时按 Esc → 整个弹窗关闭（确认框随之消失），未下任何单。是否期望 Esc 先取消确认框？

### 🔵-2 快照为空时 QuickTradeBar 整体隐藏而非灰化禁用

- `MarketDepth.tsx:122-124` 快照为空时早退返回 `--`，QuickTradeBar 不渲染。设计 §4.4「断线 → 组件灰化、禁用点价」。
- 隐藏 vs 禁用是刻意的吗？（断线场景下用户看不到改价框，视觉一致性可再斟酌）

### 🔵-3 tick 合成兜底档位可点价报单

- `MarketDepth.tsx:371` `clickable = level.valid || level.fallback !== null`。无真实盘口（价=0/DBL_MAX）时，点合成价档会以合成价报单。这是「所见即所下」的刻意选择，还是合成档应禁用下单？

### 🔵-4 涨跌为 0 时显示 `+0.0`

- `MarketDepth.tsx:145` `(diff >= 0 ? '+' : '')`，平盘显示「+0.0」而非「0.0」。是否预期？

---

## 文档同步

- 🟡 任务文件 `order-popup-redesign-tasks.md` **无 PR 状态列**（不同于 task.md 的逐 PR 状态），P1 状态只体现在 `snapshots/role-a/dev-record-a.md` 中。审查/交接流程依赖任务文件状态，建议为 P1-P4 增加状态列，或将当前状态明确为「P1 开发完成，待审查」。
- 🟡 任务文件 P1 验收标准写「前端 469 单测全绿」，实际 **928**（复验通过），需同步数字。
- ✅ 分支提交按任务文件「提交信息标注 PR 号或阶段」约定，标注 `task-order-popup-p1`（阶段）符合要求。

---

## 测试质量

- ✅ 覆盖充分：`MarketDepth.test.tsx`（26 用例：三列语义、tick 合成、量能条、QuickTradeBar、确认闭环）、`TradeParams.test.tsx`（10 用例：下拉映射、上限校验）、`OrderPopup.test.tsx` 回归更新。
- ✅ 全量复验 928 passed / 85 files。
- ❌ 🔴-1 缺口：无「连续两单 + 真实 submitOrder」覆盖（详见 🔴-1）。

---

## 审查结论

**不通过（存在 1 项 🔴 阻断性缺陷）**

P1 七项任务实现完整、测试全绿、范围控制良好、回退安全成立，但核心报单闭环存在「连续点价第二单必失败」的硬缺陷（`submitOrder` 成功后重置表单 + 弹窗不重新同步 instrumentID），直接破坏 P1 验收「点档位弹确认 → 确认后报单成功」的多笔场景与设计「手数记忆」要求。

请开发窗口处理 🔴-1（含补测试），并酌情处理 🟡-1~4 与 🔵-1~4 答复。处理后重新提交二次审查。

---

# 第二轮审查（2026-08-06）

> 修复提交：`0c4f5bf`（fix 🔴-1~🟡-4）、`0657282`（docs 状态 + 回复）
> 复验基线：`0c4f5bf` 起 HEAD

## 逐条复验

| 反馈 | 处理 | 复验结论 |
|---|---|---|
| 🔴-1 连续两单第二单失败 | 方案 A：成功保留 合约/开平/投保/有效期/手数，仅清空价格；用 `form` 而非 `submitForm` 规避套利 SPD 虚拟合约写回 | ✅ 通过。`store.ts:137-150` 正确；「连续两单真实 submitOrder 集成用例」（`MarketDepth.test.tsx`）覆盖了成功→保留→第二单发起全链路 |
| 🟡-1 改价框被 tick 覆写 | `prevInstrRef` 合约变更重置 + `quickPrice === 0` 哨兵 | ✅ 通过。效果执行顺序经推演无竞态；「改价后 tick 不覆写 + 切合约重新跟随」用例覆盖 |
| 🟡-2 价格列精度 | 真实档/合成档统一 `formatTickPrice`，`lastText` 同处理 | ✅ 通过。测试断言同步更新（4696→4696.0） |
| 🟡-3 上限规则三处重复 | `validators.ts` 新增 `getVolumeLimit` 单一事实来源 | ✅ 通过。TradeParams / OrderForm / validateVolumeWithLimit 三处统一引用 |
| 🟡-4 手数 `+` 越界 | 达上限禁用 + `Math.min` 双保险封顶 | ✅ 通过。新增封顶用例 |
| 🔵-1 Esc 关闭整个弹窗 | 答复：承认体验问题，提议 P2 引入 `popupStore.confirmOpen` | ✅ 接受（本期未实现，已明确延后理由与方案，不阻塞） |
| 🔵-2 空快照隐藏 QTB | 答复：刻意选择空态 `--`；QTB 内部已有 `disabled={!snapshot}` | ✅ 接受 |
| 🔵-3 合成档可点价 | 答复：刻意「所见即所下」+ 必弹确认 | ✅ 接受 |
| 🔵-4 平盘显示 `+0.0` | `diff > 0` 判断，平盘 `0.0` | ✅ 通过 |

## 复验结果

- ✅ 前端全量回归：**932 passed / 85 files**（复验确认，与回复声明一致）
- ✅ `tsc --noEmit` exit 0（复验确认）
- ✅ 文档同步：任务文件 `order-popup-redesign-tasks.md` 已加状态列（P1 待二次审查）、验收数字 469→932；review-feedback / review-reply 均已入仓
- ✅ 修复未改保留文件（OrderForm/DepthQuote/OrderQuotePanel）

## 二轮新增观察（🔵，不阻塞）

- `MarketDepth.tsx` 哨兵 `quickPrice === 0` 下：若快照存在但 卖一/最新价 均无效（`quickDefault === null`），`quickPrice` 保持 0，QTB 的 `canTrade`（`parseFloat("0.0")` 有限 + volume≥1 + snapshot 非空）为 true，买卖按钮可点但会以价格 0 发起 → `submitOrder` 校验「请输入有效价格」拒绝。属边缘场景且修复前同样存在（初始态即 0），建议后续在 `canTrade` 增加 `quickPrice > 0` 约束，本期不强制。

## 二轮审查结论

**✅ 通过（建议合入）**

🔴-1 已修复并有真实 `submitOrder` 集成用例兜底；🟡-1~4 全部落地；🔵-1~4 已答复或修复。复验 932 全绿 + tsc 干净。P1 可进入人工验证。

> 提示：任务文件 P1 状态现为「待二次审查」，人工验证通过后更新为「人工验证通过，待收尾」。
