# 审查反馈 · 报单弹窗重构 P3（order-popup-redesign-tasks P3）

> 审查窗口：角色B
> 审查分支：`feature/order-popup-p3`
> 任务来源：`docs/tasks/order-popup-redesign-tasks.md`（P3 增强）
> 设计依据：`docs/specs/order-popup-redesign.md`（§3.1 / §4.3 / §4.4 / §4.5 / §5）
> 审查基准：`main...feature/order-popup-p3`（23 文件，+1729/−41，merge-base `ed5e9bb`）
> 审查日期：2026-08-07

## 审查前准备确认

- ✅ 工作区干净（仅 4 个未跟踪的非代码文件：周报脚本/docx）
- ✅ 分支 `feature/order-popup-p3` 基于 main（merge-base = P2 合入点 `ed5e9bb`），无远端对应分支（本地特性分支，`git pull` 不适用）
- ✅ 改动范围：`ContractStepper.tsx/css/test`（新）、`contractStep.ts/test`（新）、`QtyPreset.tsx/css/test`（新）、`myOrders.ts/test`（新）、`MarketDepth.tsx/css/test`（改）、`TradeParams.tsx/css/test`（改）、`store.ts/test`（改）、`AccountBar.tsx/css/test`（改，P3-7 资金明细）、`api.ts`（改，ReverseResponse.message）、任务文件（改）
- ✅ 保留文件确认：`OrderForm.tsx` / `DepthQuote.tsx` / `OrderQuotePanel.tsx` 均未改动；`OrderPopup.tsx`（P2 产出）未改动
- ✅ 回退安全确认：`OrderTradeBody` 双栏结构沿用 P1，P3 新组件仅挂载于参数区/盘口内，不影响标签页
- ✅ 前端全量复验：**1039 passed / 94 files**（与任务文件声明一致，已复跑）
- ✅ `npx tsc --noEmit`：仅报 `src/hooks/debug-drag-accumulate.test.ts` 3 处错误（`main` 的 vtable 分支 debug 提交引入，**非 P3 引入**，文件不在 P3 diff 内）——与任务文件声明一致

---

## 审查维度结论（总览）

| 维度 | 结论 |
|---|---|
| 功能正确性 | 🔴 1 项（确认按钮双击重复报单，防重入缺失） |
| 测试质量 | 🟡 1039 全绿但无「双击确认」与「未提交改价直接买卖」用例；纯逻辑层（myOrders/contractStep/QtyPreset）覆盖扎实 |
| 代码质量 | 🟡 5 项（pending 提前移除、轮询不尊重 isPaused、改价框未提交路径、下拉字段偏差、下拉自点击关闭） |
| 范围控制 | ✅ 7 项全部落地；推迟项均为任务清单标注「可选」，已注明 |
| 文档同步 | ✅ 任务文件状态/适配说明与代码、git log 三方一致 |
| 潜在风险 | 🟡 双提交、重复轮询、浮点 Map key 等（详见下文） |

---

## 🔴 阻断性问题（必须修复才能合入）

### 🔴-1 确认按钮双击 → 重复报单（`handleConfirm` 无防重入守卫）

**位置**
- `frontend/src/modules/order/MarketDepth.tsx:272-306` — `handleConfirm` 开头仅 `if (!intent) return`；整个 `await submitOrder()` 期间 `intent` 仍非 null（`setIntent(null)` 在 resolve 之后）
- `frontend/src/modules/order/MarketDepth.tsx:345-359` — `ConfirmDialog` 的「确认执行」按钮在提交期间**不禁用**
- `frontend/src/modules/order/store.ts:134` — `submitOrder` 进入后 `set({ isSubmitting: true })`，但**顶部无 `if (get().isSubmitting) return` 重入守卫**

**失败场景**
1. 点档位 → 弹确认框（方向/价格/手数/开平）→ 双击「确认执行」（双击间隔 ~100-200ms 落在首个 submitOrder 的网络等待窗口内）
2. 两次 `handleConfirm` 均通过 `if (!intent)`（intent 尚未置 null）→ 添加两个 pending 条目 + 发起**两次 `submitOrder`** → 同价同量重复报单
3. 若后端双单均被接受 → 用户获得非预期的双倍仓位；若首单成功第二单被拒 → 第二单失败红条 + 残留 pending（第二个 pending 由 10s 兜底清理）

