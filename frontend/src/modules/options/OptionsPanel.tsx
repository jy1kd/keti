import { useCallback, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractFilter } from '@/components/ContractFilter'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { CollectionPicker } from '@/components/CollectionPicker'
import { OptionChainGroup } from './OptionChainGroup'
import { deriveUnderlyingProduct, groupOptionsByUnderlying } from '@/modules/market/sort'
import { filterByExchangeAndProduct } from '@/modules/market/filter'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore } from '@/stores/collections'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { getProductName } from '@/utils/productNames'
import './styles.css'

/**
 * OptionsPanel — 期权标签页（堆叠可折叠 T 型链列表视图）
 *
 * P1：标底分组堆叠，每组头部 = 标底合约 ID（FG609 / MO2608 / ...），可点击展开/折叠。
 *      展开后拉链（按最早到期）→ 渲染 T 型报价表（TQuoteTable，点击 C/P 侧回填合约+最新价）。
 *      工具栏 = ContractFilter（交易所+标底品种多选，粒度 = 标底合约）+ ContractSearch
 *      + 🔍 高级搜索。⭐ 收藏按钮已移除（合约级收藏 P1 不做；P2 加系列收藏）。
 *
 * 与旧版的差异：移除平铺 QuoteTable / optionsSpec；改用 OptionChainGroup 渲染；
 * 标底行右键「打开T型报价」菜单随平铺表一起退出（P1 T型报价内建于组头部 ⇗ 新窗）。
 */
