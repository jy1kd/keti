import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { OrderPopup } from './OrderPopup'
import { useOrderPopupStore } from './popupStore'
import { useOrderStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import type { MarketSnapshot } from '@/services/types'

// Mock toast，使上限路径可断言 toast.error
const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}))

vi.mock('@/components/Toast', () => ({
  toast: { error: toastErrorMock },
}))

// Mock API：AccountBar 挂载即拉取持仓/账户（jsdom 无后端，返回空即静默）
const { refreshPositionsMock, refreshAccountMock, lockPositionMock } = vi.hoisted(() => ({
  refreshPositionsMock: vi.fn(),
  refreshAccountMock: vi.fn(),
  lockPositionMock: vi.fn(),
}))

vi.mock('@/services/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/api')>()
  return {
    ...mod,
    refreshPositions: refreshPositionsMock,
    refreshAccount: refreshAccountMock,
    lockPosition: lockPositionMock,
  }
})

// Mock FLIP 工具：jsdom 无真实布局，同步触发 onDone
vi.mock('@/utils/flip', () => ({
  getRect: () => ({ left: 0, top: 0, width: 740, height: 500 }),
  flipToRect: (_el: HTMLElement, _from: unknown, _to: unknown, opts: { onDone?: () => void } = {}) => {
    opts.onDone?.()
  },
  getTabPanelRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
}))

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4695,
    bidPrice1: 4694, bidVolume1: 10,
    bidPrice2: 4693, bidVolume2: 20,
    bidPrice3: 4692, bidVolume3: 30,
    bidPrice4: 4691, bidVolume4: 40,
    bidPrice5: 4690, bidVolume5: 50,
    askPrice1: 4696, askVolume1: 15,
    askPrice2: 4697, askVolume2: 25,
    askPrice3: 4698, askVolume3: 35,
    askPrice4: 4699, askVolume4: 45,
    askPrice5: 4700, askVolume5: 55,
    volume: 20892,
    openInterest: 45105,
    openPrice: 4680,
    highestPrice: 4705,
    lowestPrice: 4675,
    preSettlementPrice: 4690,
    upperLimitPrice: 5100,
    lowerLimitPrice: 4300,
    ...overrides,
  } as MarketSnapshot
}

const IF2608_CONTRACT = {
  instrumentID: 'IF2608',
  instrumentName: '沪深300',
  exchangeID: 'CFFEX',
  productID: 'IF',
  volumeMultiple: 300,
  priceTick: 0.2,
  expireDate: '2026-08-15',
  isTrading: 1,
  productClass: '1',
}