**影响**
- 交易终端中重复报单属真实下单风险。设计 §4.4 明确「同档连续点击节流 150ms；报单进行中该档 pending 态禁止叠加点击」——P3 落地乐观渲染（`setPending`）时未一并落地该防误触保护
- 该缺口 P1 即潜伏（P1 `handleConfirm` 同样无守卫），但 P3 的 pending 机制使「提交期间用户反复点击」更具可见性，属 P3 交付「乐观渲染与失败回滚」应覆盖的防重入范畴

**为何测试没拦住**：`MarketDepth.test.tsx` 乐观渲染用例（`P3-4`）只用 `resolveSubmit` 挂起单次提交，**没有**「提交挂起期间再次点击确认执行」的用例。

**修复方向（供开发窗口定夺）**
- `handleConfirm` 顶部加 `if (useOrderStore.getState().isSubmitting) return`（或本地 `submittingRef` 守卫）
- 或在 `submitOrder` 顶部加 `if (get().isSubmitting) return false`
- 必补测试：submit 挂起期间双击「确认执行」→ `apiSubmitOrder` 仅调用一次、pending 仅一条

---

## 🟡 改进建议（不阻塞合入，建议处理）

### 🟡-1 盘口 pending 档位未禁止叠加点击（确认框关闭后）

- `MarketDepth.tsx:254-270` — `handleBuyClick/handleSellClick` 仅查 `myOrders` 实态量，**不检查该价该向的 pending 量**
- 确认报单成功后 pending 显示，但 `refreshOrders` 是异步的（间隔最长 10s），此窗口内再点同档 → `level.buyVolume > 0` 为 false → 重新弹确认框 → 潜在二次报单
- 设计 §4.4「报单进行中该档 pending 态禁止叠加点击」未实现；建议点击命中 `pendingByPrice` 该价该向 > 0 的档位时忽略/置灰，pending 转实态或 10s 清理后再恢复可点

### 🟡-2 MarketDepth 10s `fetchOrders` 轮询不尊重 `isPaused`

- `MarketDepth.tsx:117-131` — `load()` 循环未读 `useQueryStore.isPaused`；用户暂停查询时仍每 10s 发起一次 CTP 报单流水查询
- 与 P2 🟡-1 已修复的 `AccountBar.tsx:55-56`（暂停挂起本轮）**语义不一致**；弹窗 + 标签页同合约并存时两个 MarketDepth 实例还会产生双轮询
- 建议对齐 AccountBar：`load()` 开头 `if (isPaused) { timer = setTimeout(load, 10_000); return }`

### 🟡-3 pending→实态可能被同价既有挂单提前移除（视觉不连贯）

- `MarketDepth.tsx:147-158` — 只要有同价同向 `level.buyVolume > 0` 即移除该 pending：若该价在报单前已存在历史实态挂单（10s 聚合早已计入），新报单的 pending 会在下一轮 `myOrders` 变化时被**立即移除**，未展示 pending 过渡；若新单随后失败，pending 早已消失（失败红条仍在，但「回滚」视觉缺失）
- 建议判定改为「该价该向挂单相对报单前的**净增量** ≥ pending 量」或按 `orderRef` 关联，而非简单的量 > 0

### 🟡-4 QuickTradeBar 买卖按钮读取未提交的原始 input，不强制走 commit 的 tick 对齐/涨跌停夹紧

- `MarketDepth.tsx:660-673` — `price = parseFloat(input)` 直接 `onBuy(price)/onSell(price)`；`commit()`（tick 对齐 + 涨跌停夹紧）仅在 blur/Enter 触发
- 若用户输入非法价（如超涨停 `4705`）后**直接点「买入」按钮**，依赖「blur 先于 click」的浏览器事件顺序才可能被夹紧——行为脆弱且无测试覆盖
- 建议买卖按钮 onClick 先走同一 `commit(input)` 路径（对齐 + 夹紧）再以对齐后价格报单

