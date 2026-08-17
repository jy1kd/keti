import { useMemo, useRef, useState, useEffect } from 'react'
import type { MarketFilter } from '@/modules/market/filter'
import { computeFilterOptions } from '@/modules/market/filter'
import type { ContractInfo } from '@/services/types'
import './styles.css'

interface ContractFilterProps {
  /** 全量合约（交叉计算可选交易所/品种；期货页=全量期货，期权页=全量期权） */
  allContracts: ContractInfo[]
  /** 合约 → 品种键（期货页=productID，期权页=标底品种） */
  getProduct: (c: ContractInfo) => string
  /** productID → 品种中文名 */
  productNames: Record<string, string>
  /** 合约 → 标底 ID（期权页传 underlyingInstrID，如 FG609）。传了才显示第三级「合约」筛选；
   *  期货页不传 = 只有交易所+品种两级。 */
  getUnderlying?: (c: ContractInfo) => string
  value: MarketFilter
  onChange: (v: MarketFilter) => void
}

/**
 * ContractFilter — 交易所 + 品种（+ 可选标底合约）多选筛选面板。
 * 「筛选」按钮 + 点击展开下拉：交易所 checkbox、品种 checkbox（中文名 + 关键词过滤）、
 * 标底合约 checkbox（仅当传 getUnderlying 且已选品种/交易所时显示，列出该范围内的具体标底）；
 * 「清空」按钮；点击外部/Esc 关闭。按钮显示已选数徽标。
 * 列表内容由 computeFilterOptions 交叉联动（选交易所→品种列表收窄到该所品种，反之亦然）；
 * 标底列表受交易所+品种双重约束（选品种 FG → 只列出 FG609/FG610… 等标底）。
 * 已选项即使被交叉过滤掉也「并回」展示列表（保持勾选，可取消）。
 */
export function ContractFilter({ allContracts, getProduct, productNames, getUnderlying, value, onChange }: ContractFilterProps) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const activeCount = value.exchanges.length + value.products.length + (value.underlyings?.length ?? 0)

  // 动态可用选项：exchanges = 有合约满足已选品种的交易所；products = 有合约满足已选交易所的品种。
  // getProduct 是纯映射函数（合约 → 品种键），结果只由 allContracts 与已选值决定，因此不列入依赖数组——
  // 否则父组件内联箭头（每行情 tick 新建实例）会令本 useMemo 在每次渲染都重算（Critical #4）。
  const { exchanges: availableExchanges, products: availableProducts } = useMemo(
    () => computeFilterOptions(allContracts, value.exchanges, value.products, getProduct),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getProduct 为纯函数，结果只依赖前三个参数
    [allContracts, value.exchanges, value.products],
  )
  // 已选项并回可用列表：被交叉过滤掉的已选项仍显示（勾选）可取消
  const displayExchanges = useMemo(
    () => Array.from(new Set([...value.exchanges, ...availableExchanges])),
    [value.exchanges, availableExchanges],
  )
  const displayProducts = useMemo(
    () => Array.from(new Set([...value.products, ...availableProducts])),
    [value.products, availableProducts],
  )

  // 标底合约可用列表：满足已选交易所+品种（或空）的合约的标底 ID，去重。
  // 仅当传了 getUnderlying 才有第三级。受交易所+品种双重约束（用户先选交易所/品种收窄到具体标底）。
  const availableUnderlyings = useMemo(() => {
    if (!getUnderlying) return []
    const uSet = new Set<string>()
    const exSet = value.exchanges.length ? new Set(value.exchanges) : null
    const prodSet = value.products.length ? new Set(value.products) : null
    for (const c of allContracts) {
      if (exSet && !exSet.has(c.exchangeID)) continue
      if (prodSet && !prodSet.has(getProduct(c))) continue
      const u = getUnderlying(c)
      if (u) uSet.add(u)
    }
    return [...uSet]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getUnderlying 为纯映射函数，结果只由前三个参数决定
  }, [allContracts, value.exchanges, value.products])
  // 已选标底并回展示列表
  const displayUnderlyings = useMemo(
    () => Array.from(new Set([...(value.underlyings ?? []), ...availableUnderlyings])),
    [value.underlyings, availableUnderlyings],
  )
  // 是否展示「合约」级：传了 getUnderlying 且有内容（已选或可选），且
  // 已选品种/交易所（或已有标底选中需并回取消）。用户先选交易所+品种才展开具体标底。
  const showUnderlyings =
    !!getUnderlying &&
    (value.products.length > 0 || value.exchanges.length > 0 || (value.underlyings?.length ?? 0) > 0) &&
    displayUnderlyings.length > 0

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // 品种关键词过滤（仅过滤展示列表，不影响已选值）
  const shownProducts = useMemo(() => {
    if (!keyword.trim()) return displayProducts
    const q = keyword.toLowerCase()
    return displayProducts.filter((p) => {
      const name = productNames[p] ?? p
      return p.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    })
  }, [keyword, displayProducts, productNames])

  const toggle = (key: 'exchanges' | 'products' | 'underlyings', item: string) => {
    const list = value[key] ?? []
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    onChange({ ...value, [key]: next })
  }

  const clear = () => onChange({ exchanges: [], products: [], underlyings: [] })

  return (
    <div className="contract-filter" ref={rootRef}>
      <button
        type="button"
        className={`btn-contract-filter${activeCount ? ' has-filter' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="交易所/品种多选筛选"
      >
        <span className="contract-filter__label">筛选</span>
        {activeCount > 0 && (
          <span className="contract-filter__badge" data-testid="contract-filter-badge">
            {activeCount}
          </span>
        )}
        <span className="contract-filter__arrow">🔽</span>
      </button>

      {open && (
        <div className="contract-filter__panel">
          <div className="contract-filter__section">
            <div className="contract-filter__section-title">交易所</div>
            <div className="contract-filter__list">
              {displayExchanges.length === 0 ? (
                <div className="contract-filter__empty">无</div>
              ) : (
                displayExchanges.map((ex) => (
                  <label key={ex} className="contract-filter__item">
                    <input type="checkbox" checked={value.exchanges.includes(ex)} onChange={() => toggle('exchanges', ex)} />
                    <span>{ex}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="contract-filter__section">
            <div className="contract-filter__section-title">品种</div>
            <input
              className="contract-filter__keyword"
              placeholder="筛选品种..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <div className="contract-filter__list">
              {shownProducts.length === 0 ? (
                <div className="contract-filter__empty">无</div>
              ) : (
                shownProducts.map((p) => (
                  <label key={p} className="contract-filter__item">
                    <input type="checkbox" checked={value.products.includes(p)} onChange={() => toggle('products', p)} />
                    <span className="contract-filter__product-name">{productNames[p] ?? p}</span>
                    <span className="contract-filter__product-code">{p}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {showUnderlyings && (
            <div className="contract-filter__section">
              <div className="contract-filter__section-title">合约</div>
              <div className="contract-filter__list contract-filter__list--underlyings">
                {displayUnderlyings.length === 0 ? (
                  <div className="contract-filter__empty">无</div>
                ) : (
                  displayUnderlyings.map((u) => (
                    <label key={u} className="contract-filter__item">
                      <input type="checkbox" checked={(value.underlyings ?? []).includes(u)} onChange={() => toggle('underlyings', u)} />
                      <span>{u}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="contract-filter__footer">
            <button type="button" className="contract-filter__clear" onClick={clear}>
              清空
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
