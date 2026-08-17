import { useState, useEffect, useCallback } from 'react'
import type { ContractInfo } from '@/services/types'
import { getExchanges, getProducts, getInstruments, searchInstruments, refreshInstruments } from '@/services/api'
import { PRODUCT_NAMES, getProductName } from '@/utils/productNames'
import { toast } from '@/components/Toast'
import './index.css'

/** 判断字符串是否包含中文 */
function hasChinese(s: string): boolean {
  return /[一-鿿]/.test(s)
}

/** 从 PRODUCT_NAMES 中查找匹配中文关键词的 productID 列表 */
function findProductIdsByChineseName(keyword: string): string[] {
  const kw = keyword.toLowerCase()
  return Object.entries(PRODUCT_NAMES)
    .filter(([, name]) => name.toLowerCase().includes(kw))
    .map(([id]) => id)
}

interface Props {
  isOpen: boolean
  onClose: () => void
  /** 打开选夹面板（收藏入口） */
  onOpenFavoritePicker: (instrumentID: string) => void
  /** 从所有收藏夹移除 */
  onRemoveFromAllCollections: (instrumentIDs: string[]) => void
  /** All contract IDs in the system */
  allContractIds: Set<string>
  /** Favorited IDs (show "移除" button) */
  favoritedIds: Set<string>
  /**
   * 选中合约回调：用户点击合约代码单元格时触发（与收藏按钮分离），便于调用方跳转 / 展开定位。
   * OptionsPanel 用它做 spec §4.3 的「选中合约 → 展开对应标底组」。
   * 未传则合约代码单元格不响应点击。
   */
  onContractClick?: (instrumentID: string) => void
}

