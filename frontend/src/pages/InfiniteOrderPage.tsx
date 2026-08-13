import { useEffect, useState } from 'react'
import { AccountBar } from '@/modules/order/AccountBar'
import { InfiniteTradeParams } from '@/modules/infinite/InfiniteTradeParams'
import { InfiniteLadder } from '@/modules/infinite/InfiniteLadder'
import { useInfiniteOrderStore } from '@/modules/infinite/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'
import { useQueryStore } from '@/modules/query/store'
import { useTabStore } from '@/stores/tabs'
import { OrderFlow } from '@/modules/query/OrderFlow'
import { TradeFlow } from '@/modules/query/TradeFlow'
import { Position } from '@/modules/query/Position'
import './InfiniteOrderPage.css'

interface InfiniteOrderPageProps {
  instrumentID?: string
  floating?: boolean
  tabId?: string
}

type RightTab = 'positions' | 'orders' | 'trades'

export function InfiniteOrderPage({ instrumentID, tabId }: InfiniteOrderPageProps) {
  const setInstrument = useInfiniteOrderStore((s) => s.setInstrument)
  const contracts = useContractsStore((s) => s.contracts)
  const snapshots = useMarketStore((s) => s.snapshots)
  const updateTab = useTabStore((s) => s.updateTab)
  const [rightTab, setRightTab] = useState<RightTab>('positions')

  useEffect(() => {
    if (instrumentID) setInstrument(instrumentID)
  }, [instrumentID, setInstrument])

  useEffect(() => {
    if (contracts.length === 0) useContractsStore.getState().loadAllInstruments()
  }, [contracts.length])

  // 报单流水 10s 自刷新（供阶梯「可撤」列 + 委托 tab），对齐 MarketDepth 节奏
  useEffect(() => {
    if (!instrumentID) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      if (useQueryStore.getState().isPaused) { timer = setTimeout(load, 10_000); return }
      await useQueryStore.getState().fetchOrders()
      if (disposed) return
      timer = setTimeout(load, 10_000)
    }
    load()
    return () => { disposed = true; clearTimeout(timer) }
  }, [instrumentID])

  const contract = contracts.find((c) => c.instrumentID === instrumentID)
  const priceTick = contract?.priceTick ?? 0.2
  const snapshot = instrumentID ? snapshots.get(instrumentID) : undefined

  const handleSwitch = (code: string) => {
    if (tabId && code !== instrumentID) {
      updateTab(tabId, { props: { instrumentID: code }, title: `♾️ 无限下单-${code}` })
    }
  }

  return (
    <div className="infinite-order-page" data-testid="infinite-order-page">
      <div className="infinite-order-page__top">
        <AccountBar instrumentID={instrumentID ?? ''} />
        {snapshot && (
          <span className="infinite-order-page__limits">
            涨停 {snapshot.upperLimitPrice} / 跌停 {snapshot.lowerLimitPrice}
          </span>
        )}
      </div>
      <div className="infinite-order-page__body">
        <InfiniteTradeParams instrumentID={instrumentID} onSwitch={handleSwitch} />
        <InfiniteLadder snapshot={snapshot ?? null} priceTick={priceTick} instrumentID={instrumentID ?? ''} />
        <div className="infinite-order-page__right">
          <div className="infinite-order-page__right-tabs">
            <button type="button" className={rightTab === 'positions' ? 'active' : ''} onClick={() => setRightTab('positions')}>持仓</button>
            <button type="button" className={rightTab === 'orders' ? 'active' : ''} onClick={() => setRightTab('orders')}>委托</button>
            <button type="button" className={rightTab === 'trades' ? 'active' : ''} onClick={() => setRightTab('trades')}>成交</button>
          </div>
          {rightTab === 'positions' && <Position />}
          {rightTab === 'orders' && <OrderFlow />}
          {rightTab === 'trades' && <TradeFlow />}
        </div>
      </div>
    </div>
  )
}
