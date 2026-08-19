import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContractInfo } from '@/services/types'
import {
  activeOptionsTab,
  addOptionsTab,
  clearOptionsTabs,
  removeOptionsTab,
  setActiveOptionsTab,
  setOptionsTabSeries,
  type OptionsTabsState,
} from './optionsTabs'
import './styles.css'

interface OptionsFilterBarProps {
  /** 全量期权合约（已规范化 underlyingInstrID；用于交叉计算可选交易所/品种/系列） */
  allContracts: ContractInfo[]
  /** 合约 → 品种键（期权页 = 标底品种，如 FG609 → FG） */
  getProduct: (c: ContractInfo) => string
  /** 品种键 → 品种中文名 */
  productNames: Record<string, string>
  value: OptionsTabsState
  onChange: (v: OptionsTabsState) => void
  /** 清空筛选时的额外回调（如重置选中合约） */
  onClear?: () => void
}

/**
 * OptionsFilterBar — 期权页筛选重构后的筛选条（单行：品种 Tab 条 + 系列 + 清空 ┃ 交易所/品种 ┃ 搜索）。
 *
 * 单行布局（与搜索框同一行）：
 * - 左侧：品种 Tab 条（每选一个品种弹一个 tab：点击激活、✕ 关闭）+ 共享系列下拉
 *   （随激活 tab 列出该品种全部系列，多选收窄；「全部」= 不选系列）+「清空」
 * - 右侧：合并的「交易所→品种」下拉。点开先显示交易所列表；选定交易所后**同一面板自动切到**
 *   品种勾选清单（无需再次点开），每勾选一个品种即追加一个 tab；标题栏 ‹ 可返回换交易所。
 *
 * 纯受控组件：交互只产生对新 OptionsTabsState 的 onChange，状态转换逻辑在
 * optionsTabs.ts 纯函数中（add/remove/activate/series），不在此内实现。
 *
 * 细节：系列下拉不在可横向滚动的 Tab 容器内——overflow-x:auto 会强制 overflow-y:auto，
 * 绝对定位面板会被裁剪（旧版「系列下拉打不开」根因）。
 */