export function InstrumentSearchModal({ isOpen, onClose, onOpenFavoritePicker, onRemoveFromAllCollections, allContractIds, favoritedIds, onContractClick }: Props) {
  const [exchanges, setExchanges] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [instruments, setInstruments] = useState<ContractInfo[]>([])
  const [selectedExchange, setSelectedExchange] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshingInstruments, setRefreshingInstruments] = useState(false)
  const [error, setError] = useState('')

  // Listen for CTP refresh completion (dispatched by useSystemWs)
  useEffect(() => {
    const handler = () => setRefreshingInstruments(false)
    window.addEventListener('instruments_refreshed', handler)
    return () => window.removeEventListener('instruments_refreshed', handler)
  }, [])

  // Safety timeout: reset loading after 60s if WS event never arrives
  useEffect(() => {
    if (!refreshingInstruments) return
    const timer = setTimeout(() => setRefreshingInstruments(false), 60_000)
    return () => clearTimeout(timer)
  }, [refreshingInstruments])

  // Load exchanges on open
  useEffect(() => {
    if (!isOpen) return
    let ignore = false
    getExchanges()
      .then((res) => { if (!ignore) setExchanges(res.exchanges) })
      .catch(() => { if (!ignore) setError('加载交易所列表失败') })
    return () => { ignore = true }
  }, [isOpen])

  // Load products when exchange changes
  useEffect(() => {
    if (!selectedExchange) {
      setProducts([])
      setSelectedProduct('')
      setInstruments([])
      return
    }
    let ignore = false
    getProducts(selectedExchange)
      .then((res) => {
        if (!ignore) {
          setProducts(res.products)
          setSelectedProduct('')
          setInstruments([])
        }
      })
      .catch(() => { if (!ignore) setError('加载品种列表失败') })
    return () => { ignore = true }
  }, [selectedExchange])

  // Load instruments (shared by product change, button click, Enter key)
  const loadInstruments = useCallback((onCleanup?: () => boolean) => {
    if (!selectedExchange || !selectedProduct) {
      if (!keyword.trim()) return
      setLoading(true)
      setError('')

      // 中文搜索：从 PRODUCT_NAMES 查匹配的 productID，逐个搜索后合并
      if (hasChinese(keyword.trim())) {
        const matchedIds = findProductIdsByChineseName(keyword.trim())
        if (matchedIds.length === 0) {
          if (!onCleanup?.()) {
            setInstruments([])
            setLoading(false)
          }
          return
        }
        const matchedIdSet = new Set(matchedIds)
        // 用 productID 作为关键词搜索后端（后端搜 instrumentID/productID 等字段）
        Promise.all(matchedIds.map((id) => getInstruments(id)))
          .then((results) => {
            if (onCleanup?.()) return
            const merged = results.flatMap((r) => r.instruments)
            // 去重 + 前端按 productID 精确过滤（后端子串匹配会误匹配 MAP/SAP/TAP 等）
            const seen = new Set<string>()
            const filtered = merged.filter((c) => {
              if (!matchedIdSet.has(c.productID)) return false
              if (seen.has(c.instrumentID)) return false
              seen.add(c.instrumentID)
              return true
            })
            setInstruments(filtered)
          })
          .catch(() => { if (!onCleanup?.()) setError('加载合约列表失败') })
          .finally(() => { if (!onCleanup?.()) setLoading(false) })
        return
      }

      // 非中文：走原逻辑
      getInstruments(keyword.trim())
        .then((res) => { if (!onCleanup?.()) setInstruments(res.instruments) })
        .catch(() => { if (!onCleanup?.()) setError('加载合约列表失败') })
        .finally(() => { if (!onCleanup?.()) setLoading(false) })
      return
    }
    setLoading(true)
    setError('')
    searchInstruments(selectedExchange, selectedProduct, keyword || undefined)
      .then((res) => { if (!onCleanup?.()) setInstruments(res.instruments) })
      .catch(() => { if (!onCleanup?.()) setError('加载合约列表失败') })
      .finally(() => { if (!onCleanup?.()) setLoading(false) })
  }, [selectedExchange, selectedProduct, keyword])

  // Load instruments when product changes (with cleanup)
  useEffect(() => {
    let ignore = false
    loadInstruments(() => ignore)
    return () => { ignore = true }
  }, [selectedExchange, selectedProduct]) // eslint-disable-line react-hooks/exhaustive-deps

  // Search on Enter key
  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadInstruments()
    }
  }

  const handleSubscribe = (inst: ContractInfo) => onOpenFavoritePicker(inst.instrumentID)

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>合约搜索</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-filters">
          <select
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value)}
          >
            <option value="">选择交易所</option>
            {exchanges.map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>

          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={!selectedExchange}
          >
            <option value="">选择品种</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="搜索关键词..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
          />

          <button onClick={() => loadInstruments()} disabled={loading || (!selectedProduct && !keyword.trim())}>
            搜索
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-table-container">
          {loading ? (
            <div className="modal-loading">加载中...</div>
          ) : instruments.length === 0 ? (
            <div className="modal-empty">
              {selectedProduct ? '无匹配合约' : '输入关键词搜索，或选择交易所和品种'}
            </div>
          ) : (
            <table className="modal-table">
              <thead>
                <tr>
                  <th>合约</th>
                  <th>名称</th>
                  <th>到期日</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((inst) => (
                  <tr key={inst.instrumentID}>
                    <td>
                      {onContractClick ? (
                        <button
                          type="button"
                          className="modal-table__select-link"
                          onClick={() => onContractClick(inst.instrumentID)}
                        >
                          {inst.instrumentID}
                        </button>
                      ) : (
                        inst.instrumentID
                      )}
                    </td>
                    <td>{getProductName(inst.productID)}</td>
                    <td>{inst.expireDate}</td>
                    <td>
                      <span className={inst.isTrading ? 'status-trading' : 'status-halted'}>
                        {inst.isTrading ? '交易中' : '已停牌'}
                      </span>
                    </td>
                    <td>
                      {favoritedIds.has(inst.instrumentID) ? (
                        <button
                          className="btn-remove-favorite"
                          onClick={() => {
                            onRemoveFromAllCollections([inst.instrumentID])
                            toast.success(`已移除 ${inst.instrumentID}`)
                          }}
                        >
                          移除
                        </button>
                      ) : (
                        <button
                          className={allContractIds.has(inst.instrumentID) ? 'btn-subscribe-favorite' : 'btn-subscribe'}
                          onClick={() => handleSubscribe(inst)}
                        >
                          {allContractIds.has(inst.instrumentID) ? '收藏' : '订阅'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <span>共 {instruments.length} 个合约</span>
          <div className="modal-footer__buttons">
            <button
              className="btn-refresh-instruments"
              disabled={refreshingInstruments}
              onClick={async () => {
                setRefreshingInstruments(true)
                setError('')
                try {
                  await refreshInstruments()
                } catch {
                  setError('从CTP刷新合约失败')
                  setRefreshingInstruments(false)
                }
                // 成功时保持 loading，等待 instruments_refreshed WS 事件重置
              }}
            >
              {refreshingInstruments ? '刷新中...' : '刷新合约(CTP)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
