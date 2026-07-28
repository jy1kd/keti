import { useOrderStore } from './store'
import { useContractsStore } from '../../stores/contracts'
import { usePriceStep } from '../../hooks/usePriceStep'
import { validateVolumeWithLimit } from '../../utils/validators'
import { ContractSearch } from '../../components/ContractSearch'
import { useEffect, useMemo, useState } from 'react'

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
  const isArbitrage = orderPriceType === 'arbitrage'

  // 套利合约选择状态
  const [leg1, setLeg1] = useState(orderForm.arbitrageLeg1 ?? '')
  const [leg2, setLeg2] = useState(orderForm.arbitrageLeg2 ?? '')

  const { price, stepUp, stepDown } = usePriceStep(orderForm.limitPrice, priceTick)
  const { price: stopPrice, stepUp: stopStepUp, stepDown: stopStepDown } =
    usePriceStep(orderForm.stopPrice ?? 0, priceTick)

  // 从合约列表获取当前合约的 productClass
  const contracts = useContractsStore((s) => s.contracts)
  const productClass = useMemo(() => {
    const contract = contracts.find(c => c.instrumentID === orderForm.instrumentID)
    return contract?.productClass ?? '1'
  }, [contracts, orderForm.instrumentID])

  // 数量上限提示
  const volumeLimit = useMemo(() => {
    const isOption = productClass === '2'
    return isMarket ? (isOption ? 30 : 60) : (isOption ? 100 : 500)
  }, [productClass, isMarket])

  // 数量校验
  const volumeError = useMemo(() => {
    return validateVolumeWithLimit(orderForm.volumeTotalOriginal, orderPriceType, productClass)
  }, [orderForm.volumeTotalOriginal, orderPriceType, productClass])

  // 套利腿选择回调
  const handleLeg1Select = (instrumentID: string) => {
    setLeg1(instrumentID)
    setOrderForm({ arbitrageLeg1: instrumentID })
  }
  const handleLeg2Select = (instrumentID: string) => {
    setLeg2(instrumentID)
    setOrderForm({ arbitrageLeg2: instrumentID })
  }

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
          <button
            type="button"
            className={`toggle-btn ${orderPriceType === 'arbitrage' ? 'active' : ''}`}
            onClick={() => setOrderForm({ orderPriceType: 'arbitrage' })}
          >
            套利
          </button>
          <button
            type="button"
            className="toggle-btn"
            disabled
            title="暂未实现（仅适用于INE原油期货）"
          >
            TAS
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
            title="按套利保证金标准计算（非套利指令）"
          >
            套利优惠
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

      {/* Price input — limit: price; market: protection price; arbitrage: contract selectors + spread */}
      {isArbitrage ? (
        <>
          <div className="form-row">
            <label>腿1</label>
            <ContractSearch contracts={contracts} onSelect={handleLeg1Select} />
            {leg1 && <span className="form-hint">{leg1}</span>}
          </div>
          <div className="form-row">
            <label>腿2</label>
            <ContractSearch contracts={contracts} onSelect={handleLeg2Select} />
            {leg2 && <span className="form-hint">{leg2}</span>}
          </div>
          <div className="form-row">
            <label>价差</label>
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
        </>
      ) : (
        <div className="form-row">
          <label>{isMarket ? '保护价' : '价格'}</label>
          {isMarket ? (
            <>
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
              <span className="form-hint" title="市价指令必须填写保护价，作为未成交部分转为限价单的限定价格">
                ⓘ
              </span>
            </>
          ) : (
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
          )}
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
        <span className={`form-hint ${volumeError ? 'form-hint--error' : ''}`}>
          最大 {volumeLimit} 手
        </span>
      </div>

      {/* Submit button */}
      <button
        type="button"
        className={`submit-btn ${isBuy ? 'buy' : 'sell'}`}
        disabled={isSubmitting}
        onClick={submitOrder}
      >
        {isSubmitting ? '提交中...' : `${isBuy ? '买入' : '卖出'} ${
          isArbitrage
            ? (leg1 && leg2 ? `SP ${leg1}&${leg2}` : '套利合约')
            : orderForm.instrumentID || ''
        }`}
      </button>
    </div>
  )
}
