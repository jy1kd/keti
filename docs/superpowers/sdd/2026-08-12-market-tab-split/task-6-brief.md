### Task 6: 期权面板（分组列表 + T型报价二级视图）

**Files:**
- Create: `frontend/src/modules/market/optionsSpec.ts`（期权列 + buildRecord + rowStyle）
- Create: `frontend/src/modules/options/OptionsPanel.tsx`（重写：二级切换 shell）
- Create: `frontend/src/modules/options/TQuoteView.tsx`（现 OptionPanel 的 T型报价内容原样迁入）
- Modify: `frontend/src/components/TabContent/index.tsx:51-52`（`case 'options'` 渲染 `OptionsPanel`）
- Modify: `frontend/src/modules/options/OptionPanel.tsx`（删除，内容迁到 TQuoteView）
- Test: `frontend/src/modules/market/optionsSpec.test.ts`、`frontend/src/modules/options/OptionsPanel.test.tsx`

**Interfaces:**
- Consumes: `QuoteTableSpec`/`QuoteRecord`（Task 5）、`groupOptionsByUnderlying`/`deriveUnderlyingProduct`（Task 1）、`useTabStore`（判断激活）、`useMarketStore`/`useContractsStore`。
- Produces: `optionsSpec`；`OptionsPanel`（含 `[列表|T型报价]` 切换）；`TQuoteView`（原 OptionPanel 内容）。Task 8 在其工具行叠加搜索栏与筛选。

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/modules/market/optionsSpec.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { optionsSpec } from './optionsSpec'

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const opt: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }

