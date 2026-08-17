import { useEffect, useState } from 'react'
import type { OptionGroup } from '@/modules/market/sort'
import type { OptionChain } from '@/services/types'
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
