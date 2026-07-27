import { useOrderStore } from './store'
import { usePriceStep } from '../../hooks/usePriceStep'
import { useEffect } from 'react'

interface StopOrderFormProps {
  priceTick?: number
}

export function StopOrderForm({ priceTick = 0.2 }: StopOrderFormProps) {
  const orderForm = useOrderStore((s) => s.orderForm)
  const isSubmitting = useOrderStore((s) => s.isSubmitting)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const submitStopOrder = useOrderStore((s) => s.submitStopOrder)

  const isBuy = orderForm.direction === 'buy'
  const timeCondition = orderForm.timeCondition

  const { price, stepUp, stepDown } = usePriceStep(orderForm.limitPrice, priceTick)
  const { price: stopPrice, stepUp: stopStepUp, stepDown: stopStepDown } =
    usePriceStep(orderForm.stopPrice ?? 0, priceTick)

  // Sync hook state → store
  useEffect(() => {
    if (price !== orderForm.limitPrice) {
      setOrderForm({ limitPrice: price })
    }
  }, [price])

  useEffect(() => {
    if (stopPrice !== (orderForm.stopPrice ?? 0)) {
      setOrderForm({ stopPrice })
    }
  }, [stopPrice])

  return (
    <div className="order-form">
      {/* Direction toggle */}
      <div className="form-row">
        <label>方向</label>
        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-btn ${isBuy ? 'active buy' : ''}`}
            onClick={() => setOrderForm({ direction: 'buy' })}
          >
            买
          </button>
          <button
            type="button"
            className={`toggle-btn ${!isBuy ? 'active sell' : ''}`}
            onClick={() => setOrderForm({ direction: 'sell' })}
          >
            卖
          </button>
        </div>
      </div>

      {/* Offset toggle */}
      <div className="form-row">
        <label>开平</label>
        <div className="toggle-group triple">
          {(['open', 'close', 'close_today'] as const).map((val) => (
            <button
              key={val}
              type="button"
              className={`toggle-btn ${orderForm.combOffsetFlag === val ? 'active' : ''}`}
              onClick={() => setOrderForm({ combOffsetFlag: val })}
            >
              {{ open: '开', close: '平', close_today: '平今' }[val]}
            </button>
          ))}
        </div>
      </div>

      {/* Time condition toggle */}
      <div className="form-row">
        <label>有效期</label>
        <div className="toggle-group triple">
          <button
            type="button"
            className={`toggle-btn ${timeCondition === 'gfd' ? 'active' : ''}`}
            onClick={() => setOrderForm({ timeCondition: 'gfd' })}
          >
            GFD
          </button>
          <button
            type="button"
            className={`toggle-btn ${timeCondition === 'fok' ? 'active' : ''}`}
            onClick={() => setOrderForm({ timeCondition: 'fok' })}
          >
            FOK
          </button>
          <button
            type="button"
            className={`toggle-btn ${timeCondition === 'fak' ? 'active' : ''}`}
            onClick={() => setOrderForm({ timeCondition: 'fak' })}
          >
            FAK
          </button>
        </div>
      </div>

      {/* Hedge flag toggle */}
      <div className="form-row">
        <label>投保</label>
        <div className="toggle-group triple">
          <button
            type="button"
            className={`toggle-btn ${orderForm.combHedgeFlag === 'speculation' || !orderForm.combHedgeFlag ? 'active' : ''}`}
            onClick={() => setOrderForm({ combHedgeFlag: 'speculation' })}
          >
            投机
          </button>
          <button
            type="button"
            className={`toggle-btn ${orderForm.combHedgeFlag === 'arbitrage' ? 'active' : ''}`}
            onClick={() => setOrderForm({ combHedgeFlag: 'arbitrage' })}
          >
            套利
          </button>
          <button
            type="button"
            className={`toggle-btn ${orderForm.combHedgeFlag === 'hedge' ? 'active' : ''}`}
            onClick={() => setOrderForm({ combHedgeFlag: 'hedge' })}
          >
            套保
          </button>
        </div>
      </div>

      {/* Price input */}
      <div className="form-row">
        <label>价格</label>
        <div className="stepper-group">
          <button type="button" className="stepper-btn" onClick={stepDown}>
            −
          </button>
          <input
            type="number"
            className="stepper-input"
            value={orderForm.limitPrice}
            onChange={(e) => setOrderForm({ limitPrice: Number(e.target.value) })}
            min={0}
            step={priceTick}
          />
          <button type="button" className="stepper-btn" onClick={stepUp}>
            +
          </button>
        </div>
      </div>

      {/* Volume input */}
      <div className="form-row">
        <label>数量</label>
        <div className="stepper-group">
          <button
            type="button"
            className="stepper-btn"
            onClick={() =>
              setOrderForm({ volumeTotalOriginal: Math.max(1, orderForm.volumeTotalOriginal - 1) })
            }
          >
            −
          </button>
          <input
            type="number"
            className="stepper-input"
            value={orderForm.volumeTotalOriginal}
            onChange={(e) => setOrderForm({ volumeTotalOriginal: Math.max(1, Number(e.target.value)) })}
            min={1}
            step={1}
          />
          <button
            type="button"
            className="stepper-btn"
            onClick={() =>
              setOrderForm({ volumeTotalOriginal: orderForm.volumeTotalOriginal + 1 })
            }
          >
            +
          </button>
        </div>
      </div>

      {/* Stop price input — the key difference from OrderForm */}
      <div className="form-row">
        <label>止损价</label>
        <div className="stepper-group">
          <button type="button" className="stepper-btn" onClick={stopStepDown}>
            −
          </button>
          <input
            type="number"
            className="stepper-input"
            value={orderForm.stopPrice ?? 0}
            onChange={(e) => setOrderForm({ stopPrice: Number(e.target.value) })}
            min={0}
            step={priceTick}
          />
          <button type="button" className="stepper-btn" onClick={stopStepUp}>
            +
          </button>
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        className={`submit-btn ${isBuy ? 'buy' : 'sell'}`}
        disabled={isSubmitting}
        onClick={submitStopOrder}
      >
        {isSubmitting ? '提交中...' : `止损${isBuy ? '买入' : '卖出'} ${orderForm.instrumentID || ''}`}
      </button>
    </div>
  )
}