### 🟡-5 账户下拉字段与任务清单 #7「可用资金 / 持仓可用」不符

- 任务清单 #7（P2 🔵-2 延后项）明确「列出可用资金 / 持仓可用（设计 §4.2 备注）」
- 实现 `AccountBar.tsx:186-203` 显示 可用资金 / 持仓盈亏 / 动态权益，**缺「持仓可用」**（`AccountInfo` 类型无此字段，`frontend/src/services/types.ts:209-224`）
- 替换字段可理解（AccountInfo 无持仓可用），但属任务规格偏差。建议：确认替换可接受并同步更新任务文件 #7 的字段表述；或补充持仓可用计算来源（若按 position 聚合可得）

### 🟡-6 账户下拉点击面板自身即关闭（portal 不在 `accountAreaRef` 内）

- `AccountBar.tsx:113-125` — `mousedown` 外部关闭判断 `accountAreaRef.current.contains(e.target)`；下拉经 `createPortal` 渲染到 `document.body`，**不属于 `accountAreaRef`** → 点击面板内任一点立即关闭
- 虽为展示型面板（无交互元素）影响较小，但用户无法选中/复制资金数字；建议把 portal 容器 ref 纳入 `contains` 判断，或对 dropdown 本体 `stopPropagation`

---

## 🔵 疑问确认（补充解释即可）

### 🔵-1 「平净仓」实际为「一键反向」（`reversePosition` 平全部持仓 + 反向开仓），非仅平净仓

- `TradeParams.tsx:87-108` 调 `reversePosition({ instrumentID, executionMode: 'serial' })`；后端 `order.py:528-563` 语义为「平掉**全部**当前持仓，再反向开仓」——并非只平**净**持仓（净 = 多−空）
- 按钮标签「平净仓」与真实行为有差异，但确认框警告文案已透明说明（「将平掉当前合约全部净持仓并反向开仓」）。确认此命名差异符合预期即可

### 🔵-2 设计 §4.3「撤全部 = 撤当前合约全部挂单」与实际范围不符

- 设计文档 §4.3 表格写「撤当前合约全部挂单，二次确认」；后端 `cancel_all_orders`（`order.py:205-215`）实际撤**全部合约**的未成交单（`om.cancel_all()`）
- 实现确认框文案「将撤销所有未成交报单（全部合约）」是**正确的**（对齐后端真实行为）；建议同步更新设计文档 §4.3 措辞，避免后续误导

### 🔵-3 价格以浮点作 Map key，违反设计 §4.4「价格以整数 tick 存储…禁止浮点直接比较/运算」

- `myOrders.ts:57` `byPrice.set(o.limitPrice, …)`、`MarketDepth.tsx:152` `myOrders.byPrice.get(p.price)`、`QuickTradeBar.tsx:644` `Math.round(n / tick) * tick` 均为浮点运算
- 快照价与报单流水价经 JSON round-trip 后通常二进制等值，实际匹配风险低，但设计明确要求整数 tick 存储；确认是否本期接受（低风险）或补整数化处理

### 🔵-4 `confirmOpen` 为全局单布尔，弹窗 + 标签页同合约并存时两个实例的 effect 互相覆盖

- `MarketDepth.tsx:196-199` 与 `TradeParams.tsx:51-54` 各自的 effect 都会写 `setConfirmOpen`；同合约下弹窗与标签页各挂一份 `MarketDepth`/`TradeParams`
- 极端场景（标签页确认框打开、弹窗同时挂载）下 Esc 语义可能受影响。常规单窗口使用无问题，确认是否接受此边界

---

## 验收标准对照（P3）

