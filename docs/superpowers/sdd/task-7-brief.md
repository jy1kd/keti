### Task 7: Frontend — MarketPanel 集成

**Files:**
- Modify: `frontend/src/modules/market/MarketPanel.tsx`

**Interfaces:**
- Consumes: `useContractsStore.loadSubscribedContracts()`, `useContractsStore.addContractInfo()`, `useContractsStore.removeContractById()`, `InstrumentSearchModal`
- Produces: 完整合约搜索+订阅+退订 UI 流程

- [ ] **Step 1: Rewrite MarketPanel**

修改 `frontend/src/modules/market/MarketPanel.tsx`：

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ResizeHandle } from '@/components/ResizeHandle'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { MarketTable } from './MarketTable'
import { DepthQuote } from './DepthQuote'
import { SpreadDisplay } from '@/components/SpreadDisplay'
import { KLineChart } from './KLineChart'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useOrderStore } from '@/modules/order/store'
import { useMarketWs, PERIOD_MS } from '@/hooks/useMarketWs'
import { API_BASE, getKlineData, subscribeMarket } from '@/services/api'
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import './styles.css'

const savedMarketTop = loadPanelSizes('market-top-layout')
const savedMarket = loadPanelSizes('market-layout')

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, klineData, setKlineData } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, addContractInfo, removeContractById } = useContractsStore()
  const [period, setPeriod] = useState('5m')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const loadedRef = useRef(false)

  // Subscribed instrument IDs set (for modal to show "已订阅")
  const subscribedIds = useMemo(
    () => new Set(contracts.map((c) => c.instrumentID)),
    [contracts]
  )

  const onMarketTopLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-top-layout', { table: layout['market-table'], side: layout['market-side'] })
  }, [])

  const onMarketLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-layout', { top: layout['market-top'], kline: layout['market-kline'] })
  }, [])

  // WebSocket 行情推送
  useMarketWs(API_BASE.replace('http', 'ws'), period)

  // 启动时加载预设合约 + 用户订阅
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      useContractsStore.getState().loadSubscribedContracts().then(() => {
        const loaded = useContractsStore.getState().contracts
        if (loaded.length > 0) {
          subscribeMarket(loaded.map((c) => c.instrumentID)).catch(() => {})
        }
      })
    }
  }, [])

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
  })

  const handleSelectContract = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
  }

  const handleUnsubscribe = async () => {
    if (!selectedInstrument) return
    await removeContractById(selectedInstrument)
    setSelectedInstrument(null)
  }

  const handleSubscribeFromModal = (inst: import('@/services/types').ContractInfo) => {
    addContractInfo(inst)
    // Subscribe to CTP market data
    subscribeMarket([inst.instrumentID]).catch(() => {})
  }

  // 获取K线数据
  useEffect(() => {
    if (!selectedInstrument) return
    getKlineData(selectedInstrument, period, 200)
      .then((res) => {
        if (res.bars?.length) {
          const periodMs = PERIOD_MS[period] ?? PERIOD_MS['5m']
          const aligned = res.bars.map((bar) => {
            const d = new Date(bar.timestamp)
            const timeMs = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000) + d.getMilliseconds()
            return { ...bar, timestamp: Math.floor(timeMs / periodMs) * periodMs }
          })
          setKlineData(selectedInstrument, aligned)
        }
      })
      .catch(() => { /* 静默失败 */ })
  }, [selectedInstrument, period, setKlineData])

  const selectedSnapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null
  const selectedKline = selectedInstrument ? klineData.get(selectedInstrument) ?? [] : []

  return (
    <section className="market-panel">
      <div className="panel-header">
        <h2>行情面板</h2>
        <div className="panel-header__actions">
          <ContractSearch contracts={contracts} onSelect={handleSelectContract} />
          <button
            className="btn-search-instruments"
            onClick={() => setSearchModalOpen(true)}
          >
            搜索合约
          </button>
          <button
            className="btn-unsubscribe"
            disabled={!selectedInstrument}
            onClick={handleUnsubscribe}
          >
            退订
          </button>
        </div>
      </div>

      <Group orientation="vertical" className="panel-content" id="market-layout" onLayoutChange={onMarketLayout}>
        <Panel id="market-top" defaultSize={savedMarket?.top ?? 50} minSize={20}>
          <Group orientation="horizontal" className="market-panel__top" id="market-top-layout" onLayoutChange={onMarketTopLayout}>
            <Panel id="market-table" defaultSize={savedMarketTop?.table ?? 75} minSize={30}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <MarketTable
                  contracts={contracts}
                  snapshots={snapshots}
                  selectedInstrument={selectedInstrument}
                  onRowClick={handleClick}
                  onRowDoubleClick={handleDoubleClick}
                />
              </div>
            </Panel>
            <Separator>
              <ResizeHandle direction="horizontal" />
            </Separator>
            <Panel id="market-side" defaultSize={savedMarketTop?.side ?? 25} minSize={10}>
              <div className="market-panel__side">
                <DepthQuote
                  snapshot={selectedSnapshot}
                  onBuyClick={(price) => {
                    if (selectedInstrument) {
                      setOrderInstrument(selectedInstrument)
                      setOrderForm({ direction: 'buy', limitPrice: price })
                    }
                  }}
                  onSellClick={(price) => {
                    if (selectedInstrument) {
                      setOrderInstrument(selectedInstrument)
                      setOrderForm({ direction: 'sell', limitPrice: price })
                    }
                  }}
                />
                <SpreadDisplay
                  bidPrice={selectedSnapshot?.bidPrice1 ?? 0}
                  askPrice={selectedSnapshot?.askPrice1 ?? 0}
                />
              </div>
            </Panel>
          </Group>
        </Panel>
        <Separator>
          <ResizeHandle direction="vertical" />
        </Separator>
        <Panel id="market-kline" defaultSize={savedMarket?.kline ?? 50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedInstrument ? (
              <KLineChart
                instrument={selectedInstrument}
                klineData={selectedKline}
                period={period}
                onPeriodChange={setPeriod}
              />
            ) : (
              <div className="market-panel__kline-placeholder">选择合约查看K线图</div>
            )}
          </div>
        </Panel>
      </Group>

      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSubscribe={handleSubscribeFromModal}
        subscribedIds={subscribedIds}
      />
    </section>
  )
}
```

- [ ] **Step 2: Add button styles**

在 `frontend/src/modules/market/styles.css` 中添加（如果不存在）：

```css
.btn-search-instruments {
  padding: 4px 12px;
  background: var(--accent-color, #4a9eff);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn-unsubscribe {
  padding: 4px 12px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  cursor: pointer;
  font-size: 13px;
}

.btn-unsubscribe:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run frontend dev server to verify**

Run: `cd frontend && npm run dev`
Expected: App loads, "搜索合约" and "退订" buttons visible in header

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/styles.css
git commit -m "feat(task-15): MarketPanel 集成 — 搜索合约按钮 + 退订按钮 + 启动流程改造"
```

---

