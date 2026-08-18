import type { ReactNode } from 'react'
import { ContextMenu } from '@/components/ContextMenu'
import { toast } from '@/components/Toast'

interface SingleMenuState {
  instrumentID: string
  price: number
  x: number
  y: number
}

interface MultiMenuState {
  instrumentIDs: string[]
  x: number
  y: number
}

interface UseContractMenusArgs {
  contextMenu: SingleMenuState | null
  multiSelectMenu: MultiMenuState | null
  /** 收藏态集合（行情页 = 任一夹；夹页 = 本夹） */
  favoritedIds: Set<string>
  /** 收藏交互模式：picker（行情页，弹选夹面板）| folder（夹页，直接切本夹） */
  favoriteMode: 'picker' | 'folder'
  /** false = 不渲染任何收藏菜单项，且不渲染多选菜单（期权页：无收藏功能且未启多选） */
  showCollections?: boolean
  /** picker 模式：打开选夹面板 */
  onOpenFavoritePicker?: (instrumentIDs: string[]) => void
  /** picker 模式：批量取消收藏（从所有夹移除） */
  onRemoveFromAll?: (instrumentIDs: string[]) => void
  /** folder 模式：本夹内切换收藏 */
  onToggleInFolder?: (instrumentID: string) => void
  /** folder 模式：批量从本夹移除 */
  onRemoveFromFolderBatch?: (instrumentIDs: string[]) => void
  openOrderPopup: (instrumentID: string) => void
  openKlineTab: (instrumentID: string) => void
  openInfinitePopup: (instrumentID: string) => void
  openOrderTabs: (instrumentIDs: string[]) => void
  openKlineTabs: (instrumentIDs: string[]) => void
  openInfiniteTabs: (instrumentIDs: string[]) => void
  closeMenus: () => void
}

/**
 * useContractMenus — 合约右键菜单共享逻辑（picker / folder 双模式）。
 *
 * - picker（行情页）：收藏项统一弹 CollectionPicker；批量取消收藏 = 从所有夹移除。
 * - folder（夹页）：收藏项直接切本夹 / 批量从本夹移除。
 * - showCollections=false（期权页）：不渲染任何收藏菜单项，多选菜单整体不渲染
 *   （期权页已去掉收藏夹功能且不启用多选，右键仅 五档/无限/K线/复制代码）。
 * - 工具栏收藏已收敛为「选择收藏夹」下拉（见 MarketPanel/OptionsPanel），不再需要共享按钮逻辑。
 */
export function useContractMenus(args: UseContractMenusArgs) {
  const {
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode,
    showCollections = true,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup,
    openKlineTab,
    openInfinitePopup,
    openOrderTabs,
    openKlineTabs,
    openInfiniteTabs,
    closeMenus,
  } = args

  const singleMenu: ReactNode = contextMenu ? (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={[
        { label: '五档下单', icon: '📝', onClick: () => openOrderPopup(contextMenu.instrumentID) },
        { label: '无限下单', icon: '♾️', onClick: () => openInfinitePopup(contextMenu.instrumentID) },
        { label: '打开K线', icon: '📈', onClick: () => openKlineTab(contextMenu.instrumentID) },
        ...(showCollections
          ? [
              favoriteMode === 'folder'
                ? {
                    label: favoritedIds.has(contextMenu.instrumentID) ? '从本夹移除' : '收藏到本夹',
                    icon: favoritedIds.has(contextMenu.instrumentID) ? '★' : '⭐',
                    onClick: () => onToggleInFolder?.(contextMenu.instrumentID),
                  }
                : {
                    label: '收藏到收藏夹…',
                    icon: '⭐',
                    onClick: () => onOpenFavoritePicker?.([contextMenu.instrumentID]),
                  },
            ]
          : []),
        { label: '复制合约代码', icon: '📋', onClick: () => navigator.clipboard.writeText(contextMenu.instrumentID) },
      ]}
      onClose={closeMenus}
    />
  ) : null

  // 期权页（showCollections=false）不渲染多选菜单：无收藏项 + 未启用多选
  const multiMenu: ReactNode = !showCollections ? null : multiSelectMenu ? (() => {
    const favoritedInSelection = multiSelectMenu.instrumentIDs.filter((id) => favoritedIds.has(id))
    const favoriteItem =
      favoriteMode === 'folder'
        ? {
            label: `批量从本夹移除 (${favoritedInSelection.length}个)`,
            icon: '★',
            disabled: favoritedInSelection.length === 0,
            onClick: () => {
              onRemoveFromFolderBatch?.(favoritedInSelection)
              toast.success(`已从本夹移除 ${favoritedInSelection.length} 个合约`)
            },
          }
        : {
            label: `批量收藏到收藏夹… (${multiSelectMenu.instrumentIDs.length}个)`,
            icon: '⭐',
            onClick: () => onOpenFavoritePicker?.(multiSelectMenu.instrumentIDs),
          }
    const removeAllItem =
      favoriteMode === 'folder'
        ? null
        : {
            label: `批量取消收藏 (${favoritedInSelection.length}个)`,
            icon: '★',
            disabled: favoritedInSelection.length === 0,
            onClick: () => {
              onRemoveFromAll?.(favoritedInSelection)
              toast.success(`已移除 ${favoritedInSelection.length} 个合约的全部收藏`)
            },
          }

    return (
      <ContextMenu
        x={multiSelectMenu.x}
        y={multiSelectMenu.y}
        items={[
          { label: `批量五档下单 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📝', onClick: () => openOrderTabs(multiSelectMenu.instrumentIDs) },
          { label: `批量无限下单 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '♾️', onClick: () => openInfiniteTabs(multiSelectMenu.instrumentIDs) },
          { label: `批量打开K线 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📈', onClick: () => openKlineTabs(multiSelectMenu.instrumentIDs) },
          favoriteItem,
          ...(removeAllItem ? [removeAllItem] : []),
          { label: `复制合约代码 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📋', onClick: () => navigator.clipboard.writeText(multiSelectMenu.instrumentIDs.join(',')) },
        ]}
        onClose={closeMenus}
      />
    )
  })() : null

  return { singleMenu, multiMenu }
}
