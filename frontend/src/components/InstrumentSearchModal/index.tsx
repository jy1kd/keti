import { useState, useEffect, useCallback } from 'react'
import type { ContractInfo } from '@/services/types'
import { getExchanges, getProducts, getInstruments, searchInstruments, refreshInstruments, refreshPresetInstruments } from '@/services/api'
import { toast } from '@/components/Toast'
import './index.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (instrument: ContractInfo) => void
  /** User-subscribed IDs (show "已订阅" badge, cannot re-subscribe) */
  userSubscribedIds: Set<string>
  /** Preset IDs (show "预设" badge, can still subscribe) */
  presetIds: Set<string>
}

export function InstrumentSearchModal({ isOpen, onClose, onSubscribe, userSubscribedIds, presetIds }: Props) {
  const [exchanges, setExchanges] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [instruments, setInstruments] = useState<ContractInfo[]>([])
  const [selectedExchange, setSelectedExchange] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
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
    // Global keyword search when no exchange/product selected
    if (!selectedExchange || !selectedProduct) {
      if (!keyword.trim()) return
      setLoading(true)
      setError('')
      getInstruments(keyword.trim())
        .then((res) => { if (!onCleanup?.()) setInstruments(res.instruments) })
        .catch(() => { if (!onCleanup?.()) setError('加载合约列表失败') })
        .finally(() => { if (!onCleanup?.()) setLoading(false) })
      return
    }
    // Filtered search by exchange + product
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

  const handleSubscribe = (inst: ContractInfo) => {
    onSubscribe(inst)
  }

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
                    <td>{inst.instrumentID}</td>
                    <td>{inst.instrumentName}</td>
                    <td>{inst.expireDate}</td>
                    <td>{inst.isTrading ? '交易中' : '已停牌'}</td>
                    <td>
                      {userSubscribedIds.has(inst.instrumentID) ? (
                        <span className="subscribed-badge">已订阅</span>
                      ) : (
                        <button
                          className="btn-subscribe"
                          onClick={() => handleSubscribe(inst)}
                        >
                          {presetIds.has(inst.instrumentID) ? '订阅(预设)' : '订阅'}
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
            <button
              className="btn-refresh"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true)
                setError('')
                try {
                  const result = await refreshPresetInstruments()
                  if (result.success && result.instruments) {
                    toast.success(`已更新 ${result.instruments.length} 个预设合约`)
                  }
                } catch {
                  setError('刷新预设合约失败')
                } finally {
                  setRefreshing(false)
                }
              }}
            >
              {refreshing ? '刷新中...' : '刷新预设合约'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
