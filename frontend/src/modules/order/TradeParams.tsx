import { useMemo } from 'react'
import { useOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { validateVolumeWithLimit, getVolumeLimit } from '@/utils/validators'
import type { OrderRequestForm } from '@/utils/orderMapping'
import { ContractStepper } from './ContractStepper'
import { QtyPreset } from './QtyPreset'
import './TradeParams.css'

interface TradeParamsProps {
  /** 可选覆盖合约代码（默认取 orderForm.instrumentID），用于定位 productClass 做数量上限校验 */
  instrumentID?: string
}

/**
 * TradeParams — 压缩参数区（报单弹窗左栏 ~200px）
 *
 * 合约步进（P3）+ 开平 / 投保 / 有效期 三个下拉（映射 `combOffsetFlag` / `combHedgeFlag` / `timeCondition`）
 * + 手数步进（校验复用 `validateVolumeWithLimit`：期货 500 / 市价 60 / 期权 100）。
 * 状态读写 `useOrderStore.orderForm`；快捷手数/撤单按钮见 P3 后续模块。
 */
export function TradeParams({ instrumentID }: TradeParamsProps) {
  const orderForm = useOrderStore((s) => s.orderForm)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const contracts = useContractsStore((s) => s.contracts)

  const activeInstrument = instrumentID ?? orderForm.instrumentID
  const productClass = useMemo(() => {
    const contract = contracts.find((c) => c.instrumentID === activeInstrument)
    return contract?.productClass ?? '1'
  }, [contracts, activeInstrument])

  const volumeLimit = getVolumeLimit(orderForm.orderPriceType, productClass)
  const volumeError = validateVolumeWithLimit(
    orderForm.volumeTotalOriginal,
    orderForm.orderPriceType,
    productClass,
  )

  return (
    <div className="trade-params">
      <div className="tp-row">
        <span className="tp-row__label">合约</span>
        <ContractStepper
          instrumentID={activeInstrument}
          onSelect={(code) => setOrderForm({ instrumentID: code })}
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
    </div>
  )
}
