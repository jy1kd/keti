### Task 3: OptionChainGroup 组件（组头 + 到期切换 + 迷你 T 表 + 订阅）

**Files:**
- Create: `frontend/src/modules/options/OptionChainGroup.tsx`
- Test: `frontend/src/modules/options/OptionChainGroup.test.tsx`

**Interfaces:**
- Consumes:
  - `OptionGroup`（`{ underlyingID, underlying?: ContractInfo, options: ContractInfo[] }`）
  - `getOptionChains(underlying?: string): Promise<{ chains: OptionChain[] }>`（api）
  - `syntheticUnderlyingContract`（Task 1）
  - `TQuoteTable`（Task 2，含 `onRowClick`）
  - `addLockedContract(id)` / `removeLockedContract(id)`（`useMarketStore`）
  - `getSnapshots(ids)`（api）
  - `openTQuoteFloating(underlyingID)`（`@/utils/openFloatingTab`）
- Produces: `OptionChainGroup` 组件，props `{ group: OptionGroup; onSelectContract: (instrumentID, price) => void }`。展开时拉链、锁订阅、渲染 T 表；折叠/切到期/卸载解锁。

- [ ] **Step 1: 写失败测试**

```tsx
// OptionChainGroup.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OptionChainGroup } from './OptionChainGroup'
import { useMarketStore } from '@/modules/market/store'
import { OptionGroup } from '@/modules/market/sort'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    getOptionChains: vi.fn().mockResolvedValue({
      chains: [
        { underlying: 'FG609', expireDate: '20260930', calls: [], puts: [] },
        { underlying: 'FG609', expireDate: '20261230', calls: [], puts: [] },
      ],
    }),
    getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  }
})
vi.mock('@/utils/openFloatingTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/openFloatingTab')>()
  return { ...actual, openTQuoteFloating: vi.fn() }
})

const group: OptionGroup = {
  underlyingID: 'FG609',
  underlying: { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
  options: [],
}

describe('OptionChainGroup', () => {
  beforeEach(() => {
    useMarketStore.setState({ lockedContracts: new Map(), addLockedContract: vi.fn(), removeLockedContract: vi.fn() })
  })

  it('默认折叠：组头可见、无到期切换条', () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    expect(screen.getByText('FG609')).toBeDefined()
    expect(screen.queryByText(/到期/)).toBeNull()
  })

  it('展开：渲染到期切换条，默认最早到期 20260930', async () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    expect(screen.getByText('20260930')).toBeDefined()
    expect(screen.queryByText('20261230')).toBeDefined()
  })

  it('展开调用 addLockedContract；折叠调用 removeLockedContract', async () => {
    const { addLockedContract, removeLockedContract } = useMarketStore.getState()
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    expect(addLockedContract).toHaveBeenCalled()
    fireEvent.click(screen.getByText('FG609'))
    expect(removeLockedContract).toHaveBeenCalled()
  })

  it('⇗ 新窗按钮调用 openTQuoteFloating(underlyingID)', async () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    fireEvent.click(screen.getByText('⇗ 新窗'))
    expect(useFloatingWindowSpy()).toHaveBeenCalledWith('FG609')
  })
})
// useFloatingWindowSpy 简化：在 Task 内直接 import openTQuoteFloating 断言
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionChainGroup.test.tsx`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 最小实现**

```tsx
import { useEffect, useRef, useState, useMemo } from 'react'
import type { OptionGroup } from '@/modules/market/sort'
import { getOptionChains, getSnapshots } from '@/services/api'
import { TQuoteTable } from './TQuoteTable'
import { useMarketStore } from '@/modules/market/store'
import { openTQuoteFloating } from '@/utils/openFloatingTab'

interface OptionChainGroupProps {
  group: OptionGroup
  onSelectContract: (instrumentID: string, price: number) => void
}

const RED_BOLD = { color: '#f87171', fontWeight: 'bold', fontSize: 14 }

export function OptionChainGroup({ group, onSelectContract }: OptionChainGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const [chains, setChains] = useState<OptionChain[] | null>(null)
  const [expireDate, setExpireDate] = useState<string | null>(null)
  const { addLockedContract, removeLockedContract } = useMarketStore()

  const underlyingLabel = group.underlying?.instrumentID ?? group.underlyingID

  // 展开时拉链（缓存）；选中最早到期
  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    getOptionChains(group.underlyingID).then((res) => {
      if (cancelled) return
      const sorted = [...res.chains].sort((a, b) => a.expireDate.localeCompare(b.expireDate))
      setChains(sorted)
      if (sorted.length > 0) setExpireDate(sorted[0].expireDate)
    })
    return () => { cancelled = true }
  }, [expanded, group.underlyingID])

  // 选链 → 锁订阅 + 预拉快照；链变化/折叠 → 解锁
  useEffect(() => {
    if (!expanded || !expireDate || !chains) return
    const chain = chains.find((c) => c.expireDate === expireDate)
    if (!chain) return
    const ids = [...chain.calls.map((q) => q.instrumentID), ...chain.puts.map((q) => q.instrumentID)]
    if (ids.length > 0) {
      ids.forEach((id) => addLockedContract(id))
      getSnapshots(ids).catch(() => {})
    }
    return () => {
      ids.forEach((id) => removeLockedContract(id))
    }
  }, [expanded, expireDate, chains, addLockedContract, removeLockedContract])

  const activeChain = chains?.find((c) => c.expireDate === expireDate) ?? null

  return (
    <div className="option-chain-group">
      <div className="option-chain-group__header" style={RED_BOLD} onClick={() => setExpanded((v) => !v)}>
        <span className="option-chain-group__arrow">{expanded ? '▼' : '▶'}</span>
        <span className="option-chain-group__name">{underlyingLabel}</span>
        <button
          className="option-chain-group__new-window"
          onClick={(e) => { e.stopPropagation(); openTQuoteFloating(group.underlyingID) }}
        >
          ⇗ 新窗
        </button>
      </div>
      {expanded && activeChain && (
        <>
          <div className="option-chain-group__expires">
            {chains!.map((c) => (
              <button
                key={c.expireDate}
                className={`option-chain-group__expire${c.expireDate === expireDate ? ' active' : ''}`}
                onClick={() => setExpireDate(c.expireDate)}
              >
                {c.expireDate}
              </button>
            ))}
          </div>
          <TQuoteTable chain={activeChain} onRowClick={onSelectContract} />
        </>
      )}
    </div>
  )
}
```
（`OptionChain` 类型需从 `@/services/types` import。）

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionChainGroup.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/options/OptionChainGroup.tsx frontend/src/modules/options/OptionChainGroup.test.tsx
git commit -m "feat(options): OptionChainGroup 组头+到期切换+订阅锁定"
```