export function OptionsFilterBar({ allContracts, getProduct, productNames, value, onChange, onClear }: OptionsFilterBarProps) {
  /** 合并的交易所/品种下拉面板开合 */
  const [filterOpen, setFilterOpen] = useState(false)
  /** 面板内步骤：true = 交易所列表；false = 品种勾选清单 */
  const [showExchanges, setShowExchanges] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const seriesPanelRef = useRef<HTMLDivElement>(null)

  // 鼠标滚轮在横向筛选栏中左右移动，行为与期货收藏夹 Tab 条一致。
  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += e.deltaX + e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [value.tabs.length])

  useEffect(() => {
    const el = seriesPanelRef.current
    if (!el || !seriesOpen) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollHeight <= el.clientHeight) return
      el.scrollTop += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [seriesOpen])

  const active = activeOptionsTab(value)
  // 激活 tab 的下标（activeIndex 越界时按 activeOptionsTab 兜底后的实际 tab 定位）
  const activeIndex = active ? value.tabs.findIndex((t) => t.product === active.product) : -1
  const activeSeries = activeIndex >= 0 ? value.tabs[activeIndex].series : []
  const selectedProductCount = value.tabs.length

  // 可选交易所（全量含期权合约的交易所）
  const exchanges = useMemo(() => {
    const set = new Set<string>()
    for (const c of allContracts) set.add(c.exchangeID)
    return [...set]
  }, [allContracts])

  // 当前交易所下的品种（品种步骤可选清单）
  const productsOfExchange = useMemo(() => {
    if (!value.exchange) return []
    const set = new Set<string>()
    for (const c of allContracts) {
      if (c.exchangeID !== value.exchange) continue
      set.add(getProduct(c))
    }
    return [...set]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getProduct 为纯映射函数
  }, [allContracts, value.exchange])

  // 激活品种的全部系列（= 该品种下的具体标底合约，如 FG609/FG610）
  const seriesOfProduct = useMemo(() => {
    if (!active) return []
    const set = new Set<string>()
    for (const c of allContracts) {
      if (getProduct(c) !== active.product) continue
      if (c.underlyingInstrID) set.add(c.underlyingInstrID)
    }
    return [...set]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getProduct 为纯映射函数
  }, [allContracts, active])

  // 点击外部关闭下拉面板
  useEffect(() => {
    if (!filterOpen && !seriesOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setSeriesOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [filterOpen, seriesOpen])

  /** 打开合并下拉：已选交易所 → 直接到品种步骤（减少一次操作）；否则从交易所列表开始 */
  const openFilter = () => {
    setFilterOpen((v) => !v)
    setShowExchanges(!value.exchange)
  }

  const pickExchange = (exchange: string) => {
    onChange({ ...value, exchange })
    setShowExchanges(false) // 选完交易所自动切到该所品种清单
  }

  const toggleProduct = (product: string) => {
    const idx = value.tabs.findIndex((t) => t.product === product)
    // 勾选 → 追加并激活；取消勾选 → 移除该品种 tab
    onChange(idx >= 0 ? removeOptionsTab(value, idx) : addOptionsTab(value, product))
    setSeriesOpen(false)
  }

  const toggleTab = (index: number) => {
    onChange(setActiveOptionsTab(value, index))
    setSeriesOpen(false) // 换激活 tab → 系列下拉随动，关闭避免展示旧品种系列
  }

  const closeTab = (index: number) => {
    onChange(removeOptionsTab(value, index))
    setSeriesOpen(false)
  }

  const toggleSeries = (series: string) => {
    if (activeIndex < 0) return
    const current = activeSeries
    const next = current.includes(series)
      ? current.filter((s) => s !== series)
      : [...current, series]
    onChange(setOptionsTabSeries(value, activeIndex, next))
  }

  const selectAllSeries = () => {
    if (activeIndex < 0) return
    onChange(setOptionsTabSeries(value, activeIndex, []))
  }

  const clear = () => {
    onChange(clearOptionsTabs(value))
    setFilterOpen(false)
    setSeriesOpen(false)
    onClear?.()
  }

  return (
    <div ref={rootRef} className="options-filter-block">
      {/* 左侧：品种 Tab 条（可横滚的容器只放 tab 本身，系列下拉在其外避免被裁剪） */}
      {value.tabs.length > 0 && (
        <div ref={tabsRef} className="options-filter-tabs" data-testid="options-filter-tabs" role="tablist" aria-label="已选品种（可滚轮横向移动）">
          {value.tabs.map((t, i) => (
            <span key={t.product} className={`options-filter-tab${i === value.activeIndex ? ' options-filter-tab--active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={i === value.activeIndex}
                className="options-filter-tab__name"
                onClick={() => toggleTab(i)}
                title={`查看 ${productNames[t.product] ?? t.product}（${t.product}）全部系列`}
              >
                {t.product}
              </button>
              <button
                type="button"
                className="options-filter-tab__close"
                title="关闭品种"
                onClick={() => closeTab(i)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 共享系列下拉：随激活 tab 列出该品种全部系列，多选收窄；「全部」= 不选系列 */}
      {active && seriesOfProduct.length > 0 && (
        <div className="options-series-select" data-testid="options-series-select">
          <button
            type="button"
            className="options-filter-select"
            data-testid="options-series-dropdown"
            onClick={() => setSeriesOpen((v) => !v)}
            title="筛选系列合约"
          >
            {active.product} 系列{activeSeries.length > 0 ? `·已选${activeSeries.length}` : '·多选'} ▾
          </button>
          {seriesOpen && (
            <div ref={seriesPanelRef} className="options-filter-panel options-filter-panel--series">
              <label className="options-filter-item" data-testid="options-series-all">
                <input type="checkbox" checked={activeSeries.length === 0} onChange={selectAllSeries} />
                <span className="options-filter-item__label">全部</span>
              </label>
              {seriesOfProduct.map((s) => (
                <label key={s} className="options-filter-item">
                  <input type="checkbox" checked={activeSeries.includes(s)} aria-label={s} onChange={() => toggleSeries(s)} />
                  <span className="options-filter-item__label">{s}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {value.tabs.length > 0 && (
        <button type="button" className="options-filter-clear" title="清空筛选" onClick={clear}>
          清空
        </button>
      )}

      {/* 右侧：合并的「交易所→品种」下拉（先选交易所，同一面板自动跳品种） */}
      <div className="options-filter-combo" data-testid="options-filter-combo">
        <button
          type="button"
          className="options-filter-select options-filter-combo__button"
          data-testid="options-filter-combo__button"
          onClick={openFilter}
          title="选择交易所与品种"
        >
          {value.exchange
            ? `${value.exchange}${selectedProductCount > 0 ? ` ·${selectedProductCount}品种` : ''} ▾`
            : '请选择交易所 ▾'}
        </button>
        {filterOpen && (
          <div className="options-filter-panel options-filter-panel--combo">
            {showExchanges ? (
              <>
                <div className="options-filter-panel__title">选择交易所</div>
                {exchanges.length === 0 ? (
                  <div className="options-filter-empty">无</div>
                ) : (
                  exchanges.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className={`options-filter-panel__choice${value.exchange === ex ? ' options-filter-panel__choice--active' : ''}`}
                      aria-label={ex}
                      onClick={() => pickExchange(ex)}
                    >
                      {ex}
                    </button>
                  ))
                )}
              </>
            ) : (
              <>
                <div className="options-filter-panel__title">
                  <button type="button" className="options-filter-panel__back" data-testid="options-filter-back" title="返回选择交易所" onClick={() => setShowExchanges(true)}>
                    ‹
                  </button>
                  {value.exchange} 品种
                </div>
                {productsOfExchange.length === 0 ? (
                  <div className="options-filter-empty">该交易所暂无期权品种</div>
                ) : (
                  productsOfExchange.map((p) => {
                    const inTabs = value.tabs.some((t) => t.product === p)
                    return (
                      <label key={p} className="options-filter-item">
                        <input type="checkbox" className="options-filter-item__checkbox" checked={inTabs} aria-label={p} onChange={() => toggleProduct(p)} />
                        {/* 品种展示：英文代码左（正常色），中文名右（灰色透明） */}
                        <span className="options-filter-product-code">{p}</span>
                        <span className="options-filter-product-name">{productNames[p] ?? p}</span>
                      </label>
                    )
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
