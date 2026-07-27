import { useQueryStore } from './store'

function fmt(n: number): string {
  return n.toFixed(2)
}

export function AccountQuery() {
  const account = useQueryStore((s) => s.account)

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
