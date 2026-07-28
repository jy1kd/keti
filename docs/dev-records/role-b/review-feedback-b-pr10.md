# PR-10 Code Review 反馈

## 第 1 轮审查（初审）

审查分支：feature/pr-10-order-form
审查 commit：9b15b34（merge base）→ 423fadc（HEAD），共 3 commits
审查时间：2026-07-20
审查范围：22 files，+1993 −15 行（全部 frontend/ 相关）

---

### 🔴 阻断性问题（必须修改）

1. 【frontend/src/hooks/useHotKeys.ts + OrderForm.tsx】useHotKeys Hook 已定义并通过 9 个测试，但未在任何组件中集成调用
   - 原因：`useHotKeys` 定义了 B/S/C 快捷键逻辑，但 `OrderForm.tsx`、`StopOrderForm.tsx`、`OrderPanel.tsx` 均未 import 或调用它。Grep 确认：所有 `.tsx` 文件中均无 `useHotKeys` 引用。
   - 影响：用户按 B/S/C 键无任何响应，快捷键功能完全失效。
   - 建议：在 `OrderPanel.tsx` 中调用 `useHotKeys`，将 `onBuy`/`onSell` 映射到报单面板的快捷操作，`onCancelAll` 需先实现 store 级 cancelOrder（见下一条）。

2. 【frontend/src/hooks/usePriceStep.ts + OrderForm.tsx:819-820】usePriceStep Hook 已定义并通过测试，但表单组件使用硬编码 priceTick=0.2 的步进逻辑
   - 原因：`OrderForm.tsx` 和 `StopOrderForm.tsx` 中价格步进均使用 `const tick = 0.2` 硬编码，未使用已实现的 `usePriceStep` Hook。Hook 的优势（根据合约 tick 自动对齐、`alignToTick` 精度修正）完全未用上。
   - 影响：所有合约的价格步进统一为 0.2，不匹配实际合约的最小变动价位（如 IF 是 0.2，au 可能是 0.02）。
   - 建议：将 `priceTick` 作为 prop 传入 `OrderForm`（从选中合约的 ContractInfo 获取），内部调用 `usePriceStep` Hook 替代内联步进逻辑。

3. 【frontend/src/utils/orderMapping.ts:91-99 + StopOrderForm.tsx:163】StopOrderForm 提交时止损价被静默丢弃
   - 原因：`CtpOrderRequest` 接口不包含 `stopPrice` 字段，`convertOrderRequest()` 也不传递 `stopPrice`。StopOrderForm 调用 `submitOrder` → `apiSubmitOrder` → `convertOrderRequest`，止损价在转换步骤被丢弃。
   - 影响：止损单实际以普通限价单形式提交到后端，止损价格信息丢失。
   - 建议：在 `CtpOrderRequest` 中增加 `stopPrice?: number` 字段，`convertOrderRequest` 中透传该字段；或止损单使用独立 API 端点。

4. 【frontend/src/modules/order/store.ts:16-24】cancelOrder 未接入 Store，task 要求的「cancelOrder: 撤单」缺失
   - 原因：Store 接口中没有 `cancelOrder` 方法，仅 `api.ts` 中有独立函数 `cancelOrder(orderRef)`。组件无法通过 Store 调用撤单。
   - 影响：即使快捷键 Hook 集成后，C 键"撤销当前合约所有未成交报单"也无法实现；OrderForm 无法提供撤单按钮。
   - 建议：在 Store 中增加 `cancelOrder: () => Promise<boolean>` 方法，调用 `api.ts` 中的 `cancelOrder` 并处理 Toast 反馈。

### 🟡 改进建议

1. 【frontend/src/modules/order/OrderForm.tsx + StopOrderForm.tsx】两个表单组件存在大量重复代码
   - 方向切换（买/卖按钮）、开平切换、数量步进器在 OrderForm 和 StopOrderForm 中完全重复。
   - 建议：抽取 `DirectionToggle`、`OffsetToggle`、`VolumeStepper` 等共享子组件，或复用同一个表单组件通过 `variant` prop 控制差异部分（如止损价输入）。

2. 【frontend/src/modules/order/store.ts:46-65】提交前缺少前端校验
   - 当前 `submitOrder()` 未做任何前端校验，直接调用 API。建议增加：
     - `instrumentID` 非空检查（"请选择合约"）
     - 限价单 `limitPrice > 0` 检查（"请输入有效价格"）
     - `volumeTotalOriginal ≥ 1` 检查
   - 注意：progress.md 已标注此为已知观察项，建议在后续 PR 中完善。

3. 【frontend/src/components/Toast/index.tsx:121-123】模块级可变状态缺乏并发安全说明
   - 使用 `let toasts` / `let toastId` / `let listeners` 模块级可变状态，非 React 标准模式。
   - 在当前的同步渲染模式下可以正常工作，但建议添加注释说明此实现假设单例渲染，不适用于 React 并发模式（React 18 Concurrent Features）。
   - 长期可考虑迁移到 React Context 或使用 Portal + state 的标准模式。