| 验收标准 | 结论 | 说明 |
|---|---|---|
| 盘口挂单可撤 | ✅ | `myOrders` 聚合 + 点击含挂单档位撤该档（`cancelLevel`）；买/卖双向测试覆盖 |
| 报单失败回滚正确 | ✅ | pending 移除 + 顶部红条（`lastSubmitError` 贯通）；失败回滚/成功转实态测试覆盖 |
| 步进切月正确 | ✅ | `contractStep` 月份 ±1（跨年进位）+ 品种序列；12 个纯逻辑用例 + 8 个组件用例 |
| 大额/撤全部/平净仓均强制确认 | ✅ | 撤全部/平净仓弹 `ConfirmDialog` 强制确认（测试覆盖确认/取消两路径）；「大额」因**每次点价必弹确认**（更强约束）而隐含满足 |

**推迟项确认**：QtyPreset 右键自定义预设、盘口长按/右键菜单（撤该档/改价/反手）均为任务清单标注「可选」，任务文件已注明推迟——✅ 范围控制正确。

**实现适配说明核对**：
- 「pending→实态 10s 兜底清理」（`MarketDepth.tsx:294-298`）与代码一致 ✅
- 「平净仓市价串行、后端自动取保护价」（`TradeParams.tsx:91-94` + 后端 `closePriceType/openPriceType` 默认 `"1"` 市价）与代码一致 ✅

---

## 测试质量

- ✅ 纯逻辑层扎实：`contractStep.test.ts`（12）、`myOrders.test.ts`（8）、`QtyPreset.test.tsx`（5）、`store.test.ts` lastSubmitError（4）
- ✅ 组件集成覆盖：`MarketDepth.test.tsx` P3-3 五档挂单 + P3-4 乐观渲染（3 项）、`TradeParams.test.tsx` 操作按钮 8 项 + 步进集成、`AccountBar.test.tsx` 资金明细 3 项、`ContractStepper.test.tsx` 8 项
- ✅ 全量复验 **1039 passed / 94 files**
- ✅ `tsc --noEmit` 无 P3 新增错误（仅 main 既有 debug-drag 3 处）
- ❌ 🔴-1 缺口：无「提交挂起期间再次点击确认执行」防重入用例
- ❌ 🟡-4 缺口：无「输入非法价未 blur 直接点买卖按钮」用例

---

## 文档同步

- ✅ 任务文件状态行「开发完成，待审查」+ 开发完成说明（推迟项 + 实现适配）与 git log（`fa5ecc1`）一致
- ✅ 提交信息按阶段标注（`task-order-popup-p3`）
- ⚠️ 🔵-2 设计文档 §4.3「撤全部 = 当前合约」措辞与实际（全部合约）不符，建议同步

---

## 审查结论

**不通过（存在 1 项 🔴 阻断性缺陷）**

P3 七项任务实现完整、1039 单测全绿、纯逻辑与组件测试覆盖充分、范围控制与文档同步良好，但存在：
- 🔴-1 `handleConfirm` 无防重入守卫，确认按钮双击可在首个提交等待窗口内发起**两次报单**；设计 §4.4「pending 态禁止叠加点击」的防误触保护随乐观渲染一并落地但未实现该守卫。

请开发窗口修复 🔴-1（单独 commit，含防重入测试），并酌情处理 🟡-1~6 与 🔵-1~4 答复。处理后重新提交二次审查。

---

# 第二轮审查（2026-08-07）

> 修复提交：`ee23916`（🔴-1 + 🟡-1~4,6 代码修复 + 8 例测试）、`baae84d`（review-reply + 设计文档 §4.3 + 任务文件 #7 + 状态行）
> 复验基线：`fa5ecc1` 起 HEAD（27 文件，+2059/−65）

## 逐条复验

