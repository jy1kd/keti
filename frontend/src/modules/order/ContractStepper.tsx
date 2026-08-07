import { useMemo } from 'react'
import { useContractsStore } from '@/stores/contracts'
import { useOrderPopupStore } from './popupStore'
import { stepMonth, stepProduct, parseInstrumentCode } from './contractStep'
import './ContractStepper.css'

interface ContractStepperProps {
  /** 当前合约代码（取弹窗/标签页当前合约） */
  instrumentID: string
  /** 选中新合约 → 同步 orderForm.instrumentID（调用方负责 setOrderForm） */
  onSelect: (code: string) => void
}

/**
 * ContractStepper — 合约步进切换（P3 ③ 参数区顶部）
 *
 * 左右箭头切相邻月份（解析代码 + 月份 ±1，跨年进位）；上下箭头切品种（同交易所品种序列）。
 * 目标合约必须存在于合约列表（月份）/ 目标品种存在可交易合约（品种）才可切换，否则箭头禁用。
 * 选中同步 `onSelect`（orderForm）；若弹窗正打开当前合约，联动 `popupStore.instrumentID`，
 * 使标题/行情订阅/盘口随合约一起切换（弹窗内步进）。期权/套利代码不可解析 → 箭头全禁用。
 */
export function ContractStepper({ instrumentID, onSelect }: ContractStepperProps) {
  const contracts = useContractsStore((s) => s.contracts)

  const parsed = useMemo(() => parseInstrumentCode(instrumentID), [instrumentID])

  // 目标代码候选：相邻月份（需存在于合约列表）/ 相邻品种（需存在可交易合约）
  const prevCode = parsed ? stepMonth(instrumentID, -1) : null
  const nextCode = parsed ? stepMonth(instrumentID, 1) : null
  const upCode = parsed ? stepProduct(instrumentID, 1, contracts) : null
  const downCode = parsed ? stepProduct(instrumentID, -1, contracts) : null

  const exists = (code: string | null) => (code ? contracts.some((c) => c.instrumentID === code) : false)
  const canPrev = prevCode !== null && exists(prevCode)
  const canNext = nextCode !== null && exists(nextCode)
  const canUp = upCode !== null
  const canDown = downCode !== null

  const select = (code: string | null) => {
    if (!code) return
    // 弹窗正打开当前合约 → 联动切换弹窗合约（标题/订阅/盘口随动）
    if (useOrderPopupStore.getState().instrumentID === instrumentID) {
      useOrderPopupStore.getState().openPopup(code)
    }
    onSelect(code)
  }

  return (
    <div className="cs" data-testid="contract-stepper">
      <button
        type="button"
        className="cs__arrow cs__arrow--up"
        data-testid="cs-up"
        aria-label="切换上一品种"
        disabled={!canUp}
        onClick={() => select(upCode)}
      >
        ▲
      </button>
      <button
        type="button"
        className="cs__arrow cs__arrow--prev"
        data-testid="cs-prev"
        aria-label="上一月份合约"
        disabled={!canPrev}
        onClick={() => select(prevCode)}
      >
        ‹
      </button>
      <span className="cs__code" data-testid="cs-code" title={instrumentID}>
        {parsed ? instrumentID : '--'}
      </span>
      <button
        type="button"
        className="cs__arrow cs__arrow--next"
        data-testid="cs-next"
        aria-label="下一月份合约"
        disabled={!canNext}
        onClick={() => select(nextCode)}
      >
        ›
      </button>
      <button
        type="button"
        className="cs__arrow cs__arrow--down"
        data-testid="cs-down"
        aria-label="切换下一品种"
        disabled={!canDown}
        onClick={() => select(downCode)}
      >
        ▼
      </button>
    </div>
  )
}
