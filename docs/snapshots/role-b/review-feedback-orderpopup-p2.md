# 审查反馈 · 报单弹窗重构 P2（order-popup-redesign-tasks P2）

> 审查窗口：角色B
> 审查分支：`feature/order-popup-p2`
> 任务来源：`docs/tasks/order-popup-redesign-tasks.md`（P2 完整态与账户栏）
> 设计依据：`docs/specs/order-popup-redesign.md`（§3.2 / §4.2 / §4.6 / §4.7 / §5）
> 审查基准：`main...feature/order-popup-p2`（14 文件，+910/−19）
> 审查日期：2026-08-06

## 审查前准备确认

- ✅ 工作区干净（仅 4 个未跟踪的非代码文件：周报脚本/docx）
- ✅ 分支 `feature/order-popup-p2` 基于 main，`git pull` 无更新
- ✅ 改动范围：`AccountBar.tsx/css/test`（新）、`QuoteStatsBar.tsx/css/test`（新）、`FooterBar.tsx/css`（新）、`popupStore.ts/test`（改）、`OrderPopup.tsx/css/test`（改）、任务文件状态行（改）
- ✅ 保留文件确认：`OrderForm.tsx` / `DepthQuote.tsx` / `OrderQuotePanel.tsx` 均未改动；`MarketDepth.tsx`/`TradeParams.tsx`（P1 产出）未改动
- ✅ 回退安全确认：`OrderPopup.css` 保留 `.order-popup__*` 类名；`OrderPage` 浮动模式经 `.order-floating` 覆盖仍为 `OrderTradeBody`，P2 新增组件仅挂在 `OrderPopup` 内部，不影响标签页
- ✅ 前端全量复验：**954 passed / 87 files**（与任务文件声明一致）
- ❌ **tsc --noEmit：exit 2**（`AccountBar.tsx:78` 类型错误，见 🔴-2）

---

## 审查维度结论（总览）

| 维度 | 结论 |
|---|---|
| 功能正确性 | 🔴 2 项（锁仓/解锁语义错误；tsc 类型错误阻断构建） |
| 测试质量 | 🟡 954 全绿但掩盖 🔴-2（esbuild 不查类型）；🔴-1 测试编码了错误行为而非校验语义 |
| 代码质量 | 🟡 1 项（锁仓无确认，下单类操作防误触缺口） |
| 范围控制 | ✅ P2 五项任务全部落地，无越界 |
| 文档同步 | ✅ 任务文件状态行正确更新（开发完成，待审查 + 954 单测） |
| 潜在风险 | 🟡 双重轮询频率叠加；P1 🔵-1 承诺的 P2 改进未落地 |

---

## 🔴 阻断性问题（必须修复才能合入）

### 🔴-1 锁仓/解锁开关语义错误：「解锁」实际再次锁仓（重复开反向仓）

**位置**
- `frontend/src/modules/order/AccountBar.tsx:70-83` — `handleLockToggle` 两个方向都调用 `lockPosition({ instrumentID })`，仅翻转本地 `locked` 布尔
- `frontend/src/services/api.ts:336-344` — `lockPosition` 仅 POST `/api/order/lock`，**无解锁参数**
- `server/api/order.py:566-611` — `/api/order/lock` 是**单向锁仓**：「在反方向开同等数量仓位，不平原有持仓」。**后端不存在解锁端点**

**失败场景**
1. 用户有 IF2608 多 5 手，点「锁仓」→ 后端反方向开空 5 手 → toast「已锁仓」，按钮变「解锁」
2. 用户点「解锁」→ 前端再次 `lockPosition({ instrumentID })` → 后端对**当前全部持仓**（多 5 + 空 5）各自反方向开仓 → 再开空 5、再多 5 → **持仓翻倍对冲**，toast 却显示「已解锁」
3. 反复点 → 每次锁仓量按当前总持仓翻倍，产生大量意外委托单

**影响**
- 「解锁」从未真正解锁——用户以为在解除对冲，实际在重复锁仓，交易终端中属严重误导（实际下单）
- 设计 §4.2「锁仓/解锁开关（复用 api.lockPosition）」与 API 能力不匹配：`lockPosition` 只有锁、没有解，前端把「解锁」硬映射到同一接口是语义错误
- 锁仓本身是下单操作，却**无确认框**直接执行（对比设计 §5「撤全部、平净仓同样强制确认」的下单即确认原则）

**为何测试没拦住**：`AccountBar.test.tsx:131-138` 只断言「点击调用 `lockPosition({ instrumentID: 'IF2608' })` + 按钮文字变『解锁』」，**编码了错误行为**——二次点击仍是同一调用，未断言「解锁」不应再次锁仓。

**修复方向（供开发窗口定夺）**
- 方案 A（最小）：去掉「解锁」方向，改为一次性「锁仓」按钮（带确认框，说明会反向开仓）；不提供解锁能力直至后端有真正解锁端点
- 方案 B（完整）：后端补充解锁语义（平掉反向对冲仓），前端据此实现真开关
- 必补测试：断言「解锁」动作不会再次调用 lock / 不会产生重复反向单；锁仓点击前弹确认框

