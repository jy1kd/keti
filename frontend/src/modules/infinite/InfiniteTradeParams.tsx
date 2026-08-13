import { useMemo, useState } from 'react'
import { useInfiniteOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useQueryStore } from '@/modules/query/store'
import { validateVolumeWithLimit, getVolumeLimit } from '@/utils/validators'
import { reversePosition } from '@/services/api'
import { ACTIVE_ORDER_STATUSES } from '@/modules/order/myOrders'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { ContractSearch } from '@/components/ContractSearch'
import { QtyPreset } from '@/modules/order/QtyPreset'
import type { InfiniteOrderState } from './store'
import './InfiniteTradeParams.css'

interface InfiniteTradeParamsProps {
  instrumentID?: string
  onSwitch?: (instrumentID: string) => void
}

export function InfiniteTradeParams({ instrumentID, onSwitch }: InfiniteTradeParamsProps) {
  const order = useInfiniteOrderStore((s) => s)
  const contracts = useContractsStore((s) => s.contracts)

  const activeInstrument = instrumentID ?? ''
  const productClass = useMemo(() => {
    const c = contracts.find((x) => x.instrumentID === activeInstrument)
    return c?.productClass ?? '1'
  }, [contracts, activeInstrument])

  const volumeLimit = getVolumeLimit('limit', productClass)
  const volumeError = validateVolumeWithLimit(order.volumeTotalOriginal, 'limit', productClass)

  const [confirmOp, setConfirmOp] = useState<'cancelAll' | 'flatNet' | null>(null)
  const [opPending, setOpPending] = useState(false)

  const handleContractSelect = (code: string) => {
    order.setInstrument(code)
    onSwitch?.(code)
  }

  const handleCancelLatest = async () => {
    await useQueryStore.getState().fetchOrders()
    const mine = useQueryStore.getState().orders
      .filter((o) => o.instrumentID === activeInstrument && ACTIVE_ORDER_STATUSES.includes(o.orderStatus))
      .sort((a, b) => (b.insertTime ?? '').localeCompare(a.insertTime ?? ''))
    const latest = mine[0]
    if (!latest) { toast.error('暂无该合约可撤报单'); return }
    await useQueryStore.getState().handleCancelOrder(latest.orderRef)
  }

  const handleCancelAll = async () => {
    if (opPending) return
    setOpPending(true)
    try { await useQueryStore.getState().handleCancelAll(); setConfirmOp(null) }
    finally { setOpPending(false) }
  }

  const handleFlatNet = async () => {
    if (opPending) return
    setOpPending(true)
    try {
      const res = await reversePosition({ instrumentID: activeInstrument, executionMode: 'serial' })
      if (res.success) { toast.success('平净仓已提交'); useQueryStore.getState().fetchPositions() }
      else toast.error(`平净仓失败：${res.message || '未知错误'}`)
      setConfirmOp(null)
    } catch (e) {
      toast.error(`平净仓失败：${e instanceof Error ? e.message : '未知错误'}`)
      setConfirmOp(null)
    } finally { setOpPending(false) }
  }

  const setField = useInfiniteOrderStore((s) => s.setField)

  return (
    <div className="infinite-trade-params">
      <div className="itp-row">
        <span className="itp-row__label">合约</span>
        <ContractSearch key={activeInstrument} contracts={contracts} initialQuery={activeInstrument} onSelect={handleContractSelect} placeholder={activeInstrument ? undefined : '请选择合约'} />
      </div>
      <div className="itp-row">
        <span className="itp-row__label">开平</span>
        <select className="itp-row__select" aria-label="开平" value={order.combOffsetFlag}
          onChange={(e) => setField({ combOffsetFlag: e.target.value as InfiniteOrderState['combOffsetFlag'] })}>
          <option value="open">开</option><option value="close">平</option><option value="close_today">平今</option>
        </select>
      </div>
      <div className="itp-row">
        <span className="itp-row__label">投保</span>
        <select className="itp-row__select" aria-label="投保" value={order.combHedgeFlag}
          onChange={(e) => setField({ combHedgeFlag: e.target.value as InfiniteOrderState['combHedgeFlag'] })}>
          <option value="speculation">投机</option><option value="arbitrage">套利优惠</option><option value="hedge">套保</option>
        </select>
      </div>
      <div className="itp-row">
        <span className="itp-row__label">有效期</span>
        <select className="itp-row__select" aria-label="有效期" value={order.timeCondition}
          onChange={(e) => setField({ timeCondition: e.target.value as InfiniteOrderState['timeCondition'] })}>
          <option value="gfd">GFD</option><option value="fok">FOK</option><option value="fak">FAK</option>
        </select>
      </div>
      <div className="itp-row">
        <span className="itp-row__label">手数</span>
        <div className="itp-stepper">
          <button type="button" className="itp-stepper__btn" aria-label="减手数"
            onClick={() => setField({ volumeTotalOriginal: Math.max(1, order.volumeTotalOriginal - order.volumeStep) })}>−</button>
          <input type="number" className="itp-stepper__input" value={order.volumeTotalOriginal} min={1} step={order.volumeStep}
            onChange={(e) => setField({ volumeTotalOriginal: Math.max(1, Number(e.target.value)) })} />
          <button type="button" className="itp-stepper__btn" aria-label="加手数"
            disabled={order.volumeTotalOriginal >= volumeLimit}
            onClick={() => setField({ volumeTotalOriginal: Math.min(volumeLimit, order.volumeTotalOriginal + order.volumeStep) })}>+</button>
        </div>
      </div>
      <div className={`itp-hint${volumeError ? ' itp-hint--error' : ''}`}>
        <span>最大 {volumeLimit} 手</span>
        {volumeError && <span className="itp-hint__error">{volumeError}</span>}
      </div>
      <div className="itp-row">
        <span className="itp-row__label">快捷</span>
        <QtyPreset step={order.volumeStep} onSelect={(v) => setField({ volumeStep: v })} />
      </div>
      <div className="itp-row itp-row--ops">
        <button type="button" className="itp-op-btn" onClick={handleCancelLatest} disabled={opPending || !activeInstrument}>撤最新</button>
        <button type="button" className="itp-op-btn" onClick={() => setConfirmOp('cancelAll')} disabled={opPending || !activeInstrument}>撤全部</button>
      </div>
      <button type="button" className="itp-op-btn itp-op-btn--primary" onClick={() => setConfirmOp('flatNet')} disabled={opPending || !activeInstrument}>平净仓</button>

      {confirmOp === 'cancelAll' && (
        <ConfirmDialog title="确认撤全部" details={[{ label: '范围', value: '所有未成交报单' }]}
          warning="将撤销所有未成交报单（全部合约），请确认。" onConfirm={handleCancelAll} onCancel={() => setConfirmOp(null)} />
      )}
      {confirmOp === 'flatNet' && (
        <ConfirmDialog title="确认平净仓" details={[{ label: '合约', value: activeInstrument }]}
          warning="将平掉当前合约全部净持仓并反向开仓（市价串行），会真实下单，请确认。" onConfirm={handleFlatNet} onCancel={() => setConfirmOp(null)} />
      )}
    </div>
  )
}
