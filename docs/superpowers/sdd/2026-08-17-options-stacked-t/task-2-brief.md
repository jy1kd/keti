### Task 2: TQuoteTable 支持 `onRowClick`

**Files:**
- Modify: `frontend/src/modules/options/TQuoteTable.tsx`（`TQuoteRow` 加 `callInstrumentID`/`putInstrumentID`；`buildRecords` 填充；props 加 `onRowClick?`；单元格点击回调）
- Test: `frontend/src/modules/options/TQuoteTable.test.tsx`

**Interfaces:**
- Consumes: `OptionChain` 类型（`{ underlying, expireDate, calls: OptionQuote[], puts: OptionQuote[] }`），`OptionQuote` 含 `instrumentID`
- Produces: `TQuoteTable` 新签名 `onRowClick?: (instrumentID: string, price: number) => void`；点击 C 侧列回传该 `call.instrumentID`，P 侧列回传 `put.instrumentID`，中列（行权价）不回调，缺失侧不回调。

- [ ] **Step 1: 写失败测试**

```tsx
// frontend/src/modules/options/TQuoteTable.test.tsx
import { render, fireEvent } from '@testing-library/react'
import { ListTable } from '@visactor/vtable'
import { TQuoteTable } from './TQuoteTable'
import type { OptionChain } from '@/services/types'

// vtable 在 jsdom 下无法真实初始化；mock ListTable，捕获 on('click_cell') handler
vi.mock('@visactor/vtable', () => ({
  ListTable: class {
    _handlers: Record<string, Function[]> = {}
    constructor(public el: any, public opts: any) {}
    on(ev: string, fn: Function) { (this._handlers[ev] ||= []).push(fn) }
    release() {}
    setRecords() {}
  } as any,
}))

const chain: OptionChain = {
  underlying: 'FG609',
  expireDate: '20260930',
  calls: [{ instrumentID: 'FG609-C-1300', strikePrice: 1300, optionType: '1', lastPrice: 10, bidPrice: 9, askPrice: 11, volume: 100, openInterest: 200, impliedVolatility: 0 }],
  puts: [{ instrumentID: 'FG609-P-1250', strikePrice: 1300, optionType: '2', lastPrice: 5, bidPrice: 4, askPrice: 6, volume: 50, openInterest: 80, impliedVolatility: 0 }],
}

function getClickHandler(table: any) {
  return table._handlers['click_cell'][0]
}

describe('TQuoteTable onRowClick', () => {
  it('未传 onRowClick 时不报错（回归 TQuoteView）', () => {
    const { container } = render(<TQuoteTable chain={chain} />)
    const table = (container.querySelector('div') as any).__vtable ?? (container as any).__vtable
    // 渲染完成即可，无回调断言
    expect(table).toBeDefined()
  })

  it('点击 C 侧列回传 call.instrumentID 与最新价', () => {
    const onRowClick = vi.fn()
    const { container } = render(<TQuoteTable chain={chain} onRowClick={onRowClick} />)
    const tbl = (container as any).__vtable
    // callLastPrice 是 index 6 列；行 1 = 第一行数据
    getClickHandler(tbl)({ row: 1, col: 6, event: {} })
    expect(onRowClick).toHaveBeenCalledWith('FG609-C-1300', 10)
  })

  it('点击中列（行权价，index 7）不回调', () => {
    const onRowClick = vi.fn()
    const { container } = render(<TQuoteTable chain={chain} onRowClick={onRowClick} />)
    getClickHandler((container as any).__vtable)({ row: 1, col: 7, event: {} })
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
```

注意：上面 mock 依赖 ListTable 实例能被取出。实现时需让 `TQuoteTable` 在 `useEffect` 里把 `tableRef.current` 挂到 `container.__vtable` 之外可由测试触达的位置。更稳妥的写法见 Step 3：在 `TQuoteTable` 暴露一个 `onReady?` 回调或在测试里通过 `fireEvent.click` 真实单元格不可行（canvas）。因此测试改用「捕获 click_cell handler」策略，要求 `TQuoteTable` 把创建好的 table 实例通过 `ref` 或 `onTableReady` 暴露。**采用下方 Step 3 的 `onTableReady?` 透传方案**：

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/TQuoteTable.test.tsx`
Expected: FAIL（测试文件/函数不存在）

- [ ] **Step 3: 最小实现**

```tsx
// TQuoteTable.tsx 改动：
interface TQuoteTableProps {
  chain: OptionChain
  snapshots?: Map<string, MarketSnapshot>
  /** 新增：点击 C/P 侧单元格回调；中列（行权价）与缺失侧不回调 */
  onRowClick?: (instrumentID: string, price: number) => void
  /** 新增：暴露 vtable 实例（测试用，生产可忽略） */
  onTableReady?: (table: ListTable) => void
}

// TQuoteRow 增加两侧合约 ID
interface TQuoteRow {
  strikePrice: number
  callInstrumentID?: string
  callLastPrice: number | string
  ...
  putInstrumentID?: string
  putLastPrice: number | string
  ...
}

// buildRecords 填充：
const c = entry.call
const p = entry.put
return {
  strikePrice: strike,
  callInstrumentID: c?.instrumentID,
  putInstrumentID: p?.instrumentID,
  callLastPrice: ...,
  ...
}

// 在 new ListTable(...) 之后：
tableRef.current = table
props.onTableReady?.(table)   // 透传实例给测试

// 在 table.on('click_cell', ...) 内，现有逻辑之后增加：
if (props.onRowClick) {
  const record = recordsRef.current[rowIndex]
  if (!record) return
  // 列定义顺序见 columns：call* 在左（0..4），strike 中（5），put* 在右（6..10）
  if (col >= 0 && col <= 4 && record.callInstrumentID) {
    const price = typeof record.callLastPrice === 'number' ? record.callLastPrice : 0
    props.onRowClick(record.callInstrumentID, price)
  } else if (col >= 6 && col <= 10 && record.putInstrumentID) {
    const price = typeof record.putLastPrice === 'number' ? record.putLastPrice : 0
    props.onRowClick(record.putInstrumentID, price)
  }
}
```
（列索引以 `columns` 数组 `TQuoteTable.tsx:81-101` 为准：callOpenInterest0、callVolume1、callAskPrice2、callBidPrice3、callLastPrice4、strikePrice5、putLastPrice6、putBidPrice7、putAskPrice8、putVolume9、putOpenInterest10。Step 1 测试 col 需按此更正。）

- [ ] **Step 4: 跑绿**（修正测试 col 索引后）

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/TQuoteTable.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/options/TQuoteTable.tsx frontend/src/modules/options/TQuoteTable.test.tsx
git commit -m "feat(options): TQuoteTable 支持 onRowClick 回填合约"
```

