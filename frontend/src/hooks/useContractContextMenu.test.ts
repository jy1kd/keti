import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useContractContextMenu } from './useContractContextMenu'
import { useTabStore } from '@/stores/tabs'
import { useMarketStore } from '@/modules/market/store'
import { openFloatingTab } from '@/utils/openFloatingTab'

// Mock 统一浮动窗入口：openOrderPopup/openQueryPopup 现为打开浮动窗口
vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: vi.fn(),
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
}))

const mockOpenFloatingTab = vi.mocked(openFloatingTab)

function resetTabs() {
  useTabStore.setState({
    tabs: [{ id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false }],
    activeTabId: 'tab-market',
  })
}

describe('useContractContextMenu', () => {
  beforeEach(() => {
    resetTabs()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetTabs()
  })

  it('openOrderPopup 打开报单浮动窗口（统一浮动窗模式）', () => {
    const { result } = renderHook(() => useContractContextMenu())
    act(() => {
      result.current.openOrderPopup('IF2608')
    })

    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'order',
      title: '📝 报单-IF2608',
      props: { instrumentID: 'IF2608' },
      size: { w: 620, h: 540 },
    })
  })

  it('openKlineTab 打开K线浮动窗口', () => {
    const { result } = renderHook(() => useContractContextMenu())
    act(() => {
      result.current.openKlineTab('IF2608')
    })

    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'kline',
      title: '📈 K线-IF2608',
      props: { instrumentID: 'IF2608' },
    })
  })

  it('openKlineTabs 批量打开K线为停靠标签（与批量报单一致，非浮动窗）', () => {
    const openTabSpy = vi.spyOn(useTabStore.getState(), 'openTab')
    const { result } = renderHook(() => useContractContextMenu())
    act(() => {
      result.current.openKlineTabs(['IF2608', 'rb2610'])
    })

    expect(openTabSpy).toHaveBeenNthCalledWith(1, {
      type: 'kline',
      title: '📈 K线-IF2608',
      props: { instrumentID: 'IF2608' },
    })
    expect(openTabSpy).toHaveBeenNthCalledWith(2, {
      type: 'kline',
      title: '📈 K线-rb2610',
      props: { instrumentID: 'rb2610' },
    })
    // 批量K线不再走浮动窗
    expect(mockOpenFloatingTab).not.toHaveBeenCalled()
  })

  it('handleContextMenu 抑制浏览器默认菜单并记录坐标', () => {
    const { result } = renderHook(() => useContractContextMenu())
    const preventDefault = vi.fn()

    act(() => {
      result.current.handleContextMenu('IF2608', 4695, {
        preventDefault,
        clientX: 120,
        clientY: 240,
      } as unknown as MouseEvent)
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(result.current.contextMenu).toEqual({ instrumentID: 'IF2608', price: 4695, x: 120, y: 240 })
  })

  it('handleContextMenu 同步 selectedInstrument 到右键合约（金色锚点）', () => {
    useMarketStore.setState({ selectedInstrument: null })
    const { result } = renderHook(() => useContractContextMenu())
    act(() => {
      result.current.handleContextMenu('IF2608', 4695, {
        preventDefault: vi.fn(),
        clientX: 120,
        clientY: 240,
      } as unknown as MouseEvent)
    })
    expect(useMarketStore.getState().selectedInstrument).toBe('IF2608')
  })

  it('点击空白处关闭右键菜单', () => {
    const { result } = renderHook(() => useContractContextMenu())

    act(() => {
      result.current.handleContextMenu('IF2608', 4695, {
        preventDefault: vi.fn(),
        clientX: 120,
        clientY: 240,
      } as unknown as MouseEvent)
    })
    expect(result.current.contextMenu).not.toBeNull()

    // 模拟窗口点击事件关闭菜单
    act(() => {
      window.dispatchEvent(new MouseEvent('click'))
    })
    expect(result.current.contextMenu).toBeNull()
  })
})
