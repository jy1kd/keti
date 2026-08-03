import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useContractContextMenu } from './useContractContextMenu'
import { useTabStore } from '@/stores/tabs'

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

  it('openOrderTab 打开报单标签页', () => {
    const { result } = renderHook(() => useContractContextMenu())
    act(() => {
      result.current.openOrderTab('IF2608')
    })

    const tabs = useTabStore.getState().tabs
    const orderTab = tabs.find((t) => t.type === 'order' && t.props?.instrumentID === 'IF2608')
    expect(orderTab).toBeDefined()
    expect(orderTab?.title).toBe('📝 报单-IF2608')
    expect(useTabStore.getState().activeTabId).toBe(orderTab?.id)
  })

  it('openKlineTab 打开K线标签页', () => {
    const { result } = renderHook(() => useContractContextMenu())
    act(() => {
      result.current.openKlineTab('IF2608')
    })

    const tabs = useTabStore.getState().tabs
    const klineTab = tabs.find((t) => t.type === 'kline' && t.props?.instrumentID === 'IF2608')
    expect(klineTab).toBeDefined()
    expect(klineTab?.title).toBe('📈 K线-IF2608')
    expect(useTabStore.getState().activeTabId).toBe(klineTab?.id)
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