4. 【frontend/src/modules/order/store.ts】setSelectedInstrument 重置 orderForm 的行为可能导致用户困惑
   - `setSelectedInstrument` 会覆盖整个 `orderForm` 的 `instrumentID`（通过 spread `get().orderForm`），但方向/开平等其他字段保持不变。这是合理设计，但建议在注释中说明：选中合约时仅更新 instrumentID，保留用户已选择的方向/开平设置。

### 🔵 疑问确认

1. 【orderMapping.ts + task.md】task 文字描述提到 IOC（GFD/IOC/FOK/FAK），但前后端字段映射表仅定义 GFD/FOK/FAK 三种。当前代码实现也是三种。
   - 确认：IOC 是有意省略（因为 Simnow 柜台不支持或映射表中明确排除），还是 task 描述不一致？
   - progress.md 已标注此矛盾为"观察项"。

2. 【StopOrderForm → submitOrder】止损单是否应使用独立 API 端点（如 `/api/order/stop`）而非复用 `/api/order/insert`？
   - 当前实现中 StopOrderForm 和 OrderForm 共用同一个 `submitOrder`，两者的区别仅在前端表单 UI。
   - 确认：是否预期止损单与普通报单共享同一个后端 API？若是，后端如何区分普通单和止损单（是否通过 `stopPrice` 字段是否存在来判断）？

---

### 审查结论

❌ **需要修改后再审**

共发现 4 个阻断性问题：
- useHotKeys 未集成 → B/S/C 快捷键失效
- usePriceStep 未集成 → 所有合约价格步进固定 0.2
- stopPrice 在 convertOrderRequest 中丢失 → 止损单退化为普通单
- cancelOrder 未接入 Store → C 键撤单功能无法实现

以上问题均属于"功能实现不完整"——Hook 和 API 函数已单独编写并通过测试，但未正确接入组件和 Store。建议修复后进入第二次审查。

下一步：请切回开发窗口，使用 `/superpowers:receiving-code-review` 处理审查反馈。

---

## 第 2 轮审查（复审）

审查分支：feature/pr-10-order-form
审查 commit：423fadc（初审 HEAD）→ dcf38ce（复审 HEAD），共 6 commits
审查时间：2026-07-20
审查范围：14 files，+312 −59 行（修复初审 4 个阻断 + 3 个建议 + 注释补充）

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

1. 【OrderPanel.tsx:19-21】C 键 `onCancelAll` 为占位实现
   - 当前 C 键仅显示 toast "请使用查询面板撤单"，未真正执行撤单操作。Store 层的 `cancelOrder` 已就绪（支持单笔撤单），但"撤销当前合约所有未成交报单"需要批量撤单功能（需 PR-16 查询面板提供未成交报单列表）。
   - 这不阻塞合入——`cancelOrder` 基础设施已就绪，C 键的批量逻辑可在 PR-16（查询面板）中完善。当前占位 toast 也是合理的用户体验（至少告诉用户去哪操作）。

2. 【OrderForm.tsx:6 / StopOrderForm.tsx:5】`priceTick` prop 默认值为 0.2
   - 默认值 0.2 合适合约 IF，但对其他合约（如 au=0.02, rb=1）不准确。建议在调用方（如 MarketPanel 点价联动时）传入实际合约的 `priceTick`。当前组件层面提供 prop 接口是正确的设计方向，prop 默认值仅作为兜底。

---

### 🔵 疑问确认

1. 【useEffect sync in OrderForm/StopOrderForm】`useEffect(() => { if (price !== orderForm.limitPrice) { setOrderForm(...) } }, [price])` 这种双向同步模式（Hook ↔ Store）是否有考虑过合并为单向数据流？
   - 当前模式：用户操作 → usePriceStep 内部 state → useEffect → Store → 重渲染 → usePriceStep 同步 prop → 防循环 guard
   - 数据流较曲折但 guard 条件（`price !== orderForm.limitPrice`）有效防止了无限循环。若后续发现状态同步问题，可考虑将 `usePriceStep` 改为完全受控模式（不持有内部 state，所有状态由 Store 驱动）。

（无则写"无"）

---

### 审查结论

✅ **通过**

初审 4 个阻断性问题已全部修复，修复验证如下：

| # | 初审问题 | 修复 commit | 验证 |
|---|---------|-------------|------|
| 1 | useHotKeys 未集成 | `6ba0262` | ✅ OrderPanel 调用 useHotKeys，B/S 键映射方向切换，新增 2 个测试 |
| 2 | usePriceStep 未集成 | `fb20393` | ✅ OrderForm/StopOrderForm 接受 priceTick prop，内部使用 usePriceStep Hook |
| 3 | stopPrice 静默丢弃 | `ba2c6d7` | ✅ CtpOrderRequest 增加 stopPrice 可选字段，条件透传，新增 2 个测试 |
| 4 | cancelOrder 未接入 Store | `6346c79` | ✅ Store 增加 cancelOrder 方法 + Toast 反馈，新增 3 个测试 |

