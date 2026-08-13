import { useMemo, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractFilter } from '@/components/ContractFilter'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { ContextMenu } from '@/components/ContextMenu'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { deriveUnderlyingProduct, groupOptionsByUnderlying } from '@/modules/market/sort'
import { filterByExchangeAndProduct } from '@/modules/market/filter'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import { openTQuoteFloating } from '@/utils/openFloatingTab'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { useContractMenus } from '@/hooks/useContractMenus'
import { usePointOrder } from '@/hooks/usePointOrder'
import { getProductName } from '@/utils/productNames'
import { isContractActive } from '@/utils/contractStatus'
import { toast } from '@/components/Toast'
import type { ContractInfo } from '@/services/types'
import './styles.css'

/**
 * OptionsPanel — 期权标签页（列表视图）
 *
 * 期权列表（默认）：按标底分组展平的期权表（标底期货行在前 + 其后期权行），
 * 由 spec 驱动 QuoteTable 渲染，行级交互（选中/多选/右键/收藏/可见区订阅）与期货页一致。
 * T型报价已独立为悬浮标签页（openTQuoteFloating）：
 * - 双击标底行 → 打开 T型报价-<标底> 悬浮窗；
 * - 右键标底行 → 「打开T型报价」上下文菜单（仅此项）；
 * - 期权行双击/右键仍走原 报单弹窗 / 单选右键菜单。
 */
interface UnderlyingMenuState {
  instrumentID: string
  x: number
  y: number
}

