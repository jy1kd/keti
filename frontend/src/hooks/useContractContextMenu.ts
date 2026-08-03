import { useCallback, useEffect, useState } from 'react'
import { useTabStore } from '@/stores/tabs'
import { useOrderPopupStore } from '@/modules/order/popupStore'

interface ContextMenuState {
  instrumentID: string
  price: number
  x: number
  y: number
}

/**
 * useContractContextMenu — 合约右键菜单共享 Hook
 *
 * 封装右键菜单的状态管理与打开逻辑（打开报单弹窗 / K线标签页），
 * 供 MarketPanel / FavoritesPage 复用，避免重复实现。
 *
 * 用法：
 *   const { contextMenu, openOrderPopup, openKlineTab, handleContextMenu } = useContractContextMenu()
 */
export function useContractContextMenu() {
  const openTab = useTabStore((s) => s.openTab)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // 打开悬浮报单弹窗
  const openOrderPopup = useCallback((instrumentID: string) => {
    useOrderPopupStore.getState().openPopup(instrumentID)
  }, [])

  // 打开K线标签页
  const openKlineTab = useCallback((instrumentID: string) => {
    openTab({
      type: 'kline',
      title: `📈 K线-${instrumentID}`,
      props: { instrumentID },
    })
  }, [openTab])

  // 右键菜单处理：记录坐标并抑制浏览器原生菜单
  const handleContextMenu = useCallback((instrumentID: string, price: number, event: MouseEvent) => {
    event.preventDefault()
    setContextMenu({ instrumentID, price, x: event.clientX, y: event.clientY })
  }, [])

  // 点击空白处关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  return { contextMenu, openOrderPopup, openKlineTab, handleContextMenu }
}
