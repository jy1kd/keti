import { useMemo } from 'react'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { futuresSpec } from '@/modules/market/futuresSpec'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
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
  const { contextMenu, openOrderPopup, openKlineTab, handleContextMenu } = useContractContextMenu()

  // 自选标签是否激活：隐藏面板（display:none）不参与可见区上报，避免覆盖活跃面板可见范围
  const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'favorites' && t.id === s.activeTabId))

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
        <QuoteTable
          spec={futuresSpec}
          contracts={favorites}
          snapshots={snapshots}
          selectedInstrument={selectedInstrument}
          isActive={isActive}
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
        </div>
      )}
    </div>
  )
}
