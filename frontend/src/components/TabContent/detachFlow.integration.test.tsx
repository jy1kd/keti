import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TabContent } from './index'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { detachTabAt } from '@/utils/detachDrag'

// 集成测试：走真实的 detachTabAt（不 mock），验证「拖出活跃标签后主窗口切回行情、不空白」

vi.mock('@/modules/market/MarketPanel', () => ({
  MarketPanel: () => <div data-testid="market-panel">行情面板 Mock</div>,
}))
vi.mock('@/modules/query/QueryPanel', () => ({
  QueryPanel: () => <div data-testid="query-panel">查询面板 Mock</div>,
}))
vi.mock('@/pages/OrderPage', () => ({
  OrderPage: () => <div data-testid="order-page">报单页面 Mock</div>,
}))
vi.mock('@/pages/KLinePage', () => ({
  KLinePage: () => <div data-testid="kline-page">K线页面 Mock</div>,
}))
vi.mock('@/pages/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">设置页面 Mock</div>,
}))
vi.mock('@/pages/FavoritesPage', () => ({
  FavoritesPage: () => <div data-testid="fav-page">自选 Mock</div>,
}))
vi.mock('@/pages/IPCMonitorPage', () => ({
  IPCMonitorPage: () => <div data-testid="ipc-page">IPC Mock</div>,
}))

function appendOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'floating-overlay'
  document.body.appendChild(overlay)
  return overlay
}

describe('TabContent × detachTabAt 集成', () => {
  beforeEach(() => {
    useFloatingWindowStore.setState({ windows: {}, popupZ: {} })
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-settings',
    })
    appendOverlay()
  })
  afterEach(() => {
    document.getElementById('floating-overlay')?.remove()
  })

  it('拖出活跃标签后：主窗口切回行情标签页，内容区不空白', () => {
    const { rerender } = render(<TabContent />)

    // 拖前：主窗口显示设置
    let mainPanels = document.querySelectorAll('.tab-content [role="tabpanel"]')
    expect(mainPanels).toHaveLength(2)
    expect(mainPanels[1]).toHaveStyle({ display: 'block' }) // settings 活跃

    // 模拟真实脱离（TabBar/TabContent 的 onDetach 均调用 detachTabAt）
    detachTabAt('tab-settings', { x: 300, y: 200 })
    rerender(<TabContent />)

    // 活跃标签切回 market
    expect(useTabStore.getState().activeTabId).toBe('tab-market')

    // 主窗口内容区应显示行情面板（不空白）
    mainPanels = document.querySelectorAll('.tab-content [role="tabpanel"]')
    const visible = Array.from(mainPanels).filter((p) => (p as HTMLElement).style.display !== 'none')
    expect(visible.length).toBeGreaterThan(0)
    expect(mainPanels[0]).toHaveStyle({ display: 'block' }) // market
    expect(mainPanels[0]).toHaveAttribute('aria-hidden', 'false')

    // 设置面板已 portal 到 overlay
    const overlay = document.getElementById('floating-overlay')!
    const overlayPanels = overlay.querySelectorAll('[role="tabpanel"]')
    expect(overlayPanels).toHaveLength(1)
  })

  it('拖出非活跃标签：主窗口保持当前活跃标签，不空白', () => {
    useTabStore.setState({ activeTabId: 'tab-market' })
    const { rerender } = render(<TabContent />)

    detachTabAt('tab-settings', { x: 300, y: 200 })
    rerender(<TabContent />)

    expect(useTabStore.getState().activeTabId).toBe('tab-market')
    const mainPanels = document.querySelectorAll('.tab-content [role="tabpanel"]')
    const visible = Array.from(mainPanels).filter((p) => (p as HTMLElement).style.display !== 'none')
    expect(visible.length).toBeGreaterThan(0)
  })
})
