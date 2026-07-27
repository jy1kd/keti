import { useState, useEffect } from 'react'
import { getContracts } from '../../services/api'
import type { ContractInfo } from '../../services/types'

interface ContractQueryProps {
  instrumentID: string
}

export function ContractQuery({ instrumentID }: ContractQueryProps) {
  const [contract, setContract] = useState<ContractInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!instrumentID) {
      setContract(null)
      setError(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    getContracts(instrumentID)
      .then((res) => {
        if (cancelled) return
        setContract(res.contracts?.[0] ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [instrumentID])

  if (!instrumentID) {
    return (
      <div className="contract-query">
        <div className="flow-empty">请在行情面板选择合约查看详情</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="contract-query">
        <div className="flow-empty">加载中…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="contract-query">
        <div className="flow-empty">加载失败</div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="contract-query">
        <div className="flow-empty">未找到合约 {instrumentID}</div>
      </div>
    )
  }

  return (
    <div className="contract-query">
      <div className="contract-grid">
        <div className="contract-item">
          <span className="contract-label">合约代码</span>
          <span className="contract-value">{contract.instrumentID}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">交易所</span>
          <span className="contract-value">{contract.exchangeID}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">合约名称</span>
          <span className="contract-value">{contract.instrumentName}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">品种</span>
          <span className="contract-value">{contract.productID}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">合约乘数</span>
          <span className="contract-value">{contract.volumeMultiple}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">最小变动价位</span>
          <span className="contract-value">{contract.priceTick}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">到期日</span>
          <span className="contract-value">{contract.expireDate}</span>
        </div>
        <div className="contract-item">
          <span className="contract-label">是否可交易</span>
          <span className={`contract-value ${contract.isTrading ? 'profit-positive' : 'profit-negative'}`}>
            {contract.isTrading ? '是' : '否'}
          </span>
        </div>
      </div>
    </div>
  )
}
