import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { AccountBar } from './AccountBar'
import { useQueryStore } from '@/modules/query/store'

const { refreshPositionsMock, refreshAccountMock, lockPositionMock } = vi.hoisted(() => ({
  refreshPositionsMock: vi.fn(),
  refreshAccountMock: vi.fn(),
  lockPositionMock: vi.fn(),
}))

vi.mock('@/services/api', () => ({
  refreshPositions: refreshPositionsMock,
  refreshAccount: refreshAccountMock,
  lockPosition: lockPositionMock,
}))

vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// IF2608 多 5 空 2（净 3，持盈 800-200=600）；AU2406 多 1（应被过滤不计入）
const POSITIONS = [
  {
    instrumentID: 'IF2608', posiDirection: '2', position: 5, positionProfit: 800,
    positionCost: 0, openCost: 0, useMargin: 0, todayPosition: 5, ydPosition: 0, tradingDay: '20260806',
  },
  {
    instrumentID: 'IF2608', posiDirection: '3', position: 2, positionProfit: -200,
    positionCost: 0, openCost: 0, useMargin: 0, todayPosition: 2, ydPosition: 0, tradingDay: '20260806',
  },
  {
    instrumentID: 'AU2406', posiDirection: '2', position: 1, positionProfit: 50,
    positionCost: 0, openCost: 0, useMargin: 0, todayPosition: 1, ydPosition: 0, tradingDay: '20260806',
  },
]

const ACCOUNT = {
  accountID: 'YYB-1829143', balance: 100000, available: 80000, frozenMargin: 0,
  currMargin: 0, commission: 0, closeProfit: 0, positionProfit: 600,
  deposit: 0, withdraw: 0, preBalance: 100000, tradingDay: '20260806',
}

