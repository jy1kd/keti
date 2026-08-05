import { useState, useEffect } from 'react'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { TabBar } from '@/components/TabBar'
import { TabContent } from '@/components/TabContent'
import { PerfMonitor } from '@/components/PerfMonitor'
import { ToastContainer } from '@/components/Toast'
import { useSystemWs } from '@/hooks/useSystemWs'
import { useConnectionPoll } from '@/hooks/useConnectionPoll'
import { useTabContractLocks } from '@/hooks/useTabContractLocks'
import { useMarketStore } from '@/modules/market/store'
import { OrderPopup } from '@/modules/order/OrderPopup'
import { QueryPopup } from '@/modules/query/QueryPopup'
import { useQueryPopupStore } from '@/modules/query/popupStore'
import { FloatingWindows } from '@/components/FloatingWindow'
import { useTabStore } from '@/stores/tabs'
import { API_BASE } from '@/services/api'
import { isElectron } from '@/services/electron'
import '@/assets/styles/global.css'

function App() {
  const [perfVisible, setPerfVisible] = useState(false)
  const openTab = useTabStore((s) => s.openTab)

  // System WebSocket — 监听 MD/TD 连接状态即时推送
  useSystemWs(API_BASE.replace('http', 'ws'))

  // 轮询 /api/connection/status — MD/TD 状态的权威来源
  useConnectionPoll()

  // 打开标签的合约锁定订阅（K线/报单标签的合约永不退订，保证数据流）
  useTabContractLocks()

  // Electron IPC — 监听托盘菜单导航消息
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onNavigateTab?.((tab: string) => {
      switch (tab) {
        case 'market':
          openTab({ type: 'market', title: '📊 行情' })
          break
        case 'favorites':
          openTab({ type: 'favorites', title: '⭐ 自选' })
          break
        case 'order':
          openTab({ type: 'order', title: '📝 报单' })
          break
        case 'query':
          openTab({ type: 'query', title: '📋 查询' })
          break
        case 'kline':
          openTab({ type: 'kline', title: '📈 K线' })
          break
        case 'settings':
          openTab({ type: 'settings', title: '⚙ 设置' })
          break
        case 'ipc-monitor':
          openTab({ type: 'ipc-monitor', title: '📡 网络监控' })
          break
      }
    })

    return () => cleanup?.()
  }, [])

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

  return (
    <div className="app">
      <ToastContainer />
      <header className="status-bar">
        <div className="status-bar__left">
          <button
            className="status-bar__gear"
            onClick={() => openTab({ type: 'settings', title: '⚙ 设置' })}
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
          <button
            className="status-bar__btn"
            onClick={() => openTab({ type: 'ipc-monitor', title: '📡 网络监控' })}
            title="网络监控"
            style={{
              marginLeft: 8,
              background: 'transparent',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            🔌IPC
          </button>
        </div>
        <span className="app-title">SimNow 交易终端</span>
      </header>
      <TabBar onAddTab={() => openTab({ type: 'settings', title: '⚙ 设置' })} />
      <main className="tab-main">
        <TabContent />
      </main>

      {/* 悬浮报单弹窗（非模态，浮于所有标签页之上） */}
      <OrderPopup />

      {/* 悬浮查询弹窗（非模态，浮于所有标签页之上） */}
      <QueryPopup />

      {/* 浮动标签窗口（chrome 壳；内容由 TabContent 位移覆盖） */}
      <FloatingWindows />
    </div>
  )
}

export default App
