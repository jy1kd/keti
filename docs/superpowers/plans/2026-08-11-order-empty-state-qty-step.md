# 报单/K线无合约空态界面 + 手数步进跟随快捷 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未选合约时报单/K线标签显示完整空界面（数据 `--`、搜索框提示「请选择合约」）；手数步进跟随最后点击的快捷预设。

**Architecture:** 复用现有组件的空值回落（`MarketDepth` 无快照渲染 `--`、`KLineChart` 空数据空网格），去掉 `OrderPage`/`KLinePage` 的 `instrumentID` 空态守卫，恒渲染完整界面；`ContractSearch` 新增 `placeholder` prop。步进基准 `volumeStep` 存入 order store（独立字段），`QtyPreset` 高亮改为跟随 `volumeStep`，`TradeParams` 的 `+/-` 按 `volumeStep` 步进。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5 / Vitest + @testing-library/react；Zustand。

## Global Constraints

- 空态占位符统一为 `--`（双连字符）。
- `volumeStep` 是 order store 的**独立字段**，不进 `OrderRequestForm`（避免污染 CTP 报单字段映射）。
- `submitOrder` 成功写回 / `resetOrderForm` **不重置** `volumeStep`（报单后手数回 1、步进保持）。
- 止损单 `StopOrderForm` 的手数步进**不受影响**（保持 step=1，无快捷栏）。
- 全程 TDD：先写失败测试 → 确认失败 → 实现 → 确认通过 → 提交。
- 前端测试命令：`cd frontend && npx vitest run <文件>`；全量：`npm test`；类型：`npx tsc --noEmit`。

---

### Task 1: ContractSearch placeholder prop

**Files:**
- Modify: `frontend/src/components/ContractSearch/index.tsx`
- Test: `frontend/src/components/ContractSearch/index.test.tsx`

