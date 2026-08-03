import { useCallback, useEffect, useMemo, useState } from 'react'
import { MarketTable } from '@/modules/market/MarketTable'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
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
  const openTab = useTabStore((s) => s.openTab)
  const [contextMenu, setContextMenu] = useState<{ instrumentID: string; price: number; x: number; y: number } | null>(null)

  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.instrumentID)),
    [favorites],
  )

  // 打开报单标签页
  const openOrderTab = useCallback((instrumentID: string) => {
    openTab({
      type: 'order',
      title: `📝 报单-${instrumentID}`,
      props: { instrumentID },
    })
  }, [openTab])

  // 打开K线标签页
  const openKlineTab = useCallback((instrumentID: string) => {
    openTab({
      type: 'kline',
      title: `📈 K线-${instrumentID}`,
      props: { instrumentID },
    })
  }, [openTab])

  // 右键菜单处理
  const handleContextMenu = useCallback((instrumentID: string, price: number, event: MouseEvent) => {
    event.preventDefault()
    setContextMenu({ instrumentID, price, x: event.clientX, y: event.clientY })
  }, [])

  // 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

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

  // 双击打开报单标签页
  const handleRowDoubleClick = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
    openOrderTab(instrumentID)
  }

  if (favorites.length === 0) {
    return (
      <div className="favorites-page">
        <div className="favorites-page__header">
          <h2 className="favorites-page__title">⭐ 自选合约</h2>
          <span className="favorites-page__count">0</span>
        </div>
        <div className="favorites-page__empty">
          <p>暂无自选合约</p>
          <p className="favorites-page__hint">在行情表格中点击 ☆ 收藏合约</p>
        </div>
      </div>
    )
  }

  return (
    <div className="favorites-page">
      <div className="favorites-page__header">
        <h2 className="favorites-page__title">⭐ 自选合约</h2>
        <span className="favorites-page__count">{favorites.length}</span>
      </div>
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
            onClick={() => openOrderTab(contextMenu.instrumentID)}
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
