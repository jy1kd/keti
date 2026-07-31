import { useCallback, useState, useEffect } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { ResizeHandle } from '@/components/ResizeHandle'
import { MarketPanel } from '@/modules/market/MarketPanel'
import { OrderPanel } from '@/modules/order/OrderPanel'
import { QueryPanel } from '@/modules/query/QueryPanel'
import { PerfMonitor } from '@/components/PerfMonitor'
import { SettingsPanel } from '@/components/SettingsPanel'
import { ToastContainer } from '@/components/Toast'
import { useSystemWs } from '@/hooks/useSystemWs'
import { useConnectionPoll } from '@/hooks/useConnectionPoll'
import { useQueryStore } from '@/modules/query/store'
import { useMarketStore } from '@/modules/market/store'
import { API_BASE } from '@/services/api'
import { isElectron } from '@/services/electron'
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import '@/assets/styles/global.css'

const savedApp = loadPanelSizes('app-layout')
const savedMain = loadPanelSizes('main-layout')

function App() {
  const [perfVisible, setPerfVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const setActiveTab = useQueryStore((s) => s.setActiveTab)

  // System WebSocket — 监听 MD/TD 连接状态即时推送
  useSystemWs(API_BASE.replace('http', 'ws'))

  // 轮询 /api/connection/status — MD/TD 状态的权威来源
  useConnectionPoll()

  // Electron IPC — 监听托盘菜单导航消息
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onNavigateTab?.((tab: string) => {
      switch (tab) {
        case 'market':
          // 行情面板是主面板，不需要切换 Tab
          break
        case 'order':
          // 报单面板是独立面板，不需要切换 Tab
          break
        case 'query':
          setActiveTab('orders')
          break
        case 'settings':
          setSettingsVisible(true)
          break
      }
    })

    return () => cleanup?.()
  }, [setActiveTab])

  // Electron IPC — 响应获取选中合约请求
  useEffect(() => {
    if (!isElectron()) return

    // Listen for GET_SELECTED_INSTRUMENT and respond with selected instrument
    const cleanup = window.electronAPI?.onGetSelectedInstrument?.((): string => {
      const { selectedInstrument } = useMarketStore.getState()
      // Send response back to main process
      const id = selectedInstrument || ''
      window.electronAPI?.sendSelectedInstrument?.(id)
      return id
    })

    return () => cleanup?.()
  }, [])

  // Ctrl+Shift+M 切换性能监控
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setPerfVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const onAppLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('app-layout', { main: layout.main, query: layout.query })
  }, [])

  const onMainLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('main-layout', { market: layout.market, order: layout.order })
  }, [])

  return (
    <div className="app">
      <ToastContainer />
      <header className="status-bar">
        <div className="status-bar__left">
          <button
            className={`status-bar__gear${settingsVisible ? ' active' : ''}`}
            onClick={() => setSettingsVisible((v) => !v)}
            title="设置"
          >
            ⚙
          </button>
          <ConnectionStatus />
          <button
            className="status-bar__btn"
            onClick={() => setPerfVisible((v) => !v)}
            title="FPS 监控 (Ctrl+Shift+M)"
            style={{
              marginLeft: 12,
              background: perfVisible ? 'rgba(63,185,80,0.12)' : 'transparent',
              color: perfVisible ? '#3fb950' : '#8b949e',
              border: '1px solid #30363d',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {perfVisible ? <><PerfMonitor visible /> ⚡FPS</> : '⚡FPS'}
          </button>
        </div>
        <span className="app-title">SimNow 交易终端</span>
      </header>
      <Group orientation="vertical" className="main-content" id="app-layout" onLayoutChange={onAppLayout}>
        <Panel id="main" defaultSize={savedApp?.main ?? 75} minSize={30}>
          <Group orientation="horizontal" id="main-layout" onLayoutChange={onMainLayout}>
            <Panel id="market" defaultSize={savedMain?.market ?? 70} minSize={20}>
              <section className="market-area">
                <MarketPanel />
              </section>
            </Panel>
            <Separator>
              <ResizeHandle direction="horizontal" />
            </Separator>
            <Panel id="order" defaultSize={savedMain?.order ?? 30} minSize={15}>
              <section className="order-area">
                <OrderPanel />
              </section>
            </Panel>
          </Group>
        </Panel>
        <Separator>
          <ResizeHandle direction="vertical" />
        </Separator>
        <Panel id="query" defaultSize={savedApp?.query ?? 25} minSize={10}>
          <footer className="query-area">
            <QueryPanel />
          </footer>
        </Panel>
      </Group>

      {settingsVisible && (
        <div className="settings-overlay" onClick={() => setSettingsVisible(false)}>
          <div className="settings-overlay__panel" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel onClose={() => setSettingsVisible(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