describe('AccountBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({ positions: [], account: null, isPaused: false })
    refreshPositionsMock.mockResolvedValue({ positions: POSITIONS })
    refreshAccountMock.mockResolvedValue(ACCOUNT)
    lockPositionMock.mockResolvedValue({ success: true })
  })

  it('挂载时触发持仓与账户串行拉取（查询间 1200ms 延迟）', async () => {
    vi.useFakeTimers()
    render(<AccountBar instrumentID="IF2608" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(refreshPositionsMock).toHaveBeenCalledTimes(1)
    expect(refreshAccountMock).toHaveBeenCalledTimes(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(refreshAccountMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('显示账户 ID 与当前合约持仓 多|空(净)、持盈', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    const profit = await screen.findByTestId('ab-profit')
    expect(profit.textContent).toBe('+600.00')
    expect(profit.className).toContain('up')
    // 注入账户数据（模拟 fetch 完成后的 store 状态）
    useQueryStore.setState({ account: ACCOUNT })
    await waitFor(() => {
      expect(screen.getByTestId('ab-account').getAttribute('title')).toBe('YYB-1829143')
    })
    expect(screen.getByTestId('ab-long').textContent).toBe('5')
    expect(screen.getByTestId('ab-short').textContent).toBe('2')
    expect(screen.getByTestId('ab-net').textContent).toBe('(3)')
  })

  it('持仓仅统计当前合约（AU2406 不计入）', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    await screen.findByTestId('ab-profit')
    expect(screen.getByTestId('ab-long').textContent).toBe('5')
    expect(screen.getByTestId('ab-short').textContent).toBe('2')
    expect(screen.getByTestId('ab-net').textContent).toBe('(3)')
  })

  it('持盈盈红亏绿：亏损持仓着色 down', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    await screen.findByTestId('ab-profit')
    useQueryStore.setState({
      positions: [
        {
          instrumentID: 'IF2608', posiDirection: '3', position: 3, positionProfit: -300,
          positionCost: 0, openCost: 0, useMargin: 0, todayPosition: 3, ydPosition: 0, tradingDay: '20260806',
        },
      ],
    })
    await waitFor(() => {
      expect(screen.getByTestId('ab-profit').textContent).toBe('-300.00')
      expect(screen.getByTestId('ab-profit').className).toContain('down')
    })
  })

  it('无持仓时净仓为 0 中性着色', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    await screen.findByTestId('ab-profit')
    useQueryStore.setState({ positions: [] })
    await waitFor(() => {
      expect(screen.getByTestId('ab-long').textContent).toBe('0')
      expect(screen.getByTestId('ab-short').textContent).toBe('0')
      expect(screen.getByTestId('ab-net').textContent).toBe('(0)')
      expect(screen.getByTestId('ab-profit').textContent).toBe('0.00')
      expect(screen.getByTestId('ab-profit').className).toContain('flat')
    })
  })

  it('账户 ID 超长时省略显示，hover title 保留全称', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    await screen.findByTestId('ab-profit')
    useQueryStore.setState({ account: { ...ACCOUNT, accountID: 'YYB-1829143-SH000001' } })
    await waitFor(() => {
      expect(screen.getByTestId('ab-account').textContent).toBe('YYB-18291…')
    })
    expect(screen.getByTestId('ab-account').getAttribute('title')).toBe('YYB-1829143-SH000001')
  })

  it('锁仓为下单操作：点击先弹确认框，取消不调用 lockPosition', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    const btn = await screen.findByTestId('ab-lock')
    expect(btn.textContent).toBe('锁仓')
    fireEvent.click(btn)
    // 强制确认：确认框出现，展示合约与风险提示（下单类操作防误触）
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByText('确认锁仓')).toBeInTheDocument()
    // 取消：不触发任何下单
    fireEvent.click(screen.getByText('取消'))
    expect(lockPositionMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('确认锁仓才调用 lockPosition，锁仓后仍为「锁仓」（无解锁方向重复锁仓）', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    const btn = await screen.findByTestId('ab-lock')
    fireEvent.click(btn)
    fireEvent.click(screen.getByText('确认执行'))
    await waitFor(() => expect(lockPositionMock).toHaveBeenCalledTimes(1))
    expect(lockPositionMock).toHaveBeenCalledWith({ instrumentID: 'IF2608' })
    // 后端 lockPosition 单向锁仓、无解锁端点：按钮永不进入「解锁」态，杜绝二次点击重复锁仓
    expect(btn.textContent).toBe('锁仓')
  })

  it('锁仓成功后刷新持仓（反映反方向开仓后的仓位变化）', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    const btn = await screen.findByTestId('ab-lock')
    // 点击前基准：初始挂载已拉取一次持仓
    const before = refreshPositionsMock.mock.calls.length
    fireEvent.click(btn)
    fireEvent.click(screen.getByText('确认执行'))
    await waitFor(() => expect(lockPositionMock).toHaveBeenCalledTimes(1))
    // handleLockConfirm 成功后调用 fetchPositions → api refreshPositions 多一次
    await waitFor(() => expect(refreshPositionsMock.mock.calls.length).toBeGreaterThan(before))
  })

  describe('账户下拉资金明细（P3-7，P2 审查 🔵-2 延后项）', () => {
    it('点击账户号展开下拉：显示 可用资金/持仓盈亏/动态权益', async () => {
      render(<AccountBar instrumentID="IF2608" />)
      await screen.findByTestId('ab-profit')
      useQueryStore.setState({ account: ACCOUNT })
      await waitFor(() =>
        expect(screen.getByTestId('ab-account').getAttribute('title')).toBe('YYB-1829143'),
      )
      fireEvent.click(screen.getByTestId('ab-account'))
      const dd = within(screen.getByTestId('ab-dropdown'))
      expect(dd.getByText('可用资金')).toBeInTheDocument()
      expect(dd.getByText('80,000.00')).toBeInTheDocument()
      expect(dd.getByText('持仓盈亏')).toBeInTheDocument()
      expect(dd.getByText('600.00')).toBeInTheDocument()
      expect(dd.getByText('动态权益')).toBeInTheDocument()
      expect(dd.getByText('100,000.00')).toBeInTheDocument()
    })

    it('点击外部关闭下拉', async () => {
      render(<AccountBar instrumentID="IF2608" />)
      await screen.findByTestId('ab-profit')
      useQueryStore.setState({ account: ACCOUNT })
      await waitFor(() =>
        expect(screen.getByTestId('ab-account').getAttribute('title')).toBe('YYB-1829143'),
      )
      fireEvent.click(screen.getByTestId('ab-account'))
      expect(screen.getByTestId('ab-dropdown')).toBeInTheDocument()
      fireEvent.mouseDown(document.body)
      expect(screen.queryByTestId('ab-dropdown')).not.toBeInTheDocument()
    })

    it('账户为 null 时点击不展开下拉', async () => {
      render(<AccountBar instrumentID="IF2608" />)
      await screen.findByTestId('ab-profit')
      fireEvent.click(screen.getByTestId('ab-account'))
      expect(screen.queryByTestId('ab-dropdown')).not.toBeInTheDocument()
    })
  })

  it('每 10s 串行自刷新持仓与账户（持仓→1200ms→账户→10s→下一轮）', async () => {
    vi.useFakeTimers()
    render(<AccountBar instrumentID="IF2608" />)
    // t=0：持仓拉取
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(refreshPositionsMock).toHaveBeenCalledTimes(1)
    // 延迟 1200ms 后账户串行拉取（未到时间前账户未拉取）
    expect(refreshAccountMock).toHaveBeenCalledTimes(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(refreshAccountMock).toHaveBeenCalledTimes(1)
    // 10s 周期后新一轮：持仓再次拉取
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(refreshPositionsMock).toHaveBeenCalledTimes(2)
    expect(refreshAccountMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('暂停查询时挂起轮询（不发起 CTP 查询），恢复后继续', async () => {
    vi.useFakeTimers()
    useQueryStore.setState({ isPaused: true })
    render(<AccountBar instrumentID="IF2608" />)
    // 暂停期间：挂起本轮，t=0 与整个周期都不发起任何查询
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(refreshPositionsMock).toHaveBeenCalledTimes(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(refreshPositionsMock).toHaveBeenCalledTimes(0)
    // 恢复后：下一轮 10s 周期发起持仓拉取（对齐 QueryPanel 的 isPaused 语义）
    useQueryStore.setState({ isPaused: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(refreshPositionsMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
