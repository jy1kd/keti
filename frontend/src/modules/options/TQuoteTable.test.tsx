import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, cleanup } from '@testing-library/react'
import { TQuoteTable } from './TQuoteTable'
import type { OptionChain, OptionQuote, MarketSnapshot } from '@/services/types'

function makeQuote(overrides: Partial<OptionQuote> = {}): OptionQuote {
  return {
    instrumentID: 'IF2608-C-4800',
    strikePrice: 4800,
    lastPrice: 120.5,
    bidPrice: 120.0,
    askPrice: 121.0,
    volume: 500,
    openInterest: 3000,
    impliedVolatility: 0.25,
    ...overrides,
  }
}

describe('TQuoteTable', () => {
  const chain: OptionChain = {
    underlying: 'IF2608',
    expireDate: '20260815',
    calls: [
      makeQuote({ instrumentID: 'IF2608-C-4700', strikePrice: 4700, lastPrice: 180.0, impliedVolatility: 0.22 }),
      makeQuote({ instrumentID: 'IF2608-C-4800', strikePrice: 4800, lastPrice: 120.5, impliedVolatility: 0.25 }),
    ],
    puts: [
      makeQuote({ instrumentID: 'IF2608-P-4700', strikePrice: 4700, lastPrice: 80.0, impliedVolatility: 0.20 }),
      makeQuote({ instrumentID: 'IF2608-P-4800', strikePrice: 4800, lastPrice: 130.0, impliedVolatility: 0.28 }),
    ],
    updateTime: '2026-07-24T10:00:00',
  }

  const chainWithGaps: OptionChain = {
    underlying: 'IF2608',
    expireDate: '20260815',
    calls: [
      makeQuote({ instrumentID: 'IF2608-C-4800', strikePrice: 4800, lastPrice: 120.5 }),
    ],
    puts: [
      makeQuote({ instrumentID: 'IF2608-P-4700', strikePrice: 4700, lastPrice: 80.0 }),
    ],
    updateTime: '2026-07-24T10:00:00',
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 先卸载（fake timers 仍生效：卸载调度的延迟 release 定时器是 fake 的），
    // 再切回真实定时器丢弃全部挂起 fake 定时器 → 无真实 250ms release 定时器泄漏到后续用例。
    cleanup()
    vi.useRealTimers()
  })

  it('renders a container element', () => {
    const { container } = render(<TQuoteTable chain={chain} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('creates ListTable with correct options', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    expect(ListTable).toHaveBeenCalledTimes(1)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.columns).toBeDefined()
    expect(options.columns.length).toBe(11) // 5 call cols + 1 strike + 5 put cols（已去除 IV 列）
    // 不再渲染 IV 列
    const fields = options.columns.map((c: any) => c.field)
    expect(fields).not.toContain('callIV')
    expect(fields).not.toContain('putIV')
  })

  it('采用自适应宽度填满容器 + 低调滚动条（与行情表格一致）', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.widthMode).toBe('adaptive')
    const ss = options.theme.scrollStyle
    expect(ss).toBeDefined()
    expect(ss.visible).toBe('focus')
    expect(ss.width).toBe(6)
    expect(ss.scrollSliderColor).toBe('rgba(139,148,158,0.45)')
    expect(ss.barToSide).toBe(true)
  })

  it('merges calls and puts by strike price into sorted records', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const records = options.records
    expect(records).toHaveLength(2)
    // Strikes sorted ascending
    expect(records[0].strikePrice).toBe(4700)
    expect(records[1].strikePrice).toBe(4800)
    // First row: call exists, put exists
    expect(records[0].callLastPrice).toBe(180.0)
    expect(records[0].putLastPrice).toBe(80.0)
    // Second row
    expect(records[1].callLastPrice).toBe(120.5)
    expect(records[1].putLastPrice).toBe(130.0)
  })

  it('shows placeholder when call or put is missing at a strike', async () => {
    render(<TQuoteTable chain={chainWithGaps} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const records = options.records
    expect(records).toHaveLength(2)
    // 4700: no call, has put
    expect(records[0].callLastPrice).toBe('--')
    expect(records[0].putLastPrice).toBe(80.0)
    // 4800: has call, no put
    expect(records[1].callLastPrice).toBe(120.5)
    expect(records[1].putLastPrice).toBe('--')
  })

  it('shows empty placeholder when chain has no data', async () => {
    const emptyChain: OptionChain = { underlying: '', expireDate: '', calls: [], puts: [], updateTime: '' }
    render(<TQuoteTable chain={emptyChain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(0)
  })

  it('卸载后延迟 250ms 释放 vtable（避让 ResizeObserver 100ms 防抖回调，防 internalProps 置 null 后 resize 崩溃）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    const { unmount } = render(<TQuoteTable chain={chain} />)
    const instance = (ListTable as any).mock.results[0]?.value
    unmount()
    // 250ms 内尚未释放：挂起的防抖回调仍能在存活表上触发
    expect(instance?.release).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(instance?.release).toHaveBeenCalledTimes(1)
  })

  it('快速挂载→卸载→挂载：同实例至多保留一个释放定时器，旧表仍被释放一次', async () => {
    const { ListTable } = await import('@visactor/vtable')
    // StrictMode 双挂载使同一实例经历 setup→cleanup→setup（挂载期）+ 真实卸载 cleanup，
    // 模拟快速开合：每次 cleanup 前取消上一释放定时器 → 仅最新一次释放生效（不叠加）
    const { unmount } = render(
      <StrictMode><TQuoteTable chain={chain} /></StrictMode>
    )
    const instance = (ListTable as any).mock.results[0]?.value
    expect(instance?.release).not.toHaveBeenCalled()
    unmount()
    expect(instance?.release).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    // 只发生一次释放（旧挂起定时器已被最新 cleanup 取消）
    expect(instance?.release).toHaveBeenCalledTimes(1)
  })

  it('updates records incrementally when snapshots change without recreating table', async () => {
    const { rerender } = render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0]?.value

    const callsBeforeRerender = (ListTable as any).mock.calls.length

    const snapshots = new Map<string, MarketSnapshot>([
      [
        'IF2608-C-4700',
        {
          instrumentID: 'IF2608-C-4700',
          lastPrice: 999,
          bidPrice1: 998,
          askPrice1: 1000,
          volume: 100,
          openInterest: 5000,
        } as MarketSnapshot,
      ],
    ])

    rerender(<TQuoteTable chain={chain} snapshots={snapshots} />)

    // In StrictMode effects run twice on mount, so we assert that the rerender
    // itself did not trigger a new ListTable construction.
    expect((ListTable as any).mock.calls.length).toBe(callsBeforeRerender)
    expect(instance.setRecords).toHaveBeenCalled()
  })
})
