import { QueryPanel } from '@/modules/query/QueryPanel'
import './QueryPage.css'

/**
 * QueryPage — 查询标签页
 *
 * 独立查询页面，集成 QueryPanel。
 * QueryPanel 内部的 Tab 切换（报单/成交/持仓/资金/止损单/合约/K线）
 * 与数据查询能力均保留。
 */
export function QueryPage() {
  return (
    <div className="query-page" data-testid="query-page">
      <div className="query-page__header">
        <h2 className="query-page__title">📋 查询</h2>
      </div>
      <div className="query-page__content">
        <QueryPanel />
      </div>
    </div>
  )
}
