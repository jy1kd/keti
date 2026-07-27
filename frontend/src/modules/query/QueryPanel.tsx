import { useEffect, useCallback, useState } from 'react'
import { useQueryStore } from './store'
import { OrderFlow } from './OrderFlow'
import { TradeFlow } from './TradeFlow'
import { Position } from './Position'
import { AccountQuery } from './AccountQuery'
import { StopOrderList } from './StopOrderList'
import { ContractQuery } from './ContractQuery'
import { DepthQuote } from '../market/DepthQuote'
import { KLineChart } from '../market/KLineChart'
import { useMarketStore } from '../market/store'
import { useMarketWs, PERIOD_MS } from '@/hooks/useMarketWs'
import { API_BASE, getKlineData } from '@/services/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './styles.css'

const TABS = [
  { key: 'orders' as const, label: '报单' },
  { key: 'trades' as const, label: '成交' },
  { key: 'positions' as const, label: '持仓' },
  { key: 'account' as const, label: '资金' },
  { key: 'stop_orders' as const, label: '止损单' },
  { key: 'quotes' as const, label: '报价' },
  { key: 'contracts' as const, label: '合约' },
  { key: 'kline' as const, label: 'K线' },
]

export function QueryPanel() {
  const activeTab = useQueryStore((s) => s.activeTab)
  const setActiveTab = useQueryStore((s) => s.setActiveTab)
  const isPaused = useQueryStore((s) => s.isPaused)
  const isLoading = useQueryStore((s) => s.isLoading)
  const togglePause = useQueryStore((s) => s.togglePause)
  const refreshAll = useQueryStore((s) => s.refreshAll)
  const handleCancelAll = useQueryStore((s) => s.handleCancelAll)
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument)
  const snapshots = useMarketStore((s) => s.snapshots)
  const klineData = useMarketStore((s) => s.klineData)
  const setKlineData = useMarketStore((s) => s.setKlineData)
  const [period, setPeriod] = useState('5m')

  // Initial data load
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Auto-refresh every 10s (串行 CTP 查询需要 ~6s，间隔太短会重叠)
  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      refreshAll()
    }, 10000)
    return () => clearInterval(interval)
  }, [isPaused, refreshAll])

  // WebSocket 行情推送（K线需要）
  useMarketWs(API_BASE.replace('http', 'ws'), period)

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

  // C key shortcut — cancel all active orders (when orders tab is active)
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        // Ignore if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (activeTab === 'orders') {
          handleCancelAll()
        }
      }
    },
    [activeTab, handleCancelAll]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return <OrderFlow />
      case 'trades':
        return <TradeFlow />
      case 'positions':
        return <Position />
      case 'account':
        return <AccountQuery />
      case 'stop_orders':
        return <StopOrderList />
      case 'quotes': {
        const snapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null
        return (
          <div className="quote-query">
            <DepthQuote snapshot={snapshot} />
          </div>
        )
      }
      case 'contracts':
        return <ContractQuery instrumentID={selectedInstrument ?? ''} />
      case 'kline': {
        const selectedKline = selectedInstrument ? klineData.get(selectedInstrument) ?? [] : []
        return (
          <div className="kline-query">
            {selectedInstrument ? (
              <ErrorBoundary>
                <KLineChart
                  instrument={selectedInstrument}
                  klineData={selectedKline}
                  period={period}
                  onPeriodChange={setPeriod}
                />
              </ErrorBoundary>
            ) : (
              <div className="kline-placeholder">选择合约查看K线图</div>
            )}
          </div>
        )
      }
      default:
        return null
    }
  }

  return (
    <section className="query-panel" data-testid="query-panel">
      <div className="panel-header">
        <h2>查询面板</h2>
        <div className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="panel-controls">
          <button
            className={`btn-pause ${isPaused ? 'paused' : ''}`}
            onClick={togglePause}
          >
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            className="btn-refresh"
            onClick={() => refreshAll()}
            disabled={isLoading}
          >
            {isLoading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>
      <div className="panel-content">
        {renderContent()}
      </div>
    </section>
  )
}
