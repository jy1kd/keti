import { useEffect } from 'react'
import { useQueryStore } from './store'

const CTP_INVALID = 1.7976931348623157e+308

function fmt(n: number): string {
  if (n == null || n >= CTP_INVALID || n <= -CTP_INVALID) return '--'
  return n.toFixed(2)
}

export function AccountQuery() {
  const account = useQueryStore((s) => s.account)
  const fetchAccount = useQueryStore((s) => s.fetchAccount)

  // 10s 自刷新：完成后调度下一次，避免重入（对齐 OrdersQuery 节奏）
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = async () => {
      await fetchAccount()
      if (cancelled) return
      timer = setTimeout(schedule, 10000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchAccount])

  if (!account) {
    return (
      <div className="account-query">
        <div className="flow-empty">暂无资金数据</div>
      </div>
    )
  }

  return (
    <div className="account-query">
      <div className="account-grid">
        <div className="account-item">
          <span className="account-label">权益</span>
          <span className="account-value">{fmt(account.balance)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">可用资金</span>
          <span className="account-value">{fmt(account.available)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">冻结保证金</span>
          <span className="account-value">{fmt(account.frozenMargin)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">持仓保证金</span>
          <span className="account-value">{fmt(account.currMargin)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">手续费</span>
          <span className="account-value">{fmt(account.commission)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">平仓盈亏</span>
          <span className={`account-value ${account.closeProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {fmt(account.closeProfit)}
          </span>
        </div>
        <div className="account-item">
          <span className="account-label">持仓盈亏</span>
          <span className={`account-value ${account.positionProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {fmt(account.positionProfit)}
          </span>
        </div>
        <div className="account-item">
          <span className="account-label">入金</span>
          <span className="account-value">{fmt(account.deposit)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">出金</span>
          <span className="account-value">{fmt(account.withdraw)}</span>
        </div>
        <div className="account-item">
          <span className="account-label">昨权益</span>
          <span className="account-value">{fmt(account.preBalance)}</span>
        </div>
      </div>
    </div>
  )
}
