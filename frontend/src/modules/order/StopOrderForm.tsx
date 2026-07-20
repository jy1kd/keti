import { useOrderStore } from './store'

export function StopOrderForm() {
  const orderForm = useOrderStore((s) => s.orderForm)
  const isSubmitting = useOrderStore((s) => s.isSubmitting)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const submitOrder = useOrderStore((s) => s.submitOrder)

  const isBuy = orderForm.direction === 'buy'

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

      {/* Price input */}
      <div className="form-row">
        <label>价格</label>
        <div className="stepper-group">
          <button
            type="button"
            className="stepper-btn"
            onClick={() =>
              setOrderForm({
                limitPrice: Math.max(0, Math.round((orderForm.limitPrice - 0.2) * 100) / 100),
              })
            }
          >
            −
          </button>
          <input
            type="number"
            className="stepper-input"
            value={orderForm.limitPrice}
            onChange={(e) => setOrderForm({ limitPrice: Number(e.target.value) })}
            min={0}
            step={0.2}
          />
          <button
            type="button"
            className="stepper-btn"
            onClick={() =>
              setOrderForm({
                limitPrice: Math.round((orderForm.limitPrice + 0.2) * 100) / 100,
              })
            }
          >
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
          <button
            type="button"
            className="stepper-btn"
            onClick={() =>
              setOrderForm({
                stopPrice: Math.max(0, Math.round(((orderForm.stopPrice ?? 0) - 0.2) * 100) / 100),
              })
            }
          >
            −
          </button>
          <input
            type="number"
            className="stepper-input"
            value={orderForm.stopPrice ?? 0}
            onChange={(e) => setOrderForm({ stopPrice: Number(e.target.value) })}
            min={0}
            step={0.2}
          />
          <button
            type="button"
            className="stepper-btn"
            onClick={() =>
              setOrderForm({
                stopPrice: Math.round(((orderForm.stopPrice ?? 0) + 0.2) * 100) / 100,
              })
            }
          >
            +
          </button>
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        className={`submit-btn ${isBuy ? 'buy' : 'sell'}`}
        disabled={isSubmitting}
        onClick={submitOrder}
      >
        {isSubmitting ? '提交中...' : `止损${isBuy ? '买入' : '卖出'} ${orderForm.instrumentID || ''}`}
      </button>
    </div>
  )
}
