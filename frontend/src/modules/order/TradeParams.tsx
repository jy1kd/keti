import { useMemo, useState } from 'react'
import { useOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useQueryStore } from '../query/store'
import { validateVolumeWithLimit, getVolumeLimit } from '@/utils/validators'
import { reversePosition } from '@/services/api'
import { ACTIVE_ORDER_STATUSES } from './myOrders'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import type { OrderRequestForm } from '@/utils/orderMapping'
import { ContractSearch } from '@/components/ContractSearch'
import { QtyPreset } from './QtyPreset'
import './TradeParams.css'

interface TradeParamsProps {
  /** 可选覆盖合约代码（默认取 orderForm.instrumentID），用于定位 productClass 做数量上限校验 */
  instrumentID?: string
  /** 合约切换回调（统一浮动窗模式）：报单浮动窗切换合约时更新所属标签页；标签页模式可不传 */
  onSwitch?: (instrumentID: string) => void
}

/**
 * TradeParams — 压缩参数区（报单弹窗左栏 ~200px）
 *
 * 合约搜索切换（替换箭头步进）+ 开平 / 投保 / 有效期 三个下拉（映射 `combOffsetFlag` / `combHedgeFlag` / `timeCondition`）
 * + 手数步进（校验复用 `validateVolumeWithLimit`：期货 500 / 市价 60 / 期权 100）。
 * 状态读写 `useOrderStore.orderForm`；快捷手数/撤单按钮见 P3 后续模块。
 */
