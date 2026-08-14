import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { ContextMenu } from '@/components/ContextMenu'
import { toast } from '@/components/Toast'
import type { ContractInfo } from '@/services/types'

/** 单选右键菜单状态（来自 useContractContextMenu.contextMenu） */
interface SingleMenuState {
  instrumentID: string
  price: number
  x: number
  y: number
}

/** 多选右键菜单状态（来自 useContractContextMenu.multiSelectMenu） */
interface MultiMenuState {
  instrumentIDs: string[]
  x: number
  y: number
}

interface UseContractMenusArgs {
  contextMenu: SingleMenuState | null
  multiSelectMenu: MultiMenuState | null
  /** 已收藏合约 ID 集合（菜单收藏态与批量收藏判断） */
  favoritedIds: Set<string>
  /** 全量合约（收藏/取消收藏时查找合约对象） */
  contracts: ContractInfo[]
  addToFavorites: (inst: ContractInfo) => Promise<boolean> | boolean
  removeFromFavorites: (instrumentID: string) => Promise<unknown> | void
  openOrderPopup: (instrumentID: string) => void
  openKlineTab: (instrumentID: string) => void
  openOrderTabs: (instrumentIDs: string[]) => void
  openKlineTabs: (instrumentIDs: string[]) => void
  closeMenus: () => void
}

/**
 * useContractMenus — 合约单选/多选右键菜单 + 工具栏批量收藏共享逻辑。
 *
 * 期货页（MarketPanel）与期权页（OptionsPanel）此前各自内联约 80 行相同的
 * ContextMenu JSX（开报单/K线/查询/收藏/复制）与工具栏收藏按钮的批量
 * allFavorited/count 逻辑，抽取为本 hook 复用，行为保持一致。
 *
 * 返回：
 * - singleMenu / multiMenu：可直接渲染的右键菜单 JSX 块；
 * - batchToggleFavorite(selectedInstrument, selectedContracts)：工具栏收藏按钮点击处理；
 * - favoriteButtonLabel(selectedInstrument, selectedContracts)：工具栏收藏按钮文案。
 */
