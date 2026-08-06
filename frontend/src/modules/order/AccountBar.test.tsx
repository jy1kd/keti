import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
    useQueryStore.setState({ positions: [], account: null })
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

  it('锁仓开关：点击调用 lockPosition 并切换为解锁', async () => {
    render(<AccountBar instrumentID="IF2608" />)
    const btn = await screen.findByTestId('ab-lock')
    expect(btn.textContent).toBe('锁仓')
    fireEvent.click(btn)
    await waitFor(() => expect(lockPositionMock).toHaveBeenCalledWith({ instrumentID: 'IF2608' }))
    await waitFor(() => expect(btn.textContent).toBe('解锁'))
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
})
