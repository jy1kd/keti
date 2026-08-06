# 审查回复 · 报单弹窗重构 P1（task-order-popup-p1）

> 开发窗口：角色B
> 审查反馈：`docs/snapshots/role-b/review-feedback-orderpopup-p1.md`
> 修复分支：`feature/order-popup-p1-depth`
> 回复日期：2026-08-06

## 🔴-1 连续点价报单：第一单成功后第二单必失败「请选择合约」 — ✅ 已修复

**方案**：采用审查建议的「方案 A」，在 `store.ts` `submitOrder` 成功路径中保留交易上下文，仅清空价格类字段。

```ts
set({
  orderForm: {
    ...DEFAULT_ORDER_FORM,
    instrumentID: form.instrumentID,          // 用 form 而非 submitForm
    exchangeID: form.exchangeID,
    combOffsetFlag: form.combOffsetFlag,
    combHedgeFlag: form.combHedgeFlag,
    timeCondition: form.timeCondition,
    volumeTotalOriginal: form.volumeTotalOriginal,
  },
  isSubmitting: false,
})
```

**与审查方案的差异（1 处，刻意为之）**：审查方案 A 写 `instrumentID: submitForm.instrumentID`，实现时改用 **`form.instrumentID`**（提交前原始表单值）。原因：套利指令场景下 `submitForm.instrumentID` 是 SPD 自动生成的虚拟合约（`SPD A-B`），写回表单会导致 OrderForm 页合约查找失败；而普通限价/市价下 `form.instrumentID` 与 `submitForm.instrumentID` 相同，不影响弹窗连续报单修复。

**效果**：
- 弹窗内连续点价第二单不再清空合约 → 不再「请选择合约」
- 顺带满足设计 §5「手数记忆」：成功后手数/开平/投保/有效期保留，仅价格重新定价

**必补测试**：
- `MarketDepth.test.tsx` 新增「连续两单：真实 submitOrder 第一单成功后保留合约/手数，第二单仍能发起」集成用例——走**真实** `submitOrder`（非 submitSpy），mock `services/api` 返回成功，断言第一单成功后 `instrumentID='IF2608'`、`volumeTotalOriginal=3`，第二单 `apiSubmit` 第 2 次调用入参 `instrumentID='IF2608'`、`limitPrice=4696`。
- `store.test.ts` 新增「成功后保留 合约/开平/投保/有效期/手数，仅清空价格」，并更新原「成功重置 instrumentID 为空」断言为「保留合约、价格清空」。

---

## 🟡-1 改价框被行情 tick 持续覆写 — ✅ 已修复

`MarketDepth.tsx` 改为「仅首帧/合约变更初始化 + 用户改价后停止跟随」：

- 新增 `prevInstrRef` 追踪当前合约，合约变更（或首帧）时 `setQuickPrice(0)` 触发重新初始化
- 默认价同步 effect 增加 `quickPrice === 0` 哨兵：用户改价/点价格列后 `quickPrice !== 0`，后续 WS tick 不再覆写

**测试**：`MarketDepth.test.tsx` 新增「改价后行情 tick 更新不覆写改价框」——初始对手价 4696.0 → 点价格列改 4697.0 → 同合约 tick 更新（卖一 4700）仍保持 4697.0 → 切换合约重新跟随 4800.0。

## 🟡-2 价格列展示未按 tickSize 还原 — ✅ 已修复

- `DepthRow.priceText`：真实档与合成档统一 `formatTickPrice(level.price, tick)`（原真实档 `String(price)` 显示 4696，与合成档 4696.6 精度不一致）
- `DepthSummaryRow.lastText`：最新价同样按 tick 还原
- 同步更新 `MarketDepth.test.tsx` 三处断言（4696 → 4696.0 等）

## 🟡-3 数量上限规则三处重复定义 — ✅ 已修复

`validators.ts` 新增单一事实来源 `getVolumeLimit(orderType, productClass)`，三处统一引用：

- `validators.ts` `validateVolumeWithLimit` 内部改用
- `TradeParams.tsx` 移除本地 `isMarket/isOption` 三元，改 `getVolumeLimit(orderForm.orderPriceType, productClass)`
- `OrderForm.tsx` volumeLimit useMemo 改 `getVolumeLimit(orderPriceType, productClass)`

## 🟡-4 TradeParams 手数 `+` 步进不受上限约束 — ✅ 已修复

`TradeParams.tsx` `+` 按钮 `disabled={volumeTotalOriginal >= volumeLimit}` 且点击 `Math.min(volumeLimit, v + 1)` 双保险封顶。**测试**：新增「手数 + 达上限时禁用步进按钮」用例。

---

## 🔵-1 确认框弹出期间按 Esc 关闭整个弹窗 — 📝 答复

现状为**刻意保留**：Esc 关闭整个弹窗是与 OrderPage/其他弹窗一致的全局约定，误触概率低；确认框本身有「取消」按钮 + 点击遮罩取消两条取消路径。

但审查指出的体验问题成立——确认框打开时按 Esc 直接关弹窗，会丢失改价/手数上下文。**建议纳入 P2 增强**：`popupStore` 引入确认框状态（`confirmOpen`），OrderPopup 的 Esc 处理改为「先取消确认框，再关弹窗」。本期未实现以控制修复风险（涉及弹窗级状态提升）。

## 🔵-2 快照为空时 QuickTradeBar 整体隐藏 — 📝 答复

**刻意选择**：无行情时整块盘口显示 `--` 空态（与 DepthQuote 一致），比灰化禁用更明确的「无数据」语义；QuickTradeBar 内部已实现 `disabled={!snapshot}` 逻辑（输入框 + 买卖按钮均禁用），若未来需要「灰化」形态可直接在空态下渲染该栏。设计 §4.4「断线 → 灰化禁用点价」对应的是**有快照但档位无效**的降级场景（档位显示 `--`、不可点），已由 `clickable = valid || fallback !== null` 覆盖。

## 🔵-3 tick 合成兜底档位可点价报单 — 📝 答复

**刻意选择「所见即所下」**：合成价是基于最新价/买一卖一 ± n×tick 的候选价，tick 对齐、价格真实有效；且每次必弹确认框展示精确价格后才 submit，用户下单前可见实际成交价。若禁用合成档下单，无真实盘口时整个盘口无法点价，违背 P1「点档位弹确认 → 报单」核心闭环。

## 🔵-4 涨跌为 0 时显示 `+0.0` — ✅ 已修复

`changeText = (diff > 0 ? '+' : '') + diff.toFixed(decimals)`，平盘显示 `0.0`（不再 `+0.0`）。

---

## 测试结果

- 全量前端回归：**932 passed / 85 files**（修复前 928，新增 4 个用例）
  - `MarketDepth.test.tsx` 35（+2：连续两单集成、改价框 tick 保护）
  - `TradeParams.test.tsx` 11（+1：手数封顶）
  - `store.test.ts` 17（+1：成功后保留手数记忆）
- `tsc --noEmit` 通过（exit 0）
- 后端 108 单测未涉及（无后端改动）

## 结论

🔴-1 已修复并补连续两单真实 `submitOrder` 集成用例；🟡-1~4 与 🔵-4 全部处理；🔵-1~3 已答复。请审查窗口做二次审查。