export function TradeParams({ instrumentID, onSwitch }: TradeParamsProps) {
  const orderForm = useOrderStore((s) => s.orderForm)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const contracts = useContractsStore((s) => s.contracts)

  const activeInstrument = instrumentID ?? orderForm.instrumentID
  const productClass = useMemo(() => {
    const contract = contracts.find((c) => c.instrumentID === activeInstrument)
    return contract?.productClass ?? '1'
  }, [contracts, activeInstrument])

  // 合约搜索选择：更新报单表单；浮动窗模式联动切换所属标签页合约（标题/订阅/盘口随动）
  const handleContractSelect = (code: string) => {
    setOrderForm({ instrumentID: code })
    onSwitch?.(code)
  }

  const volumeLimit = getVolumeLimit(orderForm.orderPriceType, productClass)
  const volumeError = validateVolumeWithLimit(
    orderForm.volumeTotalOriginal,
    orderForm.orderPriceType,
    productClass,
  )

  // ── 操作按钮（P3-5）：撤最新 / 撤全部（确认）/ 平净仓（确认）──
  const [confirmOp, setConfirmOp] = useState<'cancelAll' | 'flatNet' | null>(null)
  const [opPending, setOpPending] = useState(false)

  // 撤最新：refreshOrders 取当前合约最新一笔活动挂单（insertTime 倒序）→ 撤单
  const handleCancelLatest = async () => {
    await useQueryStore.getState().fetchOrders()
    const orders = useQueryStore.getState().orders
    const mine = orders
      .filter(
        (o) =>
          o.instrumentID === activeInstrument && ACTIVE_ORDER_STATUSES.includes(o.orderStatus),
      )
      .sort((a, b) => (b.insertTime ?? '').localeCompare(a.insertTime ?? ''))
    const latest = mine[0]
    if (!latest) {
      toast.error('暂无该合约可撤报单')
      return
    }
    await useQueryStore.getState().handleCancelOrder(latest.orderRef)
  }

  // 撤全部：强制确认 → cancelAllOrders
  const handleCancelAll = async () => {
    if (opPending) return
    setOpPending(true)
    try {
      await useQueryStore.getState().handleCancelAll()
      setConfirmOp(null)
    } finally {
      setOpPending(false)
    }
  }

  // 平净仓：强制确认 → reversePosition（默认市价串行，后端自动取保护价）→ 刷新持仓
  const handleFlatNet = async () => {
    if (opPending) return
    setOpPending(true)
    try {
      const res = await reversePosition({
        instrumentID: activeInstrument,
        executionMode: 'serial',
      })
      if (res.success) {
        toast.success('平净仓已提交')
        useQueryStore.getState().fetchPositions()
      } else {
        toast.error(`平净仓失败：${res.message || '未知错误'}`)
      }
      setConfirmOp(null)
    } catch (e) {
      toast.error(`平净仓失败：${e instanceof Error ? e.message : '未知错误'}`)
      setConfirmOp(null)
    } finally {
      setOpPending(false)
    }
  }

  return (
    <div className="trade-params">
      <div className="tp-row">
        <span className="tp-row__label">合约</span>
        {/* 搜索切换合约；key 随当前合约变化强制重挂载，回显当前合约代码 */}
        <ContractSearch
          key={activeInstrument}
          contracts={contracts}
          initialQuery={activeInstrument}
          onSelect={handleContractSelect}
          placeholder={activeInstrument ? undefined : '请选择合约'}
        />
      </div>

      <div className="tp-row">
        <span className="tp-row__label">开平</span>
        <select
          className="tp-row__select"
          aria-label="开平"
          value={orderForm.combOffsetFlag}
          onChange={(e) =>
            setOrderForm({ combOffsetFlag: e.target.value as OrderRequestForm['combOffsetFlag'] })
          }
        >
          <option value="open">开</option>
          <option value="close">平</option>
          <option value="close_today">平今</option>
        </select>
      </div>

      <div className="tp-row">
        <span className="tp-row__label">投保</span>
        <select
          className="tp-row__select"
          aria-label="投保"
          value={orderForm.combHedgeFlag || 'speculation'}
          onChange={(e) =>
            setOrderForm({ combHedgeFlag: e.target.value as OrderRequestForm['combHedgeFlag'] })
          }
        >
          <option value="speculation">投机</option>
          <option value="arbitrage">套利优惠</option>
          <option value="hedge">套保</option>
        </select>
      </div>

      <div className="tp-row">
        <span className="tp-row__label">有效期</span>
        <select
          className="tp-row__select"
          aria-label="有效期"
          value={orderForm.timeCondition}
          onChange={(e) =>
            setOrderForm({ timeCondition: e.target.value as OrderRequestForm['timeCondition'] })
          }
        >
          <option value="gfd">GFD</option>
          <option value="fok">FOK</option>
          <option value="fak">FAK</option>
        </select>
      </div>

      <div className="tp-row">
        <span className="tp-row__label">手数</span>
        <div className="tp-stepper">
          <button
            type="button"
            className="tp-stepper__btn"
            data-testid="tp-volume-down"
            aria-label="减手数"
            onClick={() =>
              setOrderForm({ volumeTotalOriginal: Math.max(1, orderForm.volumeTotalOriginal - 1) })
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
            step={1}
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
                volumeTotalOriginal: Math.min(volumeLimit, orderForm.volumeTotalOriginal + 1),
              })
            }
          >
            +
          </button>
        </div>
      </div>

      <div
        className={`tp-hint${volumeError ? ' tp-hint--error' : ''}`}
        data-testid="tp-volume-hint"
      >
        <span>最大 {volumeLimit} 手</span>
        {volumeError && <span className="tp-hint__error">{volumeError}</span>}
      </div>

      <div className="tp-row">
        <span className="tp-row__label">快捷</span>
        <QtyPreset
          value={orderForm.volumeTotalOriginal}
          limit={volumeLimit}
          onSelect={(v) => setOrderForm({ volumeTotalOriginal: v })}
        />
      </div>

      {/* 操作按钮：撤最新 / 撤全部（二次确认）/ 平净仓（确认） */}
      <div className="tp-row tp-row--ops">
        <button
          type="button"
          className="tp-op-btn"
          data-testid="tp-cancel-latest"
          onClick={handleCancelLatest}
          disabled={opPending || !activeInstrument}
        >
          撤最新
        </button>
        <button
          type="button"
          className="tp-op-btn"
          data-testid="tp-cancel-all"
          onClick={() => setConfirmOp('cancelAll')}
          disabled={opPending || !activeInstrument}
        >
          撤全部
        </button>
      </div>
      <button
        type="button"
        className="tp-op-btn tp-op-btn--primary"
        data-testid="tp-flat-net"
        onClick={() => setConfirmOp('flatNet')}
        disabled={opPending || !activeInstrument}
      >
        平净仓
      </button>

      {confirmOp === 'cancelAll' && (
        <ConfirmDialog
          title="确认撤全部"
          details={[{ label: '范围', value: '所有未成交报单' }]}
          warning="将撤销所有未成交报单（全部合约），请确认。"
          onConfirm={handleCancelAll}
          onCancel={() => setConfirmOp(null)}
        />
      )}
      {confirmOp === 'flatNet' && (
        <ConfirmDialog
          title="确认平净仓"
          details={[{ label: '合约', value: activeInstrument }]}
          warning="将平掉当前合约全部净持仓并反向开仓（市价串行），会真实下单，请确认。"
          onConfirm={handleFlatNet}
          onCancel={() => setConfirmOp(null)}
        />
      )}
    </div>
  )
}
