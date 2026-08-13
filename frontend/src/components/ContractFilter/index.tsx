import { useMemo, useRef, useState, useEffect } from 'react'
import type { MarketFilter } from '@/modules/market/filter'
import './styles.css'

interface ContractFilterProps {
  /** 可选交易所 ID 列表（空=无选项） */
  exchanges: string[]
  /** 可选品种（productID）列表 */
  products: string[]
  /** productID → 品种中文名 */
  productNames: Record<string, string>
  value: MarketFilter
  onChange: (v: MarketFilter) => void
}

/**
 * ContractFilter — 交易所 + 品种多选筛选面板。
 * 「筛选」按钮 + 点击展开下拉：交易所 checkbox 列表、品种 checkbox 列表
 * （中文名 + 内嵌关键词过滤输入）、「清空」按钮；点击外部/Esc 关闭；
 * 按钮显示已选数徽标（交易所+品种合计）。
 */
export function ContractFilter({ exchanges, products, productNames, value, onChange }: ContractFilterProps) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const activeCount = value.exchanges.length + value.products.length

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
    if (!keyword.trim()) return products
    const q = keyword.toLowerCase()
    return products.filter((p) => {
      const name = productNames[p] ?? p
      return p.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    })
  }, [keyword, products, productNames])

  const toggle = (key: 'exchanges' | 'products', item: string) => {
    const list = value[key]
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    onChange({ ...value, [key]: next })
  }

  const clear = () => onChange({ exchanges: [], products: [] })

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
              {exchanges.length === 0 ? (
                <div className="contract-filter__empty">无</div>
              ) : (
                exchanges.map((ex) => (
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
