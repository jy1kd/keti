# PR-16 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-27
**审查范围**：PR-16 前端查询面板实现（`feature/pr-16-query-panel` 分支，commit `b4fd085` ~ `ef344cf`）
**审查结论**：🟡 需修复后通过（1 阻断 + 2 改进建议 + 2 疑问）

---

## 审查维度检查

### 1. 功能完整性 ✅
- ✅ 7 个 Tab 全部实现（报单、成交、持仓、资金、止损单、报价、合约）
- ✅ 报单流水：撤单按钮、撤销全部、增量更新、新数据高亮
- ✅ 成交流水：增量更新、新数据高亮
- ✅ 持仓：平仓按钮、盈亏着色
- ✅ 账户资金：全部字段展示
- ✅ 止损单列表：状态显示、取消操作
- ✅ 合约查询：详情展示
- ✅ 暂停/继续、手动刷新
- ✅ C 键快捷撤单

### 2. 代码质量 ✅
- ✅ 组件职责清晰，每个组件独立
- ✅ Store 设计合理（Zustand + 增量更新）
- ✅ 乐观更新（撤单后本地标记）
- ✅ 新数据 2 秒高亮动画
- ✅ 表头 sticky + 滚动

### 3. 测试覆盖 ✅
- ✅ 8 个测试文件，71 个测试全部通过
- ✅ Store 测试覆盖 fetch/cancel/upsert/highlight
- ✅ 组件测试覆盖空状态/渲染/交互

### 4. 样式一致性 ✅
- ✅ 暗色主题一致
- ✅ 买卖方向红绿着色
- ✅ 盈亏着色
- ✅ 按钮 hover 效果

---

## 🔴 阻断性问题

### F1: 报价 Tab 传递 `snapshot={null}`，始终显示空数据

**文件**：`frontend/src/modules/query/QueryPanel.tsx:81`
**严重等级**：🔴 阻断性

```tsx
case 'quotes':
  return (
    <div className="quote-query">
      <DepthQuote snapshot={null} />
    </div>
  )
```

**问题**：报价 Tab 始终传递 `snapshot={null}` 给 DepthQuote 组件，导致五档行情永远显示空数据。task.md 第 6 项要求「五档行情深度展示，支持多合约切换」。

**建议**：从 marketStore 获取当前选中合约的行情快照，传递给 DepthQuote：
```tsx
case 'quotes': {
  const snapshot = selectedInstrument ? marketSnapshots[selectedInstrument] ?? null : null
  return (
    <div className="quote-query">
      <DepthQuote snapshot={snapshot} />
    </div>
  )
}
```

---

## 🟡 改进建议

### F2: store.ts import 顺序混乱

**文件**：`frontend/src/modules/query/store.ts:56`
**严重等级**：🟡 改进建议

```typescript
type PositionEntry = RawPosition
import { toast } from '../../components/Toast'  // ← import 在类型定义之后
```

**问题**：`import { toast }` 放在了类型别名定义之后，不符合 ES module 规范和项目惯例。

**建议**：将 `import { toast }` 移到文件顶部与其他 import 一起。

### F3: handleCancelOrder 乐观更新的 orderStatus 值不匹配 CTP 编码

**文件**：`frontend/src/modules/query/store.ts:235`
**严重等级**：🟡 改进建议

```typescript
const orders = get().orders.map((o) =>
  o.orderRef === orderRef ? { ...o, orderStatus: 'canceled' as const } : o
)
```

**问题**：乐观更新将 `orderStatus` 设为 `'canceled'`（英文字符串），但 STATUS_MAP 使用 CTP 数字编码 `'5'` 表示已撤单。撤单成功后到下次刷新之间，状态列会显示原始字符串 `'canceled'` 而非中文「已撤单」。

**建议**：改为 `'5'` 以匹配 CTP 编码：
```typescript
orderStatus: '5'  // CTP 已撤单编码
```

---

## 🔵 疑问

### Q1: Position 平仓始终使用 `combOffsetFlag: 'close'`

**文件**：`frontend/src/modules/query/Position.tsx:20`

```typescript
setOrderForm({
  instrumentID,
  direction: posiDirection === '2' ? 'sell' : 'buy',
  combOffsetFlag: 'close',
  volumeTotalOriginal: volume,
})
```

**疑问**：对于上期所/能源交易所品种，今仓需要使用「平今」(`close_today`)，昨仓使用「平昨」(`close_yesterday`)。当前始终使用 `close`，在 simnow 环境是否会导致今仓无法平仓？

### Q2: `as unknown as` 类型断言

**文件**：`frontend/src/modules/query/store.ts:158, 176`

```typescript
set({ positions: (res.positions ?? []) as unknown as RawPosition[] })
set({ stopOrders: (res.stopOrders ?? []) as unknown as StopOrder[] })
```

**疑问**：这些类型断言说明 API 返回类型与 store 类型不完全匹配。是否有意为之（API 类型比 store 类型更宽松）？还是应该统一类型定义？

---

## 测试结果

```
Test Files  8 passed (8)
     Tests  71 passed (71)
  Duration  2.10s
```

TypeScript 编译：需确认（未单独运行 tsc）

---

## 审查结论

**🟡 需修复后通过**

- 🔴 F1（报价 Tab 空数据）必须修复
- 🟡 F2（import 顺序）建议修复
- 🟡 F3（乐观更新状态码）建议修复
- 🔵 Q1、Q2 为疑问，开发窗口回复即可

修复 F1 后可直接进入自验证，无需完整 TDD 循环。