### 🔴-2 tsc 类型错误，`npm run build`（`tsc && vite build`）失败

**位置**
- `frontend/src/modules/order/AccountBar.tsx:78` — `toast.error(\`锁仓失败：${res.message || '未知错误'}\`)`
- `frontend/src/services/api.ts:285-288` — `LockResponse = { success: boolean; orders: OrderResult[] }`，**无 `message` 字段**

**证据**
- `npx tsc --noEmit` → `error TS2339: Property 'message' does not exist on type 'LockResponse'`，exit 2
- `package.json` `"build": "tsc && vite build"` → 生产构建**直接失败**
- 后端 `/api/order/lock` 错误分支确实返回 `{"success": false, "message": error}`（`order.py:581`），运行时能拿到 `message`，但前端类型未声明

**为何测试没拦住**：Vitest 走 esbuild/vite 转译，**不做类型检查**，954 全绿掩盖了类型错误；P2 自验证声明「954 单测全绿」未含 `tsc --noEmit`（P1 二轮审查曾明确以 tsc exit 0 为复验基线，P2 回退）。

**修复方向**
- `LockResponse` 增加 `message?: string`（与 `ReverseResponse` 等错误形态对齐），一行修复

---

## 🟡 改进建议（不阻塞合入，建议处理）

### 🟡-1 AccountBar 与 QueryPanel 双重轮询，未共享 isPaused / isRefreshing 防护

- `AccountBar.tsx:40-58` 独立 10s 轮询（2 查询/约 11.2s 周期，平均 ~0.18/s）；`QueryPanel.tsx:46-57` 独立 `refreshAll`（5 查询/约 14.8s 周期，~0.34/s）
- 弹窗浮于任意标签之上，可与查询标签页**同时存在**：两者独立调度、无同步，周期边界查询可能同秒突发；合计平均 ~0.52/s 逼近 CTP ~1/s 限频
- AccountBar 轮询不尊重 `useQueryStore.isPaused`（用户暂停查询时仍持续拉取）
- 建议：AccountBar 轮询读取 `isPaused`，暂停时挂起；或在弹窗打开且 QueryPanel 已挂载时复用其数据心跳，避免双轮询

### 🟡-2 P1 审查 🔵-1 承诺的 P2 `popupStore.confirmOpen` 未落地

- P1 二轮回复明确「提议 P2 引入 `popupStore.confirmOpen`」解决「确认框弹出期间按 Esc 关闭整个弹窗」
- `OrderPopup.tsx:90-97` Esc 全局监听仍直接 `closePopup()`：确认框打开时按 Esc → **关闭整个弹窗、丢失待确认报单意图**，而非取消确认框
- 若确认框取消语义仍不在本期，请开发窗口说明延后理由与排期

### 🟡-3 锁仓为下单操作但无确认框（防误触缺口）

- 与 🔴-1 同源：锁仓会真实反向开仓，当前点击即执行。建议对齐设计 §5 强制确认原则（方向/数量展示 + 确认），可与 🔴-1 一并处理

---

## 🔵 疑问确认（补充解释即可）

### 🔵-1 QuoteStatsBar 最高/最低固定着色语义

- `QuoteStatsBar.tsx:44-45` 固定「最高 up / 最低 down」着色，与 `OrderQuotePanel.tsx:89-93` 一致
- 设计 §4.6「涨跌方向着色」若指**相对昨结涨跌**，则整日最高价 < 昨结（深跌日）时「最高」仍显示红色，语义可再斟酌。与现有面板一致，属可接受，确认即可

### 🔵-2 账户「下拉」交互范围确认

- 设计 §4.2「账户下拉 YYB-1829143…」注明「下拉列出可用资金/持仓可用」；实现（`AccountBar.tsx:89-91`）仅超长省略 + `title` hover 全称，**无下拉列表**
- 任务清单 P2-1 仅写「账户下拉（超长省略）」。确认：下拉资金明细是否属于 P2 验收？若属，需补交互；若延后，请在任务文件注明

---

## 文档同步

- ✅ 任务文件 `order-popup-redesign-tasks.md` 状态行已更新为「开发完成，待审查（2026-08-06 自验证通过，954 单测全绿）」，与 git log（`c80f72f` 自验证提交）一致
- ✅ 提交信息按「阶段标注」约定（`task-order-popup-p2`），符合任务文件要求
- ⚠️ 自验证声明「954 单测全绿」未覆盖 `tsc --noEmit`（构建前置），导致 🔴-2 漏网，建议自验证补充 tsc

---

## 测试质量

