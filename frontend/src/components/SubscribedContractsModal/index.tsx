import type { ContractInfo } from '@/services/types'
import './index.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  contracts: ContractInfo[]
  onUnsubscribe: (instrumentID: string) => void
}

export function SubscribedContractsModal({ isOpen, onClose, contracts, onUnsubscribe }: Props) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>已订阅合约</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-table-container">
          {contracts.length === 0 ? (
            <div className="modal-empty">暂无订阅合约</div>
          ) : (
            <table className="modal-table">
              <thead>
                <tr>
                  <th>合约</th>
                  <th>名称</th>
                  <th>交易所</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((inst) => (
                  <tr key={inst.instrumentID}>
                    <td>{inst.instrumentID}</td>
                    <td>{inst.instrumentName}</td>
                    <td>{inst.exchangeID}</td>
                    <td>
                      <button
                        className="btn-unsubscribe-item"
                        onClick={() => onUnsubscribe(inst.instrumentID)}
                      >
                        退订
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <span>共 {contracts.length} 个合约</span>
        </div>
      </div>
    </div>
  )
}
