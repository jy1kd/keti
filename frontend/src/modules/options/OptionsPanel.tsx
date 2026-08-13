import { useMemo, useState } from 'react'
import { ContextMenu } from '@/components/ContextMenu'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractFilter } from '@/components/ContractFilter'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { deriveUnderlyingProduct, groupOptionsByUnderlying } from '@/modules/market/sort'
import { filterByExchangeAndProduct } from '@/modules/market/filter'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { usePointOrder } from '@/hooks/usePointOrder'
import { getProductName } from '@/utils/productNames'
import { toast } from '@/components/Toast'
import { TQuoteView } from './TQuoteView'
import type { ContractInfo } from '@/services/types'
import './styles.css'

/**
 * OptionsPanel — 期权标签页（二级视图 shell）
 *
 * [列表 | T型报价] 切换：
 * - 列表（默认）：按标底分组展平的期权表（标底期货行在前 + 其后期权行），
 *   由 spec 驱动 QuoteTable 渲染，行级交互（选中/多选/右键/收藏/可见区订阅）与期货页一致；
 * - T型报价：迁入原 OptionPanel 内容（TQuoteView 原样保留）。
 */
export function OptionsPanel() {
  const [view, setView] = useState<'list' | 'tquote'>('list')
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, favorites, addToFavorites, removeFromFavorites } = useContractsStore()
  const { contextMenu, multiSelectMenu, openOrderPopup, openQueryPopup, openKlineTab, openOrderTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  // 期权标签是否激活：激活翻转为 true 时 QuoteTable 重报可见区，订阅管理器立即补订阅
  const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'options' && t.id === s.activeTabId))

  // 期权页筛选态（交易所+标底品种多选，独立于期货页，localStorage 持久化）
  const filter = useMarketFilterStore((s) => s.options)

  // 期货全量 → 期权全量（分组用 futures 匹配标底行真实合约）
  const futures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])
  const options = useMemo(() => contracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [contracts])

  // 筛选面板可用选项：交易所 = 期权合约去重；品种 = 标底品种（underlyingInstrID 去尾数字）去重
  const filterExchanges = useMemo(
    () => Array.from(new Set(options.map((c) => c.exchangeID))),
    [options],
  )
  const filterProducts = useMemo(
    () => Array.from(new Set(options.map((c) => deriveUnderlyingProduct(c.underlyingInstrID ?? '')))),
    [options],
  )
  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of filterProducts) m[p] = getProductName(p)
    return m
  }, [filterProducts])

  // 分组前先过滤期权（交易所 + 标底品种），再按标底分组展平为有序 ContractInfo[]
  // （标底行在前、期权行随后；组内无可见期权时整组消失）
  const rows = useMemo(() => {
    const filteredOptions = filterByExchangeAndProduct(
      options,
      filter.exchanges,
      filter.products,
      (c) => deriveUnderlyingProduct(c.underlyingInstrID ?? ''),
    )
    const groups = groupOptionsByUnderlying(filteredOptions, futures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [options, futures, filter])

  // 用户收藏 ID 集合（用于 ⭐ 列与右键菜单收藏态）
  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.instrumentID)),
    [favorites],
  )

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID }) => {
      setSelectedInstrument(instrumentID)
      openOrderPopup(instrumentID)
    },
  })

  return (
    <section className="options-page">
      {/* 二级视图切换工具栏（Task 7/8 在此叠加 全部/自选、筛选、仅交易中、收藏、搜索框） */}
      <div className="market-toolbar">
        <div className="market-toolbar__mode">
          <button
            className={`market-mode-btn${view === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
          >
            列表
          </button>
          <button
            className={`market-mode-btn${view === 'tquote' ? ' active' : ''}`}
            onClick={() => setView('tquote')}
          >
            T型报价
          </button>
        </div>
        <ContractFilter
          exchanges={filterExchanges}
          products={filterProducts}
          productNames={filterProductNames}
          value={filter}
          onChange={(v) => {
            useMarketFilterStore.getState().setExchanges('options', v.exchanges)
            useMarketFilterStore.getState().setProducts('options', v.products)
          }}
        />
      </div>

      {view === 'tquote' ? (
        <TQuoteView />
      ) : (
        <div className="panel-content">
          <ErrorBoundary>
            <QuoteTable
              spec={optionsSpec}
              contracts={rows}
              snapshots={snapshots}
              selectedInstrument={selectedInstrument}
              isActive={isActive}
              onRowClick={handleClick}
              onRowDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              onMultiSelectContextMenu={handleMultiSelectContextMenu}
              onVisibleRangeChange={setVisibleInstrumentIDs}
              favoritedIds={favoritedIds}
              onFavoriteChange={(instrumentID, isFavorited) => {
                if (isFavorited) {
                  const inst = contracts.find((c) => c.instrumentID === instrumentID)
                  if (inst) {
                    addToFavorites(inst)
                    toast.success(`已收藏 ${instrumentID}`)
                  }
                } else {
                  removeFromFavorites(instrumentID)
                  toast.success(`已移除 ${instrumentID}`)
                }
              }}
              selectedContracts={selectedContracts}
              onSelectionChange={setSelectedContracts}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* 单选右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            { label: '打开报单', icon: '📝', onClick: () => openOrderPopup(contextMenu.instrumentID) },
            { label: '打开K线', icon: '📈', onClick: () => openKlineTab(contextMenu.instrumentID) },
            { label: '查询', icon: '📋', onClick: () => openQueryPopup(contextMenu.instrumentID) },
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
      )}

      {/* 多选右键菜单 */}
      {multiSelectMenu && (() => {
        // 计算已收藏和未收藏的数量
        const unfavoritedIds = multiSelectMenu.instrumentIDs.filter((id) => !favoritedIds.has(id))
        const favoritedIdsInSelection = multiSelectMenu.instrumentIDs.filter((id) => favoritedIds.has(id))

        return (
          <ContextMenu
            x={multiSelectMenu.x}
            y={multiSelectMenu.y}
            items={[
              { label: `批量打开报单 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📝', onClick: () => openOrderTabs(multiSelectMenu.instrumentIDs) },
              { label: `批量打开K线 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📈', onClick: () => openKlineTabs(multiSelectMenu.instrumentIDs) },
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
      })()}
    </section>
  )
}
