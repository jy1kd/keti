import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MarketTable } from './MarketTable'
import { useMarketStore } from './store'
import type { ContractInfo } from '@/services/types'

/**
 * 回归：已批量选中后再拖选，金色高亮不得滞留。
 *
 * 根因：拖选时把金色锚点同步到起始行（`handleMouseDown` 调 setSelectedInstrument），
 * 拖选把金色"钉"在起始行上；且锚点落在蓝区内 → shouldRenderAnchor 恒 true →
 * clearSelected 永不触发 → 无法消除。
 *
 * 修复：普通拖选（无 Ctrl/Shift）不设金色锚点——首次 mousemove 时
 * `setSelectedInstrument(null)` 清掉锚点，拖选结束仅保留蓝色选区；
 * 单击仍经 click_cell 重新设置锚点（金色跟随单击），无闪烁。
 * 另禁用 vtable 原生拖选扩展（select.disableDragSelect），避免原生金色矩形与
 * RAF selectRow 竞态（双保险）。
 */
describe('二次拖选金色高亮不滞留', () => {
  const contracts: ContractInfo[] = Array.from({ length: 8 }, (_, i) => ({
    instrumentID: `C${i}`,
    instrumentName: `测试${i}`,
    exchangeID: 'SHFE',
    productID: 'au',
    volumeMultiple: 1000,
    priceTick: 0.02,
    expireDate: '99991231',
    isTrading: 1,
    productClass: '1',
  }))

  /** 包裹组件：selectedInstrument/selectedContracts 跟随 store，模拟真实状态流 */
  function Wrapper() {
    const selectedInstrument = useMarketStore((s) => s.selectedInstrument)
    const selectedContracts = useMarketStore((s) => s.selectedContracts)
    return (
      <MarketTable
        contracts={contracts}
        snapshots={new Map()}
        selectedInstrument={selectedInstrument}
        selectedContracts={selectedContracts}
        onSelectionChange={(ids) => useMarketStore.getState().setSelectedContracts(ids)}
        onRowClick={(id) => useMarketStore.getState().setSelectedInstrument(id)}
      />
    )
  }

  function stubRaf() {
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0 }) as typeof requestAnimationFrame
    }
    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
    }
    const raf = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0 })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    return () => { raf.mockRestore(); cancel.mockRestore() }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    // 初始：已批量选中 C0,C1,C2，锚点 C0（金色在 C0）
    act(() => {
      useMarketStore.setState({ selectedInstrument: 'C0', selectedContracts: new Set(['C0', 'C1', 'C2']) })
    })
  })

  afterEach(() => {
    act(() => {
      useMarketStore.setState({ selectedInstrument: null, selectedContracts: new Set() })
    })
    vi.useRealTimers()
  })

  it('关闭 vtable 原生拖选扩展（select.disableDragSelect=true，双保险）', async () => {
    render(<MarketTable contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.select?.disableDragSelect).toBe(true)
  })

  it('已选中区域内二次拖选：拖选开始清空锚点，蓝区更新，金色被清除', async () => {
    const restore = stubRaf()
    const { ListTable } = await import('@visactor/vtable')
    const { container } = render(<Wrapper />)
    const instance = (ListTable as any).mock.results[0].value
    instance.getBodyVisibleCellRange = vi.fn().mockReturnValue({ rowStart: 1, rowEnd: 20, colStart: 0, colEnd: 10 })
    Object.defineProperty(instance, 'tableNoFrameWidth', { value: 1200, configurable: true })
    Object.defineProperty(instance, 'tableNoFrameHeight', { value: 1000, configurable: true })

    // getCellAt 按 y 返回 vtable 行：y<400 → row2(C1)，y>=400 → row4(C3)
    instance.getCellAt = vi.fn((_x: number, y: number) => ({ row: y < 400 ? 2 : 4, col: 0 }))
    instance.selectRow.mockClear()
    instance.clearSelected.mockClear()
    const tableEl = container.firstChild as HTMLElement

    await act(async () => {
      // 在已选中区域内（C1）按下 → 拖到 C3 → 松开
      tableEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 100, button: 0, bubbles: true }))
      tableEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 500, button: 0, bubbles: true }))
      tableEl.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 500, button: 0, bubbles: true }))
    })

    // 蓝区 = 新拖选范围 {C1,C2,C3}
    expect(Array.from(useMarketStore.getState().selectedContracts).sort()).toEqual(['C1', 'C2', 'C3'])
    // 拖选开始即清空锚点（普通拖选是批量操作，不设金色锚点）→ 金色被清除
    expect(useMarketStore.getState().selectedInstrument).toBeNull()
    expect(instance.clearSelected).toHaveBeenCalled()
    // 金色不再被 selectRow 钉在拖选起始行（C1 → vtable row 2）
    expect(instance.selectRow).not.toHaveBeenCalledWith(2)
    restore()
  })

  it('拖选结束后单击某行：金色锚点跟随到该行（单选仍正常）', async () => {
    const restore = stubRaf()
    const { ListTable } = await import('@visactor/vtable')
    const { container } = render(<Wrapper />)
    const instance = (ListTable as any).mock.results[0].value
    instance.getBodyVisibleCellRange = vi.fn().mockReturnValue({ rowStart: 1, rowEnd: 20, colStart: 0, colEnd: 10 })
    Object.defineProperty(instance, 'tableNoFrameWidth', { value: 1200, configurable: true })
    Object.defineProperty(instance, 'tableNoFrameHeight', { value: 1000, configurable: true })
    instance.getCellAt = vi.fn((_x: number, y: number) => ({ row: y < 400 ? 2 : 4, col: 0 }))
    instance.selectRow.mockClear()
    instance.clearSelected.mockClear()
    const tableEl = container.firstChild as HTMLElement

    // 二次拖选：C1 → C3
    await act(async () => {
      tableEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 100, button: 0, bubbles: true }))
      tableEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 500, button: 0, bubbles: true }))
      tableEl.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 500, button: 0, bubbles: true }))
    })

    // 用户随后单击 C5（row6）：单选 → 蓝区与金色锚点都落到 C5
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()
    await act(async () => {
      clickHandler({ row: 6, col: 0, event: {} })
    })

    expect(useMarketStore.getState().selectedInstrument).toBe('C5')
    expect(Array.from(useMarketStore.getState().selectedContracts)).toEqual(['C5'])
    expect(instance.selectRow).toHaveBeenLastCalledWith(6)
    restore()
  })
})
