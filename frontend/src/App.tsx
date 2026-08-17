import { useEffect, useRef } from 'react'
import { GlobalBar } from '@/components/GlobalBar'
import { BottomBar } from '@/components/BottomBar'
import { TabContent } from '@/components/TabContent'
import { ToastContainer } from '@/components/Toast'
import { useSystemWs } from '@/hooks/useSystemWs'
import { useConnectionPoll } from '@/hooks/useConnectionPoll'
import { useTabContractLocks } from '@/hooks/useTabContractLocks'
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore } from '@/stores/collections'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { FloatingWindows } from '@/components/FloatingWindow'
import { useTabStore } from '@/stores/tabs'
import { API_BASE } from '@/services/api'
import { isElectron } from '@/services/electron'
import {
  openOrderFloating,
  openKlineFloating,
  openSettingsFloating,
  openIpcMonitorFloating,
  openOrdersQueryFloating,
  openPositionsQueryFloating,
  openAccountQueryFloating,
  openInfiniteFloating,
  openTQuoteFloating,
  openCollectionsFloating,
} from '@/utils/openFloatingTab'
import '@/assets/styles/global.css'

function App() {
  const openTab = useTabStore((s) => s.openTab)
  // StrictMode 开发双挂载守卫：启动加载只执行一次（loadAllInstruments/loadCollections/load）
  const startupLoadedRef = useRef(false)

  // System WebSocket — 监听 MD/TD 连接状态即时推送
  useSystemWs(API_BASE.replace('http', 'ws'))

  // 轮询 /api/connection/status — MD/TD 状态的权威来源
  useConnectionPoll()

  // 打开标签的合约锁定订阅（K线/报单标签的合约永不退订，保证数据流）
  useTabContractLocks()

  // 共享行情基础设施：行情 WS 单例 + 订阅管理器，挂载在 App 全局，
  // 期货/期权双面板共享同一份订阅生命周期与 WS 单例（useSubscriptionManager 的
  // subscribedRef 组件私有，若双份挂载会双份 diff 冲突，故必须单例）
  useMarketWs(API_BASE.replace('http', 'ws'))
  useSubscriptionManager()

  // 启动时加载全量合约 + 收藏夹（原先在 MarketPanel，现上移共享）+ 持久化筛选。
  // StrictMode 开发双挂载会重复执行 effect：用 useRef 守卫保证只加载一次。
  useEffect(() => {
    if (startupLoadedRef.current) return
    startupLoadedRef.current = true
    useContractsStore.getState().loadAllInstruments()
    useCollectionsStore.getState().loadCollections()
    useMarketFilterStore.getState().load()
  }, [])

  // Electron IPC — 监听托盘菜单导航消息
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onNavigateTab?.((tab: string) => {
      switch (tab) {
        case 'market':
          openTab({ type: 'market', title: '📊 期货' })
          break
        case 'favorites':
          openTab({ type: 'collections', title: '📁 收藏夹' })
          break
        case 'order':
          openTab({ type: 'order', title: '📝 五档下单' })
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

  // Electron IPC — 顶部菜单打开浮动窗（报单/K线/无限下单/查询/设置等）
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onOpenFloatingTab?.((tab) => {
      switch (tab) {
        case 'order':
          openOrderFloating()
          break
        case 'kline':
          openKlineFloating()
          break
        case 'infinite':
          openInfiniteFloating()
          break
        case 'settings':
          openSettingsFloating()
          break
        case 'ipc-monitor':
          openIpcMonitorFloating()
          break
        case 'query-orders':
          openOrdersQueryFloating()
          break
        case 'query-positions':
          openPositionsQueryFloating()
          break
        case 'query-account':
          openAccountQueryFloating()
          break
        case 'tquote':
          openTQuoteFloating()
          break
        case 'collections':
          openCollectionsFloating()
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

  return (
    <div className="app">
      <ToastContainer />
      <GlobalBar />

      {/* 浮动窗口内容 overlay：TabContent 将浮动标签内容 portal 到这里，
          与 FloatingWindow chrome 同层，脱离 .tab-content 布局/溢出/层叠干扰 */}
      <div id="floating-overlay" />

      <main className="tab-main">
        <TabContent />
      </main>

      {/* 底部状态栏：连接状态 + 全局工具（图标+中文名），箭头可收起/展开 */}
      <BottomBar />

      {/* 浮动标签窗口（chrome 壳；内容由 TabContent 位移覆盖）。
          统一浮动窗模式：报单/K线/无限下单/设置/网络监控均以浮动窗口打开，
          支持 ⇩ 停靠回标签栏 / 拖拽脱离 双向转换。 */}
      <FloatingWindows />
    </div>
  )
}

export default App