export function OptionsPanel() {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all')
  // 过滤开关：仅显示交易中合约（隐藏已停牌/已到期），默认关（显示全部）
  const [filterActive, setFilterActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  // 标底行右键菜单（仅「打开T型报价」一项）
  const [underlyingMenu, setUnderlyingMenu] = useState<UnderlyingMenuState | null>(null)
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
  const favoriteOptions = useMemo(
    () => favorites.filter((c) => c.productClass === '2' || c.productClass === '6'),
    [favorites],
  )

  // 全部/自选 基础集（自选 = 已收藏期权）
  const baseOptions = activeTab === 'all' ? options : favoriteOptions

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

  // 分组前先过滤期权（交易所 + 标底品种 + 仅交易中），再按标底分组展平为有序 ContractInfo[]
  // （标底行在前、期权行随后；组内无可见期权时整组消失）。此列表是搜索框的作用域。
  const listRows = useMemo(() => {
    let filteredOptions = filterByExchangeAndProduct(
      baseOptions,
      filter.exchanges,
      filter.products,
      (c) => deriveUnderlyingProduct(c.underlyingInstrID ?? ''),
    )
    filteredOptions = filterActive ? filteredOptions.filter(isContractActive) : filteredOptions
    const groups = groupOptionsByUnderlying(filteredOptions, futures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [baseOptions, filter, filterActive, futures])

  // 搜索过滤：命中 期权/标底 instrumentID + 中文品种名；空查询 = 全量
  const rows = useMemo(() => {
    if (!searchQuery.trim()) return listRows
    const q = searchQuery.toLowerCase()
    return listRows.filter((c) => {
      const instrumentID = c.instrumentID?.toLowerCase() ?? ''
      const instrumentName = c.instrumentName?.toLowerCase() ?? ''
      const productName = getProductName(c.productID).toLowerCase()
      return instrumentID.includes(q) || instrumentName.includes(q) || productName.includes(q)
    })
  }, [listRows, searchQuery])

  // 用户收藏 ID 集合（用于 ⭐ 列与右键菜单收藏态）
  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.instrumentID)),
    [favorites],
  )
  // 右键菜单 JSX 与工具栏批量收藏共享逻辑（与期货页一致，见 useContractMenus）
  const { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel } = useContractMenus({
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    contracts,
    addToFavorites,
    removeFromFavorites,
    openOrderPopup,
    openQueryPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  })
  // 全系统合约 ID 集合（高级搜索弹窗「已收藏/已订阅」徽标）
  const allContractIds = useMemo(
    () => new Set(contracts.map((c) => c.instrumentID)),
    [contracts],
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

  // 搜索定位：选中期权合约时定位到其标底分组首行（标底合约），复用 futures 页 handleSelectContract
  // 语义（selectedInstrument ∈ selectedContracts，锚点守卫通过才能滚动跳转）。
  const handleSelectContract = (instrumentID: string) => {
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    let target = instrumentID
    // 命中期权合约 → 定位到标底；标底不在期货列表（指数期权）时保持选中该期权行
    if (inst && (inst.productClass === '2' || inst.productClass === '6') && inst.underlyingInstrID) {
      const underlying = contracts.find((c) => c.instrumentID === inst.underlyingInstrID)
      if (underlying) target = underlying.instrumentID
    }
    setSelectedInstrument(target)
    setOrderInstrument(target)
    setSelectedContracts(new Set([target]))
  }

  // 标底行检测：合约 productClass === '1'（标底期货）
  const isUnderlyingRow = (instrumentID: string) =>
    contracts.find((c) => c.instrumentID === instrumentID)?.productClass === '1'

  // 双击标底行 → 打开 T型报价-<标底> 悬浮窗；期权行 → 原 handleDoubleClick（报单弹窗）
  const handleRowDoubleClick = (instrumentID: string, price: number) => {
    if (isUnderlyingRow(instrumentID)) {
      openTQuoteFloating(instrumentID)
    } else {
      handleDoubleClick(instrumentID, price)
    }
  }

  // 右键标底行 → 「打开T型报价」菜单（仅此项）；期权行 → 原 handleContextMenu（单选菜单）
  const handleRowContextMenu = (instrumentID: string, price: number, event: MouseEvent) => {
    if (isUnderlyingRow(instrumentID)) {
      event.preventDefault()
      setUnderlyingMenu({ instrumentID, x: event.clientX, y: event.clientY })
    } else {
      handleContextMenu(instrumentID, price, event)
    }
  }

  return (
    <section className="options-page">
      {/* 列表工具行：功能靠左（全部/自选 → 筛选 → 仅交易中 → 收藏），搜索贴右。
          T型报价已独立为悬浮标签页，此处不再有 [列表|T型] 切换。 */}
      <div className="market-toolbar">
        <div className="market-toolbar__tabs">
          <button
            className={`btn-tab${activeTab === 'all' ? ' active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部
          </button>
          <button
            className={`btn-tab${activeTab === 'favorites' ? ' active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            自选
          </button>
        </div>
        <ContractFilter
          exchanges={filterExchanges}
          products={filterProducts}
          productNames={filterProductNames}
          value={filter}
          onChange={(v) => useMarketFilterStore.getState().setFilter('options', v)}
        />
        <div className="market-toolbar__actions">
          <button
            className={`btn-filter-status${filterActive ? ' active' : ''}`}
            onClick={() => setFilterActive((v) => !v)}
            title={filterActive ? '仅显示交易中合约' : '显示全部合约'}
          >
            {filterActive ? '仅交易中' : '显示全部'}
          </button>
          <button
            className={`btn-favorite${selectedInstrument && favoritedIds.has(selectedInstrument) ? ' btn-favorite--remove' : ''}`}
            disabled={!selectedInstrument && selectedContracts.size === 0}
            onClick={() => batchToggleFavorite(selectedInstrument, selectedContracts)}
          >
            {favoriteButtonLabel(selectedInstrument, selectedContracts)}
          </button>
        </div>
        <div className="market-toolbar__search">
          <ContractSearch contracts={listRows} onSelect={handleSelectContract} onQueryChange={setSearchQuery} />
          <button
            className="btn-search-advanced"
            title="搜索合约"
            onClick={() => setSearchModalOpen(true)}
          >
            🔍
          </button>
          {searchQuery && (
            <span className="search-count">
              {rows.length} / {listRows.length}
            </span>
          )}
        </div>
      </div>

      <div className="panel-content">
        <ErrorBoundary>
          <QuoteTable
            spec={optionsSpec}
            contracts={rows}
            snapshots={snapshots}
            selectedInstrument={selectedInstrument}
            isActive={isActive}
            onRowClick={handleClick}
            onRowDoubleClick={handleRowDoubleClick}
            onContextMenu={handleRowContextMenu}
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

      {/* 高级搜索弹窗（放大镜入口） */}
      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onAddToFavorite={addToFavorites}
        onRemoveFromFavorite={removeFromFavorites}
        allContractIds={allContractIds}
        favoritedIds={favoritedIds}
      />

      {/* 标底行右键菜单：仅「打开T型报价」 */}
      {underlyingMenu && (
        <ContextMenu
          x={underlyingMenu.x}
          y={underlyingMenu.y}
          items={[
            {
              label: '打开T型报价',
              icon: '📉',
              onClick: () => openTQuoteFloating(underlyingMenu.instrumentID),
            },
          ]}
          onClose={() => setUnderlyingMenu(null)}
        />
      )}

      {/* 单选 + 多选右键菜单（共享 useContractMenus，与期货页一致） */}
      {singleMenu}
      {multiMenu}
    </section>
  )
}
