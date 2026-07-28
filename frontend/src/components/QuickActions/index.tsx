import { useState } from 'react'
import { toast } from '../Toast'
import './styles.css'

interface QuickActionsProps {
  instrumentID: string
  onReverse: (instrumentID: string) => Promise<unknown>
  onLock: (instrumentID: string) => Promise<unknown>
  onBatchCancel: () => void
}

type ActionType = 'reverse' | 'lock' | null

export function QuickActions({ instrumentID, onReverse, onLock, onBatchCancel }: QuickActionsProps) {
  const [loading, setLoading] = useState<ActionType>(null)
  const disabled = !instrumentID

  async function executeAction(
    action: ActionType,
    fn: () => Promise<unknown>,
    successMsg: string,
    errorPrefix: string
  ) {
    if (disabled || loading) return
    setLoading(action)
    try {
      const result = await fn() as { success?: boolean; message?: string; orders?: Array<{ success: boolean }> }
      // Check backend response body for failure
      if (result && typeof result === 'object') {
        if (result.success === false) {
          toast.error(`${errorPrefix}：${result.message || '未知错误'}`)
        } else if (result.orders && result.orders.length > 0 && result.orders.every(o => !o.success)) {
          toast.error(`${errorPrefix}：所有子订单均失败`)
        } else {
          toast.success(successMsg)
        }
      } else {
        toast.success(successMsg)
      }
    } catch (e: unknown) {
      const err = e as Error & { response?: { status: number } }
      if (err.response?.status === 501) {
        toast.error(`${errorPrefix}：501 后端尚未实现此功能`)
      } else {
        toast.error(`${errorPrefix}：${err.message || '未知错误'}`)
      }
    } finally {
      setLoading(null)
    }
  }

  function handleReverse() {
    executeAction('reverse', () => onReverse(instrumentID), '一键反向成功', '一键反向失败')
  }

  function handleLock() {
    executeAction('lock', () => onLock(instrumentID), '一键锁仓成功', '一键锁仓失败')
  }

  function handleBatchCancel() {
    if (disabled) return
    onBatchCancel()
  }

  return (
    <div className="quick-actions">
      <button
        type="button"
        className="qa-btn qa-reverse"
        disabled={disabled || loading !== null}
        onClick={handleReverse}
      >
        {loading === 'reverse' ? '反向中...' : '一键反向'}
      </button>
      <button
        type="button"
        className="qa-btn qa-lock"
        disabled={disabled || loading !== null}
        onClick={handleLock}
      >
        {loading === 'lock' ? '锁仓中...' : '一键锁仓'}
      </button>
      <button
        type="button"
        className="qa-btn qa-batch"
        disabled={disabled}
        onClick={handleBatchCancel}
      >
        批量撤单
      </button>
    </div>
  )
}