describe('optionsSpec', () => {
  it('列定义含 类型/行权价', () => {
    expect(optionsSpec.columns.map((c) => c.field)).toEqual(
      expect.arrayContaining(['contractType', 'strikePrice']),
    )
  })

  it('标底行 kind=underlying 且类型列为「标」', () => {
    const r = optionsSpec.buildRecord(fut, undefined, false)
    expect(r.kind).toBe('underlying')
    expect(r.contractType).toBe('标')
  })

  it('期权行 kind=option 且类型列 C/P、行权价填充', () => {
    const r = optionsSpec.buildRecord(opt, undefined, false)
    expect(r.kind).toBe('option')
    expect(r.contractType).toBe('C')
    expect(r.strikePrice).toBe(1300)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/optionsSpec.test.ts`
Expected: FAIL（`Cannot find module './optionsSpec'`）

- [ ] **Step 3: 抽期权 spec**

创建 `frontend/src/modules/market/optionsSpec.ts`：

```ts
import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getProductName } from '@/utils/productNames'
import { getContractStatus, type ContractStatus } from '@/utils/contractStatus'
import { PLACEHOLDER, isValidPrice, coloredStyle, statusStyle, type QuoteTableSpec, type QuoteRecord } from './quoteTable'
import { deriveUnderlyingProduct } from './sort'

const columns = [
  { field: 'instrumentID', title: '合约', width: 150 },
  { field: 'contractType', title: '类型', width: 50, style: statusStyle },
  { field: 'strikePrice', title: '行权价', width: 90 },
  { field: 'expireDate', title: '到期日', width: 115 },
  { field: 'exchangeID', title: '交易所', width: 85 },
  { field: 'status', title: '状态', width: 85, style: statusStyle },
  { field: 'lastPrice', title: '最新价', width: 90, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 115, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 115, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 120, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 120, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 90 },
  { field: 'openInterest', title: '持仓量', width: 90 },
  { field: 'favorite', title: '⭐', width: 60 },
]

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean): QuoteRecord {
  const kind = contract.productClass === '1' ? 'underlying' : 'option'
  const status = getContractStatus(contract)
  const contractType = kind === 'underlying' ? '标' : (contract.optionsType === '1' ? 'C' : 'P')
  const base = {
    instrumentID: contract.instrumentID,
    kind,
    contractType,
    strikePrice: kind === 'option' ? contract.strikePrice : PLACEHOLDER,
    expireDate: contract.expireDate || PLACEHOLDER,
    exchangeID: contract.exchangeID || PLACEHOLDER,
    status,
    favorite: isFavorited ? '⭐' : '☆',
  }
  if (!snap) {
    return { ...base, lastPrice: PLACEHOLDER, change: PLACEHOLDER, changePercent: PLACEHOLDER, bidPrice1: PLACEHOLDER, askPrice1: PLACEHOLDER, volume: PLACEHOLDER, openInterest: PLACEHOLDER }
  }
  const preSettlement = (snap.preSettlementPrice && snap.preSettlementPrice > 0) ? snap.preSettlementPrice : (snap.preClosePrice || snap.lastPrice)
  const change = snap.lastPrice - preSettlement
  const changePercent = preSettlement ? (change / preSettlement) * 100 : 0
  return {
    ...base,
    lastPrice: isValidPrice(snap.lastPrice) ? snap.lastPrice : PLACEHOLDER,
    change: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? change : PLACEHOLDER,
    changePercent: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? changePercent : PLACEHOLDER,
    bidPrice1: isValidPrice(snap.bidPrice1) ? snap.bidPrice1 : PLACEHOLDER,
    askPrice1: isValidPrice(snap.askPrice1) ? snap.askPrice1 : PLACEHOLDER,
    volume: snap.volume,
    openInterest: snap.openInterest,
  }
}

/** 标底行：深色底 + 上分隔线 */
function rowStyle(record: QuoteRecord): Record<string, unknown> | undefined {
  if (record.kind === 'underlying') return { bgColor: '#1a2230' }
  return undefined
}

export const optionsSpec: QuoteTableSpec = { columns, buildRecord, rowStyle }
```

- [ ] **Step 4: 迁 T型报价为二级视图**

新建 `frontend/src/modules/options/TQuoteView.tsx`，内容 = 现 `OptionPanel.tsx` 整体（原样搬移，仅组件名改 `TQuoteView`）。删除 `OptionPanel.tsx`。

- [ ] **Step 5: 新建 OptionsPanel shell**

创建 `frontend/src/modules/options/OptionsPanel.tsx`，含 `[列表|T型报价]` 二级切换 + 列表视图渲染分组表：

```tsx
import { useMemo, useState } from 'react'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { groupOptionsByUnderlying } from '@/modules/market/sort'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { TQuoteView } from './TQuoteView'

export function OptionsPanel() {
  const [view, setView] = useState<'list' | 'tquote'>('list')
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { contracts, favorites, addToFavorites, removeFromFavorites } = useContractsStore()
  const activeTabId = useTabStore((s) => s.activeTabId)
  const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'options' && t.id === s.activeTabId))

  // 期货全量 → 期权全量 → 分组展平为有序 ContractInfo[]（标底行在前、期权行随后）
  const rows = useMemo(() => {
    const futures = contracts.filter((c) => c.productClass === '1')
    const options = contracts.filter((c) => c.productClass === '2' || c.productClass === '6')
    const groups = groupOptionsByUnderlying(options, futures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [contracts])

  // 行级收藏/选中/右键复用 futures 页同一套 hook（usePointOrder + useContractContextMenu），
  // 此处为示意，具体 onRowClick/onContextMenu 从这两个 hook 取得后透传。

  return (
    <section className="options-panel">
      <div className="market-toolbar">
        <div className="market-toolbar__mode">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>列表</button>
          <button className={view === 'tquote' ? 'active' : ''} onClick={() => setView('tquote')}>T型报价</button>
        </div>
        {/* Task 7/8 在此叠加 全部/自选、筛选、仅交易中、收藏、搜索框 */}
      </div>
      {view === 'tquote'
        ? <TQuoteView />
        : <QuoteTable spec={optionsSpec} contracts={rows} snapshots={snapshots} isActive={isActive} /* …交互 props */ />
      }
    </section>
  )
}
```

（`usePointOrder`/`useContractContextMenu` 的接入与 futures 页一致，Task 8 统一补齐交互 props。）

- [ ] **Step 6: TabContent 渲染期权面板**

`frontend/src/components/TabContent/index.tsx:51-52` 的 `case 'options'` 改为 `return <OptionsPanel />`（import 该组件）。

- [ ] **Step 7: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/optionsSpec.test.ts src/modules/options/OptionsPanel.test.tsx src/components/TabContent/index.test.tsx`
Expected: PASS（OptionsPanel.test 覆盖 `[列表|T型报价]` 切换、列表默认；TabContent 期权不再占位符）

- [ ] **Step 8: 提交**

```bash
git add frontend/src/modules/market/optionsSpec.ts frontend/src/modules/market/optionsSpec.test.ts frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/TQuoteView.tsx frontend/src/components/TabContent/index.tsx
git rm frontend/src/modules/options/OptionPanel.tsx
git commit -m "feat(options): 期权面板=按标底分组列表(默认)+T型报价二级视图"
```

---

