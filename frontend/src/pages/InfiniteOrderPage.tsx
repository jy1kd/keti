import './InfiniteOrderPage.css'

interface InfiniteOrderPageProps {
  instrumentID?: string
  floating?: boolean
  tabId?: string
}

/** 无限下单页 — 占位，Task 5 填充完整实现 */
export function InfiniteOrderPage({ instrumentID }: InfiniteOrderPageProps) {
  return (
    <div className="infinite-order-page" data-testid="infinite-order-page">
      <div className="infinite-order-page__title">♾️ 无限下单{instrumentID ? `-${instrumentID}` : ''}</div>
    </div>
  )
}