export function OptionsPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  // 收藏选夹面板（高级搜索弹窗唯一入口；P1 工具栏无 ⭐ 按钮）
  const [picker, setPicker] = useState<{ instrumentIDs: string[] } | null>(null)

  // 标底 ID → 容器 DOM ref（搜索/高级搜索选中合约 → 定位展开对应组 + 滚动到该组）
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)

  // 期权页筛选态（交易所+标底品种多选，粒度 = 标底合约）
  const filter = useMarketFilterStore((s) => s.options)

  // 期货全量 + 期权全量
  const futures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])
  const options = useMemo(() => contracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [contracts])

  // 筛选面板品种中文名（显示用；按底层品种去重）
  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of options) {
      const p = deriveUnderlyingProduct(o.underlyingInstrID ?? '')
      if (!(p in m)) m[p] = getProductName(p)
    }
    return m
  }, [options])

  // 数据管道：筛选 → 分组（直接产出 OptionGroup[]，不再展平为 ContractInfo[]）
  const groups = useMemo(() => {
    const filteredOptions = filterByExchangeAndProduct(
      options,
      filter.exchanges,
      filter.products,
      (c) => deriveUnderlyingProduct(c.underlyingInstrID ?? ''),
    )
    return groupOptionsByUnderlying(filteredOptions, futures)
  }, [options, filter, futures])

  // 搜索过滤组：按 underlyingID / 品种中文名（不区分大小写）
  const visibleGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase()
    return groups.filter((g) => {
      const product = deriveUnderlyingProduct(g.underlyingID)
      return (
        g.underlyingID.toLowerCase().includes(q) ||
        getProductName(product).toLowerCase().includes(q)
      )
    })
  }, [groups, searchQuery])

  // 展开标底组（OptionChainGroup 是无受控的：P1 通过查询 header DOM 触发 click 事件）
  // 这是 spec §4.3 的实现路径（ContractSearch/InstrumentSearchModal 选中合约 → 展开对应组）。
  const expandGroup = useCallback((underlyingID: string) => {
    const wrapper = groupRefs.current[underlyingID]
    if (!wrapper) return
    const header = wrapper.querySelector('.option-chain-group__header') as HTMLElement | null
    if (header) header.click()
    // 下一帧滚动到该组（点击触发 useState 异步变更 → 链加载 → 渲染 T 表）
    requestAnimationFrame(() => {
      groupRefs.current[underlyingID]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [])

  // T 行单击回填（透传到 OptionChainGroup → TQuoteTable.onRowClick）：
  // 选中 → setOrderInstrument → 若非标底期货则 setOrderForm({limitPrice})
  const onSelectContract = useCallback((instrumentID: string, price: number) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    // 标底（productClass '1'）无 lastPrice，price=0；不得覆盖报单表已填的 limitPrice
    if (!(inst && inst.productClass === '1')) {
      setOrderForm({ limitPrice: price })
    }
  }, [contracts, setSelectedInstrument, setOrderInstrument, setOrderForm])

  // 搜索框选中合约 → 定位到其标底组（展开）。
  // 实现：为保证该组在 simple-search 过滤后仍可见，把 searchQuery 切到标底 ID（g.underlyingID
  // 子串匹配），下一帧 ref 重新绑定后再触发 header click。处理两条路径：
  //  1. 选中目标本身就是标底期货 → 直接展开
  //  2. 选中是期权合约 → 找到 underlyingInstrID → 展开该标底
  const handleSelectContract = useCallback((instrumentID: string) => {
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    let targetGroupID = instrumentID
    if (inst && (inst.productClass === '2' || inst.productClass === '6') && inst.underlyingInstrID) {
      const underlying = contracts.find((c) => c.instrumentID === inst.underlyingInstrID)
      if (underlying) targetGroupID = underlying.instrumentID
    }
    // 让该组在 visibleGroups 中（searchQuery 子串匹配 underlyingID），再下一帧点 header
    setSearchQuery(targetGroupID)
    requestAnimationFrame(() => expandGroup(targetGroupID))
  }, [contracts, expandGroup])

  // 高级搜索选中合约：在 InstrumentSearchModal 内点击合约条目 → 关闭弹窗并展开对应组
  const handleAdvancedSelect = useCallback((instrumentID: string) => {
    setSearchModalOpen(false)
    handleSelectContract(instrumentID)
  }, [handleSelectContract])

  // 全系统合约 ID 集合（高级搜索弹窗「已订阅」徽标）
  const allContractIds = useMemo(
    () => new Set(contracts.map((c) => c.instrumentID)),
    [contracts],
  )

  return (
    <section className="options-page">
      {/* 列表工具行：筛选 → 搜索 → 🔍（P1 移除 ⭐ 收藏按钮；P2 加系列收藏） */}
      <div className="market-toolbar">
        <ContractFilter
          allContracts={options}
          getProduct={(c) => deriveUnderlyingProduct(c.underlyingInstrID ?? '')}
          productNames={filterProductNames}
          value={filter}
          onChange={(v) => useMarketFilterStore.getState().setFilter('options', v)}
        />
        <div className="market-toolbar__search">
          <ContractSearch
            contracts={options}
            onSelect={handleSelectContract}
            onQueryChange={setSearchQuery}
          />
          <button
            className="btn-search-advanced"
            title="搜索合约"
            onClick={() => setSearchModalOpen(true)}
          >
            🔍
          </button>
          {searchQuery && (
            <span className="search-count">
              {visibleGroups.length} / {groups.length}
            </span>
          )}
        </div>
      </div>

      {/* 堆叠可折叠 T 型链组列表（替换原平铺 QuoteTable） */}
      <div className="panel-content options-groups">
        <ErrorBoundary>
          {visibleGroups.map((g) => (
            <div
              key={g.underlyingID}
              ref={(el) => { groupRefs.current[g.underlyingID] = el }}
              data-underlying={g.underlyingID}
            >
              <OptionChainGroup
                group={g}
                onSelectContract={onSelectContract}
              />
            </div>
          ))}
        </ErrorBoundary>
      </div>

      {/* 高级搜索弹窗（放大镜入口） */}
      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenFavoritePicker={(instrumentID) => setPicker({ instrumentIDs: [instrumentID] })}
        onRemoveFromAllCollections={(ids) => useCollectionsStore.getState().removeFromAllCollections(ids)}
        allContractIds={allContractIds}
        favoritedIds={new Set()}
        onContractClick={handleAdvancedSelect}
      />

      {/* 收藏选夹面板（高级搜索弹窗唯一入口） */}
      <CollectionPicker
        isOpen={!!picker}
        instrumentIDs={picker?.instrumentIDs ?? []}
        onClose={() => setPicker(null)}
      />
    </section>
  )
}