审查建议采纳情况：

| # | 建议 | 状态 |
|---|------|------|
| 1 | 抽取共享子组件 | 保留（defer 到 PR-15） |
| 2 | 前端校验 | ✅ 已采纳 — instrumentID + limitPrice 检查，新增 2 个测试 |
| 3 | Toast 并发注释 | ✅ 已采纳 — 添加注释说明 |
| 4 | setSelectedInstrument 注释 | ✅ 已采纳 — 添加注释说明 |

测试结果：**260 tests passed / 32 files**（+12 tests），2 pre-existing failures（react-resizable-panels，与 PR-10 无关）

下一步：请完成人工验证后切回开发窗口生成 PR 描述。

---

## 第 3 轮审查（人工验证）

审查分支：feature/pr-10-order-form
审查时间：2026-07-21
审查方式：人工运行验证 + 前后端字段对齐排查

---

### 🔴 阻断性问题（必须修改）

1. 【App.tsx】ToastContainer 未挂载，所有 Toast 反馈不可见
   - 原因：`ToastContainer` 组件已定义、已测试，但 `App.tsx` 中未 import 和渲染。`toast.error()` / `toast.success()` 被调用但没有任何 listener 响应。
   - 影响：前端校验拦截（"请选择合约"、"请输入有效价格"）、API 成功/失败反馈全部不可见，用户点击提交后看起来"什么都没发生"。
   - 修复：`App.tsx` 中 `import { ToastContainer }` 并在 JSX 中渲染 `<ToastContainer />`。

2. 【MarketPanel.tsx】MarketStore → OrderStore 桥接缺失，报单表单无法获取选中合约
   - 原因：`MarketPanel` 使用 `useMarketStore().setSelectedInstrument` 更新行情面板选中状态，但从未调用 `useOrderStore().setSelectedInstrument`。两个 Store 各自独立，`orderForm.instrumentID` 永远为空字符串。
   - 影响：用户在行情表上点击合约后，报单表单的合约代码不更新。提交时报单永远被前端校验拦截（instrumentID 为空）。
   - 修复：`MarketPanel.tsx` 中 import `useOrderStore`，在 5 处点击/选择事件中同步调用 `setOrderInstrument` + `setOrderForm`，删除 4 处 `// TODO: PR-10` 占位注释。

3. 【orderMapping.ts】前后端字段名不对齐 — `combOffsetFlag`/`orderPriceType` 被 Pydantic 静默丢弃
   - 原因：前端 `CtpOrderRequest` 发送 `combOffsetFlag` 和 `orderPriceType`，后端 `InsertOrderRequest` 期望 `offsetFlag` 和 `priceType`。Pydantic v2 默认忽略未识别字段 → 始终使用默认值（开仓 + 限价）。
   - 影响：用户选择的开平方向和价格类型完全无效，后端永远以默认值处理。
   - 修复：`orderMapping.ts` 中 `CtpOrderRequest` 接口和 `convertOrderRequest` 的 key 名改为 `offsetFlag`、`priceType`。

4. 【orderMapping.ts】FOK 缺少 `volumeCondition`，后端校验必失败
   - 原因：FOK 要求 `volumeCondition="3"`（CV），但前端从未发送此字段。后端默认 `"1"`，校验 `tc=="2" and vc!="3"` 永远触发。
   - 影响：任何 FOK 报单都会被后端拒绝。
   - 修复：`CtpOrderRequest` 增加 `volumeCondition` 字段，`convertOrderRequest` 中根据 `timeCondition` 自动计算：FOK→`"3"`，其他→`"1"`。

5. 【StopOrderForm.tsx】止损单表单缺少有效期（GFD/FOK/FAK）切换
   - 原因：`StopOrderForm` 只有方向、开平、价格、数量、止损价，没有 `timeCondition` toggle。始终使用默认 GFD。
   - 影响：止损单无法选择 FAK/FOK 有效期。
   - 修复：`StopOrderForm.tsx` 中新增 GFD/FOK/FAK 切换按钮（与 OrderForm 一致）。

---

### 审查结论

❌ **需要修改后再审**

人工验证发现 5 个运行时问题（2 个集成缺失 + 3 个字段对齐错误），全部已当场修复。

修复文件清单：

| 文件 | 问题 |
|------|------|
| `App.tsx` | ToastContainer 未挂载 |
| `MarketPanel.tsx` | MarketStore → OrderStore 桥接缺失 |
| `orderMapping.ts` | 字段名不对齐 + volumeCondition 缺失 |
| `orderMapping.test.ts` | 测试期望值同步更新 |
| `api.test.ts` | 测试期望值同步更新 |
| `StopOrderForm.tsx` | 有效期切换缺失 |

测试结果：**274 tests / 34 files 全通过**（+1 volumeCondition 专项测试）。

下一步：请重新进行人工验证，验证通过后生成 PR 描述。
