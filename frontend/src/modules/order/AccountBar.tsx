import { useEffect, useMemo, useState } from 'react'
import { useQueryStore } from '@/modules/query/store'
import { lockPosition } from '@/services/api'
import { toast } from '@/components/Toast'
import './AccountBar.css'

const CTP_INVALID = 1.7976931348623157e308

interface AccountBarProps {
  /** 当前弹窗合约；持仓/持盈按该合约过滤统计 */
  instrumentID: string
}

/** 账户号超长省略：>12 位截断为 9 位 + …，hover title 保留全称 */
function truncateAccountID(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 9)}…`
}

/** 盈亏格式化：盈带 + 两位小数；CTP 无效值显示 -- */
function formatProfit(n: number): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) >= CTP_INVALID) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

/**
 * AccountBar — ② 账户/持仓/持盈栏
 *
 * 打开即触发 fetchPositions + fetchAccount，每 10s 串行自刷新（遵守 CTP ~1 次/秒查询限频）。
 * 持仓按当前合约 instrumentID 过滤，posiDirection '2'/'3' 求和：多|空(净)；持盈盈红亏绿。
 * 右上角锁仓/解锁开关复用 api.lockPosition。
 */
export function AccountBar({ instrumentID }: AccountBarProps) {
  const positions = useQueryStore((s) => s.positions)
  const account = useQueryStore((s) => s.account)
  const fetchPositions = useQueryStore((s) => s.fetchPositions)
  const fetchAccount = useQueryStore((s) => s.fetchAccount)

  // 打开即拉取 + 每 10s 串行自刷新：持仓 → 账户（串行执行，CTP 查询限频）
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      await fetchPositions()
      if (disposed) return
      await fetchAccount()
      if (disposed) return
      timer = setTimeout(load, 10_000)
    }
    load()
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [fetchPositions, fetchAccount])

  // 当前合约持仓汇总：多 | 空 | 净 = 多 - 空；持盈 = positionProfit 求和
  const { long, short, net, profit } = useMemo(() => {
    const mine = positions.filter((p) => p.instrumentID === instrumentID)
    const long = mine.filter((p) => p.posiDirection === '2').reduce((s, p) => s + (p.position || 0), 0)
    const short = mine.filter((p) => p.posiDirection === '3').reduce((s, p) => s + (p.position || 0), 0)
    const profit = mine.reduce((s, p) => s + (p.positionProfit || 0), 0)
    return { long, short, net: long - short, profit }
  }, [positions, instrumentID])

  // 锁仓/解锁开关（复用 api.lockPosition；UI 状态仅反映「已执行锁仓」）
  const [locked, setLocked] = useState(false)
  const handleLockToggle = async () => {
    try {
      const res = await lockPosition({ instrumentID })
      if (res.success) {
        setLocked((v) => !v)
        toast.success(locked ? '已解锁' : '已锁仓')
      } else {
        toast.error(`锁仓失败：${res.message || '未知错误'}`)
      }
    } catch (e) {
      toast.error(`锁仓失败：${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  const profitClass = profit > 0 ? 'up' : profit < 0 ? 'down' : 'flat'

  return (
    <div className="account-bar" data-testid="account-bar">
      <span className="account-bar__id" data-testid="ab-account" title={account?.accountID || '--'}>
        {account?.accountID ? truncateAccountID(account.accountID) : '--'}
      </span>
      <span className="account-bar__pos" data-testid="ab-pos">
        <span className="account-bar__label">持仓</span>
        <b className="account-bar__long" data-testid="ab-long">{long}</b>
        <i className="account-bar__sep">|</i>
        <b className="account-bar__short" data-testid="ab-short">{short}</b>
        <span className="account-bar__net" data-testid="ab-net">({net})</span>
      </span>
      <span className={`account-bar__profit account-bar__profit--${profitClass}`} data-testid="ab-profit">
        {formatProfit(profit)}
      </span>
      <button
        type="button"
        className="account-bar__lock"
        data-testid="ab-lock"
        onClick={handleLockToggle}
        title={locked ? '解锁锁仓' : '一键锁仓当前合约'}
      >
        {locked ? '解锁' : '锁仓'}
      </button>
    </div>
  )
}