export function useContractMenus(args: UseContractMenusArgs) {
  const {
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    contracts,
    addToFavorites,
    removeFromFavorites,
    openOrderPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  } = args

  /** 工具栏收藏按钮：多选批量收藏/取消收藏；单选切换收藏 */
  const batchToggleFavorite = useCallback(async (
    selectedInstrument: string | null,
    selectedContracts: Set<string>,
  ) => {
    // 如果有多选，批量收藏/取消收藏
    if (selectedContracts.size > 1) {
      const allFavorited = Array.from(selectedContracts).every((id) => favoritedIds.has(id))
      if (allFavorited) {
        // 全部已收藏，批量取消
        for (const id of selectedContracts) {
          await removeFromFavorites(id)
        }
        toast.success(`已移除 ${selectedContracts.size} 个合约`)
      } else {
        // 批量收藏
        let count = 0
        for (const id of selectedContracts) {
          const inst = contracts.find((c) => c.instrumentID === id)
          if (inst) {
            const success = await addToFavorites(inst)
            if (success) count++
          }
        }
        toast.success(`已收藏 ${count} 个合约`)
      }
      return
    }

    // 单个合约收藏/取消收藏
    if (!selectedInstrument) return
    if (favoritedIds.has(selectedInstrument)) {
      await removeFromFavorites(selectedInstrument)
      toast.success(`已移除 ${selectedInstrument}`)
    } else {
      const inst = contracts.find((c) => c.instrumentID === selectedInstrument)
      if (inst) {
        await addToFavorites(inst)
        toast.success(`已收藏 ${inst.instrumentID}`)
      }
    }
  }, [favoritedIds, contracts, addToFavorites, removeFromFavorites])

  /** 工具栏收藏按钮文案：多选 → 批量移除/批量收藏；单选 → 移除/收藏 */
  const favoriteButtonLabel = useCallback((
    selectedInstrument: string | null,
    selectedContracts: Set<string>,
  ): string => {
    if (selectedContracts.size > 1) {
      return Array.from(selectedContracts).every((id) => favoritedIds.has(id)) ? '批量移除' : '批量收藏'
    }
    return selectedInstrument && favoritedIds.has(selectedInstrument) ? '移除' : '收藏'
  }, [favoritedIds])

  /** 单选右键菜单（开报单/K线/查询/收藏/复制合约代码） */
  const singleMenu: ReactNode = contextMenu ? (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={[
        { label: '打开报单', icon: '📝', onClick: () => openOrderPopup(contextMenu.instrumentID) },
        { label: '打开K线', icon: '📈', onClick: () => openKlineTab(contextMenu.instrumentID) },
        {
          label: favoritedIds.has(contextMenu.instrumentID) ? '取消收藏' : '收藏',
          icon: favoritedIds.has(contextMenu.instrumentID) ? '★' : '⭐',
          onClick: () => {
            if (favoritedIds.has(contextMenu.instrumentID)) {
              removeFromFavorites(contextMenu.instrumentID)
              toast.success(`已移除 ${contextMenu.instrumentID}`)
            } else {
              const inst = contracts.find((c) => c.instrumentID === contextMenu.instrumentID)
              if (inst) {
                addToFavorites(inst)
                toast.success(`已收藏 ${contextMenu.instrumentID}`)
              }
            }
          },
        },
        { label: '复制合约代码', icon: '📋', onClick: () => navigator.clipboard.writeText(contextMenu.instrumentID) },
      ]}
      onClose={closeMenus}
    />
  ) : null

  /** 多选右键菜单（批量开报单/K线/收藏/取消收藏/复制代码） */
  const multiMenu: ReactNode = multiSelectMenu ? (() => {
    // 计算已收藏和未收藏的数量
    const unfavoritedIds = multiSelectMenu.instrumentIDs.filter((id) => !favoritedIds.has(id))
    const favoritedIdsInSelection = multiSelectMenu.instrumentIDs.filter((id) => favoritedIds.has(id))

    return (
      <ContextMenu
        x={multiSelectMenu.x}
        y={multiSelectMenu.y}
        items={[
          {
            label: `批量打开报单 (${multiSelectMenu.instrumentIDs.length}个)`,
            icon: '📝',
            onClick: () => openOrderTabs(multiSelectMenu.instrumentIDs),
          },
          {
            label: `批量打开K线 (${multiSelectMenu.instrumentIDs.length}个)`,
            icon: '📈',
            onClick: () => openKlineTabs(multiSelectMenu.instrumentIDs),
          },
          {
            label: `批量收藏 (${unfavoritedIds.length}个)`,
            icon: '⭐',
            disabled: unfavoritedIds.length === 0,
            onClick: async () => {
              let count = 0
              for (const id of unfavoritedIds) {
                const inst = contracts.find((c) => c.instrumentID === id)
                if (inst) {
                  const success = await addToFavorites(inst)
                  if (success) count++
                }
              }
              toast.success(`已收藏 ${count} 个合约`)
            },
          },
          {
            label: `批量取消收藏 (${favoritedIdsInSelection.length}个)`,
            icon: '★',
            disabled: favoritedIdsInSelection.length === 0,
            onClick: async () => {
              for (const id of favoritedIdsInSelection) {
                await removeFromFavorites(id)
              }
              toast.success(`已移除 ${favoritedIdsInSelection.length} 个合约`)
            },
          },
          {
            label: `复制合约代码 (${multiSelectMenu.instrumentIDs.length}个)`,
            icon: '📋',
            onClick: () => navigator.clipboard.writeText(multiSelectMenu.instrumentIDs.join(',')),
          },
        ]}
        onClose={closeMenus}
      />
    )
  })() : null

  return { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel }
}