describe('OrderPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useOrderPopupStore.setState({ instrumentID: null, expanded: false })
    refreshPositionsMock.mockResolvedValue({})
    refreshAccountMock.mockResolvedValue({})
    lockPositionMock.mockResolvedValue({ success: true })
    useOrderStore.getState().resetOrderForm()
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      favorites: [],
      isLoaded: true,
    })
    useMarketStore.setState({ snapshots: new Map(), lockedContracts: new Map() })
  })

  it('弹窗关闭时不渲染', () => {
    const { container } = render(<OrderPopup />)
    expect(container.firstChild).toBeNull()
  })

  it('打开后渲染标题、参数区与三列盘口', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    expect(screen.getByText('📝 报单-IF2608')).toBeInTheDocument()
    // 左列压缩参数区（TradeParams）
    expect(screen.getByTestId('tp-volume')).toBeInTheDocument()
    expect(screen.getByLabelText('开平')).toBeInTheDocument()
    // 右列三列十档盘口（MarketDepth）+ 内嵌快捷买卖栏
    expect(screen.getByTestId('ask-1')).toBeInTheDocument()
    expect(screen.getByTestId('bid-1')).toBeInTheDocument()
    expect(screen.getByTestId('qtb-buy')).toBeInTheDocument()
  })

  it('打开后表单合约同步为弹窗合约', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2608')
  })

  it('打开后锁定合约订阅，保证五档行情有数据', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    // 合约进入锁定订阅集 → useSubscriptionManager 会订阅它 → WS 推送行情
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(true)
  })

  it('关闭弹窗后解除合约锁定订阅', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    const { unmount } = render(<OrderPopup />)
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(true)

    unmount()
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(false)
  })

  it('点击 × 关闭弹窗', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.click(screen.getByLabelText('关闭报单弹窗'))
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('按 ESC 关闭弹窗', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('打开弹窗即置顶（bringToFront order 写入统一 z）', () => {
    useFloatingWindowStore.setState({ popupZ: {}, windows: {} })
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    expect(useFloatingWindowStore.getState().popupZ['order']).toBeGreaterThanOrEqual(1401)
  })

  it('点击弹窗内容触发置顶（捕获阶段，子元素 stopPropagation 也生效）', () => {
    useFloatingWindowStore.setState({ popupZ: {}, windows: {} })
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    const before = useFloatingWindowStore.getState().popupZ['order']!
    const dialog = screen.getByRole('dialog')
    const child = document.createElement('div')
    child.addEventListener('pointerdown', (e) => e.stopPropagation())
    dialog.appendChild(child)
    fireEvent(child, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
    const after = useFloatingWindowStore.getState().popupZ['order']!
    expect(after).toBeGreaterThan(before)
  })

  it('点击盘口卖一档弹出确认框（买入 · 卖一价 4696），确认前不直接改单', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__buy')!)
    // 每次点价必弹确认框（强制确认流）
    const dialog = screen.getByTestId('confirm-dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('买入')).toBeInTheDocument()
    expect(within(dialog).getByText('4696.0')).toBeInTheDocument()
    // 确认前订单表单未被改写
    expect(useOrderStore.getState().orderForm.limitPrice).toBe(0)
  })

  // ── P2 完整态与账户栏 ────────────────────────────────────────

  it('渲染账户栏 AccountBar（精简态也显示）与底部工具条 FooterBar', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    expect(screen.getByTestId('account-bar')).toBeInTheDocument()
    expect(screen.getByTestId('order-popup-footer')).toBeInTheDocument()
    expect(screen.getByTestId('op-footer-toggle')).toBeInTheDocument()
  })

  it('精简态默认不渲染行情统计栏 QuoteStatsBar', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608', expanded: false })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    expect(screen.queryByTestId('quote-stats-bar')).not.toBeInTheDocument()
  })

  it('FooterBar ∧/∨ 切换精简/完整态：展开渲染 QuoteStatsBar，收起还原', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608', expanded: false })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    expect(screen.queryByTestId('quote-stats-bar')).not.toBeInTheDocument()
    // ∧ 展开完整态
    fireEvent.click(screen.getByTestId('op-footer-toggle'))
    expect(useOrderPopupStore.getState().expanded).toBe(true)
    expect(screen.getByTestId('quote-stats-bar')).toBeInTheDocument()
    expect(screen.getByText('今开')).toBeInTheDocument()
    expect(screen.getByText('成交量')).toBeInTheDocument()
    expect(screen.getByTestId('op-footer-toggle').textContent).toContain('收起')
    // ∨ 收起
    fireEvent.click(screen.getByTestId('op-footer-toggle'))
    expect(useOrderPopupStore.getState().expanded).toBe(false)
    expect(screen.queryByTestId('quote-stats-bar')).not.toBeInTheDocument()
  })

  it('标题栏 — 按钮收起完整态（等价 FooterBar ∨）', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608', expanded: true })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    expect(screen.getByTestId('quote-stats-bar')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('收起为精简态'))
    expect(screen.queryByTestId('quote-stats-bar')).not.toBeInTheDocument()
    expect(useOrderPopupStore.getState().expanded).toBe(false)
  })

  it('完整态展开状态持久化到 localStorage', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608', expanded: false })
    render(<OrderPopup />)
    fireEvent.click(screen.getByTestId('op-footer-toggle'))
    const raw = localStorage.getItem('simnow-order-popup')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).state.expanded).toBe(true)
  })
})

describe('⤢ 放大为标签页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useOrderPopupStore.setState({ instrumentID: null, expanded: false })
    refreshPositionsMock.mockResolvedValue({})
    refreshAccountMock.mockResolvedValue({})
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
  })

  it('应渲染放大按钮', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    expect(screen.getByLabelText('放大为标签页')).toBeInTheDocument()
  })

  it('点击放大应打开 order 标签并关闭弹窗', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    const { tabs, activeTabId } = useTabStore.getState()
    expect(tabs.some((t) => t.type === 'order' && t.props.instrumentID === 'IF2608')).toBe(true)
    expect(activeTabId).toBe('tab-order-IF2608')
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('标签页达上限时 toast 提示且弹窗保持', () => {
    const { openTab } = useTabStore.getState()
    // 占满 15 个
    for (let i = 0; i < 14; i++) {
      openTab({ type: 'order', title: `合约${i}`, props: { instrumentID: `c${i}` } })
    }
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    expect(useOrderPopupStore.getState().instrumentID).toBe('IF2608') // 弹窗保持
    expect(toastErrorMock).toHaveBeenCalledWith('标签页数量已达上限（15），请先关闭部分标签页')
  })
})

function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('缩放调整大小', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useOrderPopupStore.setState({ instrumentID: null, expanded: false })
    refreshPositionsMock.mockResolvedValue({})
    refreshAccountMock.mockResolvedValue({})
    // jsdom 无真实布局：物化 getBoundingClientRect 为 740×500 居中矩形
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 142, top: 134, width: 740, height: 500,
      right: 882, bottom: 634,
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染 8 个方向缩放手柄', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByLabelText(`调整弹窗大小 ${dir}`)).toBeInTheDocument()
    })
  })

  it('拖 e 手柄：更新宽度并物化位置', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 882, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 920, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 920, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('778px')
    expect(dialog.style.left).toBe('142px')
  })

  it('缩到小于最小宽度时钳制到 540', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 882, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('540px')
  })

  it('重开回到默认尺寸与居中位置', async () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    // 放大（拖 e 手柄）
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 882, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 920, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 920, clientY: 300 }))
    // 关闭 → 等待 effect 重置 position/size → 再打开
    await act(() => {
      useOrderPopupStore.setState({ instrumentID: '' })
    })
    await act(() => {
      useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('')     // 无内联宽度 → 回到默认 CSS 尺寸
    expect(dialog.style.left).toBe('50%')   // 回到默认居中（position=null 时走 transform 居中）
  })
})
