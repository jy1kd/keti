import { useState, useEffect, useCallback } from 'react'
import type { ContractInfo } from '@/services/types'
import { getExchanges, getProducts, searchInstruments, subscribeMarket } from '@/services/api'
import './index.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (instrument: ContractInfo) => void
  subscribedIds: Set<string>
}

export function InstrumentSearchModal({ isOpen, onClose, onSubscribe, subscribedIds }: Props) {
  const [exchanges, setExchanges] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [instruments, setInstruments] = useState<ContractInfo[]>([])
  const [selectedExchange, setSelectedExchange] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    if (!selectedExchange || !selectedProduct) return
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

  const handleSubscribe = async (inst: ContractInfo) => {
    try {
      const result = await subscribeMarket([inst.instrumentID])
      if (result.success) {
        onSubscribe(inst)
      } else {
        setError('订阅失败')
      }
    } catch {
      setError('订阅请求失败')
    }
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
            disabled={!selectedProduct}
          />

          <button onClick={() => loadInstruments()} disabled={!selectedProduct || loading}>
            搜索
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-table-container">
          {loading ? (
            <div className="modal-loading">加载中...</div>
          ) : instruments.length === 0 ? (
            <div className="modal-empty">
              {selectedProduct ? '无匹配合约' : '请选择交易所和品种'}
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
                      {subscribedIds.has(inst.instrumentID) ? (
                        <span className="subscribed-badge">已订阅</span>
                      ) : (
                        <button
                          className="btn-subscribe"
                          onClick={() => handleSubscribe(inst)}
                        >
                          订阅
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
        </div>
      </div>
    </div>
  )
}
