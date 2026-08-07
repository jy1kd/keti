import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryStore } from '@/modules/query/store'
import { useOrderPopupStore } from './popupStore'
import { lockPosition } from '@/services/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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

/** 资金格式化：千分位 + 两位小数；无效值显示 -- */
function formatMoney(n: number): string {
  if (n == null || !Number.isFinite(n)) return '--'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * AccountBar — ② 账户/持仓/持盈栏
 *
 * 打开即触发 fetchPositions + fetchAccount，每 10s 串行自刷新（遵守 CTP ~1 次/秒查询限频）。
 * 持仓按当前合约 instrumentID 过滤，posiDirection '2'/'3' 求和：多|空(净)；持盈盈红亏绿。
 * 右上角「锁仓」为一次性下单操作（反方向开同等数量仓位，不平原有持仓）：后端 `/api/order/lock`
 * 是单向锁仓、无解锁端点，因此不提供「解锁」方向（避免重复开反向仓的语义错误）；点击强制弹确认框。
 */
export function AccountBar({ instrumentID }: AccountBarProps) {
  const positions = useQueryStore((s) => s.positions)
  const account = useQueryStore((s) => s.account)
  const fetchPositions = useQueryStore((s) => s.fetchPositions)
  const fetchAccount = useQueryStore((s) => s.fetchAccount)

  // 打开即拉取 + 每 10s 串行自刷新：持仓 → 账户（串行 + 延迟节奏，对齐 QueryPanel，
  // 避免 CTP 查询限频 ~1 次/秒：两查询间隔 1200ms，周期约 11.2s → 平均 < 0.2 次/秒）
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const load = async () => {
      // 用户暂停查询时挂起本轮，不发起 CTP 查询（对齐 QueryPanel 的 isPaused 语义）
      if (useQueryStore.getState().isPaused) {
        timer = setTimeout(load, 10_000)
        return
      }
      await fetchPositions()
      if (disposed) return
      await delay(1200)
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

  // ── 账户下拉资金明细（P3-7，P2 审查 🔵-2 延后项）──────────────────
  // 账户号点击展开：可用资金 / 持仓盈亏 / 动态权益。用 createPortal 渲染到 body，
  // 规避 `.account-bar` 的 overflow:hidden 裁剪；定位取账户元素视口矩形（弹窗 transform 不影响 body 级 fixed）。
  const [accountOpen, setAccountOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const accountElRef = useRef<HTMLSpanElement | null>(null)

  const handleAccountClick = () => {
    if (!account) return
    if (accountOpen) {
      setAccountOpen(false)
      return
    }
    const el = accountElRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) })
    }
    setAccountOpen(true)
  }

  // 点击外部关闭（含下拉本体外的任意位置）
  const accountAreaRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!accountOpen) return
    const onDown = (e: MouseEvent) => {
      if (accountAreaRef.current && !accountAreaRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [accountOpen])

  // Esc 关闭下拉（账户区域弹出层，不触发弹窗关闭）
  useEffect(() => {
    if (!accountOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [accountOpen])

  // ── 锁仓（下单操作，强制确认）────────────────────────────────────
  // 后端 lockPosition 为单向锁仓（反方向开仓、不平原持仓），无解锁端点，
  // 因此只有「锁仓」一次操作：确认后才调接口，成功后刷新持仓反映仓位变化。
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lockPending, setLockPending] = useState(false)

  // 确认框打开状态同步到 popupStore：弹窗内 Esc 优先取消确认框，而非关闭整个弹窗
  useEffect(() => {
    useOrderPopupStore.getState().setConfirmOpen(confirmOpen)
    return () => useOrderPopupStore.getState().setConfirmOpen(false)
  }, [confirmOpen])

  const handleLockConfirm = async () => {
    if (lockPending) return
    setLockPending(true)
    try {
      const res = await lockPosition({ instrumentID })
      if (res.success) {
        setConfirmOpen(false)
        toast.success('锁仓成功（已反方向开仓）')
        // 刷新持仓，反映锁仓后的仓位变化
        await useQueryStore.getState().fetchPositions()
      } else {
        toast.error(`锁仓失败：${res.message || '未知错误'}`)
        setConfirmOpen(false)
      }
    } catch (e) {
      toast.error(`锁仓失败：${e instanceof Error ? e.message : '未知错误'}`)
      setConfirmOpen(false)
    } finally {
      setLockPending(false)
    }
  }

  const profitClass = profit > 0 ? 'up' : profit < 0 ? 'down' : 'flat'

  return (
    <div className="account-bar" data-testid="account-bar">
      <div className="account-bar__account" ref={accountAreaRef}>
        <span
          ref={accountElRef}
          className={`account-bar__id${account ? ' account-bar__id--clickable' : ''}`}
          data-testid="ab-account"
          title={account?.accountID || '--'}
          onClick={handleAccountClick}
        >
          {account?.accountID ? truncateAccountID(account.accountID) : '--'}
        </span>
        {account && <span className="account-bar__caret">▾</span>}
        {accountOpen && account && dropdownRect &&
          createPortal(
            <div
              className="account-bar__dropdown"
              data-testid="ab-dropdown"
              style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            >
              <div className="ab-dd__row">
                <span>可用资金</span>
                <b>{formatMoney(account.available)}</b>
              </div>
              <div className="ab-dd__row">
                <span>持仓盈亏</span>
                <b>{formatMoney(account.positionProfit)}</b>
              </div>
              <div className="ab-dd__row">
                <span>动态权益</span>
                <b>{formatMoney(account.balance)}</b>
              </div>
            </div>,
            document.body,
          )}
      </div>
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
        onClick={() => setConfirmOpen(true)}
        disabled={lockPending}
        title="一键锁仓：在反方向开同等数量仓位（不平原有持仓），会真实下单"
      >
        锁仓
      </button>
      {confirmOpen && (
        <ConfirmDialog
          title="确认锁仓"
          details={[{ label: '合约', value: instrumentID }]}
          warning="将在反方向开同等数量仓位，不平原有持仓。锁仓会真实下单，请确认。"
          onConfirm={handleLockConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
