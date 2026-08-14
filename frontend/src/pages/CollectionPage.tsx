import './CollectionPage.css'

/** 单收藏夹页（壳：Task 6 完整实现） */
export function CollectionPage({ collectionId }: { collectionId: string; tabId: string }) {
  return (
    <section className="collection-page" data-testid="collection-page">
      <div className="collection-page__empty">
        <p>收藏夹 {collectionId}</p>
        <p className="collection-page__hint">夹页实现中…</p>
      </div>
    </section>
  )
}
