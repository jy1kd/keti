import { useMemo } from 'react'
import { MarketTable } from '@/modules/market/MarketTable'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { toast } from '@/components/Toast'
import './FavoritesPage.css'

/**
 * FavoritesPage — 自选标签页
 *
 * 只显示收藏的合约，全部订阅（数量少，通常 < 50）。
 * 支持取消收藏操作。
 */
export function FavoritesPage() {
  const favorites = useContractsStore((s) => s.favorites)
  const contracts = useContractsStore((s) => s.contracts)
  const addToFavorites = useContractsStore((s) => s.addToFavorites)
  const removeFromFavorites = useContractsStore((s) => s.removeFromFavorites)
  const snapshots = useMarketStore((s) => s.snapshots)
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument)
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)
  const { contextMenu, openOrderPopup, openQueryPopup, openKlineTab, handleContextMenu } = useContractContextMenu()

  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.instrumentID)),
    [favorites],
  )

  const handleFavoriteChange = (instrumentID: string, isFavorited: boolean) => {
    if (isFavorited) {
      // 从全量合约中查找并收藏（防御性处理，FavoritesPage 中通常不会触发）
      const inst = contracts.find((c) => c.instrumentID === instrumentID)
      if (inst) {
        addToFavorites(inst)
        toast.success(`已收藏 ${instrumentID}`)
      }
    } else {
      removeFromFavorites(instrumentID)
      toast.success(`已取消收藏 ${instrumentID}`)
    }
  }

  const handleRowClick = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
  }

  // 双击打开悬浮报单弹窗
  const handleRowDoubleClick = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
    openOrderPopup(instrumentID)
  }

  if (favorites.length === 0) {
    return (
      <div className="favorites-page" data-testid="favorites-page">
        <div className="favorites-page__empty">
          <p>暂无自选合约</p>
          <p className="favorites-page__hint">在行情表格中点击 ☆ 收藏合约</p>
        </div>
      </div>
    )
  }

  return (
    <div className="favorites-page" data-testid="favorites-page">
      <div className="favorites-page__table">
        <MarketTable
          contracts={favorites}
          snapshots={snapshots}
          selectedInstrument={selectedInstrument}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          onContextMenu={handleContextMenu}
          favoritedIds={favoritedIds}
          onFavoriteChange={handleFavoriteChange}
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="context-menu__item"
            onClick={() => openOrderPopup(contextMenu.instrumentID)}
          >
            打开报单
          </button>
          <button
            className="context-menu__item"
            onClick={() => openKlineTab(contextMenu.instrumentID)}
          >
            打开K线
          </button>
          <button
            className="context-menu__item"
            onClick={() => openQueryPopup(contextMenu.instrumentID)}
          >
            📋 查询
          </button>
        </div>
      )}
    </div>
  )
}