- ✅ 覆盖充分：`AccountBar.test.tsx`（8 用例：串行拉取节奏、持仓过滤统计、盈红亏绿、超长省略、10s 周期）、`QuoteStatsBar.test.tsx`（6 用例）、`popupStore.test.ts`（7 用例：expanded 切换/持久化/partialize/rehydrate）、`OrderPopup.test.tsx`（P2 新增：AccountBar/FooterBar 渲染、QuoteStatsBar 条件渲染、∧/∨ 切换、— 收起、持久化）
- ✅ 全量复验 954 passed / 87 files
- ❌ 🔴-1 缺口：无「解锁不应再次锁仓」语义断言（详见 🔴-1）
- ❌ 🔴-2 缺口：无 `tsc --noEmit` 门禁，esbuild 转译掩盖类型错误（详见 🔴-2）

---

## 审查结论

**不通过（存在 2 项 🔴 阻断性缺陷）**

P2 五项任务实现完整、测试全绿、范围控制良好、标签页/弹窗样式统一成立，但存在：
- 🔴-1 锁仓/解锁开关语义错误——「解锁」实际再次调用单向锁仓接口，重复开反向仓并谎报「已解锁」，属交易正确性硬缺陷；
- 🔴-2 `LockResponse` 类型缺 `message` 导致 `tsc --noEmit` exit 2、生产构建 `tsc && vite build` 直接失败。

请开发窗口处理 🔴-1、🔴-2（各自单独 commit，含补测试），并酌情处理 🟡-1~3 与 🔵-1~2 答复。处理后重新提交二次审查。

---

# 第二轮审查（2026-08-06）

> 修复提交：`56fe5c0`（🔴-2）、`22bb0de`（🔴-1+🟡-3）、`2234260`（🟡-1）、`0b14995`（🟡-2）、`ce22000`（docs 状态+回复）、`3af1c74`（feedback 提交）
> 复验基线：`c80f72f` 起 HEAD（14 文件，+443/−17）

## 逐条复验

| 反馈 | 处理 | 复验结论 |
|---|---|---|
| 🔴-1 锁仓/解锁语义 | 方案 A：一次性「锁仓」+ `ConfirmDialog` 强制确认 + `lockPending` 防重 + 成功后 `fetchPositions` 刷新持仓 | ✅ 通过。按钮永不变「解锁」，无二次重复锁仓路径；取消不触发下单；「取消/确认/刷新持仓」三测试覆盖 |
| 🔴-2 tsc 类型错误 | `LockResponse` 补 `message?: string`（对齐 ReverseResponse） | ✅ 通过。`tsc --noEmit` exit 0，`tsc && vite build` 不再失败 |
| 🟡-1 双重轮询 | `load` 循环读取 `isPaused`，暂停挂起本轮仅调度下一轮 | ✅ 通过。与 QueryPanel 语义对齐；「暂停不发起查询/恢复继续」测试覆盖 |
| 🟡-2 confirmOpen | `popupStore.confirmOpen` 瞬态（不持久化）+ `OrderPopup` Esc 守卫 + `ConfirmDialog` Esc→onCancel + MarketDepth/AccountBar 同步 | ✅ 通过。集成测试：确认框 Esc 取消且弹窗保持；确认框关闭后 Esc 恢复关弹窗 |
| 🟡-3 锁仓无确认 | 随 🔴-1 一并处理：强制确认 | ✅ 通过 |
| 🔵-1 最高/最低着色 | 答复：与 OrderQuotePanel 既有约定一致，最高恒 up/最低恒 down | ✅ 接受 |
| 🔵-2 账户下拉范围 | 答复：非 P2 验收（仅超长省略），资金明细延后 P3，任务文件已注明 | ✅ 接受 |

## 复验结果

- ✅ 前端全量回归：**964 passed / 88 files**（复验确认，与回复声明一致）
- ✅ `tsc --noEmit` **exit 0**（复验确认，修复纳入构建基线）
- ✅ 文档同步：任务文件状态「修复完成，待二次审查（964 单测全绿，tsc 0）」；🔵-2 延后项已在 P3 任务清单注明
- ✅ 修复未改保留文件（OrderForm / DepthQuote / OrderQuotePanel）；后端无改动（108 单测不受影响）

## 二轮新增观察（🔵，不阻塞）

- `ConfirmDialog` 新增全局 Esc→onCancel 处理器，共享组件（`OrderPanel` 亦使用）。已确认 OrderPanel 无自有 Esc 监听，此前 Esc 无行为、现 Esc 取消确认框，属纯增强，无回归。

## 二轮审查结论

**✅ 通过（建议合入）**

🔴-1、🔴-2 已修复并含语义测试（锁仓确认/取消/刷新 + LockResponse 类型）；🟡-1~3 全部落地（isPaused 挂起、confirmOpen Esc 语义、锁仓强制确认）；🔵-1~2 已答复或注明延后。复验 964 全绿 + tsc 干净。P2 可进入人工验证。

> 提示：任务文件 P2 状态现为「修复完成，待二次审查」，人工验证通过后更新为「人工验证通过，待收尾」。
