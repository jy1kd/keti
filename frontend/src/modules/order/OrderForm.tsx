import { useOrderStore } from './store'
import { usePriceStep } from '../../hooks/usePriceStep'
import { useEffect } from 'react'

interface OrderFormProps {
  priceTick?: number
}

export function OrderForm({ priceTick = 0.2 }: OrderFormProps) {
  const orderForm = useOrderStore((s) => s.orderForm)
  const isSubmitting = useOrderStore((s) => s.isSubmitting)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const submitOrder = useOrderStore((s) => s.submitOrder)

  const { direction, combOffsetFlag, orderPriceType, timeCondition } = orderForm
  const isBuy = direction === 'buy'
  const isMarket = orderPriceType === 'market'

  const { price, stepUp, stepDown } = usePriceStep(orderForm.limitPrice, priceTick)

  // Sync hook state → store
  useEffect(() => {
    if (price !== orderForm.limitPrice) {
      setOrderForm({ limitPrice: price })
    }
  }, [price])

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
          <button
            type="button"
            className={`toggle-btn ${combOffsetFlag === 'open' ? 'active' : ''}`}
            onClick={() => setOrderForm({ combOffsetFlag: 'open' })}
          >
            开
          </button>
          <button
            type="button"
            className={`toggle-btn ${combOffsetFlag === 'close' ? 'active' : ''}`}
            onClick={() => setOrderForm({ combOffsetFlag: 'close' })}
          >
            平
          </button>
          <button
            type="button"
            className={`toggle-btn ${combOffsetFlag === 'close_today' ? 'active' : ''}`}
            onClick={() => setOrderForm({ combOffsetFlag: 'close_today' })}
          >
            平今
          </button>
        </div>
      </div>

      {/* Price type toggle */}
      <div className="form-row">
        <label>类型</label>
        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-btn ${orderPriceType === 'limit' ? 'active' : ''}`}
            onClick={() => setOrderForm({ orderPriceType: 'limit' })}
          >
            限价
          </button>
          <button
            type="button"
            className={`toggle-btn ${orderPriceType === 'market' ? 'active' : ''}`}
            onClick={() => setOrderForm({ orderPriceType: 'market' })}
          >
            市价
          </button>
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

      {/* Price input (hidden for market orders) */}
      {!isMarket && (
        <div className="form-row">
          <label>价格</label>
          <div className="stepper-group">
            <button
              type="button"
              className="stepper-btn"
              onClick={stepDown}
            >
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
            <button
              type="button"
              className="stepper-btn"
              onClick={stepUp}
            >
              +
            </button>
          </div>
        </div>
      )}

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

      {/* Submit button */}
      <button
        type="button"
        className={`submit-btn ${isBuy ? 'buy' : 'sell'}`}
        disabled={isSubmitting}
        onClick={submitOrder}
      >
        {isSubmitting ? '提交中...' : `${isBuy ? '买入' : '卖出'} ${orderForm.instrumentID || ''}`}
      </button>
    </div>
  )
}