**Interfaces:**
- Produces: `ContractSearchProps.placeholder?: string`（默认 `'搜索合约...'`）；`ContractSearch` 输入框 `placeholder={placeholder}`。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/components/ContractSearch/index.test.tsx` 末尾（`describe` 内）追加：

```tsx
it('支持自定义 placeholder（空态提示请选择合约）', () => {
  render(<ContractSearch contracts={[]} placeholder="请选择合约" />)
  expect(screen.getByPlaceholderText('请选择合约')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/components/ContractSearch/index.test.tsx`
Expected: FAIL（`getByPlaceholderText('请选择合约')` 找不到，仍是「搜索合约...」）

- [ ] **Step 3: 实现**

`frontend/src/components/ContractSearch/index.tsx`：

```tsx
interface ContractSearchProps {
  contracts: ContractInfo[]
  onSelect?: (instrumentID: string) => void
  /** 搜索关键词变化回调（用于表格过滤） */
  onQueryChange?: (query: string) => void
  /** 初始显示值（如回显当前选中合约）；仅初次挂载生效，选择/输入后内部接管 */
  initialQuery?: string
  /** 空态提示（如「请选择合约」）；默认「搜索合约...」 */
  placeholder?: string
}

export function ContractSearch({
  contracts,
  onSelect,
  onQueryChange,
  initialQuery = '',
  placeholder = '搜索合约...',
}: ContractSearchProps) {
```

输入框改为：

```tsx
<input
  ref={inputRef}
  type="text"
  placeholder={placeholder}
  ...
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/components/ContractSearch/index.test.tsx`
Expected: PASS（全部 12 个）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/ContractSearch/index.tsx frontend/src/components/ContractSearch/index.test.tsx
git commit -m "feat(contract-search): 支持 placeholder prop（空态提示请选择合约）"
```

---

### Task 2: 报单空态界面（OrderPage / OrderTradeBody / TradeParams / QuoteStatsBar）

**Files:**
- Modify: `frontend/src/modules/order/OrderTradeBody.tsx`
- Modify: `frontend/src/pages/OrderPage.tsx`
- Modify: `frontend/src/modules/order/TradeParams.tsx`
- Modify: `frontend/src/modules/order/QuoteStatsBar.tsx`
- Modify: `frontend/src/pages/OrderPage.css`
- Test: `frontend/src/pages/__tests__/OrderPage.test.tsx`
- Test: `frontend/src/modules/order/QuoteStatsBar.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ContractSearchProps.placeholder?: string`
- Produces: `OrderPage` 无合约时渲染完整界面（停靠/浮动）；`TradeParams` 空态搜索框 placeholder「请选择合约」、撤最新/撤全部/平净仓无合约禁用；`OrderTradeBody.instrumentID?: string`；`QuoteStatsBar` 空态占位 `--`。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/pages/__tests__/OrderPage.test.tsx` 的 `describe('OrderPage')` 内新增，并把原「浮动模式无合约时显示选择提示」替换：

```tsx
it('无合约停靠模式渲染完整空界面（参数区 + 盘口 -- + 请选择合约，操作按钮禁用）', () => {
  render(<OrderPage />)
  expect(screen.getByText('📝 报单')).toBeDefined()
  expect(screen.getByTestId('tp-volume')).toBeDefined()
  expect(screen.getByText('--')).toBeDefined()
  expect(screen.getByPlaceholderText('请选择合约')).toBeDefined()
  expect(screen.queryByText(/请在行情表格中选择合约/)).toBeNull()
  expect(screen.getByTestId('tp-cancel-latest')).toBeDisabled()
  expect(screen.getByTestId('tp-cancel-all')).toBeDisabled()
  expect(screen.getByTestId('tp-flat-net')).toBeDisabled()
})

it('无合约浮动模式渲染完整空界面（账户栏 + 参数区 + 盘口 -- + 请选择合约）', () => {
  const { container } = render(<OrderPage floating />)
  expect(container.querySelector('.order-floating')).toBeDefined()
  expect(container.querySelector('.order-popup__body')).toBeDefined()
  expect(screen.getByTestId('tp-volume')).toBeDefined()
  expect(screen.getByPlaceholderText('请选择合约')).toBeDefined()
  expect(screen.queryByText(/请在行情表格中选择合约/)).toBeNull()
})
```

原测试（约 162-166 行）：

```tsx
it('浮动模式无合约时显示选择提示', () => {
  const { container } = render(<OrderPage floating />)
  expect(screen.getByText(/请在行情表格中选择合约/)).toBeDefined()
  expect(container.querySelector('.order-popup__body')).toBeNull()
})
```

删除（被上面的新浮动测试替代）。

在 `frontend/src/modules/order/QuoteStatsBar.test.tsx` 把「无快照时全部显示 — 占位」断言改为：

```tsx
expect(screen.getByTestId(`qs-${label}`).textContent).toBe('--')
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/OrderPage.test.tsx src/modules/order/QuoteStatsBar.test.tsx`
Expected: FAIL（空态断言找不到完整界面；`QuoteStatsBar` 仍 `—`）

- [ ] **Step 3: 实现**

**(a) `OrderTradeBody.tsx`** — 类型放宽：

```tsx
interface OrderTradeBodyProps {
  /** 报单合约代码；无合约时渲染空态（--） */
  instrumentID?: string
  onSwitch?: (instrumentID: string) => void
}
```

**(b) `OrderPage.tsx`** — 去掉两处空态守卫，恒渲染：

```tsx
export function OrderPage({ instrumentID, floating = false, tabId }: OrderPageProps) {
  // ... useEffect(setOrderForm) 与 handleSwitch 保持不变 ...

  // ── 浮动窗口模式：恒渲染完整界面，无合约时各栏显示 -- ──
  if (floating) {
    return (
      <div className="order-floating">
        <AccountBar instrumentID={instrumentID ?? ''} />
        <OrderTradeBody instrumentID={instrumentID} onSwitch={handleSwitch} />
        {expanded && <QuoteStatsBar instrumentID={instrumentID ?? ''} />}
        <FooterBar />
      </div>
    )
  }

  return (
    <div className="order-page">
      <div className="order-page__title-bar" data-drag-handle>
        <span className="order-page__title">📝 报单</span>
        {instrumentID && <span className="order-page__subtitle">{instrumentID}</span>}
      </div>
      <OrderTradeBody instrumentID={instrumentID} onSwitch={handleSwitch} />
    </div>
  )
}
```

（删除原浮动模式的 `if (!instrumentID) { return ... }` 提前返回、原停靠模式 `{!instrumentID && ...}` 提示块、`{instrumentID && <OrderTradeBody .../>}` 条件包裹。）

**(c) `TradeParams.tsx`** — 空态搜索框 placeholder + 操作按钮禁用：

搜索框：

```tsx
<ContractSearch
  key={activeInstrument}
  contracts={contracts}
  initialQuery={activeInstrument}
  onSelect={handleContractSelect}
  placeholder={activeInstrument ? undefined : '请选择合约'}
/>
```

三个操作按钮加 `!activeInstrument` 禁用条件：

```tsx
<button ... data-testid="tp-cancel-latest" onClick={handleCancelLatest} disabled={opPending || !activeInstrument}>撤最新</button>
<button ... data-testid="tp-cancel-all" onClick={() => setConfirmOp('cancelAll')} disabled={opPending || !activeInstrument}>撤全部</button>
<button ... data-testid="tp-flat-net" onClick={() => setConfirmOp('flatNet')} disabled={opPending || !activeInstrument}>平净仓</button>
```

**(d) `QuoteStatsBar.tsx`** — 占位符统一 `--`：

```tsx
const PLACEHOLDER = '--'
```

**(e) `OrderPage.css`** — 删除无合约提示样式（已无引用）：

删除整个块：

```css
/* ── 无合约提示 ─────────────────────────────────────────────── */

.order-page__no-contract {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

以及：

```css
.order-floating .order-page__no-contract {
  flex: 1;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/OrderPage.test.tsx src/modules/order/QuoteStatsBar.test.tsx src/modules/order/TradeParams.test.tsx`
Expected: PASS。再跑 `npx tsc --noEmit` 确认类型干净。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/OrderPage.tsx frontend/src/pages/OrderPage.css frontend/src/modules/order/OrderTradeBody.tsx frontend/src/modules/order/TradeParams.tsx frontend/src/modules/order/QuoteStatsBar.tsx frontend/src/pages/__tests__/OrderPage.test.tsx frontend/src/modules/order/QuoteStatsBar.test.tsx
git commit -m "feat(order): 无合约空态渲染完整界面（-- + 请选择合约），撤单/平仓无合约禁用"
```

---

### Task 3: K线空态界面（KLinePage）

**Files:**
- Modify: `frontend/src/pages/KLinePage.tsx`
- Modify: `frontend/src/pages/KLinePage.css`
- Test: `frontend/src/pages/__tests__/KLinePage.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ContractSearchProps.placeholder?: string`
- Produces: `KLinePage` 无合约时渲染 `KLineChart`（instrument 空串、最新价 `--`、空数据空网格），搜索框 placeholder「请选择合约」。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/pages/__tests__/KLinePage.test.tsx` 中：

把「无快照时最新价占位」断言（约 134-137 行）改为 `--`：

```tsx
it('should show dash for latest price in KLineChart header when snapshot unavailable', () => {
  render(<KLinePage instrumentID="IF2608" />);
  expect(screen.getByTestId('latest-price').textContent).toBe('--');
});
```

把末尾「无合约显示提示文案」测试（约 175-178 行）替换为：

```tsx
it('无合约时渲染空态K线图（-- 最新价 + 请选择合约搜索框）', () => {
  render(<KLinePage />);
  expect(screen.getByTestId('kline-chart')).toBeDefined();
  expect(screen.getByTestId('latest-price').textContent).toBe('--');
  expect(screen.getByPlaceholderText('请选择合约')).toBeDefined();
  expect(screen.queryByText(/请在行情表格中选择合约/)).toBeNull();
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/KLinePage.test.tsx`
Expected: FAIL（无合约仍只显示提示文案，不渲染 KLineChart；最新价仍 `—`）

- [ ] **Step 3: 实现**

`frontend/src/pages/KLinePage.tsx`：

最新价占位（约 47 行）改为：

```tsx
const latestPrice = snapshot?.lastPrice != null ? formatPrice(snapshot.lastPrice, priceTick) : '--'
```

`return` 块（去掉 `{!instrumentID && ...}` 提示块与 `{instrumentID && ...}` 条件包裹，恒渲染）：

```tsx
return (
  <div className="kline-page">
    <div className="kline-page__content">
      <KLineChart
        instrument={instrumentID ?? ''}
        latestPrice={latestPrice}
        klineData={data}
        period={currentPeriod}
        onPeriodChange={setPeriod}
        searchSlot={
          <ContractSearch
            key={instrumentID ?? ''}
            contracts={contracts}
            initialQuery={instrumentID ?? ''}
            onSelect={handleSwitch}
            placeholder={instrumentID ? undefined : '请选择合约'}
          />
        }
      />
    </div>
    {isElectron() && <div className="kline-page__electron-info">独立窗口模式</div>}
  </div>
)
```

`frontend/src/pages/KLinePage.css` — 删除已无引用的提示块（第 11-20 行，`.kline-page__content` 的 flex 规则保留不动——`KLinePage.style.test` 依赖它）：

```css
/* ── 无合约提示 ─────────────────────────────────────────────── */

.kline-page__no-contract {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/KLinePage.test.tsx src/pages/KLinePage.style.test.tsx`
Expected: PASS。再跑 `npx tsc --noEmit`。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/KLinePage.tsx frontend/src/pages/KLinePage.css frontend/src/pages/__tests__/KLinePage.test.tsx
git commit -m "feat(kline): 无合约空态渲染 K线图（-- + 请选择合约）"
```

---

### Task 4: order store volumeStep（步进基准）

**Files:**
- Modify: `frontend/src/modules/order/store.ts`
- Test: `frontend/src/modules/order/store.test.ts`

**Interfaces:**
- Produces: `OrderStore.volumeStep: number`（默认 `1`）、`OrderStore.setVolumeStep(step: number): void`。`resetOrderForm`/`submitOrder` 不重置 `volumeStep`。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/modules/order/store.test.ts` 的 `describe('OrderStore')` 内追加（`beforeEach` 已存在）：

给 `beforeEach` 的 `setState` 加 `volumeStep: 1`：

```tsx
useOrderStore.setState({
  selectedInstrument: null,
  orderForm: { ...DEFAULT_ORDER_FORM },
  isSubmitting: false,
  lastSubmitError: null,
  volumeStep: 1,
})
```

新增测试：

```tsx
// --- volumeStep（步进基准） ---

it('默认步进基准为 1', () => {
  expect(useOrderStore.getState().volumeStep).toBe(1)
})

it('setVolumeStep 写入步进基准', () => {
  useOrderStore.getState().setVolumeStep(20)
  expect(useOrderStore.getState().volumeStep).toBe(20)
})

it('resetOrderForm 重置手数为 1 但保持步进基准', () => {
  useOrderStore.getState().setVolumeStep(20)
  useOrderStore.getState().setOrderForm({ volumeTotalOriginal: 5 })
  useOrderStore.getState().resetOrderForm()
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(1)
  expect(useOrderStore.getState().volumeStep).toBe(20)
})

it('submitOrder 成功后手数记忆且步进基准保持', async () => {
  vi.mocked(mockSubmitOrder).mockResolvedValue({ success: true, orderRef: 'ORD-003' })
  useOrderStore.getState().setVolumeStep(20)
  useOrderStore.getState().setOrderForm({ instrumentID: 'IF2608', limitPrice: 4800, volumeTotalOriginal: 3 })
  await useOrderStore.getState().submitOrder()
  expect(useOrderStore.getState().volumeStep).toBe(20)
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(3)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/order/store.test.ts`
Expected: FAIL（`volumeStep` 字段不存在，`toBe(1)` 拿到 undefined）

- [ ] **Step 3: 实现**

`frontend/src/modules/order/store.ts`：

```tsx
interface OrderStore {
  selectedInstrument: string | null
  orderForm: OrderRequestForm
  isSubmitting: boolean
  /** 最近一次报单失败原因（P3 乐观渲染失败回滚时顶部红条展示）；无失败为 null */
  lastSubmitError: string | null
  /** 手数步进基准（快捷手数选中值；+/- 按此步进）。独立字段，不进 orderForm，报单后不重置 */
  volumeStep: number
  setSelectedInstrument: (instrument: string | null) => void
  setOrderForm: (partial: Partial<OrderRequestForm>) => void
  setVolumeStep: (step: number) => void
  resetOrderForm: () => void
  submitOrder: () => Promise<boolean>
  submitStopOrder: (triggerPriceType?: 'limit' | 'market') => Promise<boolean>
  cancelOrder: (orderRef: string) => Promise<boolean>
}
```

初始 state 加 `volumeStep: 1`，actions 加：

```tsx
setVolumeStep: (step) => set({ volumeStep: step }),
```

`resetOrderForm` 与 `submitOrder` **不动**（不重置 `volumeStep`）。

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/order/store.test.ts`
Expected: PASS（全部 19 个）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/order/store.ts frontend/src/modules/order/store.test.ts
git commit -m "feat(order-store): 新增 volumeStep 步进基准（报单/重置不重置）"
```

---

### Task 5: 手数步进跟随快捷（QtyPreset + TradeParams）

**Files:**
- Modify: `frontend/src/modules/order/QtyPreset.tsx`
- Modify: `frontend/src/modules/order/TradeParams.tsx`
- Test: `frontend/src/modules/order/QtyPreset.test.tsx`
- Test: `frontend/src/modules/order/TradeParams.test.tsx`

**Interfaces:**
- Consumes: Task 4 `useOrderStore.getState().volumeStep` / `.setVolumeStep(step)`
- Produces: `QtyPreset({ step, onSelect })`（高亮 `step === p`，`onSelect(raw)` 收原始预设值）；`TradeParams` 的 `+/-` 按 `volumeStep` 步进、点快捷 → 手数 `min(p, limit)` + 步进 `p`。

- [ ] **Step 1: 写失败测试**

**`QtyPreset.test.tsx`** 整体替换为：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QtyPreset } from './QtyPreset'

describe('QtyPreset（P3 快捷手数预设）', () => {
  it('渲染 1 / 20 / 50 / 100 分段按钮', () => {
    render(<QtyPreset step={1} onSelect={vi.fn()} />)
    for (const p of ['1', '20', '50', '100']) {
      expect(screen.getByText(p)).toBeInTheDocument()
    }
  })

  it('点击预设 → onSelect(该预设原始值)', () => {
    const onSelect = vi.fn()
    render(<QtyPreset step={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('20'))
    expect(onSelect).toHaveBeenCalledWith(20)
    fireEvent.click(screen.getByText('100'))
    expect(onSelect).toHaveBeenCalledWith(100)
  })

  it('步进基准对应的预设按钮高亮（active）', () => {
    render(<QtyPreset step={50} onSelect={vi.fn()} />)
    expect(screen.getByText('50').className).toContain('qty-preset__btn--active')
    expect(screen.getByText('1').className).not.toContain('qty-preset__btn--active')
  })

  it('切换步进基准后高亮跟随（点 20 → 手数 40 仍高亮 20；点 1 → 高亮切到 1）', () => {
    const { rerender } = render(<QtyPreset step={20} onSelect={vi.fn()} />)
    expect(screen.getByText('20').className).toContain('qty-preset__btn--active')
    // 手数被 + 到 40：步进基准仍 20 → 20 持续高亮
    rerender(<QtyPreset step={20} onSelect={vi.fn()} />)
    expect(screen.getByText('20').className).toContain('qty-preset__btn--active')
    // 点 1 → 步进基准切到 1
    rerender(<QtyPreset step={1} onSelect={vi.fn()} />)
    expect(screen.getByText('1').className).toContain('qty-preset__btn--active')
    expect(screen.getByText('20').className).not.toContain('qty-preset__btn--active')
  })
})
```

**`TradeParams.test.tsx`**：
- `beforeEach` 加 `volumeStep: 1` 重置（避免 store 单例跨用例残留）：

```tsx
beforeEach(() => {
  setForm({ instrumentID: 'IF2608', volumeTotalOriginal: 1, orderPriceType: 'limit' })
  useOrderStore.setState({ volumeStep: 1 })
  useContractsStore.setState({
    contracts: [IF2608_CONTRACT],
    favorites: [],
    isLoaded: true,
  })
})
```

- 「快捷手数（P3 QtyPreset 集成）」`describe` 内新增，并把「市价单上限 60：点击 100 预设 → 钳制到 60」改为同时断言步进：

```tsx
it('点击预设 → 手数设为预设值 + 步进设为预设值', () => {
  render(<TradeParams />)
  fireEvent.click(screen.getByTestId('qty-preset-20'))
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(20)
  expect(useOrderStore.getState().volumeStep).toBe(20)
})

it('步进 +/− 按 volumeStep（点 20 → + → 40 → − → 20）', () => {
  render(<TradeParams />)
  fireEvent.click(screen.getByTestId('qty-preset-20'))
  fireEvent.click(screen.getByTestId('tp-volume-up'))
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(40)
  fireEvent.click(screen.getByTestId('tp-volume-down'))
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(20)
})

it('手动输入手数不改变步进（步进 20 → 输入 35 → + → 55）', () => {
  render(<TradeParams />)
  fireEvent.click(screen.getByTestId('qty-preset-20'))
  fireEvent.change(screen.getByTestId('tp-volume'), { target: { value: '35' } })
  expect(useOrderStore.getState().volumeStep).toBe(20)
  fireEvent.click(screen.getByTestId('tp-volume-up'))
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(55)
})

it('市价 limit 60：点 20 步进 → + → 40 → + → 60 到顶禁用', () => {
  setForm({ orderPriceType: 'market' })
  render(<TradeParams />)
  fireEvent.click(screen.getByTestId('qty-preset-20'))
  fireEvent.click(screen.getByTestId('tp-volume-up'))
  fireEvent.click(screen.getByTestId('tp-volume-up'))
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(60)
  expect(screen.getByTestId('tp-volume-up')).toBeDisabled()
})

it('市价 limit 60：点 100 预设 → 手数钳制到 60、步进为 100', () => {
  setForm({ orderPriceType: 'market' })
  render(<TradeParams />)
  fireEvent.click(screen.getByTestId('qty-preset-100'))
  expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(60)
  expect(useOrderStore.getState().volumeStep).toBe(100)
})
```

原测试「市价单上限 60：点击 100 预设 → 钳制到 60」删除（被上面「点 100 预设 → 钳制到 60、步进为 100」替代）。

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/order/QtyPreset.test.tsx src/modules/order/TradeParams.test.tsx`
Expected: FAIL（QtyPreset 新 API 不匹配 / 步进仍按 1）

- [ ] **Step 3: 实现**

**`QtyPreset.tsx`** 整体替换为：

```tsx
import './QtyPreset.css'

const PRESETS = [1, 20, 50, 100]

interface QtyPresetProps {
  /** 当前步进基准（命中预设值高亮） */
  step: number
  /** 选中原始预设值（钳制由 TradeParams 统一处理，step 用原始值） */
  onSelect: (volume: number) => void
}

/**
 * QtyPreset — 快捷手数预设（P3 ③ 参数区）
 *
 * `1 20 50 100` 分段按钮，点击选为手数步进基准；当前步进基准命中预设值高亮。
 * 手数钳制（数量上限）由 TradeParams 统一处理。
 */
export function QtyPreset({ step, onSelect }: QtyPresetProps) {
  return (
    <div className="qty-preset" data-testid="qty-preset">
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          className={`qty-preset__btn${step === p ? ' qty-preset__btn--active' : ''}`}
          data-testid={`qty-preset-${p}`}
          onClick={() => onSelect(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
```

**`TradeParams.tsx`**：

加 store 选择器：

```tsx
const volumeStep = useOrderStore((s) => s.volumeStep)
const setVolumeStep = useOrderStore((s) => s.setVolumeStep)
```

手数步进区（约 172-212 行）改为：

```tsx
<div className="tp-row">
  <span className="tp-row__label">手数</span>
  <div className="tp-stepper">
    <button
      type="button"
      className="tp-stepper__btn"
      data-testid="tp-volume-down"
      aria-label="减手数"
      onClick={() =>
        setOrderForm({ volumeTotalOriginal: Math.max(1, orderForm.volumeTotalOriginal - volumeStep) })
      }
    >
      −
    </button>
    <input
      data-testid="tp-volume"
      type="number"
      className="tp-stepper__input"
      value={orderForm.volumeTotalOriginal}
      min={1}
      step={volumeStep}
      onChange={(e) =>
        setOrderForm({ volumeTotalOriginal: Math.max(1, Number(e.target.value)) })
      }
    />
    <button
      type="button"
      className="tp-stepper__btn"
      data-testid="tp-volume-up"
      aria-label="加手数"
      disabled={orderForm.volumeTotalOriginal >= volumeLimit}
      onClick={() =>
        setOrderForm({
          volumeTotalOriginal: Math.min(volumeLimit, orderForm.volumeTotalOriginal + volumeStep),
        })
      }
    >
      +
    </button>
  </div>
</div>
```

快捷栏（约 222-229 行）改为：

```tsx
<div className="tp-row">
  <span className="tp-row__label">快捷</span>
  <QtyPreset
    step={volumeStep}
    onSelect={(raw) => {
      setOrderForm({ volumeTotalOriginal: Math.min(volumeLimit, raw) })
      setVolumeStep(raw)
    }}
  />
</div>
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/order/QtyPreset.test.tsx src/modules/order/TradeParams.test.tsx src/modules/order/store.test.ts src/pages/__tests__/OrderPage.test.tsx`
Expected: PASS。再跑 `npx tsc --noEmit`。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/order/QtyPreset.tsx frontend/src/modules/order/QtyPreset.test.tsx frontend/src/modules/order/TradeParams.tsx frontend/src/modules/order/TradeParams.test.tsx
git commit -m "feat(order): 手数步进跟随快捷预设（volumeStep），高亮随步进基准"
```

---

## 全量验证（最后收尾）

- [ ] Run: `cd frontend && npx tsc --noEmit` — Expected: 无错误
- [ ] Run: `cd frontend && npm test` — Expected: 全量通过（原 1089 + 新增）
- [ ] Run: `cd frontend && npm run build` — Expected: 构建成功
