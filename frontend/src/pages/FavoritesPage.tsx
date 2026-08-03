import { useMemo } from 'react'
import { MarketTable } from '@/modules/market/MarketTable'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { toast } from '@/components/Toast'

/**
 * FavoritesPage — 自选标签页
 *
 * 只显示收藏的合约，全部订阅（数量少，通常 < 50）。
 * 支持取消收藏操作。
 */
export function FavoritesPage() {
  const favorites = useContractsStore((s) => s.favorites)
  const removeFromFavorites = useContractsStore((s) => s.removeFromFavorites)
  const snapshots = useMarketStore((s) => s.snapshots)
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument)
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)

  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.instrumentID)),
    [favorites],
  )

  const handleFavoriteChange = (instrumentID: string, isFavorited: boolean) => {
    if (!isFavorited) {
      removeFromFavorites(instrumentID)
      toast.success(`已取消收藏 ${instrumentID}`)
    }
  }

  const handleRowClick = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
  }

  if (favorites.length === 0) {
    return (
      <div className="favorites-page" style={pageStyle}>
        <div className="favorites-page__header" style={headerStyle}>
          <h2 style={titleStyle}>⭐ 自选合约</h2>
          <span className="favorites-page__count" style={countStyle}>0</span>
        </div>
        <div className="favorites-page__empty" style={emptyStyle}>
          <p>暂无自选合约</p>
          <p style={{ color: '#8b949e', fontSize: '13px', marginTop: '8px' }}>
            在行情表格中点击 ☆ 收藏合约
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="favorites-page" style={pageStyle}>
      <div className="favorites-page__header" style={headerStyle}>
        <h2 style={titleStyle}>⭐ 自选合约</h2>
        <span className="favorites-page__count" style={countStyle}>{favorites.length}</span>
      </div>
      <div className="favorites-page__table" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <MarketTable
          contracts={favorites}
          snapshots={snapshots}
          selectedInstrument={selectedInstrument}
          onRowClick={handleRowClick}
          favoritedIds={favoritedIds}
          onFavoriteChange={handleFavoriteChange}
        />
      </div>
    </div>
  )
}

// --- 内联样式 ---

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--bg-primary)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-color)',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 600,
}

const countStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8b949e',
  background: 'var(--bg-secondary)',
  padding: '2px 8px',
  borderRadius: '10px',
}

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#8b949e',
}
