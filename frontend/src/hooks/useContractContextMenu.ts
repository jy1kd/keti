import { useCallback, useEffect, useState } from 'react'
import { useTabStore } from '@/stores/tabs'

interface ContextMenuState {
  instrumentID: string
  price: number
  x: number
  y: number
}

interface MultiSelectContextMenuState {
  instrumentIDs: string[]
  x: number
  y: number
}

/**
 * useContractContextMenu — 合约右键菜单共享 Hook
 *
 * 封装右键菜单的状态管理与标签页打开逻辑（打开报单/K线标签），
 * 供 MarketPanel / FavoritesPage 复用，避免重复实现。
 *
 * 用法：
 *   const { contextMenu, multiSelectMenu, openOrderTab, openKlineTab, handleContextMenu, handleMultiSelectContextMenu } = useContractContextMenu()
 */
export function useContractContextMenu() {
  const openTab = useTabStore((s) => s.openTab)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [multiSelectMenu, setMultiSelectMenu] = useState<MultiSelectContextMenuState | null>(null)

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

  // 批量打开报单标签页
  const openOrderTabs = useCallback((instrumentIDs: string[]) => {
    instrumentIDs.forEach((id) => {
      openTab({
        type: 'order',
        title: `📝 报单-${id}`,
        props: { instrumentID: id },
      })
    })
  }, [openTab])

  // 批量打开K线标签页
  const openKlineTabs = useCallback((instrumentIDs: string[]) => {
    instrumentIDs.forEach((id) => {
      openTab({
        type: 'kline',
        title: `📈 K线-${id}`,
        props: { instrumentID: id },
      })
    })
  }, [openTab])

  // 单选右键菜单处理：记录坐标并抑制浏览器原生菜单
  const handleContextMenu = useCallback((instrumentID: string, price: number, event: MouseEvent) => {
    event.preventDefault()
    setMultiSelectMenu(null) // 关闭多选菜单
    setContextMenu({ instrumentID, price, x: event.clientX, y: event.clientY })
  }, [])

  // 多选右键菜单处理
  const handleMultiSelectContextMenu = useCallback((instrumentIDs: string[], event: MouseEvent) => {
    event.preventDefault()
    setContextMenu(null) // 关闭单选菜单
    setMultiSelectMenu({ instrumentIDs, x: event.clientX, y: event.clientY })
  }, [])

  // 点击空白处关闭右键菜单
  useEffect(() => {
    if (!contextMenu && !multiSelectMenu) return
    const close = () => {
      setContextMenu(null)
      setMultiSelectMenu(null)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu, multiSelectMenu])

  return {
    contextMenu,
    multiSelectMenu,
    openOrderTab,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    handleContextMenu,
    handleMultiSelectContextMenu,
  }
}