| 反馈 | 处理 | 复验结论 |
|---|---|---|
| 🔴-1 确认按钮双击重复报单 | `confirmBusyRef` 同步锁（提交期间双击直接忽略，不依赖渲染时序）+ `ConfirmDialog` `busy` prop（提交期间禁用 确认/取消、Esc 不取消）+ `finally` 释放锁 | ✅ 通过。测试真实双击（提交挂起期间连续两次 click「确认执行」）→ `submitSpy` 仅调用 1 次；`ConfirmDialog` busy 用例覆盖按钮禁用 + Esc 不取消 |
| 🟡-1 pending 档位禁止叠加点击 | `handleBuyClick/handleSellClick` 追加 `pendingByPrice` 该价该向 > 0 → 忽略点击 | ✅ 通过。测试：pending 显示期间再点同档 → 确认框仍 1 个、`submitOrder` 仅 1 次 |
| 🟡-2 轮询尊重 isPaused | `MarketDepth` `load()` 开头读 `isPaused`，暂停挂起本轮（对齐 AccountBar） | ✅ 通过。测试：`isPaused=true` + advanceTimers 10s → `refreshOrders` 未调用 |
| 🟡-3 pending 被同价既有挂单提前移除 | `PendingOrder` 加 `baseline`（报单前该价该向既有量），转实态判定改净增量 `vol − baseline ≥ volume` | ✅ 通过。测试：既有卖一 2 手 + 新卖 3 手 → 聚合未变时 pending 保留；刷新后净增量 3 ≥ 3 → pending 移除、实态徽标 5 手 |
| 🟡-4 买卖按钮未走 tick 对齐/夹紧 | 提取 `align(raw)`（解析→对齐→夹紧），`handleBuy/handleSell` 先 `align` 再报单；blur/Enter `commit` 复用 | ✅ 通过。测试：超涨停 `4705` 未 blur 点买入 → `onBuy(4700)`；`4696.55` 未 blur 点卖出 → `onSell(4696.6)` |
| 🟡-5 账户下拉字段与任务#7 不符 | 任务文件 #7 表述同步为「可用资金 / 持仓盈亏 / 动态权益」（注明 AccountInfo 无持仓可用字段） | ✅ 通过（文档处理，与实现一致） |
| 🟡-6 下拉点击面板自身关闭 | `dropdownRef` 纳入 portal 容器，外部关闭判断「账户区 或 下拉面板」contains | ✅ 通过。测试：点击下拉面板自身 → 保持打开 |
| 🔵-1 平净仓实为一键反向 | 确认保留，理由：确认框已透明说明 + 符合任务#5「确认 + reversePosition」 | ✅ 接受 |
| 🔵-2 撤全部范围与设计不符 | 设计文档 §4.3 措辞同步为「全部合约，后端 `cancel_all` 语义」 | ✅ 通过 |
| 🔵-3 价格浮点 Map key | 本期接受（round-trip 等值 + P1 全局约定，后续统一整数化） | ✅ 接受 |
| 🔵-4 confirmOpen 全局单布尔 | 接受边界（P1/P2 已约定，常规使用无影响） | ✅ 接受 |

## 复验结果

- ✅ 前端全量回归：**1047 passed / 94 files**（复跑确认，与回复声明一致）
- ✅ `npx tsc --noEmit`：仅 main 既有 `debug-drag-accumulate.test.ts` 3 处错误（vtable 分支 debug 提交引入，非 P3，文件不在 P3 diff 内）——**无 P3 新增错误**
- ✅ 保留文件（OrderForm / DepthQuote / OrderQuotePanel）未改动；后端无改动（108 单测不受影响）
- ✅ 文档同步：任务文件 P3 状态「修复完成，待二次审查」与 git log 一致

## 二轮新增观察（🔵，不阻塞）

- `ConfirmDialog` 新增可选 `busy` prop，默认 `undefined` → 既有调用方（OrderPanel / AccountBar 锁仓 / TradeParams 撤全部·平净仓）行为不变，无回归。
- 🟡-3 测试通过「价格列点击 → QuickTradeBar → 卖按钮」路径绕过「点击既有挂单档即撤单」的冲突，测试设计合理。

## 二轮审查结论

**✅ 通过（建议合入）**

🔴-1 已修复并含真实双击防重入测试；🟡-1~4,6 全部落地且各有针对性用例，🟡-5 与 🔵-2 文档已同步；🔵-1/3/4 答复理由充分。复验 1047 全绿 + tsc 无 P3 新增错误。P3 可进入人工验证。

> 提示：任务文件 P3 状态现为「修复完成，待二次审查」，人工验证通过后更新为「人工验证通过，待收尾」。
