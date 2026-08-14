import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { TabBar } from '@/components/TabBar'
import { TabContent } from './index'
import { FloatingWindows } from '@/components/FloatingWindow'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'

// ── 复现测试：真实 App 外壳（真实 TabBar + TabContent + FloatingWindows + 真实 detach 逻辑），
//    仅 mock 页面内容与 Electron，验证「拖出活跃标签后主窗口切回行情、弹窗下方不空白」。──

vi.mock('@/modules/market/MarketPanel', () => ({
  MarketPanel: () => <div data-testid="market-panel">行情面板</div>,
}))
vi.mock('@/pages/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">设置页面</div>,
}))
vi.mock('@/pages/OrderPage', () => ({
  OrderPage: () => <div data-testid="order-page">报单页面</div>,
}))
vi.mock('@/pages/KLinePage', () => ({
  KLinePage: () => <div data-testid="kline-page">K线页面</div>,
}))
vi.mock('@/pages/FavoritesPage', () => ({
  FavoritesPage: () => <div data-testid="fav-page">自选页面</div>,
}))
vi.mock('@/pages/IPCMonitorPage', () => ({
  IPCMonitorPage: () => <div data-testid="ipc-page">IPC页面</div>,
}))
vi.mock('@/services/electron', () => ({
  isElectron: () => false,
}))

/** jsdom 24 无 PointerEvent 构造器，用 MouseEvent 保留 clientX/clientY/button */
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

function appendOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'floating-overlay'
  document.body.appendChild(overlay)
  return overlay
}

function renderAppShell() {
  return render(
    <>
      <TabBar />
      <div id="floating-overlay" />
      <main className="tab-main">
        <TabContent />
      </main>
      <FloatingWindows />
    </>,
  )
}

describe('真实拖拽复现：拖出活跃标签 → 主窗口切回行情', () => {
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

  it('从 TabBar 拖出「设置」pill：主窗口切回行情（不空白），设置面板 portal 到 overlay', () => {
    renderAppShell()

    // 拖前：主窗口应显示设置面板（活跃）——tabs 顺序为 [market, settings]，settings 在下标 1
    let mainVisible = () =>
      Array.from(document.querySelectorAll('.tab-content [role="tabpanel"]')).filter(
        (p) => (p as HTMLElement).style.display !== 'none',
      )
    expect(mainVisible()).toHaveLength(1)
    const beforePanels = document.querySelectorAll('.tab-content [role="tabpanel"]')
    expect(beforePanels[0]).toHaveStyle({ display: 'none' }) // market 非活跃
    expect(beforePanels[1]).toHaveStyle({ display: 'block' }) // settings 活跃

    // 找到「设置」pill 并模拟完整拖拽手势（pointerdown → move 超阈值 → up）
    const settingsPill = Array.from(document.querySelectorAll('[role="tab"]')).find((t) =>
      t.textContent?.includes('设置'),
    ) as HTMLElement
    expect(settingsPill).toBeTruthy()

    act(() => {
      fireEvent(settingsPill, pointerEvent('pointerdown', { clientX: 120, clientY: 10, button: 0, bubbles: true }))
      // 拖动越过阈值（6px）→ 进入脱离状态并产生 ghost
      fireEvent(window, pointerEvent('pointermove', { clientX: 300, clientY: 120, bubbles: true }))
      fireEvent(window, pointerEvent('pointermove', { clientX: 320, clientY: 140, bubbles: true }))
      fireEvent(window, pointerEvent('pointerup', { clientX: 320, clientY: 140, bubbles: true }))
    })

    // ① 活跃标签切回 market
    expect(useTabStore.getState().activeTabId).toBe('tab-market')

    // ② 主窗口内容区显示行情面板（不空白），且设置面板不在 .tab-content 内
    expect(mainVisible()).toHaveLength(1)
    expect(document.querySelector('.tab-content [role="tabpanel"]')).toHaveAttribute('aria-hidden', 'false')

    // ③ 设置面板已 portal 到 overlay
    const overlay = document.getElementById('floating-overlay')!
    expect(overlay.querySelector('[data-testid="settings-page"]')).not.toBeNull()

    // ④ 浮动 chrome 已渲染
    expect(document.querySelector('[data-testid^="floating-window-"]')).not.toBeNull()

    // ⑤ TabBar 中设置 pill 已隐藏（浮动标签从标签栏消失）
    const remainingTabs = Array.from(document.querySelectorAll('[role="tab"]'))
    expect(remainingTabs.some((t) => t.textContent?.includes('设置'))).toBe(false)
  })

  it('从内容区 [data-drag-handle] 拖出活跃标签：主窗口同样切回行情', () => {
    renderAppShell()

    // 设置面板内容区有一个 data-drag-handle（真实 SettingsPage 的 header 有，mock 后补上）
    const settingsPanel = document.querySelector('[data-testid="settings-page"]') as HTMLElement
    const handle = document.createElement('div')
    handle.setAttribute('data-drag-handle', '')
    handle.setAttribute('data-testid', 'settings-drag-handle')
    settingsPanel.appendChild(handle)

    act(() => {
      fireEvent(handle, pointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, bubbles: true }))
      fireEvent(window, pointerEvent('pointermove', { clientX: 260, clientY: 160, bubbles: true }))
      fireEvent(window, pointerEvent('pointerup', { clientX: 260, clientY: 160, bubbles: true }))
    })

    expect(useTabStore.getState().activeTabId).toBe('tab-market')
    const visible = Array.from(document.querySelectorAll('.tab-content [role="tabpanel"]')).filter(
      (p) => (p as HTMLElement).style.display !== 'none',
    )
    expect(visible).toHaveLength(1)
  })
})
